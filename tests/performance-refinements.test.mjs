import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { emptyProject, makeScene, makeText } from "../dist/model.mjs";
import {
  defaultStoryOptions,
  previewStory,
  storyInputs,
} from "../dist/story.mjs";
import { defaultTtsSettings, ttsInputKey } from "../dist/tts.mjs";
import { renderBudget } from "../scripts/resource-budget.mjs";
await mkdir(".cache", { recursive: true });
const directory = await mkdtemp(resolve(".cache/refinement-test-"));
test.after(() => rm(directory, { recursive: true, force: true }));
const output = join(directory, "helpers.mjs");
await build({
  stdin: {
    contents: `export * from './src/editor/revision'; export * from './src/editor/narration-document'; export * from './src/editor/preview-health'; export * from './src/overlay-particles'; export { hash, starPolygon } from './src/animation';`,
    resolveDir: resolve("."),
  },
  outfile: output,
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const {
  revisionDiff,
  applyRevision,
  NarrationDraft,
  narrationDocument,
  PreviewHealth,
  overlayParticles,
  overlayStarPoints,
  hash,
  starPolygon,
} = await import(pathToFileURL(output));

test("revision patches preserve array ordering, removed/undefined fields, and unchanged identities", () => {
  const original = {
    list: [
      { id: "a", text: "Giữ nguyên" },
      { id: "b", text: "Old" },
    ],
    options: { obsolete: true },
    unchanged: { value: 1 },
  };
  const next = {
    list: [
      { id: "b", text: "Mới" },
      { id: "a", text: "Giữ nguyên" },
      { id: "c", value: null },
    ],
    options: { explicit: undefined },
    unchanged: { value: 1 },
  };
  const patch = structuredClone(revisionDiff(original, next));
  const result = applyRevision(original, patch);
  assert.deepEqual(result, next);
  assert.equal(result.list[1], original.list[0]);
  assert.equal(result.unchanged, original.unchanged);
  assert.equal(original.list[1].text, "Old");
  assert.equal(revisionDiff(result, structuredClone(next)), null);
  assert.deepEqual(
    applyRevision([1, 2, 3], revisionDiff([1, 2, 3], [9, undefined])),
    [9, undefined],
  );
  const dangerous = JSON.parse('{"__proto__":{"safe":true}}');
  const restored = applyRevision({}, revisionDiff({}, dangerous));
  assert.equal(Object.hasOwn(restored, "__proto__"), true);
  assert.equal({}.safe, undefined);
});

test("one caption edit sends a small patch instead of the entire 300-scene project", () => {
  const before = {
    scenes: Array.from({ length: 300 }, (_, i) => ({
      id: String(i),
      captions: Array.from({ length: 20 }, (_, n) => ({
        text: `Cảnh ${i} câu ${n} giữ đầy đủ nội dung lời đọc`,
        startMs: n * 1000,
        endMs: n * 1000 + 800,
      })),
    })),
  };
  const after = structuredClone(before);
  after.scenes[155].captions[8].text = "Nội dung mới";
  const patch = revisionDiff(before, after);
  assert.deepEqual(applyRevision(before, structuredClone(patch)), after);
  assert.ok(JSON.stringify(patch).length < 5000);
  assert.ok(JSON.stringify(patch).length < JSON.stringify(after).length / 50);
});

test("buffered narration keeps the exact script/voice mapping through flush, assign, split and deletion", async () => {
  let rows = [
    { id: "1", order: 2, text: "Second", speakerId: "mom" },
    { id: "2", order: 1, text: "First", speakerId: "default" },
  ];
  let publishes = 0;
  const buffer = new NarrationDraft(
    () => rows,
    (next) => {
      rows = next;
      publishes++;
    },
    10,
  );
  buffer.set("1", "Câu mới\nTiếng Việt: ắ ệ 🎈");
  buffer.set("1", "Bản cuối\nKhông mất chữ.");
  assert.equal(publishes, 0);
  buffer.commit(
    rows.map((row) => (row.id === "1" ? { ...row, speakerId: "child" } : row)),
  );
  assert.equal(rows[0].text, "Bản cuối\nKhông mất chữ.");
  assert.equal(rows[0].speakerId, "child");
  buffer.set("2", "Một. Hai.");
  buffer.flush();
  const second = rows.find((row) => row.id === "2");
  buffer.commit(
    rows.flatMap((row) =>
      row.id === "2"
        ? [
            { ...second, text: "Một." },
            { ...second, id: "3", text: "Hai." },
          ]
        : row,
    ),
  );
  assert.deepEqual(narrationDocument(rows), {
    text: "1. Một.\n\nHai.\n\n2. Bản cuối\nKhông mất chữ.",
    dialogue: [
      {
        order: 1,
        turns: [
          { text: "Một.", speakerId: "default" },
          { text: "Hai.", speakerId: "default" },
        ],
      },
      {
        order: 2,
        turns: [{ text: "Bản cuối\nKhông mất chữ.", speakerId: "child" }],
      },
    ],
  });
  buffer.set("3", "Đoạn sắp xóa");
  buffer.commit(rows.filter((row) => row.id !== "3"));
  assert.equal(
    rows.some((row) => row.id === "3"),
    false,
  );
  buffer.set("1", "Đợi autosave");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(rows[0].text, "Đợi autosave");
  buffer.flush();
});

test("full overlay descriptors match the original particle math; light keeps original indices", () => {
  for (const kind of ["grain", "smoke", "rain", "stars", "bokeh"]) {
    const layer = { kind, seed: 31, amount: 0.4 };
    const expected = Array.from(
      { length: kind === "grain" ? 180 : kind === "smoke" ? 12 : 70 },
      (_, i) => {
        const seed = layer.seed * 313 + i * 7;
        return { i, seed, r: hash(seed), z: hash(seed + 1), a: hash(seed + 2) };
      },
    );
    assert.deepEqual(overlayParticles(layer), expected);
    assert.deepEqual(
      overlayParticles(layer, true),
      expected.filter((item) => item.i % 2 === 0),
    );
    assert.equal(overlayParticles(layer), overlayParticles(layer));
  }
  assert.equal(
    overlayStarPoints,
    starPolygon()
      .split(",")
      .map((p) => p.split("%").join(""))
      .join(" "),
  );
});

test("quality adapts to missed Remotion frames and budget respects currently free RAM", () => {
  const good = new PreviewHealth();
  for (let n = 0; n < 100; n++)
    assert.notEqual(good.sample(n, (n * 1000) / 30, 30), "light");
  const slow = new PreviewHealth();
  const changes = [];
  for (let n = 0; n < 70; n++)
    changes.push(slow.sample(n * 2, (n * 2000) / 30, 30));
  assert.ok(changes.includes("light"));
  assert.equal(new PreviewHealth().sample(500, 30000, 30), undefined);
  const gib = 1024 ** 3;
  assert.equal(renderBudget("fast", 32 * gib, 12, 2 * gib).concurrency, 1);
  assert.ok(
    renderBudget("fast", 32 * gib, 12, 0.25 * gib).mediaCacheSizeInBytes <=
      (0.25 * gib) / 4,
  );
  assert.equal(renderBudget("editing", 32 * gib, 12, 16 * gib).concurrency, 1);
});

test("delta preview protocol preserves inspection logic and exact captions across edits and reorder", async () => {
  const shim = join(directory, "worker.mjs");
  await writeFile(
    shim,
    `import {parentPort} from 'node:worker_threads'; globalThis.addEventListener=(_,fn)=>parentPort.on('message',data=>fn({data})); globalThis.postMessage=value=>parentPort.postMessage(value); await import(${JSON.stringify(pathToFileURL(resolve("dist/project-worker.js")).href)}); parentPort.postMessage({ready:true});`,
  );
  const worker = new Worker(shim);
  let beforeProject, beforeOptions, received;
  try {
    await new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    const run = async (project, options) => {
      const reply = new Promise((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
      worker.postMessage({
        id: 1,
        kind: "preview",
        delta: true,
        inspect: true,
        rebuild: true,
        projectPatch: revisionDiff(beforeProject, project),
        optionsPatch: revisionDiff(beforeOptions, options),
      });
      beforeProject = project;
      beforeOptions = options;
      const message = await reply;
      assert.equal(message.error, undefined);
      received = applyRevision(received, message.resultPatch);
      return received;
    };
    let project = emptyProject();
    project.assets = [1, 2].map((i) => ({
      id: "a" + i,
      name: `0${i}.png`,
      src: "/samples/coast.svg",
      width: 720,
      height: 1280,
    }));
    project.voiceover = {
      assets: [
        { id: "v1", name: "01.wav", src: "/media/v1.wav", duration: 10 },
        { id: "v2", name: "02.mp3", src: "/media/v2.mp3", duration: 15 },
      ],
      script: "1. Xin chào. Câu thứ hai!\n2. Kết thúc.",
      scriptName: "script.txt",
    };
    const options = defaultStoryOptions();
    const first = await run(project, options);
    assert.deepEqual(first.project, previewStory(project, options).project);
    assert.equal(first.validation.error, "");
    project = {
      ...project,
      assets: [...project.assets].reverse(),
      voiceover: {
        ...project.voiceover,
        script: "1. Nội dung mới.\n2. Kết thúc.",
      },
    };
    const next = await run(project, {
      ...options,
      caption: { ...options.caption, preset: "highlight" },
    });
    assert.deepEqual(
      next.project,
      previewStory(project, {
        ...options,
        caption: { ...options.caption, preset: "highlight" },
      }).project,
    );
    assert.equal(next.project.scenes[0].duration, 10);
    assert.equal(next.project.scenes[1].duration, 15);
    assert.doesNotThrow(() => storyInputs(project));
    const tts = { ...defaultTtsSettings(), enabled: true };
    const pending = await run(project, { ...options, tts });
    assert.equal(pending.ttsReady, false);
    assert.equal(pending.error, undefined, JSON.stringify(pending));
    assert.equal(pending.project.scenes[0].voice, undefined);
    project = {
      ...project,
      voiceover: {
        ...project.voiceover,
        ttsKey: ttsInputKey(project.voiceover.script, tts),
        tts,
      },
    };
    const ready = await run(project, { ...options, tts });
    assert.equal(ready.ttsReady, true);
    assert.equal(ready.error, undefined, JSON.stringify(ready));
    assert.equal(ready.project.scenes[0].voice.assetId, "v1");
  } finally {
    await worker.terminate();
  }
});

test("utility worker uses the existing project/preset parsers and serializes UTF-8 off-thread", async () => {
  const shim = join(directory, "utility.mjs");
  await writeFile(
    shim,
    `import {parentPort} from 'node:worker_threads'; globalThis.addEventListener=(_,fn)=>parentPort.on('message',data=>fn({data})); globalThis.postMessage=value=>parentPort.postMessage(value); await import(${JSON.stringify(pathToFileURL(resolve("dist/utility-worker.js")).href)}); parentPort.postMessage({ready:true});`,
  );
  const worker = new Worker(shim);
  const { parseProject } = await import("../dist/model.mjs");
  const { optionsFromProject, parseStoryOptions } =
    await import("../dist/story.mjs");
  try {
    await new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    const request = async (message) => {
      const reply = new Promise((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
      worker.postMessage({ id: 1, ...message });
      return reply;
    };
    const project = emptyProject();
    project.name = "Câu chuyện tiếng Việt 🎈";
    project.assets = [
      {
        id: "a",
        name: "01.png",
        src: "/samples/coast.svg",
        width: 720,
        height: 1280,
      },
    ];
    project.scenes = [
      {
        ...makeScene("a"),
        texts: [{ ...makeText(), text: "Không mất dấu tiếng Việt." }],
      },
    ];
    const opened = await request({
      kind: "file",
      type: "project",
      file: new Blob([JSON.stringify(project)]),
    });
    assert.equal(opened.error, undefined);
    assert.deepEqual(opened.result.project, parseProject(project));
    assert.deepEqual(
      opened.result.options,
      optionsFromProject(parseProject(project)),
    );
    const preset = { storyPresetVersion: 1, options: defaultStoryOptions() };
    const saved = await request({ kind: "json", value: preset, preset: true });
    assert.deepEqual(JSON.parse(await saved.result.text()), {
      ...preset,
      options: parseStoryOptions(preset.options),
    });
    const broken = await request({
      kind: "file",
      type: "project",
      file: new Blob(['{"version":999}']),
    });
    assert.ok(broken.error);
    const blocked = await request({ kind: "load" });
    assert.ok(
      blocked.error,
      "Cannot silently replace an inaccessible draft with an empty workspace",
    );
    const legacy = await request({
      kind: "load",
      legacy: JSON.stringify({
        project,
        options: defaultStoryOptions(),
        dirty: true,
        job: null,
      }),
    });
    assert.equal(legacy.error, undefined);
    assert.deepEqual(legacy.result.project, parseProject(project));
  } finally {
    await worker.terminate();
  }
});
