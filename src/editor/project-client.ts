import { applyRevision, revisionDiff } from "./revision";
import type { Project } from "../model";
import type { StoryOptions, previewStory } from "../auto/story";
import type { AutoReport } from "../auto/compile";

const leanProjects = new WeakMap<Project, Project>();
const leanVoices = new WeakMap<
  NonNullable<Project["voiceover"]>["assets"],
  NonNullable<Project["voiceover"]>["assets"]
>();
export function leanProject(project: Project): Project {
  if (!project.voiceover) return project;
  const cached = leanProjects.get(project);
  if (cached) return cached;
  let assets = leanVoices.get(project.voiceover.assets);
  if (!assets) {
    assets = project.voiceover.assets.map(({ id, name, src, duration }) => ({
      id,
      name,
      src,
      duration,
    }));
    leanVoices.set(project.voiceover.assets, assets);
  }
  const result = { ...project, voiceover: { ...project.voiceover, assets } };
  leanProjects.set(project, result);
  return result;
}
export type StoryPreview = ReturnType<typeof previewStory> & {
  validation?: { error: string };
  ttsReady?: boolean;
};

export class ProjectWorker {
  private worker: Worker | null = null;
  private id = 0;
  private sentProject: Project | undefined;
  private sentOptions: StoryOptions | undefined;
  private received: unknown;
  private kind = "";
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private ensureWorker() {
    if (this.worker) return this.worker;
    const worker = new Worker("/project-worker.js", { type: "module" });
    worker.onmessage = ({ data }) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (data.error) pending.reject(Error(data.error));
      else {
        this.received = Object.hasOwn(data, "resultPatch")
          ? applyRevision(this.received, data.resultPatch)
          : data.result;
        pending.resolve(this.received);
      }
    };
    worker.onerror = () =>
      this.close("Không chạy được worker dựng video. Tải lại trang.");
    this.worker = worker;
    return worker;
  }
  run<T>(
    kind: string,
    project: Project,
    options: StoryOptions,
    signal?: AbortSignal,
    extra: { inspect?: boolean; rebuild?: boolean } = {},
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(Error("Đã dừng dựng video."));
    // Superseded preview work must not accumulate behind a long compilation.
    if (this.pending.size && this.kind === "preview")
      this.close("Đã có bản preview mới hơn.");
    if (this.pending.size)
      return Promise.reject(Error("Worker đang dựng bản xuất."));
    this.kind = kind;
    const id = ++this.id;
    const abort = () => this.close("Đã dừng dựng video.");
    signal?.addEventListener("abort", abort, { once: true });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => this.close("Dựng video quá lâu. Hãy thử lại."),
        60000,
      );
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      try {
        const worker = this.ensureWorker();
        const lean = leanProject(project);
        worker.postMessage({
          id,
          kind,
          delta: true,
          projectPatch: revisionDiff(this.sentProject, lean),
          optionsPatch: revisionDiff(this.sentOptions, options),
          ...extra,
        });
        this.sentProject = lean;
        this.sentOptions = options;
      } catch (error) {
        this.close(error instanceof Error ? error.message : String(error));
      }
    }).finally(() => signal?.removeEventListener("abort", abort));
  }
  close(message = "Đã dừng worker.") {
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(Error(message));
    }
    this.pending.clear();
    this.sentProject = undefined;
    this.sentOptions = undefined;
    this.received = undefined;
  }
  preview(
    project: Project,
    options: StoryOptions,
    inspect = false,
    rebuild = true,
  ) {
    return this.run<StoryPreview>("preview", project, options, undefined, {
      inspect,
      rebuild,
    });
  }
  build(project: Project, options: StoryOptions, signal?: AbortSignal) {
    return this.run<{ project: Project; report: AutoReport }>(
      "build",
      project,
      options,
      signal,
    );
  }
}
