"""
image_upscaler.py
------------------
Upscale ảnh (vd. 1K -> 2K) bằng AI super-resolution (Real-ESRGAN),
kiểu tương tự tính năng "Upscale" của Google Flow.

Tự động chọn thiết bị chạy: CUDA (Google Colab GPU) > MPS (MacBook Apple
Silicon) > CPU.

Cài đặt:
    # Cài đặt PyTorch và torchvision trong venv:
    uv pip install torch torchvision

Dùng như module:
    from image_upscaler import upscale_image, upscale_folder

    upscale_image("scene_01.png", "scene_01_2k.png", scale=2)
    upscale_folder("keyframes/", "keyframes_2k/", scale=2)

Dùng như CLI:
    python image_upscaler.py scene_01.png -o scene_01_2k.png
    python image_upscaler.py keyframes/ -o keyframes_2k/ --scale 2
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional
from urllib.request import urlopen
import os
import uuid

logger = logging.getLogger("image_upscaler")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Kiến trúc RRDBNet thuần PyTorch (không cần cài basicsr / realesrgan / facexlib)
# ---------------------------------------------------------------------------
class ResidualDenseBlock(nn.Module):
    def __init__(self, num_feat: int = 64, num_grow_ch: int = 32):
        super().__init__()
        self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
        self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, num_feat: int = 64, num_grow_ch: int = 32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.rdb1(x)
        out = self.rdb2(out)
        out = self.rdb3(out)
        return out * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(
        self,
        num_in_ch: int = 3,
        num_out_ch: int = 3,
        scale: int = 2,
        num_feat: int = 64,
        num_block: int = 23,
        num_grow_ch: int = 32,
    ):
        super().__init__()
        self.scale = scale
        self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.scale == 2:
            feat = F.pixel_unshuffle(x, downscale_factor=2)
        else:
            feat = x
        feat = self.conv_first(feat)
        body_feat = self.conv_body(self.body(feat))
        feat = feat + body_feat
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        out = self.conv_last(self.lrelu(self.conv_hr(feat)))
        return out


# Model khớp đúng hệ số nhân (2x cho 1K -> 2K, 4x nếu muốn phóng to hơn nữa)
MODEL_CONFIGS = {
    2: dict(
        name="RealESRGAN_x2plus",
        num_in_ch=12,
        url="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
    ),
    4: dict(
        name="RealESRGAN_x4plus",
        num_in_ch=3,
        url="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
    ),
}

WEIGHTS_DIR = Path(__file__).parent / ".cache" / "models" / "realesrgan"


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _ensure_weights(scale: int) -> Path:
    cfg = MODEL_CONFIGS[scale]
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    path = WEIGHTS_DIR / f"{cfg['name']}.pth"
    legacy = Path(__file__).parent / "weights" / path.name
    if not path.exists() and legacy.exists():
        return legacy
    if not path.exists():
        raise FileNotFoundError(f"Thiếu {path.name}. Chạy npm run setup:images -- --scale {scale} để tải model.")
    return path


def download_weights(scale):
    cfg = MODEL_CONFIGS[scale]
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    path = WEIGHTS_DIR / f"{cfg['name']}.pth"
    if path.exists():
        return path
    temporary = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
    try:
        with urlopen(cfg["url"], timeout=30) as response, temporary.open("wb") as target:
            size = 0
            while chunk := response.read(1024*1024):
                size += len(chunk)
                if size > 120*1024*1024:
                    raise RuntimeError("Trọng số tải về vượt giới hạn 120 MB.")
                target.write(chunk)
        if size < 1_000_000:
            raise RuntimeError("File model tải về không hợp lệ.")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


_MODEL_CACHE: dict = {}


def _get_model(scale: int, device: Optional[str] = None) -> nn.Module:
    dev = device or get_device()
    cache_key = (scale, dev)
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    if scale not in MODEL_CONFIGS:
        raise ValueError(f"scale={scale} chưa hỗ trợ. Chỉ hỗ trợ: {list(MODEL_CONFIGS)}")

    cfg = MODEL_CONFIGS[scale]
    weights_path = _ensure_weights(scale)
    model = RRDBNet(
        num_in_ch=cfg["num_in_ch"],
        num_out_ch=3,
        scale=scale,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
    )

    state_dict = torch.load(weights_path, map_location="cpu", weights_only=True)
    if "params_ema" in state_dict:
        state_dict = state_dict["params_ema"]
    elif "params" in state_dict:
        state_dict = state_dict["params"]

    model.load_state_dict(state_dict, strict=True)
    model.eval()
    model.to(torch.device(dev))

    _MODEL_CACHE[cache_key] = model
    return model


import cv2
import numpy as np


def _tile_process(
    img_tensor: torch.Tensor, model: nn.Module, scale: int, tile: int = 512, tile_pad: int = 10
) -> torch.Tensor:
    """Xử lý ảnh theo từng tile nhỏ để tiết kiệm RAM/VRAM."""
    batch, channel, height, width = img_tensor.shape
    output_height = height * scale
    output_width = width * scale
    output = img_tensor.new_zeros((batch, channel, output_height, output_width))

    tiles_x = (width + tile - 1) // tile
    tiles_y = (height + tile - 1) // tile

    for y in range(tiles_y):
        for x in range(tiles_x):
            x_start = x * tile
            x_end = min(x_start + tile, width)
            y_start = y * tile
            y_end = min(y_start + tile, height)

            x_start_pad = max(x_start - tile_pad, 0)
            x_end_pad = min(x_end + tile_pad, width)
            y_start_pad = max(y_start - tile_pad, 0)
            y_end_pad = min(y_end + tile_pad, height)

            in_tile = img_tensor[:, :, y_start_pad:y_end_pad, x_start_pad:x_end_pad]
            out_tile = model(in_tile)

            out_x_start = (x_start - x_start_pad) * scale
            out_x_end = out_x_start + (x_end - x_start) * scale
            out_y_start = (y_start - y_start_pad) * scale
            out_y_end = out_y_start + (y_end - y_start) * scale

            output[
                :,
                :,
                y_start * scale : y_end * scale,
                x_start * scale : x_end * scale,
            ] = out_tile[:, :, out_y_start:out_y_end, out_x_start:out_x_end]

    return output


def _enhance_image(
    img: np.ndarray, model: nn.Module, scale: int, device: str, tile: int = 0
) -> np.ndarray:
    """Phóng to và nâng cao độ nét ảnh qua mạng RRDBNet."""
    has_alpha = img.ndim == 3 and img.shape[2] == 4
    if has_alpha:
        alpha = img[:, :, 3]
        img_bgr = img[:, :, :3]
    else:
        alpha = None
        img_bgr = img if img.ndim == 3 else np.stack([img] * 3, axis=-1)

    h, w, _ = img_bgr.shape
    # x2 RRDB uses pixel_unshuffle: the input and all tile origins must be even.
    pad_h, pad_w = (2-h%2)%2, (2-w%2)%2
    if pad_h or pad_w:
        img_bgr = cv2.copyMakeBorder(img_bgr, 0, pad_h, 0, pad_w, cv2.BORDER_REPLICATE)
    if tile:
        tile = max(64, int(tile)//2*2)
    img_tensor = (
        torch.from_numpy(np.transpose(img_bgr[:, :, [2, 1, 0]], (2, 0, 1)))
        .float()
        .unsqueeze(0)
        / 255.0
    )
    dev = torch.device(device)
    img_tensor = img_tensor.to(dev)

    with torch.no_grad():
        if tile <= 0 or (h <= tile and w <= tile):
            out_tensor = model(img_tensor)
        else:
            out_tensor = _tile_process(img_tensor, model, scale, tile=tile, tile_pad=10)

    out_np = (
        out_tensor.squeeze(0).clamp(0, 1).mul(255).byte().permute(1, 2, 0).cpu().numpy()
    )
    out_bgr = out_np[:h*scale, :w*scale, [2, 1, 0]]

    if has_alpha:
        alpha_resized = cv2.resize(
            alpha, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4
        )
        out_bgr = np.dstack([out_bgr, alpha_resized])

    return out_bgr



def _save_image(output_path: str, img: np.ndarray, quality: int = 95) -> None:
    """Lưu ảnh với chất lượng nén tối ưu theo định dạng file."""
    suffix = Path(output_path).suffix.lower()
    params = []
    if suffix in {".jpg", ".jpeg"}:
        # Quality 95: Giảm ~80% dung lượng mà giữ trọn độ nét
        params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    elif suffix == ".webp":
        params = [cv2.IMWRITE_WEBP_QUALITY, quality]
    elif suffix == ".png":
        params = [cv2.IMWRITE_PNG_COMPRESSION, 4]

    if not cv2.imwrite(output_path, img, params):
        raise RuntimeError("Không ghi được ảnh upscale.")


def upscale_image(
    input_path: str,
    output_path: Optional[str] = None,
    scale: int = 2,
    device: Optional[str] = None,
    tile: int = 0,
    quality: int = 95,
    output_format: Optional[str] = None,
) -> str:
    """
    Upscale một ảnh (vd 1K -> 2K khi scale=2).

    Args:
        input_path: đường dẫn ảnh gốc.
        output_path: đường dẫn lưu kết quả (mặc định: thêm hậu tố _<scale>x).
        scale: hệ số phóng to, 2 hoặc 4 (2 = đúng nhu cầu 1K -> 2K).
        device: "cuda" | "mps" | "cpu" | None (tự động chọn).
        tile: chia ảnh thành tile để giảm dùng RAM/VRAM (0 = không chia,
              dùng vd 256-512 nếu bị hết bộ nhớ trên máy yếu / CPU).
        quality: chất lượng nén JPEG/WebP (1-100, mặc định 95 rất nét và nhẹ).
        output_format: ép định dạng xuất ("jpeg" | "png" | "webp" | None).

    Returns:
        đường dẫn file ảnh kết quả.
    """
    in_path = Path(input_path)
    if not in_path.exists():
        raise FileNotFoundError(f"Không tìm thấy ảnh: {input_path}")

    ext = f".{output_format.lower().lstrip('.')}" if output_format else in_path.suffix
    if output_format and output_format.lower() == "jpg":
        ext = ".jpeg"

    if output_path is None:
        output_path = str(in_path.with_name(f"{in_path.stem}_{scale}x{ext}"))
    elif output_format and not Path(output_path).suffix:
        # Nếu output_path là thư mục hoặc không có đuôi
        output_path = str(Path(output_path) / f"{in_path.stem}_{scale}x{ext}")
    elif output_format:
        # Đổi đuôi file của output_path theo format được chọn
        output_path = str(Path(output_path).with_suffix(ext))

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    from delete_logo import read_image
    img = read_image(in_path)
    if img is None:
        raise ValueError(f"Không đọc được ảnh (định dạng lỗi?): {input_path}")

    dev = device or get_device()
    model = _get_model(scale=scale, device=dev)
    output = _enhance_image(img, model, scale=scale, device=dev, tile=tile)

    _save_image(output_path, output, quality=quality)
    logger.info(
        "Đã lưu: %s (%dx%d -> %dx%d)",
        output_path,
        img.shape[1],
        img.shape[0],
        output.shape[1],
        output.shape[0],
    )
    return output_path


def upscale_folder(
    input_dir: str,
    output_dir: str,
    scale: int = 2,
    device: Optional[str] = None,
    tile: int = 0,
    quality: int = 95,
    output_format: Optional[str] = None,
) -> list:
    """Upscale toàn bộ ảnh trong một thư mục (dùng cho batch trong pipeline)."""
    in_dir = Path(input_dir)
    files = sorted(p for p in in_dir.iterdir() if p.suffix.lower() in IMG_EXTS)
    results = []
    ext = f".{output_format.lower().lstrip('.')}" if output_format else None
    if output_format and output_format.lower() == "jpg":
        ext = ".jpeg"

    for i, f in enumerate(files, start=1):
        logger.info("[%d/%d] %s", i, len(files), f.name)
        out_name = f"{f.stem}{ext}" if ext else f.name
        out_path = Path(output_dir) / out_name
        try:
            results.append(
                upscale_image(
                    str(f),
                    str(out_path),
                    scale=scale,
                    device=device,
                    tile=tile,
                    quality=quality,
                    output_format=output_format,
                )
            )
        except Exception as e:
            logger.error("Lỗi khi xử lý %s: %s", f.name, e)
    return results


def _main():
    parser = argparse.ArgumentParser(description="Upscale ảnh (1K -> 2K) bằng Real-ESRGAN.")
    parser.add_argument("input", help="File ảnh hoặc thư mục ảnh đầu vào")
    parser.add_argument("-o", "--output", default=None, help="File hoặc thư mục lưu kết quả")
    parser.add_argument("--scale", type=int, default=2, choices=[2, 4], help="Hệ số phóng to (mặc định 2 = 1K->2K)")
    parser.add_argument(
        "--format",
        default="jpeg",
        choices=["jpeg", "jpg", "png", "webp", "same"],
        help="Định dạng xuất: 'jpeg' (95%% siêu nét & nhẹ, mặc định), 'png' (bản gốc Lossless 100%%), 'same' (giữ đuôi gốc)",
    )
    parser.add_argument("--quality", type=int, default=95, help="Chất lượng nén JPEG/WebP 1-100 (mặc định 95)")
    parser.add_argument("--device", default=None, choices=["cuda", "mps", "cpu"], help="Ép chạy trên thiết bị cụ thể")
    parser.add_argument("--tile", type=int, default=0, help="Kích thước tile nếu bị hết bộ nhớ (vd 256, 512)")
    args = parser.parse_args()

    fmt = None if args.format == "same" else args.format

    in_path = Path(args.input)
    if in_path.is_dir():
        out_dir = args.output or f"{in_path}_{args.scale}x"
        results = upscale_folder(
            str(in_path),
            out_dir,
            scale=args.scale,
            device=args.device,
            tile=args.tile,
            quality=args.quality,
            output_format=fmt,
        )
        print(f"\nHoàn tất: {len(results)} ảnh -> {out_dir}")
    else:
        out_path = upscale_image(
            str(in_path),
            args.output,
            scale=args.scale,
            device=args.device,
            tile=args.tile,
            quality=args.quality,
            output_format=fmt,
        )
        print(f"\nHoàn tất: {out_path}")


if __name__ == "__main__":
    sys.exit(_main() or 0)