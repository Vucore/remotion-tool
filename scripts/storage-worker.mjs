import { parentPort, workerData } from "node:worker_threads";
import { StorageManager } from "./storage.mjs";
const manager = new StorageManager(workerData.root);
let queue = Promise.resolve();
parentPort.on("message", ({ id, action, ...data }) => {
  queue = queue
    .catch(() => {})
    .then(async () => {
      try {
        const result =
          action === "scan"
            ? await manager.inventory()
            : action === "prepare"
              ? await manager.prepare(data.group, data.revision)
              : action === "clear"
                ? await manager.clear(data.token)
                : null;
        if (!result) throw Error("Thao tác dung lượng không hợp lệ.");
        parentPort.postMessage({ id, result });
      } catch (error) {
        parentPort.postMessage({
          id,
          error: error.message,
          status: error.status || 400,
        });
      }
    });
});
