import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import {
  mkdir,
  mkdtemp,
  rm,
  copyFile,
  symlink,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ResourceQueue } from "../scripts/resource-queue.mjs";

await mkdir(".cache", { recursive: true });
const directory = await mkdtemp(resolve(".cache/image-loading-test-"));
test.after(() => rm(directory, { recursive: true, force: true }));
await build({
  entryPoints: ["src/editor/image-resources.ts"],
  outfile: join(directory, "resources.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { ImageResources } = await import(
  pathToFileURL(join(directory, "resources.mjs"))
);
const tick = () => new Promise((resolve) => setImmediate(resolve));

function images() {
  const created = [];
  return {
    created,
    create() {
      const image = {
        src: "",
        removed: false,
        onload: null,
        onerror: null,
        decode: async () => {},
        removeAttribute() {
          this.removed = true;
          this.src = "";
        },
      };
      created.push(image);
      return image;
    },
  };
}

test("hundreds of thumbnails leave a foreground slot; cancelling scrubs drops unused work", async () => {
  const fake = images(),
    resources = new ImageResources(() => fake.create());
  const thumbnails = Array.from({ length: 100 }, (_, i) =>
    resources.acquire(`/media/a${i}.png`, 384, "thumbnail"),
  );
  for (const request of thumbnails) void request.promise.catch(() => {});
  assert.equal(fake.created.length, 2);
  const current = resources.acquire("/media/current.png", 1440, "preview");
  assert.equal(fake.created.length, 3);
  assert.match(fake.created[2].src, /current/);
  for (const request of thumbnails) request.release();
  await tick();
  assert.equal(
    fake.created.length,
    3,
    "cancelled queued thumbnails must never start",
  );
  fake.created[2].onload();
  assert.match(await current.promise, /api\/proxy/);
  current.release();
  assert.ok(fake.created[0].removed && fake.created[1].removed);
});

test("failed and stalled proxies fall back to the master; failed masters allow a later retry", async () => {
  for (const stalled of [false, true]) {
    const fake = images(),
      resources = new ImageResources(() => fake.create(), 10);
    const request = resources.acquire("/media/a.png", 1440, "preview");
    if (!stalled) fake.created[0].onerror();
    else await new Promise((resolve) => setTimeout(resolve, 20));
    await tick();
    assert.equal(fake.created[1].src, "/media/a.png");
    fake.created[1].onload();
    assert.equal(await request.promise, "/media/a.png");
    request.release();
  }
  const fake = images(),
    resources = new ImageResources(() => fake.create());
  const request = resources.acquire("/media/missing.png", 384, "thumbnail");
  const failed = assert.rejects(request.promise, /Không tải được ảnh/);
  for (let i = 0; i < 3; i++) {
    fake.created[i].onerror();
    await tick();
  }
  await failed;
  request.release();
  const retry = resources.acquire("/media/missing.png", 384, "thumbnail");
  fake.created.at(-1).onload();
  assert.equal(await retry.promise, "/media/missing.png");
  retry.release();
});

test("shared preloading survives one consumer cancelling; obsolete results never enter cache", async () => {
  const fake = images(),
    resources = new ImageResources(() => fake.create());
  const next = resources.acquire("/media/shared.png", 960, "next");
  const current = resources.acquire("/media/shared.png", 960, "preview");
  next.release();
  assert.equal(fake.created.length, 1);
  assert.equal(fake.created[0].removed, false);
  fake.created[0].onload();
  assert.equal(await next.promise, await current.promise);
  current.release();
  const obsolete = resources.acquire("/media/obsolete.png", 960, "preview");
  const cancelled = assert.rejects(obsolete.promise, { name: "AbortError" });
  const lateLoad = fake.created.at(-1).onload;
  obsolete.release();
  lateLoad();
  await cancelled;
  await tick();
  assert.equal(resources.peek("/media/obsolete.png", 960), undefined);
});

test("server queue starts a waiting preview ahead of queued thumbnails", async () => {
  const queue = new ResourceQueue(),
    order = [];
  let release;
  const active = queue.run(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await tick();
  const thumbnail = queue.run(() => order.push("thumbnail"));
  const preview = queue.run(() => order.push("preview"), undefined, 2);
  release();
  await Promise.all([active, thumbnail, preview]);
  assert.deepEqual(order, ["preview", "thumbnail"]);
});

test("real proxy deduplicates, repairs truncated cache and does not cancel another reader", async (t) => {
  try {
    await stat(".venv/bin/python");
  } catch {
    t.skip("Shared uv environment not installed");
    return;
  }
  const root = join(directory, "server");
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "data/uploads"), { recursive: true });
  await symlink(resolve(".venv"), join(root, ".venv"), "dir");
  for (const name of [
    "media-proxy.mjs",
    "media-proxy.py",
    "resource-queue.mjs",
  ])
    await copyFile(join("scripts", name), join(root, "scripts", name));
  await copyFile(
    "test/images/01_ngu-nuong.png",
    join(root, "data/uploads/a.png"),
  );
  const { imageProxy, stopMediaHelpers } = await import(
    pathToFileURL(join(root, "scripts/media-proxy.mjs"))
  );
  try {
    const controller = new AbortController();
    const cancelled = imageProxy("/media/a.png", 384, controller.signal);
    const reader = imageProxy("/media/a.png", 384);
    const rejection = assert.rejects(cancelled, /hủy/);
    controller.abort();
    await rejection;
    const path = await reader;
    const valid = await readFile(path);
    assert.equal(valid.toString("ascii", 8, 12), "WEBP");
    await writeFile(path, valid.subarray(0, 16));
    assert.equal(await imageProxy("/media/a.png", 384), path);
    assert.deepEqual(await readFile(path), valid);
  } finally {
    stopMediaHelpers();
  }
});
