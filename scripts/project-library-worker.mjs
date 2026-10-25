import { parentPort, workerData } from "node:worker_threads";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  open,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { applyRevision } from "../dist/revision.mjs";
import { parseProject } from "../dist/model.mjs";
import { emptyWorkspace } from "../dist/workspace.mjs";
import {
  resourceRefs,
  recordRefs,
  deletionPlan,
  removeResources,
} from "./project-resources.mjs";

const directory = join(workerData.root, "data/projects");
const idPattern = /^[a-f0-9-]{36}$/;
const indexFile = join(directory, "index.json");
let index, cached;
const deleted = new Set();
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
function pathFor(id) {
  if (!idPattern.test(id)) fail("ID dự án không hợp lệ.");
  return join(directory, id, "workspace.json");
}
async function atomic(file, value, text = false) {
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(text ? value : JSON.stringify(value));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
function summary(record) {
  const { project, options } = record.workspace;
  return {
    id: record.id,
    name: options.name || project.name || "Câu chuyện chưa đặt tên",
    thumbnail: project.assets[0]?.src,
    images: project.assets.length,
    scenes: project.scenes.length,
    ratio: options.ratio === "16:9" ? "16:9" : "9:16",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
const journalFor = (id) => join(directory, id, "changes.jsonl");
async function stamp(id) {
  const [base, journal] = await Promise.all([
    stat(pathFor(id)),
    stat(journalFor(id)).catch((error) => {
      if (error.code === "ENOENT") return { size: 0, mtimeMs: 0 };
      throw error;
    }),
  ]);
  return `${base.mtimeMs}:${base.size}:${journal.mtimeMs}:${journal.size}`;
}
async function read(id) {
  if (deleted.has(id)) fail("Dự án đã được xóa.", 404);
  if (cached?.id === id) return cached;
  let record;
  try {
    record = JSON.parse(await readFile(pathFor(id), "utf8"));
    record.resources = [...recordRefs(record)];
    const journal = await readFile(journalFor(id)).catch((error) => {
      if (error.code === "ENOENT") return Buffer.alloc(0);
      throw error;
    });
    // A killed process may leave only the final line incomplete. Keep all acknowledged lines.
    const end = journal.lastIndexOf(10) + 1;
    const lines = journal
      .subarray(0, end)
      .toString("utf8")
      .split("\n")
      .filter(Boolean);
    for (const line of lines) {
      const change = JSON.parse(line);
      if (change.sequence <= (record.sequence ?? 0)) continue; // snapshot committed before journal rotation
      if (
        change.baseRevision !== record.revision ||
        change.sequence !== (record.sequence ?? 0) + 1
      )
        fail(
          "Nhật ký dự án không khớp. Các tệp được giữ nguyên để khôi phục.",
          422,
        );
      const workspace = applyRevision(record.workspace, change.patch);
      record = {
        ...record,
        workspace,
        waves: mergeWaves(record.waves, workspace, change.waves),
        revision: change.revision,
        sequence: change.sequence,
        updatedAt: change.updatedAt,
        resources: [
          ...resourceRefs(
            change.resources ?? [],
            resourceRefs(workspace, new Set(record.resources)),
          ),
        ],
      };
    }
    if (end !== journal.length) {
      const handle = await open(journalFor(id), "r+");
      try {
        await handle.truncate(end);
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    if (error.status) throw error;
    if (error.code === "ENOENT") fail("Không tìm thấy dự án.", 404);
    fail("Không đọc được dự án. Bản lưu trên đĩa được giữ nguyên.", 422);
  }
  if (record.id !== id || !record.workspace?.project)
    fail("Bản lưu dự án không hợp lệ.", 422);
  cached = record;
  return record;
}
async function initialize() {
  if (index) return;
  await mkdir(directory, { recursive: true });
  try {
    index = JSON.parse(await readFile(indexFile, "utf8"));
  } catch {
    index = { version: 1, activeId: null, projects: {} };
  }
  if (!index.projects || index.version !== 1)
    index = { version: 1, activeId: null, projects: {} };
  const ids = new Set(
    (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && idPattern.test(entry.name))
      .map((entry) => entry.name),
  );
  // The index is rebuildable; it never holds the only copy of project content.
  for (const id of ids) {
    try {
      try {
        await stat(join(directory, id, "deleted.json"));
        deleted.add(id);
        delete index.projects[id];
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const fingerprint = await stamp(id);
      if (index.projects[id]?.stamp !== fingerprint) {
        const record = await read(id);
        index.projects[id] = {
          ...summary(record),
          stamp: await stamp(id),
          migrationKey: record.migrationKey,
        };
      }
    } catch {
      /* Preserve unreadable files. Opening the project surfaces its recovery error. */
    }
  }
  for (const id of Object.keys(index.projects))
    if (!ids.has(id)) delete index.projects[id];
}
function validate(workspace) {
  if (
    !workspace?.project ||
    !workspace.options ||
    typeof workspace.options.name !== "string"
  )
    fail("Dữ liệu dự án không hợp lệ.");
  parseProject(workspace.project);
  return workspace;
}
function mergeWaves(old, workspace, waves = []) {
  const retained = new Set(
    workspace.project.voiceover?.assets.map((voice) => voice.id),
  );
  const result = Object.fromEntries(
    Object.entries(old ?? {}).filter(([id]) => retained.has(id)),
  );
  for (const wave of waves)
    if (retained.has(wave.id)) result[wave.id] = wave.envelope;
  return result;
}
async function publish(record, activate = true) {
  cached = record;
  index.projects[record.id] = {
    ...summary(record),
    stamp: await stamp(record.id),
    migrationKey: record.migrationKey,
  };
  if (activate) index.activeId = record.id;
  await atomic(indexFile, index).catch(() => {});
  return { entry: summary(record), revision: record.revision };
}
async function commit(record, activate = true) {
  await mkdir(join(directory, record.id), { recursive: true });
  await atomic(pathFor(record.id), record);
  await atomic(journalFor(record.id), "", true);
  return publish(record, activate);
}
async function append(record, next, payload) {
  const change = {
    baseRevision: record.revision,
    revision: next.revision,
    sequence: next.sequence,
    updatedAt: next.updatedAt,
    patch: payload.patch,
    waves: payload.waves,
    resources: payload.resources,
  };
  const handle = await open(journalFor(record.id), "a");
  try {
    await handle.writeFile(JSON.stringify(change) + "\n");
    await handle.sync();
  } catch (error) {
    cached = undefined;
    throw error;
  } finally {
    await handle.close();
  }
  cached = next; // durable as soon as fsync succeeds
  // Bound replay work while avoiding full rewrites for each text/setting/progress update.
  if (
    next.sequence % 32 === 0 ||
    (await stat(journalFor(record.id))).size > 1024 * 1024
  ) {
    try {
      await commit(next, false);
    } catch {
      /* The acknowledged journal remains authoritative. */
    }
  }
  return publish(next, payload.activate !== false);
}
function unpack(record) {
  const workspace = record.workspace;
  return {
    workspace: {
      ...workspace,
      project: {
        ...workspace.project,
        ...(workspace.project.voiceover
          ? {
              voiceover: {
                ...workspace.project.voiceover,
                assets: workspace.project.voiceover.assets.map((voice) =>
                  record.waves?.[voice.id]
                    ? { ...voice, envelope: record.waves[voice.id] }
                    : voice,
                ),
              },
            }
          : {}),
      },
    },
    entry: summary(record),
    revision: record.revision,
  };
}
async function handle({ action, projectId, raw }) {
  await initialize();
  const payload = raw ? JSON.parse(raw) : {};
  if (action === "barrier") return true;
  if (action === "list")
    return {
      activeId: index.activeId,
      projects: Object.values(index.projects)
        .map(({ stamp, migrationKey, ...entry }) => entry)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };
  if (action === "create") {
    const workspace = validate(payload.workspace);
    const migrationKey = payload.migrate
      ? createHash("sha256")
          .update(JSON.stringify({ workspace, waves: payload.waves }))
          .digest("hex")
      : undefined;
    const existing =
      migrationKey &&
      Object.values(index.projects).find(
        (item) => item.migrationKey === migrationKey,
      );
    if (existing) return unpack(await read(existing.id));
    const now = new Date().toISOString();
    const record = {
      version: 1,
      sequence: 0,
      id: randomUUID(),
      revision: randomUUID(),
      createdAt: now,
      updatedAt: now,
      migrationKey,
      workspace,
      waves: mergeWaves({}, workspace, payload.waves),
      resources: [...resourceRefs(workspace)],
    };
    await commit(record);
    return unpack(record);
  }
  const record = await read(projectId);
  if (action === "exists") return { entry: summary(record) };
  if (action === "track") {
    const resources = resourceRefs(payload.resources, recordRefs(record));
    if (resources.size === recordRefs(record).size) return true;
    return append(
      record,
      {
        ...record,
        resources: [...resources],
        sequence: (record.sequence ?? 0) + 1,
      },
      { patch: null, resources: payload.resources, activate: false },
    );
  }
  if (action === "delete-preview" || action === "delete") {
    const others = [];
    let nextRecord;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        idPattern.test(entry.name) &&
        entry.name !== projectId &&
        !deleted.has(entry.name)
      ) {
        try {
          const other = await read(entry.name);
          others.push({ id: other.id, resources: [...recordRefs(other)] });
          if (!nextRecord || other.updatedAt > nextRecord.updatedAt)
            nextRecord = other;
        } catch {
          fail(
            "Có dự án khác chưa đọc được. Khôi phục dự án đó trước để tránh xóa nhầm tài nguyên dùng chung.",
            409,
          );
        }
      }
    }
    const plan = await deletionPlan(workerData.root, record, others);
    if (action === "delete-preview")
      return {
        id: record.id,
        name: summary(record).name,
        revision: record.revision,
        files: plan.files.length,
        bytes: plan.bytes,
        shared: plan.shared,
        exports: plan.jobs.length,
      };
    if (payload.confirm !== true || payload.revision !== record.revision)
      fail(
        "Dự án đã thay đổi. Mở lại xác nhận xóa để kiểm tra bản mới nhất.",
        409,
      );
    let opened;
    if (payload.activeId === record.id) {
      const next = nextRecord;
      opened = next
        ? unpack(next)
        : await handle({
            action: "create",
            raw: JSON.stringify({ workspace: emptyWorkspace() }),
          });
    }
    // Tombstone first: stale tabs must never recreate the project while files are being removed.
    await atomic(join(directory, record.id, "deleted.json"), {
      deletedAt: new Date().toISOString(),
      revision: record.revision,
      files: plan.files,
      jobs: plan.jobs,
    });
    deleted.add(record.id);
    if (cached?.id === record.id) cached = undefined;
    delete index.projects[record.id];
    if (index.activeId === record.id)
      index.activeId = opened?.entry.id ?? others[0]?.id ?? null;
    await atomic(indexFile, index).catch(() => {});
    const result = await removeResources(plan);
    if (!result.failures.length) {
      try {
        await rm(join(directory, record.id), { recursive: true, force: true });
      } catch {
        result.failures.push("project:" + record.id);
      }
    }
    return { ...result, id: record.id, opened };
  }
  if (action === "open") {
    index.activeId = record.id;
    await atomic(indexFile, index).catch(() => {});
    return unpack(record);
  }
  if (action === "save") {
    if (payload.revision !== record.revision)
      fail(
        "Dự án đã được chỉnh sửa ở tab khác. Hãy tải bản sao JSON để giữ thay đổi, rồi tải lại trang.",
        409,
      );
    const workspace = validate(applyRevision(record.workspace, payload.patch));
    const waves = mergeWaves(record.waves, workspace, payload.waves);
    // Repeated flushes with no content change need not serialize or rewrite a large snapshot.
    if (workspace === record.workspace && !payload.waves?.length)
      return { entry: summary(record), revision: record.revision };
    return append(
      record,
      {
        ...record,
        workspace,
        waves,
        sequence: (record.sequence ?? 0) + 1,
        revision: randomUUID(),
        updatedAt: new Date().toISOString(),
        resources: [...resourceRefs(workspace, recordRefs(record))],
      },
      payload,
    );
  }
  fail("Thao tác dự án không hợp lệ.");
}
// Serialize mutations from tabs and autosaves; failures do not poison the queue.
let queue = Promise.resolve();
parentPort.on("message", (message) => {
  queue = queue
    .catch(() => {})
    .then(async () => {
      try {
        const result = await handle(message);
        parentPort.postMessage({
          id: message.id,
          result:
            message.serialize === "deletion"
              ? {
                  body: JSON.stringify(result),
                  removedJobs: result.removedJobs,
                }
              : message.serialize
                ? JSON.stringify(result)
                : result,
        });
      } catch (error) {
        parentPort.postMessage({
          id: message.id,
          error: error.message,
          status: error.status || 400,
        });
      }
    });
});
