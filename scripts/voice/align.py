"""Local forced alignment. stdout is a JSON-lines protocol; model logs go to stderr."""
import argparse
import contextlib
import json
import math
import os
from pathlib import Path
import sys
import unicodedata


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def normalized(text):
    return "".join(unicodedata.normalize("NFC", text).split())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request")
    parser.add_argument("--model", choices=["tiny", "base", "small", "medium"], default="small")
    parser.add_argument("--language", choices=["vi", "en"], default="vi")
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import soundfile as sf
        import stable_whisper
        import torch
        from scipy.signal import resample_poly
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        model_dir = Path(args.model_dir)
        model_dir.mkdir(parents=True, exist_ok=True)
        if not args.download and not (model_dir / (args.model + ".pt")).is_file():
            raise RuntimeError("Chưa có model voice. Chạy: npm run setup:voice -- --model " + args.model)
        model = stable_whisper.load_model(args.model, device="cpu", download_root=str(model_dir))
    if args.download:
        emit({"type": "ready", "model": args.model})
        return
    requests = json.loads(Path(args.request).read_text(encoding="utf-8"))
    for index, job in enumerate(requests):
        emit({"type": "progress", "index": index, "total": len(requests), "name": job["name"]})
        with contextlib.redirect_stdout(sys.stderr):
            samples, rate = sf.read(job["path"], dtype="float32", always_2d=True)
            audio = samples.mean(axis=1)
            duration = len(audio) / rate
            if not np.isfinite(audio).all() or np.max(np.abs(audio)) < 1e-5:
                raise RuntimeError(job["name"] + ": WAV im lặng hoặc dữ liệu âm thanh không hợp lệ.")
            if rate != 16000:
                divisor = math.gcd(rate, 16000)
                audio = resample_poly(audio, 16000 // divisor, rate // divisor).astype(np.float32)
            result = model.align(
                audio, "\n".join(job["sentences"]), language=args.language,
                original_split=True, regroup=False, suppress_silence=True,
                failure_threshold=0.15, verbose=None,
            )
        if result is None:
            raise RuntimeError(job["name"] + ": không căn được lời đọc. Kiểm tra TXT đúng lời WAV.")
        segments = result.to_dict()["segments"]
        if len(segments) != len(job["sentences"]):
            raise RuntimeError(job["name"] + ": số câu căn được không khớp TXT.")
        captions = []
        previous_end = 0
        for sentence, segment in zip(job["sentences"], segments):
            if normalized(sentence) != normalized(segment["text"]):
                raise RuntimeError(job["name"] + ": nội dung căn câu không khớp TXT.")
            start = round(max(0, segment["start"]) * 1000, 3)
            end = round(min(duration, segment["end"]) * 1000, 3)
            if not math.isfinite(start + end) or start < previous_end or end <= start:
                raise RuntimeError(job["name"] + ": mốc câu không rõ hoặc chồng lấn; kiểm tra WAV/TXT.")
            probabilities = [w["probability"] for w in segment.get("words", []) if isinstance(w.get("probability"), (int, float)) and math.isfinite(w["probability"])]
            confidence = sum(probabilities) / len(probabilities) if probabilities else None
            captions.append({"text": sentence, "startMs": start, "endMs": end,
                             "timestampMs": (start + end) / 2, "confidence": confidence})
            previous_end = end
        emit({"type": "result", "key": job["key"], "captions": captions})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit({"type": "error", "error": str(error)})
        sys.exit(1)
