import { parentPort, workerData } from "node:worker_threads";
import { prepareNarration } from "./narration.mjs";
import { compileAuto } from "../dist/auto.mjs";
const controller = new AbortController();
parentPort.on("message", () => controller.abort());
try {
  const { config, project, keep } = workerData;
  const prepared = await prepareNarration(
    config,
    project.assets,
    project.voiceover,
    {
      signal: controller.signal,
      onProgress: (progress, message) =>
        parentPort.postMessage({ progress, message }),
      onResource: (resources) => parentPort.postMessage({ resources }),
    },
  );
  if (controller.signal.aborted) throw Error("Đã hủy căn phụ đề.");
  const result = compileAuto(config, project.assets, project, keep, prepared);
  if (result.project.voiceover)
    result.project.voiceover.assets = result.project.voiceover.assets.map(
      ({ id, name, src, duration }) => ({ id, name, src, duration }),
    );
  parentPort.postMessage({ result });
} catch (error) {
  parentPort.postMessage({ error: error.message });
} finally {
  parentPort.close();
}
