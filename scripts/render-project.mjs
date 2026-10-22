import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
let bundlePromise;
export async function renderProject(
  project,
  {
    origin,
    output,
    quality = "high",
    cancelSignal,
    cancelled = () => false,
    onProgress = () => {},
    ports = {},
  },
) {
  if (!bundlePromise)
    bundlePromise = bundle({
      entryPoint: join(root, "src/remotion.tsx"),
      publicDir: join(root, "public"),
      outDir: join(root, ".cache", `remotion-${process.pid}`),
      onProgress: (value) => onProgress((value / 100) * 0.12, "preparing"),
    }).catch((error) => {
      bundlePromise = undefined;
      throw error;
    });
  const serveUrl = await bundlePromise;
  if (cancelled()) return;
  const inputProps = {
    project: {
      ...project,
      assets: project.assets.map((a) => ({ ...a, src: origin + a.src })),
      fonts: project.fonts.map((f) => ({ ...f, src: origin + f.src })),
    },
  };
  const composition = await selectComposition({
    serveUrl,
    id: "ImageVideo",
    inputProps,
    port: ports.composition,
    chromiumOptions: { gl: "angle" },
  });
  if (cancelled()) return;
  onProgress(0.15, "rendering");
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf: quality === "high" ? 18 : 23,
    pixelFormat: "yuv420p",
    outputLocation: output,
    concurrency: 2,
    cancelSignal,
    port: ports.render,
    chromiumOptions: { gl: "angle" },
    onProgress: ({ progress }) =>
      onProgress(0.15 + progress * 0.85, "rendering"),
  });
}
