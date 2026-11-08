export const MAX_VIDEO_OVERLAYS = 100;
export type VideoOverlay = {
  id: string;
  name: string;
  src: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceDuration: number;
  start: number;
  duration: number;
  trimStart: number;
  x: number;
  y: number;
  width: number;
  opacity: number;
  muted: boolean;
  chromaKey: boolean;
  keyColor: string;
  similarity: number;
  smoothness: number;
  spillSuppression: number;
};

export const TRANSPARENT_GREEN_SCREEN = {
  chromaKey: true,
  keyColor: "#00ff00",
  similarity: 0.22,
  smoothness: 0.03,
  spillSuppression: 1,
} as const;

export function videoOverlayKeyParams(layer: VideoOverlay) {
  // A softness wider than the threshold leaves even the key color translucent.
  // Keep a fully transparent interior, including for previously saved clips.
  const similarity = Math.max(1 / 255, layer.similarity);
  return {
    keyColor: layer.keyColor,
    similarity,
    smoothness: Math.min(layer.smoothness, similarity / 2),
    spillSuppression: layer.spillSuppression,
  };
}

export function greenScreenColor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  // Sample the border, where a greenscreen is less likely to contain graphics.
  // Use the dominant bucket so compression noise and a corner logo do not win.
  const buckets = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();
  let sampled = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (
        x >= width * 0.1 &&
        x < width * 0.9 &&
        y >= height * 0.1 &&
        y < height * 0.9
      )
        continue;
      sampled++;
      const i = (y * width + x) * 4;
      const [r, g, b, a] = pixels.subarray(i, i + 4);
      if (a < 128 || g < 60 || g < r * 1.2 || g < b * 1.2) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant || dominant.count < sampled * 0.1) return null;
  return `#${[dominant.r, dominant.g, dominant.b]
    .map((sum) =>
      Math.round(sum / dominant.count)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function parseVideoOverlays(value: unknown): VideoOverlay[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_VIDEO_OVERLAYS)
    throw Error(`Tối đa ${MAX_VIDEO_OVERLAYS} lần xuất hiện MP4.`);
  const numeric = (value: unknown, min: number, max: number) => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw Error("Kích thước, vị trí hoặc thời gian lớp video không hợp lệ.");
    return value;
  };
  const items = value.map((item): VideoOverlay => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      item.id.length > 100 ||
      typeof item.name !== "string" ||
      !item.name ||
      item.name.length > 500 ||
      typeof item.src !== "string" ||
      !/^\/media\/[a-zA-Z0-9_-]+\.mp4$/.test(item.src) ||
      typeof item.keyColor !== "string" ||
      !/^#[a-f0-9]{6}$/i.test(item.keyColor) ||
      typeof item.muted !== "boolean" ||
      typeof item.chromaKey !== "boolean"
    )
      throw Error("Lớp video không hợp lệ. Hãy nhập MP4 từ công cụ.");
    const sourceDuration = numeric(item.sourceDuration, 0.01, 36000);
    const trimStart = numeric(item.trimStart, 0, sourceDuration - 0.001);
    return {
      id: item.id,
      name: item.name,
      src: item.src,
      sourceWidth: numeric(item.sourceWidth, 1, 7680),
      sourceHeight: numeric(item.sourceHeight, 1, 7680),
      sourceDuration,
      trimStart,
      start: numeric(item.start, 0, 36000),
      duration: numeric(
        item.duration,
        0.001,
        sourceDuration - trimStart + 0.001,
      ),
      x: numeric(item.x, 0, 100),
      y: numeric(item.y, 0, 100),
      width: numeric(item.width, 1, 200),
      opacity: numeric(item.opacity, 0, 1),
      muted: item.muted,
      chromaKey: item.chromaKey,
      keyColor: item.keyColor,
      similarity: numeric(item.similarity, 0, 1),
      smoothness: numeric(item.smoothness, 0, 1),
      spillSuppression: numeric(item.spillSuppression, 0, 1),
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw Error("ID lớp video bị trùng.");
  return items;
}

export function parseOverlayTime(value: string, maxSeconds: number): number {
  const parts = value.trim().replace(",", ".").split(":");
  if (
    !parts.length ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part)) ||
    parts.slice(0, -1).some((part) => part.includes(".")) ||
    parts.slice(1).some((part) => Number(part) >= 60)
  )
    throw Error("Nhập số giây hoặc phút:giây, ví dụ 90 hoặc 1:30.");
  const seconds = parts.reduce((sum, part) => sum * 60 + Number(part), 0);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > maxSeconds)
    throw Error(
      `Thời điểm cần nằm trong video: 0–${maxSeconds.toFixed(2)} giây.`,
    );
  return seconds;
}

export function duplicateVideoOverlay(
  layers: VideoOverlay[],
  sourceId: string,
  start: number,
): VideoOverlay[] {
  if (layers.length >= MAX_VIDEO_OVERLAYS)
    throw Error(`Tối đa ${MAX_VIDEO_OVERLAYS} lần xuất hiện MP4.`);
  const source = layers.find((layer) => layer.id === sourceId);
  if (!source) throw Error("Chọn clip cần thêm lần xuất hiện.");
  return parseVideoOverlays([
    ...layers,
    { ...source, id: crypto.randomUUID(), start },
  ]);
}
