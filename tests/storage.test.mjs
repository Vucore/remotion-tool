import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  access,
  readdir,
} from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { StorageManager } from "../scripts/storage.mjs";
import { StorageWorker } from "../scripts/storage-client.mjs";
import { ProjectLibrary } from "../scripts/project-library.mjs";
import { ExportJobs } from "../scripts/export-jobs.mjs";
import { emptyWorkspace } from "../dist/workspace.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "khung-storage-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = async (path, content = "fixture") => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    return join(root, path);
  };
  return { root, file, manager: new StorageManager(root) };
}
const group = async (manager, id) =>
  (await manager.inventory()).groups.find((item) => item.id === id);

test("storage scanning is demand-driven, read-only, counts groups and never follows symlinks", async (t) => {
  const { root, file, manager } = await fixture(t);
  const outside = await fixture(t);
  await outside.file("private.bin", "outside-data");
  await file(".cache/tts/one.json", "1234");
  await file(".cache/unknown/file.bin", "unknown");
  await file(".git/objects/keep", "git-history");
  await file(".venv/keep", "python-environment");
  await symlink(outside.root, join(root, ".cache/models"), "dir");
  const worker = new StorageWorker(root);
  t.after(() => worker.close());
  assert.equal(
    worker.worker,
    undefined,
    "Constructing storage service must not spawn or scan",
  );
  const before = await readdir(root);
  const report = await manager.inventory();
  assert.deepEqual(await readdir(root), before);
  assert.equal(report.groups.find((g) => g.id === "cache:tts").bytes, 4);
  for (const id of [
    "hidden:.git",
    "hidden:.venv",
    "cache:unknown",
    "cache:models",
  ])
    assert.equal(report.groups.find((g) => g.id === id).canDelete, false, id);
  assert.equal(report.groups.find((g) => g.id === "cache:models").bytes, 0);
  assert.equal(
    await readFile(join(outside.root, "private.bin"), "utf8"),
    "outside-data",
  );
  for (const id of [
    "hidden:.git",
    "hidden:.venv",
    "cache:unknown",
    "../../.git",
  ])
    await assert.rejects(manager.prepare(id, "ignored"));
});

test("clear removes only confirmed cache, preserves source/model/new files and rejects changed plans", async (t) => {
  const { root, file, manager } = await fixture(t);
  const old = await file(".cache/tts/a.json", "cache");
  const voice = await file("data/uploads/voice.wav", "original-voice");
  const model = await file(".cache/whisper/small.pt", "model");
  const selected = await group(manager, "cache:tts");
  await assert.rejects(
    manager.prepare(selected.id, "stale"),
    (e) => e.status === 409,
  );
  const plan = await manager.prepare(selected.id, selected.revision);
  const added = await file(".cache/tts/new.json", "created-after-confirmation");
  const result = await manager.clear(plan.token);
  assert.equal(result.removed, 1);
  await assert.rejects(access(old), { code: "ENOENT" });
  for (const path of [voice, model, added]) await access(path);
  const next = await group(manager, "cache:tts");
  const changed = await manager.prepare(next.id, next.revision);
  await writeFile(added, "changed");
  await assert.rejects(manager.clear(changed.token), (e) => e.status === 409);
  await access(added);
});

test("a symlink swapped in after confirmation cannot delete files outside the project", async (t) => {
  const { root, file, manager } = await fixture(t);
  const outside = await fixture(t);
  const keep = await outside.file("keep.json", "outside");
  await file(".cache/tts/one.json");
  const selected = await group(manager, "cache:tts");
  const plan = await manager.prepare(selected.id, selected.revision);
  await rm(join(root, ".cache/tts"), { recursive: true });
  await symlink(outside.root, join(root, ".cache/tts"), "dir");
  await assert.rejects(manager.clear(plan.token), /symlink/);
  assert.equal(await readFile(keep, "utf8"), "outside");
});

test("export cleanup synchronizes every saved project and stale saves cannot resurrect removed links", async (t) => {
  const { root, file, manager } = await fixture(t);
  const library = new ProjectLibrary(root);
  t.after(() => library.close());
  const id = randomUUID();
  const workspace = {
    ...emptyWorkspace(),
    job: { id, status: "done", progress: 1, url: `/exports/${id}.mp4` },
  };
  const call = (action, payload, projectId) =>
    library.request(action, { projectId, raw: JSON.stringify(payload) });
  const a = await call("create", { workspace }),
    b = await call("create", { workspace });
  await file(
    `data/jobs/${id}.json`,
    JSON.stringify({
      id,
      status: "done",
      filename: "Old.mp4",
      url: `/exports/${id}.mp4`,
    }),
  );
  await file(
    `data/jobs/${id}.snapshot.json`,
    JSON.stringify({ project: { assets: [{ src: "/media/original.png" }] } }),
  );
  await file(`data/exports/${id}.mp4`, "video");
  await file(`data/exports/${id}.srt`, "subtitle");
  const source = await file("data/uploads/original.png", "source");
  await file(".cache/tts/one.json", "cache");
  const unknown = await file("data/exports/keep-custom.txt", "custom");
  await call(
    "track",
    { resources: [`/.cache/tts/${"a".repeat(64)}.json`] },
    a.entry.id,
  );
  const queue = new ExportJobs(root, "http://localhost");
  await queue.initialize();
  const selected = await group(manager, "exports"),
    plan = await manager.prepare(selected.id, selected.revision);
  await call("forget-resources", {
    exports: plan.exportIds,
    cachePrefixes: ["/.cache/tts/"],
  });
  await queue.remove(id);
  await manager.clear(plan.token);
  for (const project of [a, b]) {
    const reopened = await library.request("open", {
      projectId: project.entry.id,
    });
    assert.equal(reopened.workspace.job, null);
    const saved = await call(
      "save",
      {
        revision: reopened.revision,
        patch: { type: "value", value: workspace },
        waves: [],
      },
      project.entry.id,
    );
    assert.ok(saved.revision);
    assert.equal(
      (await library.request("open", { projectId: project.entry.id })).workspace
        .job,
      null,
    );
    const record = JSON.parse(
      await readFile(
        join(root, "data/projects", project.entry.id, "workspace.json"),
        "utf8",
      ),
    );
    assert.ok(
      !record.resources.some(
        (ref) => ref.includes(id) || ref.startsWith("/.cache/tts/"),
      ),
    );
  }
  await access(source);
  await access(unknown);
  await access(join(root, ".cache/tts/one.json"));
  await assert.rejects(access(join(root, `data/exports/${id}.mp4`)), {
    code: "ENOENT",
  });
  assert.equal(queue.jobs.has(id), false);
});

test("missing output is reconciled using file metadata; snapshot and source remain available", async (t) => {
  const { root, file } = await fixture(t);
  const id = randomUUID();
  await file(
    `data/jobs/${id}.json`,
    JSON.stringify({
      id,
      status: "done",
      filename: "Gone.mp4",
      url: `/exports/${id}.mp4`,
      subtitleUrl: `/exports/${id}.srt`,
      subtitleFilename: "Gone_vi_tiengviet.srt",
    }),
  );
  const snapshot = await file(`data/jobs/${id}.snapshot.json`, "{}");
  const queue = new ExportJobs(root, "http://localhost");
  await queue.initialize();
  await queue.reconcile(id);
  const job = queue.jobs.get(id);
  assert.equal(job.status, "error");
  assert.equal(job.url, undefined);
  assert.equal(job.subtitleUrl, undefined);
  await access(snapshot);
});
