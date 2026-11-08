import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { emptyProject, makeScene } from "../dist/model.mjs";

await mkdir(".cache", { recursive: true });
const directory = await mkdtemp(resolve(".cache/overlay-preview-timing-"));
test.after(() => rm(directory, { recursive: true, force: true }));
const output = join(directory, "panel.mjs");
await build({
  stdin: {
    contents:
      'export { VideoOverlayPanel } from "./src/editor/VideoOverlayPanel"; export { createElement } from "react"; export { renderToStaticMarkup } from "react-dom/server";',
    resolveDir: resolve("."),
  },
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
  logLevel: "silent",
});
const { VideoOverlayPanel, createElement, renderToStaticMarkup } = await import(
  pathToFileURL(output)
);
function markup(fps, start, initialFrame) {
  const project = emptyProject();
  project.fps = fps;
  project.assets = [
    {
      id: "a",
      name: "01.png",
      src: "/samples/coast.svg",
      width: 1600,
      height: 1000,
    },
  ];
  project.scenes = [{ ...makeScene("a"), duration: 12, transition: "none" }];
  project.videoOverlays = [
    {
      id: "clip",
      name: "clip.mp4",
      src: "/media/fixture.mp4",
      sourceWidth: 320,
      sourceHeight: 180,
      sourceDuration: 2,
      start,
      duration: 2,
      trimStart: 0,
      x: 50,
      y: 50,
      width: 50,
      opacity: 1,
      muted: true,
      chromaKey: true,
      keyColor: "#00ff00",
      similarity: 1,
      smoothness: 0.15,
      spillSuppression: 1,
    },
  ];
  return renderToStaticMarkup(
    createElement(VideoOverlayPanel, {
      project,
      initialFrame,
      busy: false,
      onChange() {},
      onUploading() {},
      onSeek() {},
    }),
  );
}
test("selection follows the same rounded frame window as the rendered MP4, including fractional starts at 24 fps", () => {
  for (const [fps, start] of [
    [24, 0.1],
    [25, 0.1],
    [30, 5.2],
    [60, 3.4],
  ]) {
    const first = Math.round(start * fps),
      last = first + 2 * fps - 1;
    assert.doesNotMatch(
      markup(fps, start, first - 1),
      /class="video-overlay-selection"/,
    );
    assert.match(markup(fps, start, first), /class="video-overlay-selection"/);
    assert.match(markup(fps, start, last), /class="video-overlay-selection"/);
    assert.doesNotMatch(
      markup(fps, start, last + 1),
      /class="video-overlay-selection"/,
    );
  }
});
test("a high chroma threshold offers an explicit reset without changing saved settings automatically", () => {
  const html = markup(30, 5.2, 156);
  assert.match(html, /Mức xóa nền đang cao/);
  assert.match(html, /Khôi phục xóa nền xanh/);
  assert.match(html, /Mức xóa nền.*100/);
  assert.match(html, /Làm nền xanh trong suốt/);
  assert.match(html, /Màu nền cần xóa/);
});
