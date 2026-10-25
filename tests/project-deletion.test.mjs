import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  stat,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectLibrary } from "../scripts/project-library.mjs";
import { emptyWorkspace } from "../dist/workspace.mjs";
import { revisionDiff } from "../dist/revision.mjs";
const call = (library, action, id, value) =>
  library.request(action, {
    projectId: id,
    raw: value && JSON.stringify(value),
  });
const workspace = (name, images = []) => {
  const value = emptyWorkspace();
  value.options.name = name;
  value.project.assets = images.map((name, i) => ({
    id: "image" + i,
    name: `0${i + 1}.png`,
    src: "/media/" + name,
    width: 720,
    height: 1280,
  }));
  return value;
};
const create = (library, workspace) =>
  call(library, "create", null, { workspace });
async function file(root, path, bytes = "fixture") {
  const full = join(root, path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, bytes);
  return full;
}
const missing = async (path) =>
  assert.rejects(access(path), (e) => e.code === "ENOENT");

test("deleting a project removes exclusive media/history/proxies/cache while keeping shared files, models and the original source", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-delete-"));
  let library = new ProjectLibrary(root);
  try {
    const shared = await file(root, "data/uploads/shared.png");
    const unique = await file(root, "data/uploads/only.png");
    const replaced = await file(root, "data/uploads/replaced.png");
    const clone = await file(root, "data/uploads/reference.wav");
    const fontName = randomUUID() + ".ttf";
    const font = await file(root, "data/fonts/" + fontName);
    const cacheName = "a".repeat(64) + ".json";
    const cache = await file(
      root,
      ".cache/tts/" + cacheName,
      JSON.stringify({ file: "reference.wav" }),
    );
    const model = await file(root, ".cache/models/lama/lama_fp32.onnx");
    const source = await file(root, "original-images/source.png");
    const ws = workspace("Bản gốc", ["shared.png", "only.png"]);
    const a = await create(library, ws),
      b = await create(library, workspace("Bản sao", ["shared.png"]));
    await call(library, "track", a.entry.id, {
      resources: [
        "/media/replaced.png",
        "/media/reference.wav",
        "/fonts/" + fontName,
        "/.cache/tts/" + cacheName,
        "/.cache/models/lama/lama_fp32.onnx",
        "../../original-images/source.png",
      ],
    });
    const next = structuredClone(ws);
    next.options.name = "Đã đổi tên";
    await call(library, "save", a.entry.id, {
      revision: a.revision,
      patch: revisionDiff(ws, next),
      waves: [],
    });
    const info = await stat(unique);
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          "proxy-1",
          "/media/only.png",
          info.size,
          info.mtimeMs,
          384,
        ]),
      )
      .digest("hex");
    const proxy = await file(root, ".cache/proxies/" + key + ".webp");
    await library.close();
    library = new ProjectLibrary(root);
    const plan = await call(library, "delete-preview", a.entry.id);
    assert.equal(plan.shared, 1);
    assert.ok(plan.files >= 6);
    await assert.rejects(
      call(library, "delete", a.entry.id, {
        confirm: true,
        revision: "stale",
        activeId: a.entry.id,
      }),
      (e) => e.status === 409,
    );
    await access(unique);
    const result = await call(library, "delete", a.entry.id, {
      confirm: true,
      revision: plan.revision,
      activeId: a.entry.id,
    });
    assert.equal(result.failures.length, 0);
    assert.equal(result.opened.entry.id, b.entry.id);
    for (const path of [
      unique,
      replaced,
      clone,
      font,
      proxy,
      cache,
      join(root, "data/projects", a.entry.id),
    ])
      await missing(path);
    for (const path of [shared, model, source]) await access(path);
    assert.equal(
      (await call(library, "open", b.entry.id)).workspace.project.assets[0].src,
      "/media/shared.png",
    );
    await assert.rejects(
      call(library, "save", a.entry.id, {
        revision: plan.revision,
        patch: { type: "value", value: ws },
        waves: [],
      }),
      (e) => e.status === 404,
    );
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("export ownership removes every associated output but retained snapshots and shared job references protect media", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-delete-jobs-"));
  const library = new ProjectLibrary(root);
  try {
    const a = await create(
      library,
      workspace("Xóa", ["only.png", "kept-by-export.png"]),
    );
    const b = await create(library, workspace("Giữ"));
    const own = randomUUID(),
      other = randomUUID();
    const unique = await file(root, "data/uploads/only.png");
    const kept = await file(root, "data/uploads/kept-by-export.png");
    const files = [];
    for (const [id, pid, images] of [
      [own, a.entry.id, ["only.png"]],
      [other, b.entry.id, ["kept-by-export.png"]],
    ]) {
      for (const ext of [".mp4", ".srt"])
        files.push(await file(root, "data/exports/" + id + ext));
      files.push(
        await file(
          root,
          "data/jobs/" + id + ".snapshot.json",
          JSON.stringify({
            projectId: pid,
            project: workspace("x", images).project,
          }),
        ),
      );
      files.push(
        await file(
          root,
          "data/jobs/" + id + ".json",
          JSON.stringify({ id, status: "done" }),
        ),
      );
    }
    const plan = await call(library, "delete-preview", a.entry.id);
    assert.equal(plan.exports, 1);
    const result = await call(library, "delete", a.entry.id, {
      confirm: true,
      revision: plan.revision,
      activeId: b.entry.id,
    });
    assert.equal(result.opened, undefined);
    assert.deepEqual(result.removedJobs, [own]);
    await missing(unique);
    await access(kept);
    for (const path of files.filter((p) => p.includes(own)))
      await missing(path);
    for (const path of files.filter((p) => p.includes(other)))
      await access(path);
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("deleting the last active project opens a fresh empty project and does not resurrect after restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-delete-last-"));
  let library = new ProjectLibrary(root);
  try {
    const a = await create(library, workspace("Cuối cùng"));
    const plan = await call(library, "delete-preview", a.entry.id);
    await assert.rejects(
      call(library, "delete", a.entry.id, {
        revision: plan.revision,
        activeId: a.entry.id,
      }),
      (e) => e.status === 409,
    );
    const response = await library.request("delete", {
      projectId: a.entry.id,
      raw: JSON.stringify({
        confirm: true,
        revision: plan.revision,
        activeId: a.entry.id,
      }),
      serialize: "deletion",
    });
    const result = JSON.parse(response.body);
    assert.deepEqual(response.removedJobs, []);
    assert.notEqual(result.opened.entry.id, a.entry.id);
    assert.equal(result.opened.workspace.project.assets.length, 0);
    await library.close();
    library = new ProjectLibrary(root);
    const list = await library.request("list");
    assert.equal(list.projects.length, 1);
    assert.equal(list.activeId, result.opened.entry.id);
    await assert.rejects(
      call(library, "open", a.entry.id),
      (e) => e.status === 404,
    );
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("unreadable other projects or export snapshots block cleanup before changing any file", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-delete-corrupt-"));
  let library = new ProjectLibrary(root);
  try {
    const unique = await file(root, "data/uploads/only.png");
    const a = await create(library, workspace("Không mất", ["only.png"]));
    const other = randomUUID();
    await file(root, `data/projects/${other}/workspace.json`, "broken");
    await assert.rejects(
      call(library, "delete-preview", a.entry.id),
      /dự án khác chưa đọc được/,
    );
    await access(unique);
    await access(join(root, "data/projects", a.entry.id, "workspace.json"));
    await rm(join(root, "data/projects", other), {
      recursive: true,
      force: true,
    });
    await file(root, `data/jobs/${randomUUID()}.snapshot.json`, "broken");
    await assert.rejects(call(library, "delete-preview", a.entry.id));
    await access(unique);
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an export tracked by another project survives until the last project using it is deleted", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-delete-shared-job-"));
  const library = new ProjectLibrary(root);
  try {
    const a = await create(library, workspace("Tạo video", ["history.png"]));
    const jobId = randomUUID();
    const second = workspace("Theo dõi video");
    second.job = { id: jobId, status: "done", progress: 1 };
    const b = await create(library, second);
    const media = await file(root, "data/uploads/history.png");
    const mp4 = await file(root, "data/exports/" + jobId + ".mp4");
    const snapshot = await file(
      root,
      "data/jobs/" + jobId + ".snapshot.json",
      JSON.stringify({
        projectId: a.entry.id,
        project: workspace("x", ["history.png"]).project,
      }),
    );
    const first = await call(library, "delete-preview", a.entry.id);
    assert.equal(first.exports, 0);
    await call(library, "delete", a.entry.id, {
      revision: first.revision,
      confirm: true,
      activeId: b.entry.id,
    });
    for (const path of [media, mp4, snapshot]) await access(path);
    const last = await call(library, "delete-preview", b.entry.id);
    assert.equal(last.exports, 1);
    await call(library, "delete", b.entry.id, {
      revision: last.revision,
      confirm: true,
      activeId: b.entry.id,
    });
    for (const path of [media, mp4, snapshot]) await missing(path);
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});
