import { emptyProject, parseProject, type Project } from "../model";
import {
  defaultStoryOptions,
  parseStoryOptions,
  optionsFromProject,
} from "../auto/story";
import { defaultTtsSettings, parseTtsSettings } from "../auto/tts";
import { parseImageProcessing } from "../auto/image-processing";
import { readDraft, DraftWriter } from "./workspace-database";
import { applyRevision } from "./revision";
let draft: Record<string, unknown> & { project: Project };
let initialWaves: {
  id: string;
  envelope: NonNullable<Project["voiceover"]>["assets"][number]["envelope"];
}[] = [];
const writer = new DraftWriter();
function restore(
  value: Record<string, unknown> & {
    project: Project;
    options?: unknown;
    dirty?: boolean;
    job?: { id?: string };
  },
) {
  let tts = defaultTtsSettings();
  try {
    tts = parseTtsSettings((value.options as { tts?: unknown })?.tts);
  } catch {
    /* Preserve the old behavior for unfinished TTS settings. */
  }
  return {
    project: parseProject(value.project),
    options: parseStoryOptions({ ...(value.options as object), tts }),
    dirty: value.dirty !== false,
    job:
      value.job?.id && /^[a-f0-9-]{36}$/.test(value.job.id) ? value.job : null,
  };
}
globalThis.addEventListener("message", async ({ data }) => {
  try {
    let result: unknown;
    if (data.kind === "load") {
      let value, failure: unknown;
      try {
        value = await readDraft();
      } catch (error) {
        failure = error;
      }
      if (value) {
        try {
          result = restore(value);
        } catch (error) {
          failure = error;
        }
      }
      if (!result && data.legacy) {
        try {
          result = restore(JSON.parse(data.legacy));
        } catch (error) {
          failure = error;
        }
      }
      if (!result && data.oldProject) {
        try {
          const project = parseProject(JSON.parse(data.oldProject));
          result = {
            project,
            options: optionsFromProject(project),
            dirty: !project.scenes.length,
            job: null,
          };
        } catch (error) {
          failure = error;
        }
      }
      if (!result && failure) throw failure;
      result ??= {
        project: emptyProject(),
        options: defaultStoryOptions(),
        dirty: true,
        job: null,
      };
      const restored = result as { project: Project };
      initialWaves =
        restored.project.voiceover?.assets
          .filter((v) => v.envelope)
          .map((v) => ({ id: v.id, envelope: v.envelope })) ?? [];
    } else if (data.kind === "save") {
      draft = applyRevision(draft, data.patch);
      await writer.save(draft, [...initialWaves, ...data.waves]);
      initialWaves = [];
      result = true;
    } else if (data.kind === "file") {
      if (data.file.size > 10_000_000)
        throw Error("Tệp dự án/mẫu tối đa 10 MB.");
      const value = JSON.parse(await data.file.text());
      if (data.type === "project") {
        const project = parseProject(value);
        result = { project, options: optionsFromProject(project) };
      } else {
        if (value.storyPresetVersion !== 1)
          throw Error("Chọn tệp .khung-preset.json đã lưu từ Khung.");
        result = {
          options: parseStoryOptions({ ...value.options, name: data.name }),
          imageProcessing: value.imageProcessing
            ? parseImageProcessing(value.imageProcessing)
            : undefined,
        };
      }
    } else if (data.kind === "json") {
      const value = data.preset
        ? { ...data.value, options: parseStoryOptions(data.value.options) }
        : data.value;
      result = new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json",
      });
    } else throw Error("Thao tác dữ liệu không hợp lệ.");
    globalThis.postMessage({ id: data.id, result });
  } catch (error) {
    globalThis.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
