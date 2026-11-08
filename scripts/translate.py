"""JSON stdin/stdout bridge; all dependencies live in the project's uv .venv."""
import json
import sys


def main():
    from deep_translator import GoogleTranslator
    from deep_translator.exceptions import TooManyRequests
    import requests

    # deep-translator does not set a requests timeout itself.
    original_get = requests.get

    def bounded_get(*args, **kwargs):
        kwargs.setdefault("timeout", 25)
        response = original_get(*args, **kwargs)
        if response.status_code == 429 or "/sorry/" in getattr(response, "url", ""):
            raise TooManyRequests()
        return response

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
    from srt_translator import translate_texts
    return translate_texts(data["texts"], translator)



if __name__ == "__main__":
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except ImportError:
        print(json.dumps({"error": "Chưa cài thư viện dịch. Chạy npm run setup:python (uv sync).", "code": "SETUP"}))
        sys.exit(1)
    except Exception as error:
        import requests
        from deep_translator.exceptions import RequestError, TooManyRequests, TranslationNotFound
        code = "RATE_LIMIT" if isinstance(error, (RuntimeError, TooManyRequests)) else "NETWORK" if isinstance(error, (requests.exceptions.RequestException, RequestError)) else "PROVIDER_RESPONSE" if isinstance(error, TranslationNotFound) else "TRANSLATION"
        message = str(error) if isinstance(error, RuntimeError) else "Google đang giới hạn lượt dịch. Hãy đợi rồi thử lại." if code == "RATE_LIMIT" else "Không kết nối được Google Translate." if code == "NETWORK" else "Google không trả bản dịch hợp lệ. Hãy thử lại sau." if code == "PROVIDER_RESPONSE" else "Không dịch được. Kiểm tra ngôn ngữ và nội dung phụ đề."
        print(json.dumps({"error": message, "code": code}, ensure_ascii=False))
        sys.exit(1)
