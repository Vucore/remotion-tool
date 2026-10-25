import { renderBudget, normalizeMediaCacheSize } from "./resource-budget.mjs";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { setPriority } from "node:os";
import { makeCancelSignal } from "@remotion/renderer";
import { renderProject } from "./render-project.mjs";
import {
  projectSubtitles,
  toSrt,
  subtitleFilename,
} from "../dist/subtitles.mjs";
const request = JSON.parse(await readFile(process.argv[2], "utf8"));
const signal = makeCancelSignal();
let cancelled = false;
const stop = () => {
  cancelled = true;
  signal.cancel();
};
process.on("SIGTERM", stop);
process.on("disconnect", stop);
const send = (event) => {
  if (process.connected) process.send(event, () => {});
};
process.on("message", (message) => {
  if (message === "cancel") stop();
});
try {
  setPriority(0, request.mode === "fast" ? 5 : 10);
} catch {
  /* OS dependent. */
}
const temporary = request.output + ".partial.mp4";
let lastProgress = 0;
try {
  const current = renderBudget(request.mode);
  await renderProject(request.project, {
    origin: request.origin,
    output: temporary,
    quality: request.quality,
    concurrency: Math.min(request.concurrency, current.concurrency),
    mediaCacheSizeInBytes: Math.min(
      normalizeMediaCacheSize(request.mediaCacheSizeInBytes),
      current.mediaCacheSizeInBytes,
    ),
    cancelSignal: signal.cancelSignal,
    cancelled: () => cancelled,
    ports: { composition: 3231, render: 3232 },
    onProgress: (progress, status) => {
      const now = Date.now();
      if (now - lastProgress >= 250) {
        send({ progress, status });
        lastProgress = now;
      }
    },
  });
  if (cancelled) throw Error("Đã hủy xuất.");
  const cues = projectSubtitles(request.project);
  let subtitle;
  if (cues.length) {
    await writeFile(
      request.output.replace(/\.mp4$/, ".srt"),
      toSrt(cues),
      "utf8",
    );
    subtitle = subtitleFilename(
      request.filename,
      request.project.automation?.config.narration.language ??
        request.project.voiceover?.uploadLanguage ??
        "vi",
    );
  }
  if (cancelled) throw Error("Đã hủy xuất.");
  await rename(temporary, request.output);
  send({ done: true, subtitle });
} catch (error) {
  if (!cancelled) send({ error: error.message });
  process.exitCode = cancelled ? 0 : 1;
} finally {
  await rm(temporary, { force: true });
  if (cancelled || process.exitCode)
    await rm(request.output.replace(/\.mp4$/, ".srt"), { force: true });
  if (process.connected) process.disconnect();
}
