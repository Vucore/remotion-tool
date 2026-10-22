import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileAuto, compareNames } from "../dist/auto.mjs";
import { configFromScene, parseAutoConfig } from "../dist/auto-config.mjs";
import { parseProject, totalFrames } from "../dist/model.mjs";
import { imageInfo } from "../scripts/image-info.mjs";
import { runAuto } from "../scripts/auto-edit.mjs";
const assets = (count = 3) =>
  Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    name: `${i + 1}.png`,
    src: "/samples/coast.svg",
    width: 1600,
    height: 1000,
  }));
const config = (patch = {}) => ({ autoEditVersion: 1, ...patch });
test("automatic build sorts naturally, accounts for overlaps and round-trips through project validation", () => {
  const input = assets();
  input[0].name = "10.png";
  input[1].name = "2.png";
  input[2].name = "1.png";
  const { project, report } = compileAuto(config(), input);
  assert.deepEqual(report.files, ["1.png", "2.png", "10.png"]);
  assert.equal(totalFrames(project), 330);
  assert.equal(report.seconds, 11);
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))), project);
  assert.ok(compareNames("0000000000000002.png", "10.png") < 0);
});
test("same inputs reproduce scene and layer IDs, movement and complete project data", () => {
  const recipe = config({
    motion: { policy: "seeded", presets: ["zoom-in", "zoom-out", "pan-left"] },
    text: { source: "filename" },
    look: {
      scene: {
        effects: [{ kind: "brightness", params: { amount: 0.15 } }],
        overlays: [{ kind: "dust" }],
      },
    },
  });
  const a = compileAuto(recipe, assets(25)),
    b = compileAuto(recipe, assets(25));
  assert.deepEqual(a, b);
  for (let i = 1; i < a.project.scenes.length; i++)
    assert.notEqual(a.project.scenes[i - 1].motion, a.project.scenes[i].motion);
  assert.equal(a.project.scenes[0].texts[0].text, "1");
  assert.equal(a.project.scenes[0].effects[0].params.amount, 0.15);
});
test("total duration is exact to a frame across both ratios and supported frame rates", () => {
  for (const ratio of ["9:16", "16:9"])
    for (const fps of [24, 25, 30, 60]) {
      const { project } = compileAuto(
        config({
          output: { ratio, fps },
          timing: {
            mode: "total",
            seconds: 12.13,
            minSeconds: 1,
            maxSeconds: 10,
          },
        }),
        assets(7),
      );
      assert.equal(totalFrames(project), Math.round(12.13 * fps));
      assert.equal(
        project.width / project.height,
        ratio === "9:16" ? 9 / 16 : 16 / 9,
      );
    }
});
test("total allocation keeps locked edits and distributes only the remaining duration", () => {
  const first = compileAuto(config(), assets()).project;
  first.scenes[0].duration = 6;
  first.scenes[0].filter = "vintage";
  first.automation.locks = [first.scenes[0].id];
  const result = compileAuto(
    config({ timing: { mode: "total", seconds: 10 } }),
    assets(),
    first,
  ).project;
  assert.equal(result.scenes[0].duration, 6);
  assert.equal(result.scenes[0].filter, "vintage");
  assert.equal(totalFrames(result), 300);
  const reset = compileAuto(config(), assets(), first, false).project;
  assert.equal(reset.scenes[0].duration, 4);
  assert.deepEqual(reset.automation.locks, []);
});
test("target duration reports infeasible limits and shortened transitions", () => {
  assert.throws(
    () =>
      compileAuto(
        config({
          timing: { mode: "total", seconds: 1, minSeconds: 2, maxSeconds: 3 },
        }),
        assets(),
      ),
    /Khoảng khả thi/,
  );
  const { project, report } = compileAuto(
    config({
      timing: { mode: "total", seconds: 5, minSeconds: 0.5 },
      transition: { preset: "fade", seconds: 2 },
    }),
    assets(),
  );
  assert.equal(totalFrames(project), 150);
  assert.ok(report.warnings.length > 0);
});
test("captions map to filenames rather than array positions; missing captions and unmatched overrides fail", () => {
  const recipe = config({
    text: {
      source: "file",
      captions: { "1.png": "Một", "2.png": "Hai", "3.png": "Ba" },
    },
    overrides: [
      {
        file: "2.png",
        scene: { duration: 7, motion: "none" },
        text: "Ngoại lệ",
      },
    ],
  });
  const result = compileAuto(recipe, assets()).project;
  assert.equal(result.scenes[1].duration, 7);
  assert.equal(result.scenes[1].texts[0].text, "Ngoại lệ");
  assert.throws(
    () => compileAuto(config({ text: { source: "file" } }), assets()),
    /thiếu nội dung/,
  );
  assert.throws(
    () =>
      compileAuto(
        config({ overrides: [{ file: "missing.png", scene: {} }] }),
        assets(),
      ),
    /không tìm thấy/,
  );
});
test("invalid config fields, scene parameters, native effects, duplicate names and versions fail before rendering", () => {
  for (const recipe of [
    config({ outpt: {} }),
    config({ timing: { seconds: "4" } }),
    config({ output: { ratio: "1:1" } }),
    config({ template: "unknown@1" }),
    config({ look: { scene: { rotate: 400 } } }),
    config({ look: { scene: { effects: [{ kind: "unknown" }] } } }),
    config({
      look: {
        scene: { effects: [{ kind: "brightness", params: { amount: 999 } }] },
      },
    }),
    config({ text: { source: "filename", style: { fontFamily: "missing" } } }),
  ])
    assert.throws(() => compileAuto(recipe, assets()));
  assert.throws(() => parseAutoConfig({ autoEditVersion: 2 }));
  const duplicate = assets();
  duplicate[1].name = duplicate[0].name;
  assert.throws(() => compileAuto(config(), duplicate), /tên trùng/);
});
test("new image batches need no per-scene configuration and input order can be retained", () => {
  const a = compileAuto(config(), assets(1)),
    b = compileAuto(config(), assets(30));
  assert.equal(a.project.scenes.length, 1);
  assert.equal(b.project.scenes.length, 30);
  const input = assets().reverse();
  assert.deepEqual(
    compileAuto(config({ input: { order: "input" } }), input).report.files,
    input.map((a) => a.name),
  );
});
test("a manually edited scene becomes a reusable config without asset or scene identity", () => {
  const original = compileAuto(
    config({ text: { source: "static", content: "Tiếng Việt" } }),
    assets(),
  ).project;
  const scene = original.scenes[0];
  scene.rotate = 15;
  scene.filter = "warm";
  scene.motion = "pan-up";
  const recipe = configFromScene(original, scene);
  assert.equal(recipe.look.scene.id, undefined);
  assert.equal(recipe.look.scene.assetId, undefined);
  const regenerated = compileAuto(recipe, assets(8)).project;
  assert.equal(regenerated.scenes.length, 8);
  for (const item of regenerated.scenes) {
    assert.equal(item.rotate, 15);
    assert.equal(item.motion, "pan-up");
    assert.equal(item.texts[0].text, "Tiếng Việt");
  }
});
test("focal points alter cropping rather than translating the whole image; unsupported native combinations fail explicitly", () => {
  const { project } = compileAuto(
    config({ framing: { focus: { x: 0.2, y: 0.8 } } }),
    assets(),
  );
  assert.equal(project.scenes[0].focusX, 20);
  assert.equal(project.scenes[0].focusY, 80);
  assert.equal(project.scenes[0].x, 0);
  assert.equal(project.scenes[0].y, 0);
  assert.throws(
    () =>
      compileAuto(
        config({
          framing: { focus: { x: 0.2, y: 0.5 } },
          look: { scene: { effects: [{ kind: "brightness" }] } },
        }),
        assets(),
      ),
    /điểm lấy khung/,
  );
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6F6sAAAAASUVORK5CYII=",
  "base64",
);
test("image headers provide intrinsic dimensions; corrupt and oversized headers are rejected", () => {
  assert.deepEqual(imageInfo(png), { width: 1, height: 1, ext: "png" });
  const jpeg = Buffer.from([
    255, 216, 255, 192, 0, 8, 8, 0, 240, 1, 64, 1, 255, 217,
  ]);
  assert.deepEqual(imageInfo(jpeg), { width: 320, height: 240, ext: "jpg" });
  const webp = Buffer.alloc(30);
  webp.write("RIFF");
  webp.writeUInt32LE(22, 4);
  webp.write("WEBP", 8);
  webp.write("VP8X", 12);
  webp.writeUInt32LE(10, 16);
  webp.writeUIntLE(319, 24, 3);
  webp.writeUIntLE(239, 27, 3);
  assert.deepEqual(imageInfo(webp), { width: 320, height: 240, ext: "webp" });
  assert.throws(() => imageInfo(webp.subarray(0, 29)));
  assert.throws(() => imageInfo(Buffer.from("not an image")));
  const huge = Buffer.from(png);
  huge.writeUInt32BE(30001, 16);
  assert.throws(() => imageInfo(huge), /30.000/);
});
test("CLI planning receives a real folder and caption file, writes validated project/report, and never renders", async () => {
  const temp = await mkdtemp(join(tmpdir(), "khung-auto-"));
  try {
    await mkdir(join(temp, "images"));
    for (const name of ["10.png", "2.png", "1.png"])
      await writeFile(join(temp, "images", name), png);
    await writeFile(
      join(temp, "captions.json"),
      JSON.stringify({ "1.png": "Một", "2.png": "Hai", "10.png": "Mười" }),
    );
    const path = join(temp, "config.json");
    await writeFile(
      path,
      JSON.stringify(
        config({
          input: { directory: "./images" },
          output: { file: "./out/video.mp4" },
          text: { source: "file", file: "./captions.json" },
        }),
      ),
    );
    const result = await runAuto({
      config: path,
      planOnly: true,
      assetDirectory: join(temp, "cache"),
    });
    assert.equal(result.report.status, "planned");
    assert.equal(result.report.seconds, 11);
    assert.equal(result.project.scenes[2].texts[0].text, "Mười");
    assert.equal(
      JSON.parse(await readFile(result.reportFile, "utf8")).manifest.length,
      3,
    );
    assert.deepEqual(
      parseProject(JSON.parse(await readFile(result.projectFile, "utf8"))),
      result.project,
    );
    await assert.rejects(
      () =>
        runAuto({
          config: path,
          planOnly: true,
          assetDirectory: join(temp, "cache"),
        }),
      /Đã có/,
    );
    // Simulate a completed queue entry; resume must return before any renderer/server starts.
    const completed = Buffer.from("completed-output-fixture");
    await writeFile(result.report.output, completed);
    await writeFile(
      result.reportFile,
      JSON.stringify({
        ...result.report,
        status: "done",
        outputBytes: completed.length,
      }),
    );
    const resumed = await runAuto({
      config: path,
      resume: true,
      assetDirectory: join(temp, "cache"),
    });
    assert.equal(resumed.report.skipped, true);
    await writeFile(
      path,
      JSON.stringify({ autoEditVersion: 1, unknownOption: true }),
    );
    await assert.rejects(
      () =>
        runAuto({
          config: path,
          resume: true,
          assetDirectory: join(temp, "cache"),
        }),
      /unknownOption/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
