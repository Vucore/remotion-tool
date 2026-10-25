import { availableParallelism, totalmem, freemem } from "node:os";
// @remotion/media rejects smaller caches (including when rendering audio).
export const MIN_MEDIA_CACHE_BYTES = 240 * 1024 ** 2;
export function normalizeMediaCacheSize(bytes) {
  return Math.max(
    MIN_MEDIA_CACHE_BYTES,
    Math.floor(Number.isFinite(bytes) ? bytes : 256 * 1024 ** 2),
  );
}
export function renderBudget(
  mode,
  memory = totalmem(),
  cpus = availableParallelism(),
  free = freemem(),
) {
  const gib = 1024 ** 3;
  const available = Math.max(0, Math.min(memory, free));
  const memorySlots = Math.max(1, Math.floor((available - gib) / (1.5 * gib)));
  return {
    concurrency:
      mode === "fast"
        ? Math.max(
            1,
            Math.min(
              4,
              Math.floor(cpus / 2),
              Math.floor(memory / (4 * gib)),
              memorySlots,
            ),
          )
        : 1,
    mediaCacheSizeInBytes: normalizeMediaCacheSize(
      Math.min(
        mode === "fast" ? 768 * 1024 ** 2 : 256 * 1024 ** 2,
        memory / 16,
        available / 4,
      ),
    ),
  };
}
