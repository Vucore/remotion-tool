import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultStoryOptions,
  parseStoryOptions,
  storyInputs,
  storyConfig,
  finishStory,
} from "../dist/story.mjs";
import { compileAuto } from "../dist/auto.mjs";
import { emptyProject, parseProject, timeline } from "../dist/model.mjs";
const input = () => ({
  ...emptyProject(),
  assets: [2, 1].map((n) => ({
    id: "a" + n,
    name: "0" + n + ".png",
    src: "/samples/coast.svg",
    width: 720,
    height: 1280,
  })),
  voiceover: {
    assets: [],
    script: "1. Một buổi sáng. Cậu bé thức dậy!\n2. Cậu chạy ra ngoài sân.",
    scriptName: "script.txt",
  },
});
test("story input pairs by number, rejects missing or duplicate images and missing script for voice", () => {
  const p = input();
  assert.deepEqual(
    storyInputs(p).map((r) => r.image.name),
    ["01.png", "02.png"],
  );
  assert.throws(
    () => storyInputs({ ...p, assets: p.assets.slice(0, 1) }),
    /Thiếu ảnh/,
  );
  assert.throws(
    () => storyInputs({ ...p, assets: [p.assets[0], p.assets[0]] }),
    /trùng/,
  );
  assert.throws(
    () =>
      storyInputs({
        ...p,
        voiceover: { assets: [{ name: "01.wav" }], script: "" },
      }),
    /Thêm một TXT/,
  );
});
test("text-only story splits estimated captions within scene duration and round-trips at both ratios", () => {
  for (const ratio of ["9:16", "16:9"]) {
    const p = input(),
      o = { ...defaultStoryOptions(), ratio, overlay: "stars" };
    const c = storyConfig(p, o);
    const result = finishStory(
      compileAuto(c, p.assets, p, false).project,
      p,
      o,
      c,
    );
    assert.deepEqual(parseProject(JSON.parse(JSON.stringify(result))), result);
    assert.equal(result.scenes[0].texts[0].captions.length, 2);
    assert.equal(result.scenes[0].overlays[0].kind, "stars");
    for (const s of result.scenes) {
      const captions = s.texts[0].captions;
      assert.ok(
        captions.every(
          (cue, i) =>
            cue.endMs <= s.duration * 1000 &&
            cue.startMs < cue.endMs &&
            (!i || cue.startMs >= captions[i - 1].endMs),
        ),
      );
    }
  }
});
test("WAV decides scene time; hidden subtitles keep exact alignment and voice never overlaps", () => {
  const p = input();
  p.voiceover.assets = [1, 2].map((n) => ({
    id: "v" + n,
    name: "0" + n + ".wav",
    src: "/media/v" + n + ".wav",
    duration: n === 1 ? 3.21 : 6.1,
  }));
  const o = { ...defaultStoryOptions(), style: "lively", subtitles: false };
  const c = storyConfig(p, o);
  const captions = [
    ["Một buổi sáng.", "Cậu bé thức dậy!"],
    ["Cậu chạy ra ngoài sân."],
  ];
  const alignments = p.voiceover.assets.map((v, i) => ({
    voiceId: v.id,
    captions: captions[i].map((text, j, all) => ({
      text,
      startMs: (j * v.duration * 1000) / all.length,
      endMs: ((j + 1) * v.duration * 1000) / all.length,
      timestampMs: null,
      confidence: 0.9,
    })),
  }));
  const result = finishStory(
    compileAuto(c, p.assets, p, false, { input: p.voiceover, alignments })
      .project,
    p,
    o,
    c,
  );
  assert.equal(result.scenes[0].duration, Math.ceil(3.21 * 30) / 30);
  assert.deepEqual(result.scenes[0].texts[0].captions, alignments[0].captions);
  assert.equal(result.scenes[0].texts[0].visible, false);
  const t = timeline(result);
  assert.ok(t[1].from >= t[0].from + Math.ceil(3.21 * 30));
});
test("automatic actor casting follows template, and invalid saved options fail before rendering", () => {
  const p = input();
  p.actors = [
    {
      id: "boy",
      name: "Cậu bé",
      width: 200,
      height: 400,
      kind: "cutout",
      image: {
        id: "boy-image",
        name: "boy.png",
        src: "/media/boy.png",
        width: 200,
        height: 400,
      },
    },
  ];
  const o = { ...defaultStoryOptions(), style: "lively" },
    c = storyConfig(p, o);
  const result = finishStory(
    compileAuto(c, p.assets, p, false).project,
    p,
    o,
    c,
  );
  assert.ok(
    result.scenes.every(
      (s) =>
        s.actors.length === 1 &&
        s.actors[0].actions.some((a) => a.kind === "enter"),
    ),
  );
  const off = storyConfig(p, { ...o, characters: false });
  assert.ok(
    compileAuto(off, p.assets, p, false).project.scenes.every(
      (s) => !s.actors?.length,
    ),
  );
  for (const patch of [
    { ratio: "1:1" },
    { seconds: NaN },
    { name: "" },
    { style: "unknown" },
    { subtitles: "false" },
  ])
    assert.throws(() => parseStoryOptions({ ...o, ...patch }));
});

test("instant preview plays matching WAVs before alignment, including without TXT", async () => {
  const { previewStory } = await import("../dist/story.mjs");
  const p = input();
  p.voiceover.assets = [1, 2].map((n) => ({
    id: "v" + n,
    name: "0" + n + ".wav",
    src: "/media/v" + n + ".wav",
    duration: 4.12 + n,
  }));
  const result = previewStory(p, defaultStoryOptions());
  assert.equal(result.error, undefined);
  assert.equal(result.estimated, true);
  assert.equal(result.project.scenes[0].voice.assetId, "v1");
  assert.equal(timeline(result.project)[1].from, Math.ceil(5.12 * 30));
  assert.ok(
    result.project.scenes.every(
      (s) => s.texts[0].captions.at(-1).endMs <= s.voice.duration * 1000,
    ),
  );
  const noText = previewStory(
    { ...p, voiceover: { ...p.voiceover, script: "" } },
    defaultStoryOptions(),
  );
  assert.equal(noText.error, undefined);
  assert.ok(noText.project.scenes.every((s) => s.voice && !s.texts.length));
});
test("effect changes reuse aligned cues and every overlay type compiles into preview", async () => {
  const { previewStory, newStoryOverlay } = await import("../dist/story.mjs");
  const { OVERLAYS, MOTIONS, TRANSITIONS } =
    await import("../dist/catalog.mjs");
  const p = input();
  p.voiceover.assets = [1, 2].map((n) => ({
    id: "v" + n,
    name: "0" + n + ".wav",
    src: "/media/v" + n + ".wav",
    duration: 5,
  }));
  const original = previewStory(p, defaultStoryOptions()).project;
  original.scenes[0].texts[0].captions[0].startMs = 220;
  const changed = previewStory(original, {
    ...defaultStoryOptions(),
    motion: "zoom-out",
    overlays: [newStoryOverlay("rain"), newStoryOverlay("vignette")],
    caption: {
      ...defaultStoryOptions().caption,
      preset: "outline",
      animation: "pop",
    },
  });
  assert.equal(changed.estimated, false);
  assert.equal(changed.project.scenes[0].texts[0].captions[0].startMs, 220);
  assert.equal(changed.project.scenes[0].motion, "zoom-out");
  assert.equal(changed.project.scenes[0].texts[0].animationIn, "pop");
  for (const kind of Object.keys(OVERLAYS))
    assert.equal(
      previewStory(input(), {
        ...defaultStoryOptions(),
        overlays: [newStoryOverlay(kind)],
      }).error,
      undefined,
      kind,
    );
  for (const motion of Object.keys(MOTIONS))
    assert.equal(
      previewStory(input(), { ...defaultStoryOptions(), motion }).error,
      undefined,
      motion,
    );
  for (const transition of Object.keys(TRANSITIONS))
    assert.equal(
      previewStory(input(), { ...defaultStoryOptions(), transition }).error,
      undefined,
      transition,
    );
});

test("advanced image/transition/caption settings survive preview, build and project restore", async () => {
  const { previewStory, optionsFromProject } =
    await import("../dist/story.mjs");
  const p = input(),
    o = defaultStoryOptions();
  o.motion = "curve";
  o.image = {
    ...o.image,
    motionSpeed: 1.6,
    motionStart: 0.3,
    motionDuration: 2,
    focusX: 30,
    focusY: 65,
    motionEasing: "elastic",
    keyframes: [
      { time: 0, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      { time: 2, x: 10, y: -5, scale: 1.2, rotate: 8, opacity: 0.9 },
    ],
  };
  o.transition = "book-flip";
  o.transitionEasing = "ease-in-out";
  o.caption = {
    ...o.caption,
    size: 112,
    animation: "letter-spin",
    transparent: true,
    advanced: {
      animationOut: "word-pop",
      inDuration: 0.4,
      outDuration: 0.3,
      easing: "back",
      loop: "wave",
      lineHeight: 1.4,
      stroke: 2,
      strokeColor: "#123456",
      shadow: 9,
      fill: "gradient",
      gradientColor: "#abcdef",
      x: 48,
      y: 80,
    },
  };
  const parsed = parseStoryOptions(JSON.parse(JSON.stringify(o))),
    c = storyConfig(p, parsed);
  const built = finishStory(
    compileAuto(c, p.assets, p, false).project,
    p,
    parsed,
    c,
  );
  const preview = previewStory(p, parsed);
  assert.equal(preview.error, undefined);
  for (const project of [built, preview.project]) {
    assert.deepEqual(project.scenes[0].keyframes, o.image.keyframes);
    assert.equal(project.scenes[0].focusX, 30);
    assert.equal(project.scenes[0].transitionEasing, "ease-in-out");
    assert.equal(project.scenes[0].texts[0].animationOut, "word-pop");
    assert.equal(project.scenes[0].texts[0].loop, "wave");
    assert.equal(project.scenes[0].texts[0].background, "transparent");
  }
  const restored = parseStoryOptions(optionsFromProject(built));
  assert.equal(restored.image.motionStart, 0.3);
  assert.equal(restored.caption.animation, "letter-spin");
  assert.equal(restored.caption.advanced.animationOut, "word-pop");
  assert.equal(restored.caption.size, 112);
  assert.equal(restored.transitionEasing, "ease-in-out");
});

test("all catalog text animations and loops compile, legacy options migrate, invalid advanced fields fail", async () => {
  const { TEXT_ANIMATIONS, TEXT_LOOPS } = await import("../dist/catalog.mjs");
  const p = input(),
    old = defaultStoryOptions();
  delete old.image;
  delete old.transitionEasing;
  delete old.caption.advanced;
  delete old.caption.transparent;
  const options = parseStoryOptions(old);
  assert.equal(options.image.motionStart, 0);
  assert.deepEqual(options.caption.advanced, {});
  for (const animation of Object.keys(TEXT_ANIMATIONS)) {
    const o = {
      ...options,
      caption: {
        ...options.caption,
        animation,
        advanced: { animationOut: animation },
      },
    };
    const c = storyConfig(p, o),
      project = finishStory(
        compileAuto(c, p.assets, p, false).project,
        p,
        o,
        c,
      );
    assert.equal(project.scenes[0].texts[0].animationOut, animation);
  }
  for (const loop of Object.keys(TEXT_LOOPS))
    assert.equal(
      storyConfig(p, {
        ...options,
        caption: { ...options.caption, advanced: { loop } },
      }).text.style.loop,
      loop,
    );
  assert.throws(() =>
    parseStoryOptions({
      ...options,
      image: { ...options.image, motionSpeed: 99 },
    }),
  );
  assert.throws(() =>
    parseStoryOptions({
      ...options,
      caption: { ...options.caption, advanced: { captions: [] } },
    }),
  );
  assert.throws(() =>
    parseStoryOptions({
      ...options,
      caption: { ...options.caption, advanced: { animationOut: "invalid" } },
    }),
  );
});

test("per-scene image, transition and caption overrides survive preview, voice alignment and project restore", async () => {
  const { previewStory, optionsFromProject } =
    await import("../dist/story.mjs");
  const p = input(),
    o = defaultStoryOptions();
  o.sceneOverrides["01.png"] = {
    motion: "figure-eight",
    transition: "cube",
    transitionEasing: "expo",
    image: { ...o.image, focusX: 22, motionSpeed: 2 },
    caption: {
      ...o.caption,
      animation: "word-pop",
      advanced: { animationOut: "blur", stroke: 4 },
    },
  };
  o.sceneOverrides["02.png"] = { motion: "none", subtitles: false };
  const c = storyConfig(p, o),
    built = finishStory(compileAuto(c, p.assets, p, false).project, p, o, c),
    preview = previewStory(p, o);
  assert.equal(preview.error, undefined);
  for (const project of [built, preview.project]) {
    assert.equal(project.scenes[0].motion, "figure-eight");
    assert.equal(project.scenes[0].focusX, 22);
    assert.equal(project.scenes[0].transition, "cube");
    assert.equal(project.scenes[0].texts[0].animationOut, "blur");
    assert.equal(project.scenes[1].motion, "none");
    assert.equal(project.scenes[1].texts[0].visible, false);
  }
  const restored = parseStoryOptions(optionsFromProject(built));
  const rebuilt = previewStory(p, restored);
  assert.equal(rebuilt.project.scenes[0].texts[0].animationOut, "blur");
  assert.equal(rebuilt.project.scenes[0].transition, "cube");
  assert.equal(rebuilt.project.scenes[1].texts[0].visible, false);
  const { splitSentences } = await import("../dist/narration.mjs");
  const voices = [1, 2].map((n) => ({
    id: "v" + n,
    name: "0" + n + ".wav",
    src: "/media/voice" + n + ".wav",
    duration: 5,
  }));
  const voiced = { ...p, voiceover: { ...p.voiceover, assets: voices } };
  const vc = storyConfig(voiced, o);
  const sections = storyInputs(voiced);
  const alignments = sections.map((r) => ({
    voiceId: r.voice.id,
    captions: splitSentences(r.text, vc.narration.maxChars).map(
      (text, i, all) => ({
        text,
        startMs: (i * 4800) / all.length,
        endMs: ((i + 1) * 4800) / all.length,
        timestampMs: null,
        confidence: 1,
      }),
    ),
  }));
  const aligned = finishStory(
    compileAuto(vc, voiced.assets, voiced, false, {
      input: voiced.voiceover,
      alignments,
    }).project,
    voiced,
    o,
    vc,
  );
  assert.equal(aligned.scenes[0].texts[0].animationOut, "blur");
  assert.equal(aligned.scenes[1].texts[0].visible, false);
  assert.equal(aligned.scenes[0].duration, 5);
});
