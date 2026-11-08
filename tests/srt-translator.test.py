import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, "scripts")
from srt_translator import (
    BATCH_SLEEP_SEC,
    MAX_CHARS_PER_BATCH,
    RETRY_COUNT,
    RETRY_DELAY_SEC,
    SEPARATOR,
    _chunk_by_char_limit,
    _translate_batch,
    translate_srt_file,
    translate_texts,
)


class Translator:
    def __init__(self, call):
        self.call = call
        self.requests = []

    def translate(self, text):
        self.requests.append(text)
        return self.call(text)


class BatchTests(unittest.TestCase):
    def test_constants(self):
        self.assertEqual(MAX_CHARS_PER_BATCH, 3000)
        self.assertEqual(SEPARATOR, " \n@@@\n ")
        self.assertEqual(RETRY_COUNT, 3)
        self.assertEqual(RETRY_DELAY_SEC, 2)
        self.assertEqual(BATCH_SLEEP_SEC, 0.5)

    def test_batch_limit(self):
        texts = ["a" * 100 for _ in range(100)]
        batches = _chunk_by_char_limit(texts)
        self.assertEqual([i for batch in batches for i in batch], list(range(100)))
        self.assertTrue(
            all(
                len(SEPARATOR.join(texts[i] for i in batch)) <= MAX_CHARS_PER_BATCH
                for batch in batches
            )
        )

    def test_batch_one_request_and_newlines(self):
        translator = Translator(lambda text: text.replace("Hello", "Bonjour"))
        result = translate_texts(
            ["Hello\nworld", "Hello again"], translator, lambda _: None
        )
        self.assertEqual(result["translations"], ["Bonjour\nworld", "Bonjour again"])
        self.assertEqual(len(translator.requests), 1)
        self.assertEqual(result["failedIndices"], [])

    def test_malformed_separator_falls_back_after_three_attempts(self):
        translator = Translator(
            lambda text: "lost separator" if "@@@" in text else "T:" + text
        )
        sleeps = []
        result = translate_texts(["One", "Two"], translator, sleeps.append)
        self.assertEqual(result["translations"], ["T:One", "T:Two"])
        self.assertEqual(len(translator.requests), 5)
        self.assertIn(2, sleeps)
        self.assertIn(4, sleeps)
        self.assertIn(6, sleeps)

    def test_errors_retain_source_and_report_index(self):
        def call(text):
            if "@@@" in text or text == "Two":
                raise RuntimeError("429")
            return "Translated"

        translator = Translator(call)
        result = translate_texts(["One", "Two"], translator, lambda _: None)
        self.assertEqual(
            result, {"translations": ["Translated", "Two"], "failedIndices": [1]}
        )
        self.assertEqual(len(translator.requests), 7)

    def test_separator_in_source_and_long_cue(self):
        translator = Translator(lambda text: text)
        originals = ["literal @@@ separator", "x" * 7000]
        result = translate_texts(originals, translator, lambda _: None)
        self.assertEqual(result["failedIndices"], [])
        self.assertEqual(result["translations"][0], originals[0])
        self.assertTrue(
            all(len(text) <= MAX_CHARS_PER_BATCH for text in translator.requests)
        )

    def test_translate_batch_direct_and_translate_srt_file(self):
        sample_srt = (
            "1\n"
            "00:00:01,000 --> 00:00:03,500\n"
            "First line\n\n"
            "2\n"
            "00:00:04,000 --> 00:00:06,200\n"
            "Second line\n"
        )
        with tempfile.TemporaryDirectory() as tmp:
            srt_path = Path(tmp) / "Ep3.srt"
            out_dir = Path(tmp) / "out"
            srt_path.write_text(sample_srt, encoding="utf-8")

            def factory(src, tgt):
                self.assertEqual(src, "auto")
                return Translator(
                    lambda text: SEPARATOR.join(
                        f"[{tgt}]{part.strip()}"
                        for part in text.split("@@@")
                    )
                )

            outputs = translate_srt_file(
                srt_path,
                target_langs=["vi", "ja"],
                output_dir=out_dir,
                source_lang="auto",
                translator_factory=factory,
                sleep=lambda _: None,
            )
            self.assertEqual(Path(outputs["vi"]).name, "Ep3.vi.srt")
            self.assertEqual(Path(outputs["ja"]).name, "Ep3.ja.srt")
            vi_content = Path(outputs["vi"]).read_text(encoding="utf-8")
            self.assertIn("00:00:01,000 --> 00:00:03,500\n[vi]First line", vi_content)
            self.assertIn("00:00:04,000 --> 00:00:06,200\n[vi]Second line", vi_content)


if __name__ == "__main__":
    unittest.main()
