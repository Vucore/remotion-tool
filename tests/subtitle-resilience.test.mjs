import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { translateSubtitles } from "../scripts/translate-subtitles.mjs";
import {
  translateSubtitleDocument,
  subtitleWait,
} from "../dist/subtitle-client.mjs";

const cues = [
  { startMs: 100, endMs: 1100, text: "Câu một." },
  { startMs: 1200, endMs: 2200, text: "Câu hai." },
];
const input = { cues, source: "vi", target: "en" };
async function storage(run) {
  const dir = await mkdtemp(join(tmpdir(), "khung-translation-retry-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("429 retries back off; each completed cue survives a later failure and resumes without resending", async () =>
  storage(async (dir) => {
    const pauses = [],
      attempts = [];
    let first = true;
    await assert.rejects(
      translateSubtitles(input, {
        cacheDirectory: dir,
        maxBatchChars: 1,
        rateLimitDelaysMs: [10, 20],
        wait: async (ms) => {
          pauses.push(ms);
        },
        translator: async ({ texts }) => {
          attempts.push(texts[0]);
          if (texts[0] === cues[0].text && first) {
            first = false;
            throw Object.assign(Error("blocked"), { code: "RATE_LIMIT" });
          }
          if (texts[0] === cues[1].text)
            throw Object.assign(Error("blocked"), { code: "RATE_LIMIT" });
          return { translations: ["First sentence."] };
        },
      }),
      (error) => error.code === "RATE_LIMIT",
    );
    assert.deepEqual(pauses, [10, 10, 20]);
    assert.equal((await readdir(dir)).length, 1);
    const sent = [];
    const result = await translateSubtitles(input, {
      cacheDirectory: dir,
      maxBatchChars: 1,
      translator: async ({ texts }) => {
        sent.push(...texts);
        return { translations: ["Second sentence."] };
      },
    });
    assert.deepEqual(sent, [cues[1].text]);
    assert.deepEqual(result.cues, [
      { ...cues[0], text: "First sentence." },
      { ...cues[1], text: "Second sentence." },
    ]);
  }));
test("network retries are bounded; a user can stop immediately during a rate limit wait", async () =>
  storage(async (dir) => {
    let attempts = 0;
    await assert.rejects(
      translateSubtitles(input, {
        cacheDirectory: dir,
        maxBatchChars: 1,
        networkDelaysMs: [1, 2],
        wait: async () => {},
        translator: async () => {
          attempts++;
          throw Object.assign(Error("offline"), { code: "NETWORK" });
        },
      }),
      /offline/,
    );
    assert.equal(attempts, 3);
    const abort = new AbortController();
    const promise = translateSubtitles(input, {
      cacheDirectory: dir,
      maxBatchChars: 1,
      signal: abort.signal,
      rateLimitDelaysMs: [1],
      translator: async () => {
        throw Object.assign(Error("blocked"), { code: "RATE_LIMIT" });
      },
      onProgress: (_progress, _message, retryAt) => {
        if (retryAt) abort.abort();
      },
    });
    await assert.rejects(promise, /abort|dừng/i);
    assert.deepEqual(await readdir(dir), []);
  }));
test("lost POST response reuses request ID and validates a complete timestamp-preserving result", async () => {
  const posts = [];
  const result = await translateSubtitleDocument(input, {
    signal: new AbortController().signal,
    wait: async () => {},
    fetchImpl: async (_url, init) => {
      posts.push(JSON.parse(init.body));
      if (posts.length === 1) throw new TypeError("connection lost after POST");
      return Response.json({
        id: posts[0].requestId,
        status: "done",
        result: { cues: cues.map((cue) => ({ ...cue, text: "Translated." })) },
      });
    },
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].requestId, posts[1].requestId);
  assert.deepEqual(
    result.map(({ startMs, endMs }) => [startMs, endMs]),
    [
      [100, 1100],
      [1200, 2200],
    ],
  );
});
test("client rejects incomplete/misaligned SRT and cancels the unfinished job", async () => {
  for (const invalid of [[cues[0]], [cues[0], { ...cues[1], startMs: 1300 }]]) {
    let deleted = false;
    await assert.rejects(
      translateSubtitleDocument(input, {
        signal: new AbortController().signal,
        fetchImpl: async (_url, init) => {
          if (init.method === "DELETE") {
            deleted = true;
            return Response.json({});
          }
          return Response.json({
            id: "fixture",
            status: "done",
            result: { cues: invalid },
          });
        },
      }),
      /đầy đủ|timestamp/,
    );
    assert.equal(deleted, true);
  }
});
test("client reconnects polling without starting another job; cancellation interrupts waits", async () => {
  let polls = 0,
    posts = 0;
  const result = await translateSubtitleDocument(input, {
    signal: new AbortController().signal,
    wait: async () => {},
    fetchImpl: async (_url, init) => {
      if (init.method === "POST") {
        posts++;
        return Response.json({ id: "fixture", status: "translating" });
      }
      if (++polls === 1) throw new TypeError("offline");
      return Response.json({ id: "fixture", status: "done", result: { cues } });
    },
  });
  assert.equal(posts, 1);
  assert.equal(polls, 2);
  assert.equal(result.length, 2);
  const abort = new AbortController();
  const waiting = subtitleWait(60000, abort.signal);
  abort.abort();
  await assert.rejects(waiting, /dừng/);
});

test("persistent browser connection failure returns NETWORK so the remaining batch can pause", async () => {
  let posts = 0;
  await assert.rejects(
    translateSubtitleDocument(input, {
      signal: new AbortController().signal,
      wait: async () => {},
      fetchImpl: async (_url, init) => {
        if (init.method === "POST") {
          posts++;
          throw new TypeError("offline");
        }
        return Response.json({});
      },
    }),
    (error) => error.code === "NETWORK",
  );
  assert.equal(posts, 4);
});
