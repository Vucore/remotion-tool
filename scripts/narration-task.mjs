import { Worker } from "node:worker_threads";
export function narrationTask(data, signal, onProgress, onResource) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./narration-worker.mjs", import.meta.url),
      { workerData: data },
    );
    let settled = false;
    const abort = () => worker.postMessage("abort");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(result);
    };
    worker.on("message", (event) => {
      if (event.error) finish(Error(event.error));
      else if (event.result)
        finish(
          signal.aborted ? Error("Đã hủy căn phụ đề.") : null,
          event.result,
        );
      else if (event.resources) onResource?.(event.resources);
      else onProgress(event.progress, event.message);
    });
    worker.on("error", (error) => finish(error));
    worker.on("exit", () => {
      if (!settled) finish(Error("Worker căn phụ đề dừng bất thường."));
    });
  });
}
