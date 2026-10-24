// Immutable project data is indexed once; playback never rebuilds these arrays.
export function lastAt<T extends { from: number }>(
  items: readonly T[],
  frame: number,
) {
  let low = 0,
    high = items.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (items[mid].from <= frame) low = mid + 1;
    else high = mid;
  }
  return Math.max(0, low - 1);
}

export function visibleItems<T extends { from: number; end: number }>(
  items: readonly T[],
  from: number,
  to: number,
) {
  // Starts are ordered; include clips beginning before the viewport that cross it.
  const end = lastAt(items, to) + 1;
  return items.slice(0, end).filter((item) => item.end >= from);
}

export class PlaybackClock {
  private frame = 0;
  private listeners = new Set<() => void>();
  get = () => this.frame;
  set = (frame: number) => {
    if (this.frame === frame) return;
    this.frame = frame;
    for (const listener of this.listeners) listener();
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

const waves = new WeakMap<number[], Map<number, number[]>>();
export function waveformPeaks(source: number[], columns: number) {
  const count = Math.min(Math.max(1, Math.round(columns)), source.length);
  let levels = waves.get(source);
  if (!levels) {
    levels = new Map();
    waves.set(source, levels);
  }
  const cached = levels.get(count);
  if (cached) return cached;
  const result = Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * source.length) / count);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) * source.length) / count),
    );
    let peak = 0;
    for (let j = start; j < end; j++) peak = Math.max(peak, source[j]);
    return peak;
  });
  if (levels.size >= 5) levels.delete(levels.keys().next().value!);
  levels.set(count, result);
  return result;
}

export function proxySource(src: string, size = 960) {
  return /^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(src)
    ? `/api/proxy?src=${encodeURIComponent(src)}&size=${size}`
    : src;
}
