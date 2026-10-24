import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { ResourceQueue } from "../scripts/resource-queue.mjs";
import { ExportJobs, renderBudget } from "../scripts/export-jobs.mjs";
import { emptyProject, makeScene, makeText } from "../dist/model.mjs";
import { defaultStoryOptions } from "../dist/story.mjs";

await mkdir(".cache", { recursive: true });
const directory = await mkdtemp(resolve(".cache/editor-performance-test-"));
test.after(() => rm(directory, { recursive: true, force: true }));
await build({
  entryPoints: ["src/editor/performance.ts"],
  outfile: join(directory, "performance.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { visibleItems, lastAt, PlaybackClock, waveformPeaks } = await import(
  pathToFileURL(join(directory, "performance.mjs"))
);

test("viewport includes intersecting clips; clock subscriptions and waveform levels are bounded", () => {
  const clips = [
    { from: 0, end: 100 },
    { from: 30, end: 40 },
    { from: 50, end: 60 },
  ];
  assert.deepEqual(visibleItems(clips, 45, 55), [clips[0], clips[2]]);
  assert.equal(lastAt(clips, 49), 1);
  const clock = new PlaybackClock();
  let calls = 0;
  const unsubscribe = clock.subscribe(() => calls++);
  clock.set(3);
  clock.set(3);
  unsubscribe();
  clock.set(4);
  assert.equal(calls, 1);
  const source = [0, 0.1, 0.3, 0.7, 0.2, 1];
  assert.deepEqual(waveformPeaks(source, 2), [0.3, 1]);
  assert.equal(waveformPeaks(source, 2), waveformPeaks(source, 2));
});

test("300 scenes / 6000 cues at fit zoom use density blocks and no SVG waveform lines", async () => {
  const output = join(directory, "timeline.mjs");
  await build({
    stdin: {
      contents:
        'export { Timeline } from "./src/editor/Timeline"; export { renderToStaticMarkup } from "react-dom/server"; export { createElement } from "react";',
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
  const { Timeline, renderToStaticMarkup, createElement } = await import(
    pathToFileURL(output)
  );
  const project = emptyProject();
  project.assets = [
    {
      id: "a",
      name: "01.png",
      src: "/samples/coast.svg",
      width: 720,
      height: 1280,
    },
  ];
  project.voiceover = {
    assets: Array.from({ length: 300 }, (_, i) => ({
      id: "v" + i,
      name: `${i + 1}.wav`,
      src: `/media/v${i}.wav`,
      duration: 36,
      envelope: { stepMs: 50, values: Array(720).fill(0.5) },
    })),
    script: "",
    scriptName: "",
  };
  project.scenes = Array.from({ length: 300 }, (_, i) => ({
    ...makeScene("a"),
    duration: 36,
    voice: { assetId: "v" + i, duration: 36 },
    transition: "none",
    texts: [
      {
        ...makeText(),
        captions: Array.from({ length: 20 }, (_, i) => ({
          text: `Câu ${i}`,
          startMs: i * 1800,
          endMs: (i + 1) * 1800,
          timestampMs: null,
          confidence: null,
        })),
      },
    ],
  }));
  const start = performance.now();
  const html = renderToStaticMarkup(
    createElement(Timeline, {
      project,
      clock: new PlaybackClock(),
      frame: 0,
      busy: false,
      playing: false,
      estimated: true,
    }),
  );
  const buttons = (html.match(/<button/g) ?? []).length;
  assert.ok(buttons < 800, `Too many DOM buttons at fit zoom: ${buttons}`);
  assert.equal((html.match(/class="timeline-wave"/g) ?? []).length, 0);
  console.log(
    JSON.stringify({
      fixture: "300 scenes / 300 voices / 6000 captions / 3h",
      serverRenderMs: +(performance.now() - start).toFixed(1),
      buttons,
      htmlBytes: Buffer.byteLength(html),
    }),
  );
});

test("heavy tasks queue serially and cancellation removes waiting work", async () => {
  const queue = new ResourceQueue(),
    order = [];
  let release;
  const first = queue.run(async () => {
    order.push(1);
    await new Promise((resolve) => {
      release = resolve;
    });
    order.push(2);
  });
  await new Promise((resolve) => setImmediate(resolve));
  const abort = new AbortController();
  const second = queue.run(() => order.push(99), abort.signal);
  const rejected = assert.rejects(second, /hủy/);
  abort.abort();
  release();
  await first;
  await rejected;
  await queue.run(() => order.push(3));
  assert.deepEqual(order, [1, 2, 3]);
});

test("preview worker compiles off-thread with matching voice and timing", async () => {
  const shim = join(directory, "worker-shim.mjs");
  await writeFile(
    shim,
    `import { parentPort } from 'node:worker_threads'; globalThis.addEventListener = (_, fn) => parentPort.on('message', data => fn({data})); globalThis.postMessage = value => parentPort.postMessage(value); await import(${JSON.stringify(pathToFileURL(resolve("dist/project-worker.js")).href)}); parentPort.postMessage({ready:true});`,
  );
  const worker = new Worker(shim);
  try {
    await new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    const project = emptyProject();
    project.assets = [
      {
        id: "a",
        name: "01.png",
        src: "/samples/coast.svg",
        width: 720,
        height: 1280,
      },
    ];
    project.voiceover = {
      assets: [{ id: "v", name: "01.wav", src: "/media/v.wav", duration: 10 }],
      script: "1. Chào bạn. Hẹn gặp lại!",
      scriptName: "script.txt",
    };
    const reply = new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    worker.postMessage({
      id: 1,
      kind: "preview",
      project,
      options: defaultStoryOptions(),
    });
    const result = await reply;
    assert.equal(result.error, undefined);
    assert.equal(result.result.project.scenes[0].duration, 10);
    assert.equal(result.result.project.scenes[0].voice.assetId, "v");
  } finally {
    await worker.terminate();
  }
});

test("export snapshots are immutable, survive restart, and can be retried or cancelled", async () => {
  const root = join(directory, "export-root");
  await mkdir(join(root, "data/exports"), { recursive: true });
  const runner = join(directory, "fake-export.mjs");
  await writeFile(
    runner,
    `import {readFile,writeFile} from 'node:fs/promises'; const data=JSON.parse(await readFile(process.argv[2],'utf8')); setTimeout(async()=>{ await writeFile(data.output,'fake-mp4'); process.send({done:true}); process.disconnect(); },80); process.on('SIGTERM',()=>process.exit(0));`,
  );
  const queue = new ExportJobs(root, "http://127.0.0.1:3210", {
    workerPath: runner,
  });
  await queue.initialize();
  const project = { name: "Before", assets: [] };
  const job = await queue.create(project, {
    filename: "first.mp4",
    mode: "editing",
    quality: "high",
  });
  project.name = "After";
  const snapshot = JSON.parse(
    await readFile(join(root, "data/jobs", job.id + ".snapshot.json"), "utf8"),
  );
  assert.equal(snapshot.project.name, "Before");
  const wait = async (job) => {
    const start = Date.now();
    while (job.running && Date.now() - start < 5000)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(job.running, false);
  };
  await wait(job);
  assert.equal(job.status, "done");
  const restarted = new ExportJobs(root, "http://127.0.0.1:3210", {
    workerPath: runner,
  });
  await restarted.initialize();
  assert.equal(restarted.jobs.get(job.id).status, "done");
  const retried = await restarted.retry(job.id);
  await wait(retried);
  assert.equal(retried.status, "done");
  const cancelled = await queue.create(project, { filename: "cancel.mp4" });
  await queue.cancel(cancelled);
  await wait(cancelled);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(renderBudget("editing", 8 * 1024 ** 3, 8).concurrency, 1);
  assert.ok(renderBudget("fast", 8 * 1024 ** 3, 8).concurrency <= 2);
  await writeFile(
    join(root, "data/jobs", "12345678-1234-1234-1234-123456789abc.json"),
    JSON.stringify({
      id: "12345678-1234-1234-1234-123456789abc",
      status: "rendering",
    }),
  );
  const afterCrash = new ExportJobs(root, "http://127.0.0.1:3210");
  await afterCrash.initialize();
  assert.equal(
    afterCrash.jobs.get("12345678-1234-1234-1234-123456789abc").status,
    "error",
  );
});

test("batch import limits concurrency, preserves ordering/partial success and keeps old input on total failure", async () => {
  const output = join(directory, "import.mjs");
  await build({
    entryPoints: ["src/editor/story-import.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const { importStoryFiles } = await import(pathToFileURL(output));
  const oldFetch = globalThis.fetch;
  let active = 0,
    max = 0,
    publishes = 0;
  const files = [1, 2, 3].map(
    (i) => new File([String(i)], `0${i}.png`, { type: "image/png" }),
  );
  try {
    globalThis.fetch = async (_, { body }) => {
      active++;
      max = Math.max(max, active);
      await new Promise((resolve) =>
        setTimeout(resolve, body.name === "01.png" ? 8 : 1),
      );
      active--;
      return {
        ok: body.name !== "02.png",
        json: async () =>
          body.name === "02.png"
            ? { error: "Invalid image" }
            : { src: "/media/" + body.name, width: 720, height: 1280 },
      };
    };
    const project = emptyProject();
    const result = await importStoryFiles(
      files,
      project,
      "images",
      () => {},
      false,
      () => publishes++,
    );
    assert.equal(max, 2);
    assert.deepEqual(
      result.project.assets.map((a) => a.name),
      ["01.png", "03.png"],
    );
    assert.equal(result.warnings.length, 1);
    assert.ok(publishes > 0);
    publishes = 0;
    globalThis.fetch = async () => ({
      ok: false,
      json: async () => ({ error: "bad" }),
    });
    await assert.rejects(
      importStoryFiles(
        files,
        result.project,
        "images",
        () => {},
        false,
        () => publishes++,
      ),
    );
    assert.equal(publishes, 0);
    assert.equal(result.project.assets.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("superseded preview jobs terminate rather than accumulate; build cancellation stops worker", async () => {
  const output = join(directory, "project-client.mjs");
  await build({
    entryPoints: ["src/editor/project-client.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const { ProjectWorker } = await import(pathToFileURL(output));
  const PreviousWorker = globalThis.Worker;
  const workers = [];
  globalThis.Worker = class {
    stopped = false;
    constructor() {
      workers.push(this);
    }
    postMessage(data) {
      this.data = data;
    }
    terminate() {
      this.stopped = true;
    }
  };
  const client = new ProjectWorker();
  try {
    const first = client.preview(emptyProject(), defaultStoryOptions());
    const firstRejected = assert.rejects(first, /mới hơn/);
    const second = client.preview(emptyProject(), defaultStoryOptions());
    assert.equal(workers[0].stopped, true);
    workers[1].onmessage({
      data: {
        id: workers[1].data.id,
        result: { project: emptyProject(), estimated: false },
      },
    });
    await firstRejected;
    await second;
    const controller = new AbortController();
    const building = client.build(
      emptyProject(),
      defaultStoryOptions(),
      controller.signal,
    );
    const aborted = assert.rejects(building, /dừng/);
    controller.abort();
    await aborted;
    assert.equal(workers.at(-1).stopped, true);
  } finally {
    client.close();
    globalThis.Worker = PreviousWorker;
  }
});

test("render bundle cache invalidates on source changes and publishes only completed bundles", async () => {
  const { renderBundle } = await import("../scripts/render-bundle.mjs");
  const root = join(directory, "bundle-root");
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "public"));
  await writeFile(join(root, "src/remotion.tsx"), "version-one");
  await writeFile(join(root, "package-lock.json"), "{}");
  let builds = 0;
  const compile = async ({ outDir }) => {
    builds++;
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "index.html"), "test bundle");
  };
  const first = await renderBundle(root, () => {}, compile);
  assert.equal(await renderBundle(root, () => {}, compile), first);
  assert.equal(builds, 1);
  await writeFile(join(root, "src/remotion.tsx"), "version-two");
  assert.notEqual(await renderBundle(root, () => {}, compile), first);
  assert.equal(builds, 2);
});

test("incremental scene cache matches uncached preview after scoped/global changes", async () => {
  const { previewStory } = await import("../dist/story.mjs");
  const project = emptyProject();
  project.assets = [1, 2, 3].map((i) => ({
    id: "a" + i,
    name: `0${i}.png`,
    src: "/samples/coast.svg",
    width: 720,
    height: 1280,
  }));
  project.voiceover = {
    assets: [],
    script: "1. Một câu đầu tiên.\n2. Một câu thứ hai.\n3. Một câu cuối.",
    scriptName: "script.txt",
  };
  const cache = new Map();
  const options = defaultStoryOptions();
  assert.deepEqual(
    previewStory(project, options, cache),
    previewStory(project, options),
  );
  const original = [...cache.entries()];
  const next = {
    ...options,
    sceneOverrides: { "03.png": { motion: "zoom-in", transition: "slide" } },
  };
  assert.deepEqual(
    previewStory(project, next, cache),
    previewStory(project, next),
  );
  assert.equal(cache.get(original[0][0]), original[0][1]);
  assert.equal(cache.get(original[1][0]), original[1][1]);
  for (const change of [
    { ...next, motionAmount: 12 },
    { ...next, seconds: 8 },
    { ...next, transitionSeconds: 0.8 },
    { ...next, caption: { ...next.caption, preset: "highlight" } },
  ]) {
    const actual = previewStory(project, change, cache);
    assert.equal(actual.error, undefined);
    assert.deepEqual(actual, previewStory(project, change));
  }
});
