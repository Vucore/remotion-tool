import { emptyProject, parseProject, type Project } from "../model";
import {
  defaultStoryOptions,
  parseStoryOptions,
  type StoryOptions,
} from "../auto/story";
import { defaultTtsSettings, parseTtsSettings } from "../auto/tts";

export type WorkspaceJob = {
  id: string;
  status: "queued" | "preparing" | "rendering" | "done" | "error" | "cancelled";
  createdAt?: string;
  mode?: string;
  progress: number;
  error?: string;
  url?: string;
  subtitleUrl?: string;
  subtitleFilename?: string;
};
export type Workspace = {
  project: Project;
  options: StoryOptions;
  dirty: boolean;
  job: WorkspaceJob | null;
};
export type SavedProject = {
  id: string;
  name: string;
  thumbnail?: string;
  images: number;
  scenes: number;
  ratio: "9:16" | "16:9";
  createdAt: string;
  updatedAt: string;
};
export function emptyWorkspace(): Workspace {
  return {
    project: emptyProject(),
    options: defaultStoryOptions(),
    dirty: true,
    job: null,
  };
}
export function restoreWorkspace(value: Workspace): Workspace {
  let tts = defaultTtsSettings();
  try {
    tts = parseTtsSettings(value.options?.tts);
  } catch {
    /* Unfinished TTS settings retain the previous restoration behavior. */
  }
  return {
    project: parseProject(value.project),
    options: parseStoryOptions({ ...value.options, tts }),
    dirty: value.dirty !== false,
    job:
      value.job?.id && /^[a-f0-9-]{36}$/.test(value.job.id) ? value.job : null,
  };
}
