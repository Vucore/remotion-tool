import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateTts } from "../scripts/tts.mjs";
import { runVoiceFfmpeg } from "../scripts/voice-input.mjs";
import {
  defaultTtsSettings,
  parseTtsSettings,
  ttsInputKey,
  ttsParameters,
  ttsPlan,
} from "../dist/tts.mjs";
import { emptyProject, parseProject, timeline } from "../dist/model.mjs";
import {
  defaultStoryOptions,
  parseStoryOptions,
  storyConfig,
  optionsFromProject,
  previewStory,
} from "../dist/story.mjs";
import { pairNarration, splitSentences } from "../dist/narration.mjs";
import { compileAuto } from "../dist/auto.mjs";

const settings = (patch = {}) => ({
  ...defaultTtsSettings(),
  enabled: true,
  ...patch,
});
const images = [2, 1].map((order) => ({
  id: `image-${order}`,
  name: `0${order}.png`,
  src: "/samples/coast.svg",
  width: 720,
  height: 1280,
}));
const script = "1. Hello there.\n2. A second scene.";
const project = (voiceover) => ({
  ...emptyProject(),
  assets: images,
  voiceover,
});
const fixture = () =>
  readFile(new URL("../test/voices/01_ngu-nuong.wav", import.meta.url));
async function withStorage(run) {
  const directory = await mkdtemp(join(tmpdir(), "khung-tts-test-"));
  try {
    return await run({
      assetDirectory: directory,
      cacheDirectory: join(directory, "cache"),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("TTS config follows both API models; old presets and all documented languages work", () => {
  const old = defaultStoryOptions();
  delete old.tts;
  assert.equal(parseStoryOptions(old).tts.enabled, false);
  const turbo = ttsParameters(settings({ voice: "Lucy", seed: 42 }));
  assert.equal(turbo.mode, "single");
  assert.equal(turbo.voice, "Lucy");
  assert.equal(turbo.norm_loudness, true);
  assert.equal(turbo.seed, 42);
  assert.equal(turbo.language_id, undefined);
  assert.equal(turbo.exaggeration, undefined);
  for (const languageId of [
    "ar",
    "da",
    "de",
    "el",
    "en",
    "es",
    "fi",
    "fr",
    "he",
    "hi",
    "it",
    "ja",
    "ko",
    "ms",
    "nl",
    "no",
    "pl",
    "pt",
    "ru",
    "sv",
    "sw",
    "tr",
    "zh",
  ]) {
    const tts = settings({ model: "multilingual", languageId });
    const params = ttsParameters(tts);
    assert.equal(params.language_id, languageId);
    assert.equal(params.cfg_weight, 0.5);
    assert.equal(params.top_k, undefined);
    assert.equal(params.norm_loudness, undefined);
    assert.equal(
      storyConfig(
        project({ script, scriptName: "script.txt", assets: [] }),
        parseStoryOptions({
          ...defaultStoryOptions(),
          language: languageId,
          tts,
        }),
      ).narration.language,
      languageId,
    );
  }
  assert.equal(
    parseTtsSettings(settings({ baseUrl: settings().baseUrl + "/api/cli" }))
      .baseUrl,
    settings().baseUrl,
  );
  for (const patch of [
    { languageId: "vi" },
    { temperature: 0 },
    { topK: 1.5 },
    { seed: -1 },
    { voice: "a\nb" },
    { baseUrl: "http://127.0.0.1" },
    { baseUrl: "https://example.com" },
    { reference: { src: "/media/../x.wav", name: "x" } },
  ])
    assert.throws(() => parseTtsSettings(settings(patch)), /TTS/);
});

test("number pairing and freshness invalidate only speech inputs", () => {
  assert.deepEqual(
    ttsPlan(script, images).map((s) => s.order),
    [1, 2],
  );
  assert.throws(() => ttsPlan(script, images.slice(1)), /Thiếu ảnh/);
  assert.throws(() => ttsPlan(script, [images[0], images[0]]), /trùng/);
  assert.throws(
    () => ttsPlan(script, [...images, { name: "03.png" }]),
    /TXT số 3/,
  );
  const key = ttsInputKey(script, settings());
  assert.equal(
    key,
    ttsInputKey(script, settings({ cfgWeight: 0.2, languageId: "ko" })),
  );
  assert.notEqual(key, ttsInputKey(script, settings({ outputFormat: "mp3" })));
  assert.notEqual(
    key,
    ttsInputKey(script.replace("there", "world"), settings()),
  );
  assert.notEqual(key, ttsInputKey(script, settings({ temperature: 0.6 })));
});

test("TTS WAV batch, per-scene cache, native media and alignment pipeline round-trip", async () =>
  withStorage(async (storage) => {
    const bytes = await fixture(),
      calls = [];
    const fetchImpl = async (url, request) => {
      calls.push(Object.fromEntries(request.body));
      assert.equal(url, settings().baseUrl + "/api/cli");
      assert.equal(request.redirect, "error");
      return new Response(bytes, { headers: { "Content-Type": "audio/wav" } });
    };
    const result = await generateTts(
      { script, images, settings: settings() },
      { ...storage, fetchImpl },
    );
    assert.deepEqual(
      calls.map((c) => c.text),
      ["Hello there.", "A second scene."],
    );
    assert.ok(
      calls.every((c) => c.mode === "single" && c.output_format === "wav"),
    );
    assert.equal(result.cached, 0);
    assert.equal(new Set(result.assets.map((a) => a.id)).size, 2);
    assert.deepEqual(
      await readFile(
        join(storage.assetDirectory, result.assets[0].src.slice(7)),
      ),
      bytes,
    );
    assert.ok(result.assets[0].envelope.values.some((v) => v > 0));
    const p = parseProject(
      project({
        script,
        scriptName: "script.txt",
        ...result,
        uploadLanguage: "vi",
      }),
    );
    assert.equal(p.voiceover.ttsKey, result.ttsKey);
    assert.equal(optionsFromProject(p).tts.enabled, true);
    assert.equal(optionsFromProject(p).language, "vi");
    const options = {
      ...defaultStoryOptions(),
      tts: settings(),
      language: "vi",
    };
    const config = storyConfig(p, options);
    assert.equal(config.narration.language, "en");
    assert.equal(options.language, "vi");
    assert.equal(
      storyConfig(p, { ...options, tts: { ...options.tts, enabled: false } })
        .narration.language,
      "vi",
    );
    const alignments = pairNarration(p.assets, p.voiceover).map((pair) => ({
      voiceId: pair.voice.id,
      captions: splitSentences(pair.text, config.narration.maxChars).map(
        (text) => ({
          text,
          startMs: 100,
          endMs: 1500,
          timestampMs: null,
          confidence: null,
        }),
      ),
    }));
    const built = compileAuto(config, p.assets, p, false, {
      input: p.voiceover,
      alignments,
    }).project;
    assert.equal(timeline(built)[1].from, timeline(built)[0].end);
    assert.equal(parseProject(built).voiceover.ttsKey, result.ttsKey);
    assert.ok(previewStory(built, options).project.scenes.length === 2);
    await generateTts(
      { script, images, settings: settings() },
      { ...storage, fetchImpl },
    );
    assert.equal(calls.length, 2);
    const changed = await generateTts(
      { script: script.replace("second", "new"), images, settings: settings() },
      { ...storage, fetchImpl },
    );
    assert.equal(calls.length, 3);
    assert.equal(changed.cached, 1);
  }));

test("voice cloning sends the actual reference; MP3 result stays MP3 and original bytes", async () =>
  withStorage(async (storage) => {
    const bytes = await fixture();
    await writeFile(join(storage.assetDirectory, "reference.wav"), bytes);
    const mp3Path = join(storage.assetDirectory, "sample.mp3");
    await runVoiceFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-i",
      join(storage.assetDirectory, "reference.wav"),
      "-c:a",
      "libmp3lame",
      "-q:a",
      "3",
      "-y",
      mp3Path,
    ]);
    const mp3 = await readFile(mp3Path);
    const result = await generateTts(
      {
        script: "1. 안녕하세요.",
        images: images.slice(1),
        settings: settings({
          model: "multilingual",
          languageId: "ko",
          outputFormat: "mp3",
          voiceMode: "reference",
          voice: "ignored",
          reference: { src: "/media/reference.wav", name: "reference.wav" },
        }),
      },
      {
        ...storage,
        fetchImpl: async (_, { body }) => {
          assert.deepEqual(
            Buffer.from(await body.get("voice_file").arrayBuffer()),
            bytes,
          );
          assert.equal(body.get("voice"), null);
          assert.equal(body.get("language_id"), "ko");
          return new Response(mp3, {
            headers: { "Content-Type": "audio/mpeg" },
          });
        },
      },
    );
    assert.ok(result.assets[0].src.endsWith(".mp3"));
    assert.deepEqual(
      await readFile(
        join(storage.assetDirectory, result.assets[0].src.slice(7)),
      ),
      mp3,
    );
  }));

test("failed batches resume cached scenes; API errors, cancellation, wrong content and timeout are explicit", async () =>
  withStorage(async (storage) => {
    const bytes = await fixture();
    let count = 0;
    const fetchImpl = async () =>
      ++count === 2
        ? new Response(JSON.stringify({ detail: "GPU unavailable" }), {
            status: 500,
          })
        : new Response(bytes);
    await assert.rejects(
      generateTts(
        { script, images, settings: settings() },
        { ...storage, fetchImpl },
      ),
      /Voice 2: API TTS HTTP 500: GPU unavailable/,
    );
    assert.equal(count, 2);
    const resumed = await generateTts(
      { script, images, settings: settings() },
      { ...storage, fetchImpl },
    );
    assert.equal(count, 3);
    assert.equal(resumed.cached, 1);
    const input = {
      script: "1. An uncached request.",
      images: images.slice(1),
      settings: settings(),
    };
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      generateTts(input, { ...storage, signal: abort.signal, fetchImpl }),
      /Đã dừng/,
    );
    await assert.rejects(
      generateTts(input, {
        ...storage,
        fetchImpl: async () =>
          new Response("{}", {
            headers: { "Content-Type": "application/json" },
          }),
      }),
      /audio trực tiếp/,
    );
    await assert.rejects(
      generateTts(input, {
        ...storage,
        fetchImpl: async () => new Response(Buffer.from("not audio")),
      }),
      /WAV/,
    );
    await assert.rejects(
      generateTts(input, {
        ...storage,
        fetchImpl: async () =>
          new Response(Buffer.alloc(0), {
            headers: { "Content-Length": String(101 * 1024 * 1024) },
          }),
      }),
      /100 MB/,
    );
    await assert.rejects(
      generateTts(input, {
        ...storage,
        timeoutMs: 10,
        fetchImpl: async (_, { signal }) =>
          new Promise((_, reject) => {
            const hold = setTimeout(
              () => reject(Error("unexpected timeout")),
              1000,
            );
            signal.addEventListener(
              "abort",
              () => {
                clearTimeout(hold);
                reject(signal.reason);
              },
              { once: true },
            );
          }),
      }),
      /hết thời gian chờ/,
    );
  }));

test("Turbo emotion tags go to TTS but are removed from generated captions, upload behavior stays unchanged", async () =>
  withStorage(async (storage) => {
    const taggedScript = "1. Hello [laugh] there.",
      bytes = await fixture();
    const result = await generateTts(
      { script: taggedScript, images: images.slice(1), settings: settings() },
      {
        ...storage,
        fetchImpl: async (_, { body }) => {
          assert.equal(body.get("text"), "Hello [laugh] there.");
          return new Response(bytes);
        },
      },
    );
    const p = project({
      script: taggedScript,
      scriptName: "script.txt",
      ...result,
    });
    p.assets = images.slice(1);
    assert.equal(pairNarration(p.assets, p.voiceover)[0].text, "Hello there.");
    const uploaded = { ...p.voiceover };
    delete uploaded.tts;
    delete uploaded.ttsKey;
    assert.equal(
      pairNarration(p.assets, uploaded)[0].text,
      "Hello [laugh] there.",
    );
  }));
