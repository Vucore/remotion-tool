import { Worker } from "node:worker_threads";
export class StorageWorker {
  pending = new Map();
  sequence = 0;
  constructor(root) {
    this.root = root;
  }
  request(action, data = {}) {
    if (!this.worker) {
      const worker = new Worker(
        new URL("./storage-worker.mjs", import.meta.url),
        { workerData: { root: this.root } },
      );
      this.worker = worker;
      const fail = (error) => {
        if (this.worker !== worker) return;
        this.worker = null;
        for (const task of this.pending.values()) task.reject(error);
        this.pending.clear();
      };
      worker.on("message", ({ id, result, error, status }) => {
        const task = this.pending.get(id);
        if (!task) return;
        this.pending.delete(id);
        if (error) task.reject(Object.assign(Error(error), { status }));
        else task.resolve(result);
      });
      worker.on("error", fail);
      worker.on("exit", () =>
        fail(Error("Worker kiểm tra dung lượng đã dừng. Thử lại.")),
      );
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, action, ...data });
    });
  }
  async close() {
    const worker = this.worker;
    this.worker = null;
    await worker?.terminate();
    for (const task of this.pending.values())
      task.reject(Error("Server đã dừng."));
    this.pending.clear();
  }
}
