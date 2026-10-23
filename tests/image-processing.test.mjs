import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  defaultImageProcessing,
  parseImageProcessing,
  pixelRegion,
} from "../dist/image-processing.mjs";
import { emptyProject, parseProject } from "../dist/model.mjs";
import { compileAuto } from "../dist/auto.mjs";
import { storyConfig, defaultStoryOptions } from "../dist/story.mjs";
import { processImages } from "../scripts/image-processing.mjs";
const asset = {
  id: "one",
  name: "01.png",
  src: "/media/source.png",
  width: 720,
  height: 1280,
};
test("logo region matches percent controls, clips padding and validates bounds", () => {
  const settings = defaultImageProcessing();
  const box = pixelRegion(settings.region, 1000, 1000, 4);
  assert.deepEqual(box, { x: 879, y: 796, width: 60, height: 93 });
  assert.deepEqual(
    pixelRegion({ x: 0, y: 0, width: 1, height: 1 }, 20, 10, 64),
    { x: 0, y: 0, width: 20, height: 10 },
  );
  for (const patch of [
    { region: { x: 0.9, y: 0, width: 0.2, height: 1 } },
    { scale: 3 },
    { padding: -1 },
    { feather: 33 },
    { tile: 0 },
    { autoOnImport: "yes" },
  ])
    assert.throws(() => parseImageProcessing({ ...settings, ...patch }));
  const python = spawnSync(
    "python3",
    [
      "-c",
      "from delete_logo import region_pixels; assert region_pixels({'x':.883,'y':.8,'width':.052,'height':.085},1000,1000,4)==(879,796,939,889)",
    ],
    { encoding: "utf8" },
  );
  assert.equal(python.status, 0, python.stderr);
});
test("processed assets preserve originals, IDs and metadata across save/open", () => {
  const settings = defaultImageProcessing();
  const project = parseProject({
    ...emptyProject(),
    imageProcessing: settings,
    assets: [
      {
        ...asset,
        src: "/media/result.png",
        width: 1440,
        height: 2560,
        original: { src: asset.src, width: 720, height: 1280 },
      },
    ],
  });
  assert.equal(project.assets[0].original.src, asset.src);
  const rebuilt = compileAuto(
    storyConfig(project, defaultStoryOptions()),
    project.assets,
    project,
    false,
  ).project;
  assert.deepEqual(rebuilt.imageProcessing, settings);
  assert.equal(rebuilt.assets[0].original.src, asset.src);
  assert.deepEqual(
    parseProject(JSON.parse(JSON.stringify(project))).imageProcessing,
    settings,
  );
  assert.throws(() =>
    parseProject({
      ...project,
      assets: [
        {
          ...project.assets[0],
          original: {
            src: "/media/../../secret.png",
            width: 720,
            height: 1280,
          },
        },
      ],
    }),
  );
});
test("batch worker caching always starts at original and partial failures keep successes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "khung-image-test-"));
  try {
    const bytes = await readFile(
      new URL("../test/images/01_ngu-nuong.png", import.meta.url),
    );
    await writeFile(join(directory, "source.png"), bytes);
    let calls = 0;
    const worker = async ({ tasks }) => {
      calls++;
      for (const task of tasks) await writeFile(task.output, bytes);
      return tasks.map((_, index) => ({ type: "result", index }));
    };
    const options = {
      assetDirectory: directory,
      cacheDirectory: join(directory, "cache"),
      modelSignature: "fake-model-for-test",
      worker,
    };
    const result = await processImages(
      [asset],
      defaultImageProcessing(),
      options,
    );
    assert.equal(calls, 1);
    assert.equal(result.assets[0].id, asset.id);
    assert.equal(result.assets[0].original.src, asset.src);
    assert.equal(result.assets[0].width, 720);
    const cached = await processImages(
      result.assets,
      defaultImageProcessing(),
      options,
    );
    assert.equal(calls, 1);
    assert.equal(cached.cached, 1);
    assert.equal(cached.assets[0].original.src, asset.src);
    const partial = await processImages(
      [asset, { ...asset, id: "two", name: "02.png" }],
      { ...defaultImageProcessing(), padding: 5 },
      {
        ...options,
        worker: async ({ tasks }) => {
          await writeFile(tasks[0].output, bytes);
          return [
            { type: "result", index: 0 },
            { type: "error", index: 1, error: "test failure" },
          ];
        },
      },
    );
    assert.equal(partial.assets.length, 1);
    assert.equal(partial.errors[0].id, "two");
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      processImages([asset], defaultImageProcessing(), {
        ...options,
        signal: abort.signal,
      }),
      /dừng/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
