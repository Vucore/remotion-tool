import { Worker } from "node:worker_threads";
import { ResourceQueue } from "./resource-queue.mjs";
const queue = new ResourceQueue();
export function analyzeVoice(path, name, signal) {
  return queue.run(
    () =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL("./voice-worker.mjs", import.meta.url),
          { workerData: { path, name } },
        );
        let done = false;
        const abort = () => worker.postMessage("abort");
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        const finish = (error, result) => {
          if (done) return;
          done = true;
          signal?.removeEventListener("abort", abort);
          if (error) reject(error);
          else resolve(result);
        };
        worker.on("message", (result) =>
          finish(
            result.error
              ? Error(result.error)
              : signal?.aborted
                ? Error("Đã hủy nhập voice.")
                : null,
            result,
          ),
        );
        worker.on("error", (error) => finish(error));
        worker.on("exit", () => {
          if (!done) finish(Error("Worker phân tích voice dừng bất thường."));
        });
      }),
    signal,
  );
}
