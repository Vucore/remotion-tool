"""LaMa logo removal. Importing this module never downloads or loads a model."""
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "lama_fp32.onnx"
_SESSION = None


def get_session(model_path=None):
    global _SESSION
    import onnxruntime as ort
    path = Path(model_path or MODEL_PATH)
    if not path.is_file():
        raise FileNotFoundError(f"Thiếu model LaMa: {path}. Đặt lama_fp32.onnx ở thư mục dự án.")
    if _SESSION is None:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        _SESSION = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
    return _SESSION


def region_pixels(region, width, height, padding=0):
    """Same floor/ceil semantics as the web preview; coordinates are normalized."""
    x = max(0, math.floor(region["x"] * width) - padding)
    y = max(0, math.floor(region["y"] * height) - padding)
    right = min(width, math.ceil((region["x"] + region["width"]) * width) + padding)
    bottom = min(height, math.ceil((region["y"] + region["height"]) * height) + padding)
    if right <= x or bottom <= y:
        raise ValueError("Vùng xóa logo không hợp lệ.")
    return x, y, right, bottom


def inpaint_array(img, region, padding=4, feather=2, context=96, session=None):
    import cv2
    import numpy as np
    height, width = img.shape[:2]
    x, y, right, bottom = region_pixels(region, width, height, padding)
    # Center a crop around the mask, rather than assuming bottom-right.
    crop_w = min(width, max(512, right-x+context*2))
    crop_h = min(height, max(512, bottom-y+context*2))
    left = max(0, min(width-crop_w, (x+right-crop_w)//2))
    top = max(0, min(height-crop_h, (y+bottom-crop_h)//2))
    crop = img[top:top+crop_h, left:left+crop_w, :3]
    mask = np.zeros((crop_h, crop_w), dtype=np.uint8)
    mask[y-top:bottom-top, x-left:right-left] = 255
    rgb = cv2.cvtColor(cv2.resize(crop, (512, 512)), cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
    mask_small = cv2.resize(mask, (512, 512), interpolation=cv2.INTER_NEAREST)
    # Preserve sub-pixel masks when a small box is downscaled into a large crop.
    sx = max(0, min(511, math.floor((x-left)*512/crop_w)))
    sy = max(0, min(511, math.floor((y-top)*512/crop_h)))
    ex = max(sx+1, min(512, math.ceil((right-left)*512/crop_w)))
    ey = max(sy+1, min(512, math.ceil((bottom-top)*512/crop_h)))
    mask_small[sy:ey, sx:ex] = 255
    model = session or get_session()
    out = model.run(None, {
        "image": np.transpose(rgb, (2, 0, 1))[None, ...],
        "mask": (mask_small[None, None, ...] > 0).astype(np.float32),
    })[0][0]
    result = np.transpose(out, (1, 2, 0))
    if not np.isfinite(result).all():
        raise ValueError("LaMa trả ảnh không hợp lệ.")
    result = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    result = cv2.resize(result, (crop_w, crop_h), interpolation=cv2.INTER_CUBIC)
    blend = mask.astype(np.float32)/255.0
    if feather:
        kernel = int(feather)*2+1
        # Blend inward: pixels outside the displayed padded region remain identical.
        blend = cv2.GaussianBlur(blend, (kernel, kernel), 0)*blend
    output = img.copy()
    output[top:top+crop_h, left:left+crop_w, :3] = np.round(result*blend[..., None]+crop*(1-blend[..., None])).astype(np.uint8)
    return output


def read_image(path):
    import cv2
    import numpy as np
    from PIL import Image, ImageOps
    with Image.open(path) as source:
        if source.width * source.height > 40_000_000:
            raise ValueError("Ảnh nguồn tối đa 40 megapixel.")
        source = ImageOps.exif_transpose(source)
        alpha = source.mode in ("RGBA", "LA") or "transparency" in source.info
        pixels = np.array(source.convert("RGBA" if alpha else "RGB"))
        return cv2.cvtColor(pixels, cv2.COLOR_RGBA2BGRA if alpha else cv2.COLOR_RGB2BGR)


def remove_logo(image_path, output_path, logo_w_ratio=0.052, logo_h_ratio=0.085,
                margin_x_ratio=0.065, margin_y_ratio=0.115, *, region=None,
                padding=4, feather=2, context=96):
    import cv2
    region = region or {"x": 1-logo_w_ratio-margin_x_ratio, "y": 1-logo_h_ratio-margin_y_ratio, "width": logo_w_ratio, "height": logo_h_ratio}
    result = inpaint_array(read_image(image_path), region, padding, feather, context)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), result):
        raise RuntimeError("Không ghi được ảnh kết quả.")
    return str(output_path)


def batch_process(input_dir, output_dir):
    for path in sorted(Path(input_dir).iterdir()):
        if path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
            remove_logo(path, Path(output_dir)/path.name)


if __name__ == "__main__":
    batch_process("input", "output")
