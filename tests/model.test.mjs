import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyProject,
  makeScene,
  makeText,
  timeline,
  totalFrames,
  splitScene,
  moveScene,
  parseProject,
  sceneAt,
} from "../dist/model.mjs";

const fixture = () => {
  const p = emptyProject();
  p.assets = [
    {
      id: "a",
      name: "Biển",
      src: "/samples/coast.svg",
      width: 1600,
      height: 1000,
    },
  ];
  p.scenes = [makeScene("a"), makeScene("a"), makeScene("a")];
  return p;
};
test("overlap is subtracted from total duration; each scene uses integer frames", () => {
  const p = fixture();
  const t = timeline(p);
  assert.deepEqual(
    t.map((s) => [s.from, s.duration, s.overlap]),
    [
      [0, 120, 0],
      [105, 120, 15],
      [210, 120, 15],
    ],
  );
  assert.equal(totalFrames(p), 330);
  assert.equal(sceneAt(p, 108), p.scenes[1].id);
});
test("hard cuts keep the full duration", () => {
  const p = fixture();
  p.scenes.forEach((s) => (s.transition = "none"));
  assert.equal(totalFrames(p), 360);
});
test("transitions never exceed half either adjacent scene", () => {
  const p = fixture();
  p.scenes[0].duration = 0.5;
  p.scenes[0].transitionDuration = 2;
  assert.equal(timeline(p)[1].overlap, 7);
  assert.ok(timeline(p).every((t) => Number.isInteger(t.from)));
});
test("changing FPS preserves time within frame rounding", () => {
  const p = fixture();
  p.fps = 60;
  assert.equal(totalFrames(p), 660);
});
test("split preserves video duration, text, and creates unique layer IDs", () => {
  const p = fixture();
  p.scenes[1].texts = [makeText()];
  const result = splitScene(p, p.scenes[1].id, 165);
  assert.ok(result);
  assert.equal(result.scenes.length, 4);
  assert.equal(totalFrames(result), totalFrames(p));
  assert.equal(result.scenes[1].transition, "none");
  assert.notEqual(result.scenes[1].texts[0].id, result.scenes[2].texts[0].id);
});
test("split rejects transition intervals and cuts near boundaries", () => {
  const p = fixture();
  assert.equal(splitScene(p, p.scenes[1].id, 108), null);
  assert.equal(splitScene(p, p.scenes[0].id, 119), null);
});
test("reordering preserves every scene and supports both directions", () => {
  const p = fixture();
  const a = p.scenes.map((s) => s.id);
  assert.deepEqual(
    moveScene(p, a[0], a[2]).scenes.map((s) => s.id),
    [a[1], a[2], a[0]],
  );
  assert.deepEqual(
    moveScene(p, a[2], a[0]).scenes.map((s) => s.id),
    [a[2], a[0], a[1]],
  );
});
test("project survives JSON round-trip", () => {
  const p = fixture();
  p.scenes[0].texts = [makeText()];
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))), p);
});
test("invalid references, URLs, dimensions and unknown effects are rejected", () => {
  for (const corrupt of [
    (p) => (p.scenes[0].assetId = "missing"),
    (p) => (p.assets[0].src = "https://evil.invalid/test.png"),
    (p) => (p.assets[0].src = "/media/../secret.png"),
    (p) => (p.width = 1081),
    (p) => (p.scenes[0].duration = -1),
    (p) => (p.scenes[0].motion = "unsupported"),
    (p) => (p.scenes[0].brightness = Infinity),
    (p) => (p.scenes[1].id = p.scenes[0].id),
  ]) {
    const p = fixture();
    corrupt(p);
    assert.throws(() => parseProject(p));
  }
});
