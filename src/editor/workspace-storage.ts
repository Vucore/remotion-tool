import type { Project, VoiceAsset } from "../model";
import type { StoryOptions } from "../auto/story";
import { leanProject } from "./project-client";
import { revisionDiff } from "./revision";
export const LEGACY_STORAGE = "khung-story-workspace-v1";
let worker: Worker | null = null,
  sequence = 0;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
let sent: unknown;
const knownWaves = new Map<string, VoiceAsset["envelope"]>();
function stop(error: Error) {
  worker?.terminate();
  worker = null;
  sent = undefined;
  knownWaves.clear();
  for (const job of pending.values()) {
    clearTimeout(job.timer);
    job.reject(error);
  }
  pending.clear();
}
function request<T>(
  kind: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  if (!worker) {
    worker = new Worker("/utility-worker.js", { type: "module" });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      clearTimeout(job.timer);
      pending.delete(data.id);
      if (data.error) job.reject(Error(data.error));
      else job.resolve(data.result);
    };
    worker.onerror = () =>
      stop(
        Error(
          "Không chạy được worker dữ liệu. Khởi động lại server và tải lại trang.",
        ),
      );
  }
  const id = ++sequence;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => stop(Error("Xử lý dữ liệu quá lâu. Hãy thử lại.")),
      120000,
    );
    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer,
    });
    try {
      worker!.postMessage({ id, kind, ...data });
    } catch (error) {
      stop(error instanceof Error ? error : Error(String(error)));
    }
  });
}
export async function readWorkspace() {
  let legacy = null,
    oldProject = null;
  try {
    legacy = localStorage.getItem(LEGACY_STORAGE);
    oldProject = localStorage.getItem("khung-editor-project-v1");
  } catch {
    /* Browser may block localStorage. */
  }
  const result = await request<{ project: Project }>("load", {
    legacy,
    oldProject,
  });
  for (const voice of result.project.voiceover?.assets ?? [])
    if (voice.envelope) knownWaves.set(voice.id, voice.envelope);
  return result;
}
let writes = Promise.resolve();
export function writeWorkspace(workspace: unknown) {
  const next = writes
    .catch(() => {})
    .then(async () => {
      const value = workspace as { project: Project };
      const lean = { ...value, project: leanProject(value.project) };
      const waves = (value.project.voiceover?.assets ?? [])
        .filter(
          (voice) =>
            voice.envelope && knownWaves.get(voice.id) !== voice.envelope,
        )
        .map((voice) => ({ id: voice.id, envelope: voice.envelope }));
      const promise = request("save", {
        patch: revisionDiff(sent, lean),
        waves,
      });
      sent = lean;
      await promise;
      for (const wave of waves) knownWaves.set(wave.id, wave.envelope);
      const ids = new Set(value.project.voiceover?.assets.map((v) => v.id));
      for (const id of knownWaves.keys())
        if (!ids.has(id)) knownWaves.delete(id);
      try {
        localStorage.removeItem(LEGACY_STORAGE);
      } catch {
        /* IndexedDB save has already committed. */
      }
    });
  writes = next;
  return next;
}
export const readEditorFile = (
  file: File,
  type: "project" | "preset",
  name: string,
) =>
  request<{
    project: Project;
    options: StoryOptions;
    imageProcessing?: Project["imageProcessing"];
  }>("file", { file, type, name });
export const jsonBlob = (value: unknown, preset = false) =>
  request<Blob>("json", { value, preset });
