"""Small local image helper, using the project's shared uv environment."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000
source, destination, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
with Image.open(source) as raw:
    width, height = raw.size
    if width * height > 40_000_000 or max(width, height) > 30000:
        raise ValueError("Ảnh vượt giới hạn 40 megapixel / 30.000px")
    if destination == "-":
        if raw.getexif().get(274, 1) in (5, 6, 7, 8):
            width, height = height, width
        print(json.dumps({"width": width, "height": height}))
        sys.exit(0)
    oriented = ImageOps.exif_transpose(raw)
    width, height = oriented.size
    if destination != "-":
        oriented.thumbnail((size, size), Image.Resampling.LANCZOS)
        image = oriented.convert("RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB")
        Path(destination).parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="WEBP", quality=90, method=3)
    print(json.dumps({"width": width, "height": height}))
