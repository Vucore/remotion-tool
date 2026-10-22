// RIFF/WAVE only: calculate the duration from complete sample frames, never file size estimates.
export function wavInfo(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 44 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  )
    throw Error("WAV không hợp lệ. Cần RIFF/WAVE PCM hoặc IEEE float.");
  const size = buffer.readUInt32LE(4) + 8;
  if (size > buffer.length || size < 44)
    throw Error("WAV bị cắt thiếu dữ liệu.");
  let format,
    dataBytes = 0,
    dataOffset = 0,
    dataChunks = 0;
  for (let offset = 12; offset + 8 <= size; ) {
    const id = buffer.toString("ascii", offset, offset + 4),
      length = buffer.readUInt32LE(offset + 4),
      start = offset + 8;
    if (start + length > size) throw Error("Chunk WAV bị cắt thiếu dữ liệu.");
    if (id === "fmt ") {
      if (format || length < 16) throw Error("WAV: fmt không hợp lệ.");
      let codec = buffer.readUInt16LE(start);
      if (codec === 0xfffe) {
        if (
          length < 40 ||
          buffer.readUInt16LE(start + 16) < 22 ||
          buffer.toString("hex", start + 26, start + 40) !==
            "000000001000800000aa00389b71"
        )
          throw Error("WAV extensible không được hỗ trợ.");
        codec = buffer.readUInt16LE(start + 24);
      }
      format = {
        codec,
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        byteRate: buffer.readUInt32LE(start + 8),
        blockAlign: buffer.readUInt16LE(start + 12),
        bits: buffer.readUInt16LE(start + 14),
      };
    } else if (id === "data") {
      dataBytes += length;
      dataOffset = start;
      dataChunks++;
    }
    offset = start + length + (length % 2);
  }
  if (!format || dataChunks !== 1 || !dataBytes)
    throw Error("WAV thiếu fmt/data hoặc chứa nhiều data chunk.");
  const { codec, channels, sampleRate, byteRate, blockAlign, bits } = format;
  if (
    ![1, 3].includes(codec) ||
    ![1, 2].includes(channels) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    !(codec === 1 ? [8, 16, 24, 32] : [32, 64]).includes(bits) ||
    blockAlign !== (channels * bits) / 8 ||
    byteRate !== sampleRate * blockAlign ||
    dataBytes % blockAlign
  )
    throw Error(
      "WAV: chỉ nhận PCM 8/16/24/32-bit hoặc float 32/64-bit, mono/stereo, 8–192 kHz.",
    );
  const duration = dataBytes / blockAlign / sampleRate;
  if (duration < 0.5 || duration > 300)
    throw Error("Mỗi WAV cần dài từ 0,5 đến 300 giây.");
  return { duration, sampleRate, channels, bits, codec, dataOffset, dataBytes };
}

export function wavEnvelope(buffer, info = wavInfo(buffer)) {
  const count = Math.ceil(info.duration * 20 - 1e-8),
    values = [];
  const samples = info.dataBytes / (info.bits / 8),
    totalFrames = samples / info.channels;
  const read = (frame, channel) => {
    const offset =
      info.dataOffset + ((frame * info.channels + channel) * info.bits) / 8;
    const v =
      info.codec === 3
        ? info.bits === 32
          ? buffer.readFloatLE(offset)
          : buffer.readDoubleLE(offset)
        : info.bits === 8
          ? (buffer.readUInt8(offset) - 128) / 128
          : info.bits === 16
            ? buffer.readInt16LE(offset) / 32768
            : info.bits === 24
              ? buffer.readIntLE(offset, 3) / 8388608
              : buffer.readInt32LE(offset) / 2147483648;
    if (!Number.isFinite(v)) throw Error("WAV chứa sample không hữu hạn.");
    return v;
  };
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * info.sampleRate) / 20),
      end = Math.min(totalFrames, Math.floor(((i + 1) * info.sampleRate) / 20));
    const stride = Math.max(1, Math.floor((end - start) / 128));
    let sum = 0,
      n = 0;
    for (let f = start; f < end; f += stride)
      for (let c = 0; c < info.channels; c++) {
        const v = read(f, c);
        sum += v * v;
        n++;
      }
    values.push(n ? Math.sqrt(sum / n) : 0);
  }
  const sorted = [...values].sort((a, b) => a - b),
    reference = Math.max(0.01, sorted[Math.floor(sorted.length * 0.95)] ?? 0);
  return {
    stepMs: 50,
    values: values.map(
      (v) =>
        Math.round(Math.max(0, Math.min(1, (v - 0.004) / reference)) * 100) /
        100,
    ),
  };
}
