import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  mkdir,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectVoice, runVoiceFfmpeg } from "../scripts/voice-input.mjs";
import { wavInfo, wavEnvelope } from "../scripts/wav-info.mjs";
import { prepareNarration } from "../scripts/narration.mjs";
import { parseAutoConfig } from "../dist/auto-config.mjs";
import { compileAuto } from "../dist/auto.mjs";
import { parseProject } from "../dist/model.mjs";

function wave(duration = 1.137, sampleRate = 44100, channels = 2) {
  const frames = Math.floor(duration * sampleRate),
    size = frames * channels * 2;
  const b = Buffer.alloc(44 + size);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * channels * 2, 28);
  b.writeUInt16LE(channels * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(size, 40);
  for (let i = 0; i < frames; i++)
    for (let channel = 0; channel < channels; channel++)
      b.writeInt16LE(
        Math.round(
          Math.sin((i * Math.PI * 2 * (channel ? 880 : 440)) / sampleRate) *
            (channel ? 5000 : 7000),
        ),
        44 + (i * channels + channel) * 2,
      );
  return b;
}
async function encode(dir, input, name, options = []) {
  const source = join(dir, name + ".wav"),
    target = join(dir, name + ".mp3");
  await writeFile(source, input);
  await runVoiceFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-i",
    source,
    "-c:a",
    "libmp3lame",
    ...options,
    "-y",
    target,
  ]);
  return { bytes: await readFile(target), path: target };
}

test("existing WAV is byte-identical; invalid types, corrupt data and cancelled imports fail", async () => {
  const original = wave(),
    result = await inspectVoice(original, { name: "01_voice.WAV" });
  assert.strictEqual(result.bytes, original);
  assert.strictEqual(result.decodedWav, original);
  assert.equal(result.extension, "wav");
  assert.deepEqual(result.info, wavInfo(original));
  await assert.rejects(
    inspectVoice(original, { name: "01.m4a" }),
    /WAV hoặc MP3/,
  );
  await assert.rejects(
    inspectVoice(Buffer.from("invalid"), { name: "01.wav" }),
    /WAV/,
  );
  await assert.rejects(
    inspectVoice(Buffer.alloc(0), { name: "01.mp3" }),
    /trống/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    inspectVoice(original, { name: "01.wav", signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("source MP3 remains byte-identical; analysis WAV preserves gapless samples, stereo and sample rate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "khung-audio-test-"));
  try {
    const original = wave(),
      sourceInfo = wavInfo(original);
    const mp3 = await encode(dir, original, "01_stereo", ["-q:a", "2"]);
    const result = await inspectVoice(mp3.bytes, { name: "01_stereo.MP3" });
    assert.strictEqual(result.bytes, mp3.bytes);
    assert.equal(result.extension, "mp3");
    assert.equal(result.info.bits, 24);
    assert.equal(result.info.channels, sourceInfo.channels);
    assert.equal(result.info.sampleRate, sourceInfo.sampleRate);
    assert.equal(result.info.duration, sourceInfo.duration);
    // Independent ordinary FFmpeg conversion: no trim/resample/channel/level filters.
    const reference = join(dir, "reference.wav");
    await runVoiceFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-i",
      mp3.path,
      "-map",
      "0:a:0",
      "-c:a",
      "pcm_s24le",
      "-y",
      reference,
    ]);
    const bytes = await readFile(reference),
      info = wavInfo(bytes);
    assert.deepEqual(
      result.decodedWav.subarray(
        result.info.dataOffset,
        result.info.dataOffset + result.info.dataBytes,
      ),
      bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes),
    );
    assert.ok(
      wavEnvelope(result.decodedWav, result.info).values.some((v) => v > 0.2),
    );
    const again = await inspectVoice(mp3.bytes, { name: "01_stereo.mp3" });
    assert.deepEqual(again.bytes, mp3.bytes);
    assert.deepEqual(again.decodedWav, result.decodedWav);
    await assert.rejects(
      inspectVoice(Buffer.from("ID3broken-mp3"), { name: "02_bad.mp3" }),
      /Không đọc được MP3/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CBR mono MP3 preserves 48kHz and duration; long/short MP3 is rejected rather than silently cut", async () => {
  const dir = await mkdtemp(join(tmpdir(), "khung-audio-test-"));
  try {
    const original = wave(1.2, 48000, 1),
      encoded = await encode(dir, original, "mono", ["-b:a", "128k"]);
    const result = await inspectVoice(encoded.bytes, { name: "02_mono.mp3" });
    assert.equal(result.info.channels, 1);
    assert.equal(result.info.sampleRate, 48000);
    assert.equal(result.info.duration, wavInfo(original).duration);
    for (const [name, duration] of [
      ["short", 0.3],
      ["long", 300.2],
    ]) {
      const mp3 = await encode(dir, wave(duration, 8000, 1), name, [
        "-b:a",
        "16k",
      ]);
      await assert.rejects(
        inspectVoice(mp3.bytes, { name: name + ".mp3" }),
        /0,5 đến 300/,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mixed native MP3/WAV keeps source paths through alignment and export project; temporary WAV is cleaned on success/error", async () => {
  const dir = await mkdtemp(join(tmpdir(), "khung-audio-test-"));
  try {
    const uploads = join(dir, "uploads"),
      cache = join(dir, "cache");
    await mkdir(uploads);
    const original = wave(),
      mp3 = await encode(dir, original, "01_mix", ["-q:a", "2"]);
    const voice = await inspectVoice(mp3.bytes, { name: "01_mix.mp3" });
    await writeFile(join(uploads, "one.mp3"), mp3.bytes);
    await writeFile(join(uploads, "two.wav"), original);
    const input = {
      assets: [
        {
          id: "v1",
          name: "01_mix.mp3",
          src: "/media/one.mp3",
          duration: voice.info.duration,
        },
        {
          id: "v2",
          name: "02_mix.wav",
          src: "/media/two.wav",
          duration: wavInfo(original).duration,
        },
      ],
      script: "1. Xin chào.\n2. Tạm biệt.",
      scriptName: "script.txt",
    };
    const assets = [1, 2].map((n) => ({
      id: "a" + n,
      name: "0" + n + ".png",
      src: "/samples/coast.svg",
      width: 720,
      height: 1280,
    }));
    const config = parseAutoConfig({
      autoEditVersion: 1,
      narration: { enabled: true },
    });
    let temporary;
    const align = async (requests) => {
      const mp3Request = requests.find((r) => r.name.endsWith(".mp3"));
      temporary = mp3Request.path;
      assert.notEqual(temporary, join(uploads, "one.mp3"));
      assert.equal(
        wavInfo(await readFile(temporary)).duration,
        voice.info.duration,
      );
      assert.equal(
        requests.find((r) => r.name.endsWith(".wav")).path,
        join(uploads, "two.wav"),
      );
      return new Map(
        requests.map((r) => [
          r.key,
          r.sentences.map((text) => ({
            text,
            startMs: 0,
            endMs: r.duration * 1000,
            timestampMs: null,
            confidence: 1,
          })),
        ]),
      );
    };
    const prepared = await prepareNarration(config, assets, input, {
      assetDirectory: uploads,
      cacheDirectory: cache,
      align,
    });
    assert.equal(prepared.input.assets[0].src, "/media/one.mp3");
    assert.equal(
      prepared.manifest[0].sha256,
      createHash("sha256").update(mp3.bytes).digest("hex"),
    );
    assert.deepEqual(await readFile(join(uploads, "one.mp3")), mp3.bytes);
    await assert.rejects(access(temporary), { code: "ENOENT" });
    const result = compileAuto(
      config,
      assets,
      undefined,
      false,
      prepared,
    ).project;
    const restored = parseProject(JSON.parse(JSON.stringify(result)));
    assert.equal(restored.voiceover.assets[0].src, "/media/one.mp3");
    assert.equal(restored.voiceover.assets[1].src, "/media/two.wav");
    assert.equal(restored.scenes[0].voice.duration, voice.info.duration);
    let failedTemp;
    await assert.rejects(
      prepareNarration(config, assets, input, {
        assetDirectory: uploads,
        cacheDirectory: join(dir, "failed"),
        align: async (requests) => {
          failedTemp = requests.find((r) => r.name.endsWith(".mp3")).path;
          throw Error("test alignment failure");
        },
      }),
      /test alignment failure/,
    );
    await assert.rejects(access(failedTemp), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
