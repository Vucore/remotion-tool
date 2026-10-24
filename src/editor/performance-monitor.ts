// Opt-in diagnostics: no media, script text or filenames are collected.
export function installPerformanceMonitor() {
  if (!new URLSearchParams(location.search).has("perf")) return;
  const samples = {
    longTasks: [] as number[],
    interactionMs: [] as number[],
    frameGapsMs: [] as number[],
    startedAt: new Date().toISOString(),
  };
  const push = (list: number[], value: number) => {
    list.push(Math.round(value * 100) / 100);
    if (list.length > 10000) list.shift();
  };
  const observer =
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes.includes("longtask")
      ? new PerformanceObserver((entries) =>
          entries
            .getEntries()
            .forEach((entry) => push(samples.longTasks, entry.duration)),
        )
      : null;
  observer?.observe({ type: "longtask", buffered: true });
  let previous = performance.now();
  const tick = (now: number) => {
    if (document.visibilityState === "visible")
      push(samples.frameGapsMs, now - previous);
    previous = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const interaction = () => {
    const start = performance.now();
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        push(samples.interactionMs, performance.now() - start),
      ),
    );
  };
  window.addEventListener("pointerdown", interaction, { passive: true });
  window.addEventListener("keydown", interaction, { passive: true });
  Object.assign(window, {
    khungPerformance: {
      report: () => {
        const stats = (values: number[]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return {
            count: sorted.length,
            p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
            p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            max: sorted.at(-1) ?? 0,
          };
        };
        return {
          startedAt: samples.startedAt,
          measuredAt: new Date().toISOString(),
          longTasksSupported: Boolean(observer),
          longTasks: stats(samples.longTasks),
          inputToSecondRafMs: stats(samples.interactionMs),
          frameGapsMs: stats(samples.frameGapsMs),
          note: "Development diagnostic; input-to-second-rAF is not the browser INP metric. Frame gaps are UI rAF gaps, not Remotion dropped-frame counts.",
        };
      },
      reset: () => {
        samples.longTasks.length = 0;
        samples.interactionMs.length = 0;
        samples.frameGapsMs.length = 0;
        previous = performance.now();
      },
    },
  });
}
