// Read intrinsic dimensions without downloading or decoding arbitrary media.
export function imageInfo(buffer) {
  const invalid = () => {
    throw Error("Ảnh không phải PNG, JPG hoặc WebP hợp lệ.");
  };
  let width, height, ext;
  if (
    buffer.length >= 24 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    buffer.toString("ascii", 12, 16) === "IHDR"
  ) {
    ext = "png";
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  } else if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216) {
    ext = "jpg";
    let i = 2;
    while (i + 3 < buffer.length) {
      if (buffer[i] !== 255) invalid();
      while (buffer[i] === 255) i++;
      const marker = buffer[i++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > buffer.length) invalid();
      const length = buffer.readUInt16BE(i);
      if (length < 2 || i + length > buffer.length) invalid();
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 8
      ) {
        height = buffer.readUInt16BE(i + 3);
        width = buffer.readUInt16BE(i + 5);
        break;
      }
      i += length;
    }
  } else if (
    buffer.length >= 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    ext = "webp";
    let i = 12;
    while (i + 8 <= buffer.length) {
      const kind = buffer.toString("ascii", i, i + 4),
        length = buffer.readUInt32LE(i + 4),
        start = i + 8;
      if (start + length > buffer.length) invalid();
      if (kind === "VP8X" && length >= 10) {
        width = 1 + buffer.readUIntLE(start + 4, 3);
        height = 1 + buffer.readUIntLE(start + 7, 3);
        break;
      }
      if (
        kind === "VP8 " &&
        length >= 10 &&
        buffer.subarray(start + 3, start + 6).equals(Buffer.from([157, 1, 42]))
      ) {
        width = buffer.readUInt16LE(start + 6) & 0x3fff;
        height = buffer.readUInt16LE(start + 8) & 0x3fff;
        break;
      }
      if (kind === "VP8L" && length >= 5 && buffer[start] === 0x2f) {
        const bits = buffer.readUInt32LE(start + 1);
        width = 1 + (bits & 0x3fff);
        height = 1 + ((bits >>> 14) & 0x3fff);
        break;
      }
      i = start + length + (length % 2);
    }
  }
  if (!width || !height || width > 30000 || height > 30000)
    throw Error("Không đọc được kích thước ảnh hoặc ảnh vượt quá 30.000 px.");
  return { width, height, ext };
}
