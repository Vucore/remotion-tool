import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

test("image processing dialog content renders with no images and no preview", async () => {
  await mkdir(resolve(".cache"), { recursive: true });
  const directory = await mkdtemp(resolve(".cache/image-panel-test-"));
  try {
    const output = join(directory, "panel.mjs");
    await build({
      stdin: {
        contents: `import {createElement} from "react"; import {renderToStaticMarkup} from "react-dom/server"; import {ImageProcessingPanel} from "./src/editor/ImageProcessingPanel"; import {defaultImageProcessing} from "./src/auto/image-processing"; export function render(assets=[],preview=null){return renderToStaticMarkup(createElement(ImageProcessingPanel,{assets,preview,settings:defaultImageProcessing(),busy:false,progress:"",onChange:()=>{},onRun:()=>{},onRestore:()=>{},onCancel:()=>{}}));}`,
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
    const { render } = await import(pathToFileURL(output).href);
    assert.match(render(), /Thêm ảnh trước khi xử lý/);
    const asset = {
      id: "one",
      src: "/media/example.png",
      width: 720,
      height: 1280,
      name: "01.png",
    };
    assert.match(render([asset]), /Vùng logo/);
    assert.match(
      render([], { id: "old", src: "/media/result.png", key: "old" }),
      /Thêm ảnh trước khi xử lý/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
