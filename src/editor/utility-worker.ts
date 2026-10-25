import { parseProject } from "../model";
import { parseStoryOptions, optionsFromProject } from "../auto/story";
import { parseImageProcessing } from "../auto/image-processing";
import { readDraft, clearLegacyDraft } from "./legacy-workspace";
import { applyRevision, revisionDiff } from "./revision";
import { leanProject } from "./project-client";
import {
  emptyWorkspace,
  restoreWorkspace,
  type Workspace,
  type SavedProject,
} from "./workspace";

type Saved = { workspace: Workspace; entry: SavedProject; revision: string };
let draft: Workspace, projectId: string, revision: string;
async function api(path: string, method = "GET", value?: unknown) {
  const response = await fetch("/api/projects" + path, {
    method,
    headers: value ? { "Content-Type": "application/json" } : undefined,
    body: value ? JSON.stringify(value) : undefined,
    signal: AbortSignal.timeout(110000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      result.error || "Chưa lưu được dự án. Kiểm tra server và thử lại.",
    );
  return result;
}
function waves(workspace: Workspace) {
  return (
    workspace.project.voiceover?.assets
      .filter((v) => v.envelope)
      .map((v) => ({ id: v.id, envelope: v.envelope })) ?? []
  );
}
function lean(workspace: Workspace): Workspace {
  return { ...workspace, project: leanProject(workspace.project) };
}
function adopt(saved: Saved) {
  const workspace = restoreWorkspace(saved.workspace);
  // Keep the exact server baseline; restoration can add defaults to older projects.
  draft = lean(saved.workspace);
  projectId = saved.entry.id;
  revision = saved.revision;
  return { ...saved, workspace };
}
async function create(workspace: Workspace, migrate = false): Promise<Saved> {
  return api("", "POST", {
    workspace: lean(workspace),
    waves: waves(workspace),
    migrate,
  });
}
async function load(data: { legacy?: string; oldProject?: string }) {
  const library = await api("");
  let previous: Workspace | undefined, failure: unknown;
  try {
    const value = await readDraft();
    if (value) previous = restoreWorkspace(value as Workspace);
  } catch (error) {
    failure = error;
  }
  if (!previous && data.legacy) {
    try {
      previous = restoreWorkspace(JSON.parse(data.legacy));
    } catch (error) {
      failure = error;
    }
  }
  if (!previous && data.oldProject) {
    try {
      const project = parseProject(JSON.parse(data.oldProject));
      previous = {
        project,
        options: optionsFromProject(project),
        dirty: !project.scenes.length,
        job: null,
      };
    } catch (error) {
      failure = error;
    }
  }
  if (previous) {
    const saved = await create(previous, true);
    // A failed cleanup is safe: migration is idempotent, so retry cannot overwrite the newer server version.
    await clearLegacyDraft().catch(() => {});
    return { ...adopt(saved), migrated: true };
  }
  if (library.projects.length) {
    const id = library.projects.some(
      (item: SavedProject) => item.id === library.activeId,
    )
      ? library.activeId
      : library.projects[0].id;
    return adopt(await api("/" + id));
  }
  // An inaccessible legacy draft must not be silently replaced by a blank workspace.
  if (failure) throw failure;
  return adopt(await create(emptyWorkspace()));
}
type Message = {
  kind: string;
  projectId: string;
  revision: string;
  workspace: Workspace;
  patch: Parameters<typeof applyRevision>[1];
  waves: ReturnType<typeof waves>;
  file: File;
  type: string;
  name: string;
  value: Record<string, unknown>;
  preset: boolean;
  legacy?: string;
  oldProject?: string;
};
async function handle(data: Message) {
  if (data.kind === "load") return load(data);
  if (data.kind === "list") return api("");
  if (data.kind === "open") return adopt(await api("/" + data.projectId));
  if (data.kind === "create") return adopt(await create(data.workspace));
  if (data.kind === "delete-preview")
    return api("/" + data.projectId + "/delete-preview");
  if (data.kind === "delete") {
    const result = await api("/" + data.projectId, "DELETE", {
      revision: data.revision,
      activeId: projectId,
      confirm: true,
    });
    if (result.opened) result.opened = adopt(result.opened);
    return result;
  }
  if (data.kind === "save") {
    if (!projectId || data.projectId !== projectId)
      throw Error("Dự án đã thay đổi. Hãy tải lại trang.");
    const next = applyRevision(draft, data.patch);
    const result = await api("/" + projectId, "PATCH", {
      revision,
      patch: revisionDiff(draft, next),
      waves: data.waves,
    });
    draft = next;
    revision = result.revision;
    return result;
  }
  if (data.kind === "file") {
    if (data.file.size > 64 * 1024 * 1024)
      throw Error("Tệp dự án/mẫu tối đa 64 MB.");
    const value = JSON.parse(await data.file.text());
    if (data.type === "project") {
      if (value.khungWorkspaceVersion === 1)
        return restoreWorkspace(value.workspace);
      const project = parseProject(value);
      return {
        project,
        options: optionsFromProject(project),
        dirty: !project.scenes.length,
        job: null,
      };
    }
    if (value.storyPresetVersion !== 1)
      throw Error("Chọn tệp .khung-preset.json đã lưu từ Khung.");
    return {
      options: parseStoryOptions({ ...value.options, name: data.name }),
      imageProcessing: value.imageProcessing
        ? parseImageProcessing(value.imageProcessing)
        : undefined,
    };
  }
  if (data.kind === "json") {
    const value = data.preset
      ? { ...data.value, options: parseStoryOptions(data.value.options) }
      : data.value;
    return new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    });
  }
  throw Error("Thao tác dữ liệu không hợp lệ.");
}
// Await saves before opening another project, including when requests arrive during disk writes.
let queue = Promise.resolve();
globalThis.addEventListener("message", ({ data }) => {
  queue = queue
    .catch(() => {})
    .then(async () => {
      try {
        globalThis.postMessage({ id: data.id, result: await handle(data) });
      } catch (error) {
        globalThis.postMessage({
          id: data.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
});
