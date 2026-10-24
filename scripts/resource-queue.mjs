// One heavy task at a time; media/API work does not wait on this queue.
export class ResourceQueue {
  active = false;
  pending = [];
  run(task, signal, priority = 0) {
    return new Promise((resolve, reject) => {
      const entry = { task, signal, resolve, reject, priority };
      const abort = () => {
        const index = this.pending.indexOf(entry);
        if (index >= 0) {
          this.pending.splice(index, 1);
          reject(Error("Đã hủy tác vụ đang chờ."));
        }
      };
      entry.abort = abort;
      if (signal?.aborted) return reject(Error("Đã hủy tác vụ."));
      signal?.addEventListener("abort", abort, { once: true });
      const before = this.pending.findIndex(
        (pending) => pending.priority < priority,
      );
      if (before < 0) this.pending.push(entry);
      else this.pending.splice(before, 0, entry);
      this.drain();
    });
  }
  drain() {
    if (this.active) return;
    const entry = this.pending.shift();
    if (!entry) return;
    this.active = true;
    entry.signal?.removeEventListener("abort", entry.abort);
    Promise.resolve()
      .then(() => {
        if (entry.signal?.aborted) throw Error("Đã hủy tác vụ.");
        return entry.task();
      })
      .then(entry.resolve, entry.reject)
      .finally(() => {
        this.active = false;
        this.drain();
      });
  }
}
export const heavyTasks = new ResourceQueue();
