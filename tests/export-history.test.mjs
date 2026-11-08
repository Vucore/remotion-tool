import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  access,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ExportJobs, exportFilename } from "../scripts/export-jobs.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "khung-export-history-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "data/exports"), { recursive: true });
  await mkdir(join(root, "data/uploads"));
  const runner = join(root, "worker.mjs");
  await writeFile(runner, `process.send({done:true}); process.disconnect();`);
  const queue = new ExportJobs(root, "http://localhost", {
    workerPath: runner,
  });
  await queue.initialize();
  const id = randomUUID();
  const job = {
    id,
    filename: "Tuổi thơ.mp4",
    subtitleFilename: "Tuổi thơ_vi_tiengviet.srt",
    status: "done",
    progress: 1,
    running: false,
    url: `/exports/${id}.mp4`,
    subtitleUrl: `/exports/${id}.srt`,
  };
  queue.jobs.set(id, job);
  await queue.persist(job);
  const snapshot = JSON.stringify({
    project: { assets: [{ src: "/media/source.png" }] },
    filename: job.filename,
    output: join(root, "data/exports", id + ".mp4"),
  });
  await writeFile(join(root, "data/jobs", id + ".snapshot.json"), snapshot);
  return { root, queue, job, id, snapshot };
}

test("rename persists MP4 and language-specific SRT names; retry uses new name without changing snapshot", async (t) => {
  const { root, queue, job, id, snapshot } = await fixture(t);
  await queue.rename(id, "  Những thói quen mới.MP4 ");
  assert.equal(job.filename, "Những thói quen mới.mp4");
  assert.equal(job.subtitleFilename, "Những thói quen mới_vi_tiengviet.srt");
  assert.equal(
    await readFile(join(root, "data/jobs", id + ".snapshot.json"), "utf8"),
    snapshot,
  );
  const restart = new ExportJobs(root, "http://localhost");
  await restart.initialize();
  assert.equal(restart.jobs.get(id).filename, job.filename);
  assert.equal(restart.jobs.get(id).subtitleFilename, job.subtitleFilename);
  const retry = await queue.retry(id);
  for (let i = 0; retry.running && i < 100; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(retry.status, "done");
  assert.equal(retry.running, false);
  assert.equal(retry.filename, job.filename);
  const retriedSnapshot = JSON.parse(
    await readFile(
      join(root, "data/jobs", retry.id + ".snapshot.json"),
      "utf8",
    ),
  );
  assert.equal(retriedSnapshot.filename, job.filename);
  await queue.rename(id, "a".repeat(120) + "?");
  assert.equal(job.subtitleFilename, "a".repeat(100) + "_vi_tiengviet.srt");
  await queue.rename(id, "Bản cuối");
  assert.equal(job.subtitleFilename, "Bản cuối_vi_tiengviet.srt");
});

test("delete removes only this export and snapshot, survives restart, tolerates missing output", async (t) => {
  const { root, queue, job, id } = await fixture(t);
  const source = join(root, "data/uploads/source.png");
  const other = join(root, "data/exports", randomUUID() + ".mp4");
  await writeFile(source, "original");
  await writeFile(other, "other export");
  await writeFile(join(root, "data/exports", id + ".mp4"), "bad video");
  await writeFile(join(root, "data/exports", id + ".srt"), "subtitle");
  await writeFile(
    join(root, "data/exports", id + ".mp4.partial.mp4"),
    "partial",
  );
  const rename = queue.rename(id, "Renamed");
  await assert.rejects(queue.remove(id), (error) => error.status === 409);
  await rename;
  await queue.remove(id);
  for (const file of [
    `data/exports/${id}.mp4`,
    `data/exports/${id}.srt`,
    `data/exports/${id}.mp4.partial.mp4`,
    `data/jobs/${id}.json`,
    `data/jobs/${id}.snapshot.json`,
  ])
    await assert.rejects(access(join(root, file)), { code: "ENOENT" });
  assert.equal(await readFile(source, "utf8"), "original");
  assert.equal(await readFile(other, "utf8"), "other export");
  assert.equal(queue.jobs.has(id), false);
  const restart = new ExportJobs(root, "http://localhost");
  await restart.initialize();
  assert.equal(restart.jobs.has(id), false);
  job.status = "error";
  queue.jobs.set(id, job);
  await queue.persist(job);
  await queue.remove(id); // Missing MP4/SRT/snapshot does not prevent history cleanup.
});

test("running exports are protected; filename validation and failed deletion remain retryable", async (t) => {
  const { root, queue, job, id } = await fixture(t);
  job.running = true;
  await assert.rejects(queue.remove(id), (error) => error.status === 409);
  await assert.rejects(
    queue.rename(id, "new"),
    (error) => error.status === 409,
  );
  job.running = false;
  const metadata = join(root, "data/jobs", id + ".json");
  await rm(metadata);
  await mkdir(metadata);
  await assert.rejects(queue.rename(id, "Cannot save"));
  assert.equal(job.filename, "Tuổi thơ.mp4");
  await rm(metadata, { recursive: true });
  await queue.rename(id, "Can retry");
  assert.equal(job.filename, "Can retry.mp4");
  for (const name of ["", "  ", ".mp4", "...", "a".repeat(177), null])
    assert.throws(() => exportFilename(name));
  assert.equal(exportFilename('Một/đoạn\\khác\n".mp4'), "Một-đoạn-khác--.mp4");
  const output = join(root, "data/exports", id + ".mp4");
  await mkdir(output); // A directory must never be removed recursively by export cleanup.
  await assert.rejects(queue.remove(id));
  assert.equal(queue.jobs.has(id), true);
  assert.equal(job.editing, undefined);
  await access(join(root, "data/jobs", id + ".snapshot.json"));
  await rm(output, { recursive: true });
  await queue.remove(id);
});

test("project rename updates only its exports, including an in-flight render, without changing snapshots", async (t) => {
  const { root, queue, job, id, snapshot } = await fixture(t);
  const projectId = randomUUID();
  job.projectId = projectId;
  const otherId = randomUUID();
  const other = {
    ...job,
    id: otherId,
    projectId: randomUUID(),
    filename: "Other.mp4",
  };
  queue.jobs.set(otherId, other);
  await queue.persist(other);
  await queue.persist(job);
  await writeFile(
    queue.workerPath,
    `import {readFile} from 'node:fs/promises'; const request=JSON.parse(await readFile(process.argv[2], 'utf8')); setTimeout(()=>{process.send({done:true,subtitle:request.filename.replace(/\\.mp4$/, '_vi_tiengviet.srt')});process.disconnect();},100);`,
  );
  const rendering = await queue.create(
    { name: "Old", assets: [] },
    { filename: "Old.mp4", projectId },
  );
  await Promise.all([
    queue.renameProject(projectId, "Tên lần một"),
    queue.renameProject(projectId, "Tên cuối cùng"),
  ]);
  assert.equal(job.filename, "Tên cuối cùng.mp4");
  assert.equal(job.subtitleFilename, "Tên cuối cùng_vi_tiengviet.srt");
  assert.equal(rendering.filename, "Tên cuối cùng.mp4");
  assert.equal(other.filename, "Other.mp4");
  for (let i = 0; rendering.running && i < 100; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(rendering.status, "done");
  assert.equal(rendering.running, false);
  assert.equal(rendering.subtitleFilename, "Tên cuối cùng_vi_tiengviet.srt");
  assert.equal(
    await readFile(join(root, "data/jobs", id + ".snapshot.json"), "utf8"),
    snapshot,
  );
  const renderSnapshot = JSON.parse(
    await readFile(
      join(root, "data/jobs", rendering.id + ".snapshot.json"),
      "utf8",
    ),
  );
  assert.equal(renderSnapshot.filename, "Old.mp4");
  await queue.rename(id, "Tên riêng");
  assert.deepEqual(await queue.renameProject(projectId, "Tên cuối cùng"), []);
  assert.equal(job.filename, "Tên riêng.mp4");
  const restart = new ExportJobs(root, "http://localhost");
  await restart.initialize();
  assert.equal(restart.jobs.get(id).filename, "Tên riêng.mp4");
  assert.equal(restart.jobs.get(rendering.id).filename, "Tên cuối cùng.mp4");
  assert.equal(restart.jobs.get(rendering.id).projectName, "Tên cuối cùng");
});
