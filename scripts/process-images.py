"""One batch per process; JSON events on stdout, no automatic model downloads."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def main():
    try:
        import cv2
        from delete_logo import read_image, inpaint_array, get_session
        request = json.load(sys.stdin)
        settings = request["settings"]
        if settings["removeLogo"]:
            get_session()  # Fail early before writing any outputs.
        if settings["upscale"]:
            from image_upscaler import _get_model, _enhance_image, get_device, _MODEL_CACHE
            device = get_device() if settings["device"] == "auto" else settings["device"]
            try:
                _get_model(settings["scale"], device)
            except RuntimeError:
                if settings["device"] != "auto" or device == "cpu":
                    raise
                device = "cpu"
                _get_model(settings["scale"], device)
        else:
            device = "cpu"
        emit({"type": "ready", "device": device})
    except ImportError:
        raise RuntimeError("Thiếu thư viện xử lý ảnh. Chạy uv sync trong dự án rồi khởi động lại server.") from None
    for index, task in enumerate(request["tasks"]):
        try:
            emit({"type": "progress", "index": index, "message": f"Đang xử lý {index+1}/{len(request['tasks'])} · {task['name']}"})
            image = read_image(task["input"])
            height, width = image.shape[:2]
            scale = settings["scale"] if settings["upscale"] else 1
            if width*height*scale*scale > 40_000_000 or max(width,height)*scale > 30000:
                raise ValueError("Ảnh kết quả tối đa 40 megapixel và 30.000 px mỗi chiều. Giảm hệ số upscale.")
            if settings["removeLogo"]:
                image = inpaint_array(image, settings["region"], settings["padding"], settings["feather"], settings["context"])
            if settings["upscale"]:
                try:
                    image = _enhance_image(image, _get_model(settings["scale"], device), settings["scale"], device, settings["tile"])
                except RuntimeError:
                    if settings["device"] != "auto" or device == "cpu":
                        raise
                    emit({"type": "progress", "index": index, "message": "Thiết bị tăng tốc không xử lý được; chuyển sang CPU…"})
                    _MODEL_CACHE.clear()
                    import gc
                    import torch
                    gc.collect()
                    if device == "mps":
                        torch.mps.empty_cache()
                    elif device == "cuda":
                        torch.cuda.empty_cache()
                    device = "cpu"
                    image = _enhance_image(image, _get_model(settings["scale"], device), settings["scale"], device, settings["tile"])
            if not cv2.imwrite(task["output"], image, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
                raise RuntimeError("Không lưu được ảnh kết quả.")
            emit({"type": "result", "index": index})
        except Exception as error:
            emit({"type": "error", "index": index, "error": str(error)[:600]})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit({"type": "fatal", "error": str(error)[:600]})
        sys.exit(1)
