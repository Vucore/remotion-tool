import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { translateSubtitles } from "../scripts/translate-subtitles.mjs";

test("Python batch engine: limits, separators, retries, fallback and retained source", () => {
  execFileSync(
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
    ["tests/srt-translator.test.py"],
  );
});
test("Node batches uncached cues and never caches fallback originals as translations", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "srt-batch-"));
  try {
    const cues = Array.from({ length: 80 }, (_, i) => ({
      startMs: i * 1000,
      endMs: i * 1000 + 900,
      text: "Sentence " + i + " " + "x".repeat(90),
    }));
    const sent = [];
    const result = await translateSubtitles(
      { cues, source: "auto", target: "vi" },
      {
        cacheDirectory,
        translator: async ({ texts }) => {
          sent.push(texts);
          return {
            translations: texts.map((t) => "T:" + t),
            failedIndices: sent.length === 1 ? [0] : [],
          };
        },
      },
    );
    assert.ok(sent.length < 10);
    assert.ok(sent.every((texts) => texts.join(" \n@@@\n ").length <= 3000));
    assert.deepEqual(result.untranslatedIndices, [0]);
    assert.equal(result.cues[0].text, cues[0].text);
    assert.deepEqual(
      result.cues.map((c) => [c.startMs, c.endMs]),
      cues.map((c) => [c.startMs, c.endMs]),
    );
    assert.equal((await readdir(cacheDirectory)).length, 79);
    const retry = [];
    await translateSubtitles(
      { cues, source: "auto", target: "vi" },
      {
        cacheDirectory,
        translator: async ({ texts }) => {
          retry.push(...texts);
          return { translations: texts.map((t) => "T:" + t) };
        },
      },
    );
    assert.deepEqual(retry, [cues[0].text]);
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});
