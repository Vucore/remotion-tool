import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseSrt,
  toSrt,
  srtTimestamp,
  subtitleFilename,
  bilingualCues,
  projectSubtitles,
  estimatedSubtitles,
} from "../dist/subtitles.mjs";
import { emptyProject, makeScene, makeText, timeline } from "../dist/model.mjs";
import {
  translateSubtitles,
  translationLanguages,
} from "../scripts/translate-subtitles.mjs";

const cues = [
  { startMs: 400, endMs: 2100, text: "Xin chào.\nĐây là cảnh một." },
  { startMs: 2650, endMs: 4800, text: "Một buổi sáng vui vẻ." },
];
async function storage(run) {
  const dir = await mkdtemp(join(tmpdir(), "khung-srt-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("SRT UTF-8 preserves cue text, line breaks, timing, overlap and millisecond boundaries", () => {
  const srt = toSrt(cues);
  assert.deepEqual(parseSrt("\uFEFF" + srt.replace(/\n/g, "\r\n")), cues);
  assert.match(srt, /00:00:00,400 --> 00:00:02,100/);
  assert.equal(srtTimestamp(3599999.6), "01:00:00,000");
  assert.equal(srtTimestamp(36000000), "10:00:00,000");
  assert.equal(
    parseSrt(
      "1\n00:00:00,000 --> 00:00:02,000\n日本語\n\n2\n00:00:01,500 --> 00:00:03,000\n한국어",
    ).length,
    2,
  );
  for (const input of [
    "hello",
    "1\n00:00:02,000 --> 00:00:01,000\nSai",
    "1\n00:61:00,000 --> 00:62:00,000\nSai",
    "1\n00:00:01,000 --> 00:00:02,000\n",
  ])
    assert.throws(() => parseSrt(input));
});
test("SRT export uses global scene clocks, includes hidden captions and bilingual keeps exact timing", () => {
  const p = emptyProject();
  p.fps = 30;
  p.scenes = [1, 2].map((n) => ({
    ...makeScene("a" + n),
    duration: n === 1 ? 4 : 3,
    voice: { assetId: "v" + n, duration: n === 1 ? 4 : 3 },
    transition: "fade",
    transitionDuration: 0.5,
    texts: [{ ...makeText(), visible: false, captions: [cues[0]] }],
  }));
  const exported = projectSubtitles(p),
    timing = timeline(p);
  assert.equal(exported[1].startMs, (timing[1].from / p.fps) * 1000 + 400);
  assert.equal(exported[1].startMs, 4400);
  assert.deepEqual(parseSrt(toSrt(exported)), exported);
  assert.equal(estimatedSubtitles(p), false);
  delete p.scenes[0].voice;
  assert.equal(estimatedSubtitles(p), true);
  assert.equal(estimatedSubtitles(JSON.parse(JSON.stringify(p))), true);
  const translated = exported.map((c) => ({ ...c, text: "Hello" }));
  const bilingual = bilingualCues(exported, translated);
  assert.ok(
    bilingual.every(
      (c, i) =>
        c.startMs === exported[i].startMs &&
        c.endMs === exported[i].endMs &&
        c.text.endsWith("\nHello"),
    ),
  );
  assert.throws(() => bilingualCues(exported, []), /khớp/);
});
test("file names contain language code and Vietnamese language name", () => {
  assert.equal(subtitleFilename("video.mp4", "en"), "video_en_tienganh.srt");
  assert.equal(
    subtitleFilename("video", "vi", "en"),
    "video_vi_tiengviet_en_tienganh_songngu.srt",
  );
  assert.equal(
    subtitleFilename("video", "af", undefined, { af: "Tiếng Nam Phi" }),
    "video_af_tiengnamphi.srt",
  );
  assert.ok(!subtitleFilename("../../video", "ja").includes("/"));
  assert.throws(() => subtitleFilename("video", "../../key"));
});
test("free Google translation preserves timestamps and reuses cache without keys", async () =>
  storage(async (dir) => {
    let calls = 0;
    const translator = async (payload) => {
      if (payload.action === "languages")
        return {
          languages: [
            { code: "en", name: "english" },
            { code: "vi", name: "vietnamese" },
          ],
        };
      calls++;
      assert.equal(payload.source, "vi");
      assert.equal(payload.target, "en");
      assert.ok(!("apiKey" in payload));
      return {
        translations: payload.texts.map((_, i) =>
          i ? "A cheerful morning." : "Hello & welcome.",
        ),
      };
    };
    const input = { cues, source: "vi", target: "en" };
    const result = await translateSubtitles(input, {
      cacheDirectory: dir,
      translator,
    });
    assert.equal(result.cues[0].text, "Hello & welcome.");
    assert.deepEqual(
      result.cues.map(({ startMs, endMs }) => ({ startMs, endMs })),
      cues.map(({ startMs, endMs }) => ({ startMs, endMs })),
    );
    await translateSubtitles(
      {
        ...input,
        cues: cues.map((c) => ({
          ...c,
          startMs: c.startMs + 1000,
          endMs: c.endMs + 1000,
        })),
      },
      { cacheDirectory: dir, translator },
    );
    assert.equal(calls, 1);
    assert.equal((await translationLanguages({ translator })).length, 2);
  }));
test("translation failures and cancellation leave original cues intact", async () =>
  storage(async (dir) => {
    const input = { cues, source: "vi", target: "en" };
    await assert.rejects(
      translateSubtitles(input, {
        cacheDirectory: dir,
        translator: async () => {
          throw Error("Google đang giới hạn lượt dịch");
        },
      }),
      /giới hạn/,
    );
    await assert.rejects(
      translateSubtitles(input, {
        cacheDirectory: dir,
        translator: async () => ({ translations: [] }),
      }),
      /khớp/,
    );
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      translateSubtitles(input, { cacheDirectory: dir, signal: abort.signal }),
      /dừng/,
    );
    assert.equal(cues[0].text, "Xin chào.\nĐây là cảnh một.");
    assert.deepEqual(await readdir(dir), []);
  }));
