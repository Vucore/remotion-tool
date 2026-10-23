"""JSON stdin/stdout bridge; all dependencies live in the project's uv .venv."""
import json
import sys
import time


def main():
    from deep_translator import GoogleTranslator
    from deep_translator.exceptions import TooManyRequests
    import requests

    # deep-translator does not set a requests timeout itself.
    original_get = requests.get

    def bounded_get(*args, **kwargs):
        kwargs.setdefault("timeout", 25)
        return original_get(*args, **kwargs)

    requests.get = bounded_get
    data = json.load(sys.stdin)
    if data.get("action") == "languages":
        languages = GoogleTranslator().get_supported_languages(as_dict=True)
        return {"languages": [{"code": {"zh-CN": "zh", "iw": "he", "jw": "jv"}.get(code, code), "name": name} for name, code in languages.items()]}
    supported = GoogleTranslator().get_supported_languages(as_dict=True)
    aliases = {"zh": "zh-CN", "he": "iw", "jv": "jw"}
    def code(value):
        return value if value in supported.values() else aliases.get(value, value)
    translator = GoogleTranslator(source=code(data["source"]), target=code(data["target"]))
    results = []
    try:
        for text in data["texts"]:
            # Google accepts fewer than 5,000 characters per request. Split long
            # cues without changing the cue count or its timestamp.
            chunks = []
            while len(text) > 4500:
                end = max(text.rfind("\n", 0, 4500), text.rfind(" ", 0, 4500))
                if end < 1000:
                    end = 4500
                chunks.append(text[:end])
                text = text[end:].lstrip()
            chunks.append(text)
            translated = []
            for chunk in chunks:
                if not chunk.strip():
                    continue
                value = translator.translate(chunk)
                if not isinstance(value, str) or not value.strip():
                    raise ValueError("Empty translation")
                translated.append(value)
                time.sleep(0.25)
            results.append(" ".join(translated))
    except TooManyRequests:
        raise RuntimeError("Google đang giới hạn lượt dịch. Hãy đợi rồi thử lại.") from None
    return {"translations": results}


if __name__ == "__main__":
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except ImportError:
        print(json.dumps({"error": "Chưa cài thư viện dịch. Chạy npm run setup:python (uv sync)."}))
        sys.exit(1)
    except Exception as error:
        message = str(error) if isinstance(error, RuntimeError) else "Không kết nối hoặc dịch được bằng Google Translate. Kiểm tra mạng, ngôn ngữ và thử lại sau."
        print(json.dumps({"error": message}, ensure_ascii=False))
        sys.exit(1)
