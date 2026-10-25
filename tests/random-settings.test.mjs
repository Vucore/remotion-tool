import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultStoryOptions,
  parseStoryOptions,
  storyConfig,
  previewStory,
  finishStory,
  optionsFromProject,
} from "../dist/story.mjs";
import { compileAuto } from "../dist/auto.mjs";
import { emptyProject, parseProject, timeline } from "../dist/model.mjs";
import { MOTIONS, TRANSITIONS } from "../dist/catalog.mjs";
import { parseAutoConfig } from "../dist/auto-config.mjs";
import { ttsInputKey } from "../dist/tts.mjs";

const input = () => ({
  ...emptyProject(),
  assets: Array.from({ length: 16 }, (_, i) => ({
    id: `a${i}`,
    name: `${String(i + 1).padStart(2, "0")}.png`,
    src: "/samples/coast.svg",
    width: 720,
    height: 1280,
  })),
  voiceover: {
    assets: [],
    scriptName: "script.txt",
    script: Array.from(
      { length: 16 },
      (_, i) => `${i + 1}. Câu chuyện số ${i + 1}.`,
    ).join("\n"),
  },
});
const randomOptions = () => ({
  ...defaultStoryOptions(),
  motion: "random",
  transition: "random",
});
const choices = (p) => p.scenes.map((s) => [s.motion, s.transition]);
function build(p, o) {
  const config = storyConfig(p, o);
  return finishStory(
    compileAuto(config, p.assets, p, false).project,
    p,
    o,
    config,
  );
}

test("selected random pools reproduce preview/export and avoid consecutive repeats at both ratios", () => {
  for (const ratio of ["9:16", "16:9"]) {
    const p = input(),
      o = { ...randomOptions(), ratio };
    const preview = previewStory(p, o);
    assert.equal(preview.error, undefined);
    const built = build(p, o);
    assert.deepEqual(choices(preview.project), choices(built));
    assert.deepEqual(choices(previewStory(p, o).project), choices(built));
    built.scenes.forEach((scene, i) => {
      assert.ok(o.motionRandom.presets.includes(scene.motion));
      assert.ok(o.transitionRandom.presets.includes(scene.transition));
      if (i) {
        assert.notEqual(scene.motion, built.scenes[i - 1].motion);
        assert.notEqual(scene.transition, built.scenes[i - 1].transition);
      }
    });
    const restored = parseStoryOptions(
      optionsFromProject(parseProject(JSON.parse(JSON.stringify(built)))),
    );
    assert.equal(restored.motion, "random");
    assert.equal(restored.transition, "random");
    assert.deepEqual(
      choices(previewStory(p, restored).project),
      choices(built),
    );
  }
});

test("reshuffling one track preserves the other; random settings survive JSON and one-choice pools", () => {
  const p = input(),
    o = randomOptions();
  const first = previewStory(p, o).project;
  const changed = { ...o, motionRandom: { ...o.motionRandom, seed: 573 } };
  const after = previewStory(p, changed).project;
  assert.notDeepEqual(
    after.scenes.map((s) => s.motion),
    first.scenes.map((s) => s.motion),
  );
  assert.deepEqual(
    after.scenes.map((s) => s.transition),
    first.scenes.map((s) => s.transition),
  );
  assert.deepEqual(
    parseStoryOptions(JSON.parse(JSON.stringify(changed))),
    changed,
  );
  const single = previewStory(p, {
    ...o,
    motionRandom: { presets: ["float"], seed: 9 },
    transitionRandom: { presets: ["none"], seed: 9 },
  }).project;
  assert.ok(
    single.scenes.every((s) => s.motion === "float" && s.transition === "none"),
  );
  const reordered = {
    ...o,
    motionRandom: {
      ...o.motionRandom,
      presets: [...o.motionRandom.presets].reverse(),
    },
  };
  assert.deepEqual(choices(previewStory(p, reordered).project), choices(first));
});

test("scene random overrides, incremental compilation and plain project restore keep their settings", () => {
  const p = input(),
    o = defaultStoryOptions();
  o.sceneOverrides["01.png"] = {
    motion: "random",
    motionRandom: { presets: ["bounce", "curve"], seed: 71 },
    transition: "random",
    transitionRandom: { presets: ["iris", "heart"], seed: 72 },
  };
  const cache = new Map();
  const first = previewStory(p, o, cache);
  const config = storyConfig(p, o);
  // Exercise the same scene cache used by the preview worker.
  compileAuto(config, p.assets, p, false, undefined, [], cache);
  const changed = {
    ...o,
    motion: "random",
    motionRandom: { presets: ["pan-down", "pan-up"], seed: 173 },
  };
  const next = storyConfig(p, changed);
  const cached = compileAuto(
    next,
    p.assets,
    p,
    false,
    undefined,
    [],
    cache,
  ).project;
  assert.deepEqual(choices(cached), choices(build(p, changed)));
  const restored = optionsFromProject(build(p, o));
  assert.deepEqual(
    restored.sceneOverrides["01.png"].motionRandom,
    o.sceneOverrides["01.png"].motionRandom,
  );
  assert.deepEqual(
    restored.sceneOverrides["01.png"].transitionRandom,
    o.sceneOverrides["01.png"].transitionRandom,
  );
  assert.deepEqual(
    choices(first.project),
    choices(previewStory(p, restored).project),
  );
});

test("legacy defaults remain compatible, full catalogs work and invalid pools fail before export", () => {
  const legacy = defaultStoryOptions();
  delete legacy.motionRandom;
  delete legacy.transitionRandom;
  assert.deepEqual(
    parseStoryOptions(legacy).motionRandom,
    defaultStoryOptions().motionRandom,
  );
  for (const presets of [[], ["unknown"], ["zoom-in", "zoom-in"]])
    assert.throws(() =>
      parseStoryOptions({
        ...randomOptions(),
        motionRandom: { presets, seed: 42 },
      }),
    );
  assert.throws(() =>
    parseStoryOptions({
      ...randomOptions(),
      transitionRandom: { presets: ["fade"], seed: -1 },
    }),
  );
  assert.throws(() =>
    parseAutoConfig({
      autoEditVersion: 1,
      transition: { policy: "seeded", presets: [] },
    }),
  );
  const all = {
    ...randomOptions(),
    motionRandom: { presets: Object.keys(MOTIONS), seed: 42 },
    transitionRandom: { presets: Object.keys(TRANSITIONS), seed: 42 },
  };
  assert.equal(previewStory(input(), all).error, undefined);
});

test("caption coordinates persist globally/per scene while voice timing, alignment and TTS key stay intact", () => {
  const p = input(),
    o = randomOptions();
  p.voiceover.assets = p.assets.map((a, i) => ({
    id: `v${i}`,
    name: a.name.replace(".png", ".wav"),
    src: `/media/v${i}.wav`,
    duration: 5,
  }));
  const before = previewStory(p, o).project;
  before.scenes.forEach((s) => (s.texts[0].captions[0].startMs = 230));
  o.caption.advanced = { x: 37, y: 23 };
  o.sceneOverrides["02.png"] = {
    caption: { ...o.caption, advanced: { x: 63, y: 72 } },
  };
  const result = previewStory(before, o);
  assert.equal(result.estimated, false);
  assert.equal(result.project.scenes[0].texts[0].x, 37);
  assert.equal(result.project.scenes[0].texts[0].y, 23);
  assert.equal(result.project.scenes[1].texts[0].x, 63);
  assert.equal(result.project.scenes[1].texts[0].y, 72);
  assert.equal(result.project.scenes[0].texts[0].captions[0].startMs, 230);
  assert.deepEqual(
    timeline(result.project).map((i) => i.from),
    timeline(before).map((i) => i.from),
  );
  assert.equal(
    ttsInputKey(p.voiceover.script, o.tts),
    ttsInputKey(p.voiceover.script, defaultStoryOptions().tts),
  );
  const restored = optionsFromProject(result.project);
  assert.equal(restored.caption.advanced.x, 37);
  assert.equal(restored.sceneOverrides["02.png"].caption.advanced.y, 72);
});
