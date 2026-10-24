import { fork } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  rm,
} from "node:fs/promises";
import { renderBudget } from "./resource-budget.mjs";
export { renderBudget } from "./resource-budget.mjs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { heavyTasks } from "./resource-queue.mjs";

export class ExportJobs {
  jobs = new Map();
  writes = new Map();
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
  async create(project, { filename, quality, mode = "editing" }) {
    if ([...this.jobs.values()].filter((job) => job.running).length >= 5)
      throw Error("Hàng đợi đã đầy.");
    const job = {
      id: randomUUID(),
      filename,
      createdAt: new Date().toISOString(),
      mode: mode === "fast" ? "fast" : "editing",
      status: "queued",
      progress: 0,
      running: true,
      controller: new AbortController(),
    };
    const request = {
      project,
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
            job.subtitleFilename = message.subtitle;
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
    if (!previous || previous.running)
      throw Error("Tác vụ chưa sẵn sàng để thử lại.");
    const snapshot = JSON.parse(
      await readFile(join(this.directory, id + ".snapshot.json"), "utf8"),
    );
    return this.create(snapshot.project, snapshot);
  }
  async close() {
    await Promise.all(
      [...this.jobs.values()]
        .filter((job) => job.running)
        .map((job) => this.cancel(job)),
    );
  }
}
