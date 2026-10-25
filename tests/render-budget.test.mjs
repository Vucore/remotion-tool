import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  copyFile,
  symlink,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  renderBudget,
  normalizeMediaCacheSize,
  MIN_MEDIA_CACHE_BYTES,
} from "../scripts/resource-budget.mjs";
import { emptyProject } from "../dist/model.mjs";

test("low free RAM never puts export cache below the @remotion/media minimum", () => {
  const mib = 1024 ** 2,
    gib = 1024 ** 3;
  assert.equal(normalizeMediaCacheSize(33554432), 251658240);
  for (const mode of ["editing", "fast"])
    for (const memory of [512 * mib, 8 * gib, 32 * gib])
      for (const free of [0, 64 * mib, 256 * mib, 2 * gib, 32 * gib]) {
        const budget = renderBudget(mode, memory, 12, free);
        assert.ok(budget.mediaCacheSizeInBytes >= MIN_MEDIA_CACHE_BYTES);
        assert.ok(
          budget.mediaCacheSizeInBytes <= (mode === "fast" ? 768 : 256) * mib,
        );
        assert.ok(Number.isInteger(budget.mediaCacheSizeInBytes));
        assert.ok(
          budget.concurrency >= 1 &&
            budget.concurrency <= (mode === "fast" ? 4 : 1),
        );
      }
  for (const value of [undefined, null, NaN, Infinity])
    assert.equal(normalizeMediaCacheSize(value), 256 * mib);
});

test(
  "export worker repairs a legacy 32 MiB request before invoking the renderer",
  { timeout: 15000 },
  async () => {
    await mkdir(".cache", { recursive: true });
    const root = await mkdtemp(resolve(".cache/render-budget-test-"));
    let child;
    try {
      await mkdir(join(root, "scripts"));
      for (const name of ["export-worker.mjs", "resource-budget.mjs"])
        await copyFile(join("scripts", name), join(root, "scripts", name));
      for (const name of ["dist", "node_modules"])
        await symlink(resolve(name), join(root, name), "dir");
      // Observe the worker/renderer boundary without launching Chromium/FFmpeg.
      await writeFile(
        join(root, "scripts/render-project.mjs"),
        `
      import {writeFile} from 'node:fs/promises';
      export async function renderProject(project, options) {
        await writeFile(options.output, JSON.stringify({cache:options.mediaCacheSizeInBytes, concurrency:options.concurrency}));
      }
    `,
      );
      const output = join(root, "result.mp4");
      const request = join(root, "request.json");
      await writeFile(
        request,
        JSON.stringify({
          project: emptyProject(),
          output,
          origin: "http://127.0.0.1:3210",
          mode: "editing",
          concurrency: 1,
          mediaCacheSizeInBytes: 33554432,
          filename: "test.mp4",
        }),
      );
      child = fork(join(root, "scripts/export-worker.mjs"), [request], {
        silent: true,
        execArgv: [],
      });
      const messages = [];
      let stderr = "";
      child.on("message", (message) => messages.push(message));
      child.stderr.on("data", (data) => {
        stderr += data;
      });
      const exit = await new Promise((yes, no) => {
        child.once("error", no);
        child.once("close", yes);
      });
      assert.equal(exit, 0, stderr || JSON.stringify(messages));
      assert.ok(messages.some((message) => message.done));
      const observed = JSON.parse(await readFile(output, "utf8"));
      assert.equal(observed.cache, MIN_MEDIA_CACHE_BYTES);
      assert.equal(observed.concurrency, 1);
    } finally {
      if (child && child.exitCode === null) child.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  },
);
