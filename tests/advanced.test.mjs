import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  emptyProject,
  makeScene,
  makeText,
  parseProject,
  parseEffects,
  splitScene,
  totalFrames,
} from "../dist/model.mjs";
import { effectDescriptors } from "../dist/effects.mjs";
import { imagePose, transitionStyle } from "../dist/animation.mjs";
import { MOTIONS, TRANSITIONS, EASINGS } from "../dist/catalog.mjs";
const { effects } = JSON.parse(
  await readFile(
    new URL("../src/effects/catalog.generated.json", import.meta.url),
    "utf8",
  ),
);
const fixture = () => {
  const p = emptyProject();
  p.assets = [
    {
      id: "a",
      name: "Ảnh",
      src: "/samples/coast.svg",
      width: 1600,
      height: 1000,
    },
  ];
  p.scenes = [makeScene("a")];
  return p;
};
const spec = (kind) => ({
  id: crypto.randomUUID(),
  kind,
  enabled: true,
  start: 0,
  end: null,
  offset: 0,
  span: null,
  params: structuredClone(effects.find((e) => e.kind === kind).defaults),
  automation: {},
});
test("every pinned official effect has valid typed defaults (no GPU required)", () => {
  assert.equal(effects.length, 81);
  for (const effect of effects)
    assert.doesNotThrow(() => parseEffects([spec(effect.kind)]), effect.kind);
});
test("legacy projects migrate without losing regular text, imagery or timing", () => {
  const p = fixture();
  delete p.fonts;
  const base = p.scenes[0];
  p.scenes = [
    Object.fromEntries(
      [
        "id",
        "assetId",
        "duration",
        "fit",
        "x",
        "y",
        "scale",
        "rotate",
        "flip",
        "brightness",
        "contrast",
        "saturation",
        "filter",
        "motion",
        "transition",
        "transitionDuration",
      ].map((key) => [key, base[key]]),
    ),
  ];
  p.scenes[0].texts = [
    {
      id: "legacy",
      text: "Tiếng Việt",
      x: 50,
      y: 75,
      size: 64,
      color: "#ffffff",
      background: "transparent",
      bold: false,
      align: "center",
    },
  ];
  const result = parseProject(p);
  assert.equal(result.scenes[0].texts[0].weight, 400);
  assert.equal(result.scenes[0].texts[0].animationIn, "none");
  assert.deepEqual(result.fonts, []);
  assert.deepEqual(result.scenes[0].effects, []);
  assert.equal(totalFrames(result), 120);
});
test("new text styles, fonts, keyframes, effects and automation round-trip", () => {
  const p = fixture();
  const src = "/fonts/12345678-1234-1234-1234-123456789abc.woff2";
  p.fonts = [
    {
      id: "khung-12345678-1234-1234-1234-123456789abc",
      src,
      name: "Font riêng",
    },
  ];
  p.scenes[0].texts = [
    {
      ...makeText(),
      fontFamily: "khung-12345678-1234-1234-1234-123456789abc",
      animationIn: "letter-rise",
      animationOut: "blur",
      loop: "wave",
      shape: "normal",
      fill: "gradient",
      stroke: 2,
      depth: 3,
      start: 0.5,
      end: 3.5,
    },
  ];
  p.scenes[0].effects = [
    {
      ...spec("blur"),
      automation: { radius: { from: 0, to: 20, easing: "ease-in" } },
    },
  ];
  p.scenes[0].keyframes = [
    { time: 0, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
    { time: 3, x: 20, y: 10, scale: 1.2, rotate: 15, opacity: 0.5 },
  ];
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))), p);
});
test("effect windows, bypass and numeric automation are frame deterministic", () => {
  const effect = {
    ...spec("brightness"),
    start: 1,
    end: 3,
    automation: { amount: { from: 0, to: 1, easing: "linear" } },
  };
  assert.equal(effectDescriptors([effect], 0.5, 4).length, 0);
  assert.equal(effectDescriptors([effect], 3, 4).length, 0);
  assert.equal(
    effectDescriptors([{ ...effect, enabled: false }], 2, 4).length,
    0,
  );
  assert.equal(effectDescriptors([effect], 2, 4)[0].params.amount, 0.5);
  assert.deepEqual(
    effectDescriptors([effect], 2, 4)[0].params,
    effectDescriptors([effect], 2, 4)[0].params,
  );
});
test("split preserves source clocks of image, text, effects and overlays", () => {
  const p = fixture(),
    scene = p.scenes[0];
  scene.motion = "zoom-in";
  scene.texts = [
    { ...makeText(), start: 1, end: 3.5, animationIn: "typewriter" },
  ];
  scene.effects = [
    {
      ...spec("brightness"),
      automation: { amount: { from: 0, to: 1, easing: "ease-in" } },
    },
  ];
  scene.overlays = [
    {
      id: "dust",
      kind: "dust",
      enabled: true,
      amount: 0.5,
      color: "#ffffff",
      speed: 1,
      size: 1,
      seed: 2,
      start: 0.5,
      end: 3.5,
      offset: 0,
    },
  ];
  const result = splitScene(p, scene.id, 60);
  assert.ok(result);
  const [first, second] = result.scenes;
  assert.equal(totalFrames(result), totalFrames(p));
  assert.equal(first.texts[0].end, null);
  assert.equal(second.texts[0].start, 0);
  assert.equal(second.texts[0].end, 1.5);
  assert.equal(second.texts[0].offset, 1);
  assert.equal(second.texts[0].span, 2.5);
  assert.equal(second.overlays[0].offset, 1.5);
  const expected = imagePose(scene, 75, 30, 120),
    actual = imagePose(second, 15, 30, 60);
  assert.deepEqual(actual, expected);
  assert.deepEqual(
    effectDescriptors(second.effects, 0.5, 2)[0].params,
    effectDescriptors(scene.effects, 2.5, 4)[0].params,
  );
  assert.doesNotThrow(() => parseProject(result));
});
test("all image motion, transition and easing combinations produce finite output", () => {
  const p = fixture();
  for (const easing of Object.keys(EASINGS)) {
    for (const motion of Object.keys(MOTIONS)) {
      const s = { ...p.scenes[0], motion, motionEasing: easing };
      for (const frame of [0, 1, 30, 60, 119])
        for (const value of Object.values(imagePose(s, frame, 30, 120)))
          assert.ok(Number.isFinite(value), `${motion}/${easing}`);
    }
    for (const type of Object.keys(TRANSITIONS))
      for (const direction of ["left", "right", "up", "down"])
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
          const style = transitionStyle(type, progress, direction);
          assert.ok(!/NaN|Infinity/.test(JSON.stringify(style)), type);
        }
  }
});
test("unknown effects, invalid native parameters, fonts and duplicate IDs are rejected", () => {
  for (const corrupt of [
    (e) => (e.kind = "unknown"),
    (e) => (e.params.amount = Infinity),
    (e) => (e.params.unknown = 1),
    (e) => (e.automation.amount = { from: -2, to: 1, easing: "linear" }),
  ]) {
    const e = spec("brightness");
    corrupt(e);
    assert.throws(() => parseEffects([e]));
  }
  const p = fixture();
  p.fonts = [
    { id: "bad", name: "Bad", src: "https://example.invalid/font.woff2" },
  ];
  assert.throws(() => parseProject(p));
  const duplicate = fixture();
  const text = makeText();
  duplicate.scenes[0].texts = [text, { ...text }];
  assert.throws(() => parseProject(duplicate));
  const square = fixture();
  square.height = 1080;
  assert.throws(() => parseProject(square));
});
