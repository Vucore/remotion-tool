import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { inspectVoice } from "./voice-input.mjs";
import { wavEnvelope } from "./wav-info.mjs";
const controller = new AbortController();
parentPort.on("message", () => controller.abort());
try {
  const input = await readFile(workerData.path);
  const { info, decodedWav, extension } = await inspectVoice(input, {
    name: workerData.name,
    signal: controller.signal,
  });
  parentPort.postMessage({
    info,
    extension,
    envelope: wavEnvelope(decodedWav, info),
  });
} catch (error) {
  parentPort.postMessage({ error: error.message });
} finally {
  parentPort.close();
}
