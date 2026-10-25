import { Worker } from "node:worker_threads";

// Disk I/O and large JSON documents stay off the HTTP event loop.
export class ProjectLibrary {
  pending = new Map();
  sequence = 0;
  constructor(root) {
    this.root = root;
  }
  request(action, data = {}) {
    if (!this.worker) {
      const worker = new Worker(
        new URL("./project-library-worker.mjs", import.meta.url),
        {
          workerData: { root: this.root },
        },
      );
      this.worker = worker;
      const fail = (error) => {
        if (this.worker !== worker) return;
        this.worker = null;
        for (const job of this.pending.values()) job.reject(error);
        this.pending.clear();
      };
      worker.on("message", ({ id, result, error, status }) => {
        const job = this.pending.get(id);
        if (!job) return;
        this.pending.delete(id);
        if (error) job.reject(Object.assign(Error(error), { status }));
        else job.resolve(result);
      });
      worker.on("error", fail);
      worker.on("exit", (code) =>
        fail(Error(`Kho dự án đã dừng (${code}). Hãy thử lại.`)),
      );
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, action, ...data });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  async close() {
    // The queue barrier lets acknowledged saves finish before shutdown.
    if (!this.worker) return;
    await this.request("barrier");
    const worker = this.worker;
    this.worker = null;
    await worker.terminate();
  }
}
