"""SRT subtitle batch translator using srt parser and deep-translator GoogleTranslator."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
import re
import time
from typing import Callable, Iterable

try:
    import srt  # type: ignore
except ImportError:
    _TIMECODE_RE = re.compile(
        r"^(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{3})\s+-->\s+(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{3})(?:[ \t]+.*)?$"
    )

    def _parse_timedelta(h: str, m: str, s: str, ms: str) -> timedelta:
        return timedelta(
            hours=int(h), minutes=int(m), seconds=int(s), milliseconds=int(ms)
        )

    def _format_timedelta(td: timedelta) -> str:
        total_ms = max(0, int(round(td.total_seconds() * 1000)))
        hours, rem = divmod(total_ms, 3_600_000)
        minutes, rem = divmod(rem, 60_000)
        seconds, millis = divmod(rem, 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

    @dataclass
    class _Subtitle:
        index: int
        start: timedelta
        end: timedelta
        content: str
        proprietary: str = ""

        def to_srt(self, strict: bool = True, eol: str = "\n") -> str:
            content = self.content
            if strict:
                content = re.sub(r"\r\n?", "\n", content)
                content = re.sub(r"\n[ \t]*\n+", "\n", content).strip("\n")
            lines = [
                str(self.index),
                f"{_format_timedelta(self.start)} --> {_format_timedelta(self.end)}",
                content,
            ]
            return eol.join(lines) + eol

    class _SrtFallbackModule:
        Subtitle = _Subtitle

        @staticmethod
        def parse(srt_text: str):
            cleaned = srt_text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n").strip()
            if not cleaned:
                return
            blocks = re.split(r"\n[ \t]*\n+", cleaned)
            for fallback_idx, block in enumerate(blocks, start=1):
                lines = block.split("\n")
                if not lines:
                    continue
                first = lines[0].strip()
                if first.isdigit():
                    idx = int(first)
                    lines = lines[1:]
                else:
                    idx = fallback_idx
                if not lines:
                    raise ValueError(f"Missing timecode at subtitle {idx}")
                match = _TIMECODE_RE.match(lines[0].strip())
                if not match:
                    raise ValueError(f"Invalid timecode at subtitle {idx}: {lines[0]}")
                start = _parse_timedelta(match.group(1), match.group(2), match.group(3), match.group(4))
                end = _parse_timedelta(match.group(5), match.group(6), match.group(7), match.group(8))
                content = "\n".join(lines[1:]).strip("\n")
                yield _Subtitle(index=idx, start=start, end=end, content=content)

        @staticmethod
        def compose(
            subtitles: Iterable[_Subtitle],
            reindex: bool = True,
            start_index: int = 1,
            strict: bool = True,
            eol: str = "\n",
        ) -> str:
            out = []
            for offset, sub in enumerate(subtitles):
                index = (start_index + offset) if reindex else sub.index
                item = _Subtitle(
                    index=index,
                    start=sub.start,
                    end=sub.end,
                    content=sub.content,
                    proprietary=getattr(sub, "proprietary", ""),
                )
                out.append(item.to_srt(strict=strict, eol=eol))
            return eol.join(out)

    srt = _SrtFallbackModule()

MAX_CHARS_PER_BATCH = 3000
SEPARATOR = " \n@@@\n "
RETRY_COUNT = 3
RETRY_DELAY_SEC = 2
BATCH_SLEEP_SEC = 0.5


def _chunk_by_char_limit(
    texts: list[str], max_chars: int = MAX_CHARS_PER_BATCH
) -> list[list[int]]:
    """Group consecutive subtitle indices into batches within max_chars (including SEPARATOR)."""
    batches: list[list[int]] = []
    current: list[int] = []
    size = 0
    sep_len = len(SEPARATOR)
    for index, text in enumerate(texts):
        extra = len(text) + (sep_len if current else 0)
        if current and size + extra > max_chars:
            batches.append(current)
            current = []
            size = 0
        current.append(index)
        size += len(text) + (sep_len if len(current) > 1 else 0)
    if current:
        batches.append(current)
    return batches


def _translate_batch(
    texts: list[str],
    translator,
    sleep: Callable[[float], None] = time.sleep,
    failed_indices: list[int] | None = None,
    _request_fn: Callable[[str], str] | None = None,
) -> list[str]:
    """Translate a batch of subtitle strings with 2-tier protection:
    Tier 1: Batch translation joined by SEPARATOR with up to RETRY_COUNT retries.
    Tier 2: Line-by-line fallback with up to RETRY_COUNT retries per line; retains source on failure.
    """
    if not texts:
        return []

    def do_request(payload: str) -> str:
        if _request_fn is not None:
            return _request_fn(payload)
        value = translator.translate(payload)
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Empty translation")
        return value.strip()

    def retry_call(call: Callable[[], str]) -> str | None:
        for attempt in range(RETRY_COUNT):
            try:
                return call()
            except Exception:
                sleep(RETRY_DELAY_SEC * (attempt + 1))
        return None

    # Tier 1 — Batch Translation
    joined = SEPARATOR.join(texts)
    can_batch = (
        len(texts) > 1
        and all("@@@" not in text for text in texts)
        and len(joined) <= MAX_CHARS_PER_BATCH
    )
    if can_batch:
        for attempt in range(RETRY_COUNT):
            try:
                translated = do_request(joined)
                parts = [p.strip() for p in re.split(r"\s*@@@\s*", translated.strip())]
                if len(parts) == len(texts) and all(parts):
                    return parts
            except Exception:
                pass
            sleep(RETRY_DELAY_SEC * (attempt + 1))

    # Tier 2 — Fallback Line-by-Line
    def translate_single_line(text: str) -> str | None:
        chunks = [
            text[i : i + MAX_CHARS_PER_BATCH]
            for i in range(0, max(1, len(text)), MAX_CHARS_PER_BATCH)
        ]
        translated_chunks: list[str] = []
        for chunk in chunks:
            value = retry_call(lambda c=chunk: do_request(c))
            if value is None:
                return None
            translated_chunks.append(value)
        return " ".join(translated_chunks)

    results: list[str] = []
    for idx, text in enumerate(texts):
        translated_line = translate_single_line(text)
        if translated_line is None:
            if failed_indices is not None:
                failed_indices.append(idx)
            translated_line = text
        results.append(translated_line)
    return results


def translate_texts(
    texts: list[str],
    translator,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, list]:
    """Translate list of subtitle cue texts in batches; return translations and failedIndices."""
    result = list(texts)
    failed: list[int] = []
    requests_made = 0

    def request_with_pacing(payload: str) -> str:
        nonlocal requests_made
        if requests_made:
            sleep(BATCH_SLEEP_SEC)
        requests_made += 1
        value = translator.translate(payload)
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Empty translation")
        return value.strip()

    batches = _chunk_by_char_limit(texts)
    for indexes in batches:
        originals = [texts[i] for i in indexes]
        local_failed: list[int] = []
        parts = _translate_batch(
            originals,
            translator,
            sleep=sleep,
            failed_indices=local_failed,
            _request_fn=request_with_pacing,
        )
        for local_idx in local_failed:
            failed.append(indexes[local_idx])
        for index, value in zip(indexes, parts):
            result[index] = value

    return {"translations": result, "failedIndices": failed}


def translate_srt_file(
    srt_path: str | Path,
    target_langs: Iterable[str] | str,
    output_dir: str | Path | None = None,
    source_lang: str = "auto",
    translator_factory: Callable[[str, str], object] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, str]:
    """Read an .srt file, translate its subtitle cues in batches across target_langs,
    preserve original index/start/end timecodes, and write <stem>.<lang>.srt files.
    """
    input_path = Path(srt_path)
    out_dir = Path(output_dir) if output_dir is not None else input_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    if isinstance(target_langs, str):
        langs = [target_langs]
    else:
        langs = list(target_langs)

    # Step 1: Read UTF-8 .srt and parse into Subtitle objects
    raw_srt = input_path.read_text(encoding="utf-8-sig")
    subs = list(srt.parse(raw_srt))
    texts = [s.content for s in subs]

    # Step 2: Split into batches by character limit
    batches = _chunk_by_char_limit(texts)

    if translator_factory is None:
        from deep_translator import GoogleTranslator

        def default_factory(src: str, tgt: str):
            return GoogleTranslator(source=src, target=tgt)

        translator_factory = default_factory

    output_files: dict[str, str] = {}

    # Step 3: Translate batch-by-batch with 2-tier fallback for each target language
    for lang in langs:
        translator = translator_factory(source_lang, lang)
        translated_texts = list(texts)
        for batch_idx, batch_indices in enumerate(batches):
            batch_texts = [texts[i] for i in batch_indices]
            translated_batch = _translate_batch(
                batch_texts, translator, sleep=sleep
            )
            for idx, translated_line in zip(batch_indices, translated_batch):
                translated_texts[idx] = translated_line
            if batch_idx < len(batches) - 1:
                sleep(BATCH_SLEEP_SEC)

        # Step 4: Reconstruct srt.Subtitle list and compose output .srt
        new_subs = [
            srt.Subtitle(
                index=s.index,
                start=s.start,
                end=s.end,
                content=translated_texts[i],
            )
            for i, s in enumerate(subs)
        ]
        composed = srt.compose(new_subs, reindex=False)
        out_path = out_dir / f"{input_path.stem}.{lang}.srt"
        out_path.write_text(composed, encoding="utf-8")
        output_files[lang] = str(out_path)

    return output_files
