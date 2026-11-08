import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { emptyProject, parseProject } from "../dist/model.mjs";
import { previewStory, defaultStoryOptions } from "../dist/story.mjs";
import { compileAuto } from "../dist/auto.mjs";
import { deletionPlan, resourceRefs } from "../scripts/project-resources.mjs";
import { inspectVideo } from "../scripts/video-input.mjs";
import { runVoiceFfmpeg } from "../scripts/voice-input.mjs";
import {
  duplicateVideoOverlay,
  parseOverlayTime,
  MAX_VIDEO_OVERLAYS,
  greenScreenColor,
  TRANSPARENT_GREEN_SCREEN,
  videoOverlayKeyParams,
} from "../dist/video-overlays.mjs";

const layer = () => ({
  id: "clip",
  name: "subscribe.mp4",
  src: "/media/fixture.mp4",
  sourceWidth: 320,
  sourceHeight: 180,
  sourceDuration: 2,
  start: 1,
  duration: 1.5,
  trimStart: 0.5,
  x: 50,
  y: 80,
  width: 45,
  opacity: 1,
  muted: true,
  chromaKey: true,
  keyColor: "#00ff00",
  similarity: 0.18,
  smoothness: 0.08,
  spillSuppression: 0.25,
});
test("green-screen sampling finds the actual lime background rather than assuming pure green", () => {
  const width = 100,
    height = 60;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const foreground = x > 20 && x < 80 && y > 15 && y < 45;
      pixels.set(
        foreground ? [255, 0, 0, 255] : [85, 238, 0, 255],
        (y * width + x) * 4,
      );
    }
  // A white corner logo and codec noise must not become the key color.
  pixels.set([255, 255, 255, 255], 0);
  pixels.set([86, 239, 1, 255], 4);
  assert.equal(greenScreenColor(pixels, width, height), "#55ee00");
  pixels.fill(255);
  assert.equal(greenScreenColor(pixels, width, height), null);
  pixels.fill(0);
  assert.equal(greenScreenColor(pixels, width, height), null);
});
test("transparent preset and legacy softness keep a fully clear key interior without changing saved values", () => {
  assert.equal(TRANSPARENT_GREEN_SCREEN.chromaKey, true);
  assert.equal(TRANSPARENT_GREEN_SCREEN.spillSuppression, 1);
  for (const [similarity, smoothness] of [
    [0.7, 0.99],
    [0.5, 0.9],
    [0, 1],
    [0.22, 0.03],
  ]) {
    const original = { ...layer(), similarity, smoothness };
    const resolved = videoOverlayKeyParams(original);
    assert.ok(resolved.similarity - resolved.smoothness > 0);
    assert.equal(original.similarity, similarity);
    assert.equal(original.smoothness, smoothness);
    assert.equal(resolved.keyColor, original.keyColor);
  }
});
test("one MP4 has independent occurrences at chosen times and positions across save and rebuild", () => {
  let layers = [layer()];
  for (const start of [30, 90, 150.5])
    layers = duplicateVideoOverlay(layers, "clip", start);
  layers[1].x = 20;
  layers[2].x = 80;
  layers[2].width = 25;
  assert.deepEqual(
    layers.map((l) => l.start),
    [1, 30, 90, 150.5],
  );
  assert.equal(layers[0].x, 50);
  assert.equal(layers[0].width, 45);
  assert.equal(new Set(layers.map((l) => l.src)).size, 1);
  assert.equal(new Set(layers.map((l) => l.id)).size, 4);
  const p = emptyProject();
  p.assets = [
    {
      id: "a",
      name: "01.png",
      src: "/samples/coast.svg",
      width: 320,
      height: 180,
    },
  ];
  p.videoOverlays = layers;
  const restored = parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored.videoOverlays, layers);
  assert.deepEqual(
    compileAuto({ autoEditVersion: 1 }, p.assets, restored).project
      .videoOverlays,
    layers,
  );
  assert.deepEqual([...resourceRefs(p)], ["/media/fixture.mp4"]);
  assert.throws(() => duplicateVideoOverlay(layers, "clip", -1));
  const full = Array.from({ length: MAX_VIDEO_OVERLAYS }, (_, i) => ({
    ...layer(),
    id: `clip-${i}`,
  }));
  assert.throws(() => duplicateVideoOverlay(full, "clip-0", 20), /100/);
});
test("placement time accepts seconds or minute/hour notation and rejects invalid or out-of-video entries", () => {
  for (const [text, seconds] of [
    ["90", 90],
    ["1:30", 90],
    ["2:15.5", 135.5],
    ["0,5", 0.5],
    ["1:02:03", 3723],
  ])
    assert.equal(parseOverlayTime(text, 4000), seconds);
  for (const text of [
    "",
    "-1",
    "1:90",
    "1::20",
    "a",
    "Infinity",
    "4001",
    "1.5:20",
  ])
    assert.throws(() => parseOverlayTime(text, 4000));
});
test("video layers survive save, preview and rebuilding across both ratios", () => {
  const project = emptyProject();
  project.assets = [
    {
      id: "a",
      name: "01.png",
      src: "/samples/coast.svg",
      width: 320,
      height: 180,
    },
  ];
  project.videoOverlays = [layer()];
  assert.deepEqual(
    parseProject(JSON.parse(JSON.stringify(project))).videoOverlays,
    project.videoOverlays,
  );
  for (const ratio of ["9:16", "16:9"]) {
    const options = { ...defaultStoryOptions(), ratio };
    assert.deepEqual(
      previewStory(project, options).project.videoOverlays,
      project.videoOverlays,
    );
    assert.deepEqual(
      compileAuto(
        { autoEditVersion: 1, output: { ratio } },
        project.assets,
        project,
      ).project.videoOverlays,
      project.videoOverlays,
    );
  }
  for (const patch of [
    { src: "https://evil.invalid/clip.mp4" },
    { src: "/media/../clip.mp4" },
    { width: NaN },
    { trimStart: 2 },
    { duration: 3 },
    { start: -1 },
    { chromaKey: "yes" },
  ])
    assert.throws(() =>
      parseProject({ ...project, videoOverlays: [{ ...layer(), ...patch }] }),
    );
});
test("project deletion tracks exclusive MP4 and protects a shared clip", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-overlay-resource-"));
  try {
    await mkdir(join(root, "data/uploads"), { recursive: true });
    await writeFile(join(root, "data/uploads/fixture.mp4"), "video fixture");
    const target = {
      id: "a",
      workspace: { project: { videoOverlays: [layer()] } },
    };
    assert.deepEqual(
      [...resourceRefs(target.workspace)],
      ["/media/fixture.mp4"],
    );
    const own = await deletionPlan(root, target, []);
    assert.equal(own.files.length, 1);
    const shared = await deletionPlan(root, target, [{ ...target, id: "b" }]);
    assert.equal(shared.files.length, 0);
    assert.equal(shared.shared, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("MP4 inspection reads actual H.264 dimensions/duration and rejects fake files", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-overlay-mp4-"));
  try {
    const path = join(root, "fixture.mp4");
    await runVoiceFfmpeg([
      "-loop",
      "1",
      "-i",
      resolve("test/images/01_ngu-nuong.png"),
      "-vf",
      "scale=320:180",
      "-r",
      "30",
      "-t",
      "1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-y",
      path,
    ]);
    const info = await inspectVideo(path);
    assert.equal(info.width, 320);
    assert.equal(info.height, 180);
    assert.equal(info.duration, 1);
    await writeFile(join(root, "invalid.mp4"), "this is not MP4");
    await assert.rejects(inspectVideo(join(root, "invalid.mp4")), /MP4/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
