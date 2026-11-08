import { fork } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { renderBudget } from "./resource-budget.mjs";
export { renderBudget } from "./resource-budget.mjs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { heavyTasks } from "./resource-queue.mjs";

export function exportFilename(value) {
  if (typeof value !== "string") throw Error("Nhập tên video.");
  const base = value
    .replace(/[\x00-\x1f\x7f"\\/]/g, "-")
    .trim()
    .replace(/\.mp4$/i, "")
    .trim();
  if (!base || /^\.+$/.test(base)) throw Error("Nhập tên video.");
  if (Array.from(base).length > 176)
    throw Error("Tên video tối đa 176 ký tự, chưa gồm .mp4.");
  return base + ".mp4";
}
function renamedSubtitle(subtitle, previous, filename) {
  const base = (name) =>
    name
      .replace(/\.(?:srt|mp4)$/i, "")
      .replace(/[\\/:*?"<>|\r\n]/g, "_")
      .trim()
      .slice(0, 100) || "video";
  const oldBase = base(previous ?? "");
  const suffix = subtitle.startsWith(oldBase + "_")
    ? subtitle.slice(oldBase.length)
    : ".srt";
  return base(filename) + suffix;
}

export class ExportJobs {
  jobs = new Map();
  writes = new Map();
  projectWrites = new Map();
  constructor(
    root,
    origin,
    { workerPath = join(root, "scripts/export-worker.mjs") } = {},
  ) {
    this.root = root;
    this.origin = origin;
    this.directory = join(root, "data/jobs");
    this.workerPath = workerPath;
  }
  public(job) {
    const {
      id,
      filename,
      status,
      progress,
      error,
      url,
      subtitleUrl,
      subtitleFilename,
      createdAt,
      mode,
      projectId,
      projectName,
    } = job;
    return {
      id,
      filename,
      status,
      progress,
      error,
      url,
      subtitleUrl,
      subtitleFilename,
      createdAt,
      mode,
      ...(projectId ? { projectId } : {}),
      ...(projectName ? { projectName } : {}),
      running: !!job.running,
    };
  }
  async persist(job) {
    const old = this.writes.get(job.id) ?? Promise.resolve();
    const next = old
      .catch(() => {})
      .then(async () => {
        const temporary = join(this.directory, job.id + ".tmp");
        await writeFile(temporary, JSON.stringify(this.public(job)));
        await rename(temporary, join(this.directory, job.id + ".json"));
      });
    this.writes.set(job.id, next);
    return next;
  }
  async initialize() {
    await mkdir(this.directory, { recursive: true });
    for (const name of await readdir(this.directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      try {
        const job = JSON.parse(
          await readFile(join(this.directory, name), "utf8"),
        );
        if (job.id !== name.slice(0, -5)) continue;
        if (["queued", "preparing", "rendering"].includes(job.status)) {
          job.status = "error";
          job.error =
            "Server đã khởi động lại. Có thể thử xuất lại từ snapshot đã lưu.";
          await this.persist(job);
          await rm(
            join(this.root, "data/exports", job.id + ".mp4.partial.mp4"),
            { force: true },
          );
        }
        job.running = false;
        this.jobs.set(job.id, job);
      } catch {
        /* Ignore incomplete/corrupt job records, never delete their source snapshot. */
      }
    }
  }
  async reconcile(id) {
    for (const job of id ? [this.jobs.get(id)] : this.jobs.values()) {
      if (!job || job.running || job.editing) continue;
      let changed = false;
      for (const [field, suffix] of [
        ["url", ".mp4"],
        ["subtitleUrl", ".srt"],
      ]) {
        if (!job[field]) continue;
        try {
          await stat(join(this.root, "data/exports", job.id + suffix));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          delete job[field];
          if (field === "subtitleUrl") delete job.subtitleFilename;
          if (field === "url" && job.status === "done") {
            job.status = "error";
            job.error =
              "File MP4 không còn trên đĩa. Có thể xuất lại từ snapshot còn giữ.";
          }
          changed = true;
        }
      }
      if (changed) await this.persist(job);
    }
  }
  async create(
    project,
    { filename, quality, mode = "editing", projectId, projectName },
  ) {
    if ([...this.jobs.values()].filter((job) => job.running).length >= 5)
      throw Error("Hàng đợi đã đầy.");
    const job = {
      id: randomUUID(),
      filename,
      renderFilename: filename,
      projectId,
      projectName: projectName ?? filename.replace(/\.mp4$/i, ""),
      createdAt: new Date().toISOString(),
      mode: mode === "fast" ? "fast" : "editing",
      status: "queued",
      progress: 0,
      running: true,
      controller: new AbortController(),
    };
    const request = {
      project,
      projectId,
      filename,
      quality,
      mode: job.mode,
      ...renderBudget(job.mode),
      origin: this.origin,
      output: join(this.root, "data/exports", job.id + ".mp4"),
    };
    // Reserve a slot before awaiting disk I/O so concurrent POSTs cannot overfill the queue.
    this.jobs.set(job.id, job);
    try {
      await writeFile(
        join(this.directory, job.id + ".snapshot.json"),
        JSON.stringify(request),
        { flag: "wx" },
      );
      await this.persist(job);
    } catch (error) {
      this.jobs.delete(job.id);
      this.writes.delete(job.id);
      await Promise.all(
        [".snapshot.json", ".json", ".tmp"].map((extension) =>
          rm(join(this.directory, job.id + extension), { force: true }).catch(
            () => {},
          ),
        ),
      );
      throw error;
    }
    void heavyTasks
      .run(() => this.execute(job), job.controller.signal)
      .catch(async (error) => {
        if (job.status !== "cancelled") {
          job.status = "error";
          job.error = error.message;
        }
      })
      .finally(async () => {
        job.running = false;
        await this.persist(job).catch(() => {});
      });
    return job;
  }
  async execute(job) {
    if (job.controller.signal.aborted) return;
    job.status = "preparing";
    await this.persist(job);
    await new Promise((resolve, reject) => {
      const child = fork(
        this.workerPath,
        [join(this.directory, job.id + ".snapshot.json")],
        {
          detached: process.platform !== "win32",
          stdio: ["ignore", "ignore", "pipe", "ipc"],
        },
      );
      job.child = child;
      let errorLog = "",
        killTimer,
        done = false,
        lastSave = 0;
      const abort = () => {
        if (child.connected) child.send("cancel");
        child.kill("SIGTERM");
        killTimer ??= setTimeout(() => {
          try {
            if (process.platform !== "win32")
              process.kill(-child.pid, "SIGKILL");
            else child.kill("SIGKILL");
          } catch {
            /* Already stopped. */
          }
        }, 5000);
      };
      job.controller.signal.addEventListener("abort", abort, { once: true });
      if (job.controller.signal.aborted) abort();
      child.stderr.on("data", (value) => {
        errorLog = (errorLog + value).slice(-2000);
      });
      child.on("message", (message) => {
        if (job.status === "cancelled") return;
        if (message.error) {
          job.error = message.error;
          return;
        }
        if (message.done) {
          done = true;
          job.status = "done";
          job.progress = 1;
          job.url = `/exports/${job.id}.mp4`;
          if (message.subtitle) {
            job.subtitleUrl = `/exports/${job.id}.srt`;
            job.subtitleFilename = renamedSubtitle(
              message.subtitle,
              job.renderFilename ?? job.filename,
              job.filename,
            );
          }
        } else {
          job.status = message.status;
          job.progress = message.progress;
        }
        if (message.done || Date.now() - lastSave > 1000) {
          lastSave = Date.now();
          void this.persist(job).catch(() => {});
        }
      });
      child.once("error", reject);
      child.once("close", async (code) => {
        clearTimeout(killTimer);
        job.controller.signal.removeEventListener("abort", abort);
        delete job.child;
        if (job.status === "cancelled") {
          await rm(
            join(this.root, "data/exports", job.id + ".mp4.partial.mp4"),
            { force: true },
          );
          await rm(join(this.root, "data/exports", job.id + ".mp4"), {
            force: true,
          });
          await rm(join(this.root, "data/exports", job.id + ".srt"), {
            force: true,
          });
          resolve();
        } else if (code !== 0 || !done)
          reject(
            Error(
              job.error || errorLog || "Tiến trình xuất kết thúc bất thường.",
            ),
          );
        else resolve();
      });
    });
  }
  async cancel(job) {
    job.status = "cancelled";
    job.controller?.abort();
    await this.persist(job);
  }
  async retry(id) {
    if ([...this.jobs.values()].filter((job) => job.running).length >= 5)
      throw Error("Hàng đợi đã đầy.");
    const previous = this.jobs.get(id);
    if (!previous || previous.running || previous.editing)
      throw Error("Tác vụ chưa sẵn sàng để thử lại.");
    return this.edit(id, async () => {
      const snapshot = JSON.parse(
        await readFile(join(this.directory, id + ".snapshot.json"), "utf8"),
      );
      return this.create(snapshot.project, {
        ...snapshot,
        filename: previous.filename,
        projectName: previous.projectName,
      });
    });
  }
  async edit(id, operation) {
    const job = this.jobs.get(id);
    if (!job)
      throw Object.assign(Error("Không tìm thấy bản xuất."), { status: 404 });
    if (
      job.running ||
      job.editing ||
      ["queued", "preparing", "rendering"].includes(job.status)
    )
      throw Object.assign(
        Error("Bản xuất đang được xử lý. Chờ hoàn tất rồi thử lại."),
        { status: 409 },
      );
    job.editing = true;
    try {
      await this.writes.get(id)?.catch(() => {});
      return await operation(job);
    } finally {
      delete job.editing;
    }
  }
  async rename(id, value) {
    const filename = exportFilename(value);
    return this.edit(id, async (job) => {
      const old = {
        filename: job.filename,
        subtitleFilename: job.subtitleFilename,
      };
      if (job.subtitleFilename)
        job.subtitleFilename = renamedSubtitle(
          job.subtitleFilename,
          job.filename,
          filename,
        );
      job.filename = filename;
      try {
        await this.persist(job);
      } catch (error) {
        Object.assign(job, old);
        throw error;
      }
      return job;
    });
  }
  renameProject(projectId, name) {
    const pending = (this.projectWrites.get(projectId) ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.syncProjectName(projectId, name));
    this.projectWrites.set(projectId, pending);
    const clear = () => {
      if (this.projectWrites.get(projectId) === pending)
        this.projectWrites.delete(projectId);
    };
    void pending.then(clear, clear);
    return pending;
  }
  async syncProjectName(projectId, name) {
    const filename = exportFilename(name);
    const updated = [];
    for (const job of this.jobs.values()) {
      if (job.projectId !== projectId || job.projectName === name) continue;
      if (job.editing)
        throw Error(
          "Bản xuất đang được chỉnh sửa. Hãy thử đổi tên dự án lại sau giây lát.",
        );
      job.editing = true;
      const old = {
        filename: job.filename,
        subtitleFilename: job.subtitleFilename,
        projectName: job.projectName,
      };
      try {
        await this.writes.get(job.id)?.catch(() => {});
        if (job.subtitleFilename)
          job.subtitleFilename = renamedSubtitle(
            job.subtitleFilename,
            job.filename,
            filename,
          );
        job.filename = filename;
        job.projectName = name;
        await this.persist(job);
        updated.push(this.public(job));
      } catch (error) {
        Object.assign(job, old);
        throw error;
      } finally {
        delete job.editing;
      }
    }
    return updated;
  }
  async remove(id) {
    // Only canonical files owned by this job; never traverse snapshot media.
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Mã bản xuất không hợp lệ.");
    return this.edit(id, async () => {
      for (const suffix of [".mp4", ".srt", ".mp4.partial.mp4"])
        await rm(join(this.root, "data/exports", id + suffix), { force: true });
      for (const suffix of [".snapshot.json", ".tmp", ".json"])
        await rm(join(this.directory, id + suffix), { force: true });
      this.jobs.delete(id);
      this.writes.delete(id);
    });
  }
  async close() {
    await Promise.all(
      [...this.jobs.values()]
        .filter((job) => job.running)
        .map((job) => this.cancel(job)),
    );
  }
}
