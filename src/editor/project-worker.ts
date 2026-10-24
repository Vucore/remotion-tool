import {
  previewStory,
  storyConfig,
  finishStory,
  storyInputs,
  type StoryOptions,
} from "../auto/story";
import { compileAuto, type SceneCompileCache } from "../auto/compile";
import { estimatedSubtitles } from "../auto/subtitles";
import {
  parseTtsSettings,
  ttsInputKey,
  ttsPlan,
  speechPlan,
} from "../auto/tts";
import { applyRevision, revisionDiff, type RevisionPatch } from "./revision";
import type { Project } from "../model";

const sceneCache: SceneCompileCache = new Map();
let project: Project;
let options: StoryOptions;
let previousResult: unknown;
export function inspectStory(project: Project, options: StoryOptions) {
  let ttsReady = false;
  if (options.tts.enabled && project.voiceover?.assets.length) {
    try {
      ttsReady =
        project.voiceover.ttsKey ===
        ttsInputKey(project.voiceover.script, options.tts);
    } catch {
      /* Validation below reports invalid speech settings. */
    }
  }
  const ttsPending = options.tts.enabled && !ttsReady;
  const source: Project = ttsPending
    ? {
        ...project,
        scenes: [],
        automation: undefined,
        voiceover: {
          ...project.voiceover!,
          assets: [],
          script: project.voiceover?.script ?? "",
          scriptName: project.voiceover?.scriptName ?? "",
        },
      }
    : project;
  let validation = { error: "" };
  try {
    if (options.tts.enabled) {
      const tts = parseTtsSettings(options.tts);
      ttsPlan(project.voiceover?.script ?? "", project.assets);
      speechPlan(project.voiceover?.script ?? "", tts);
    }
    storyInputs(source);
  } catch (error) {
    validation = {
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { source, ttsPending, ttsReady, validation };
}

globalThis.addEventListener(
  "message",
  ({
    data,
  }: MessageEvent<{
    id: number;
    kind: string;
    project?: Project;
    options?: StoryOptions;
    projectPatch?: RevisionPatch | null;
    optionsPatch?: RevisionPatch | null;
    delta?: boolean;
    inspect?: boolean;
    rebuild?: boolean;
  }>) => {
    try {
      project =
        data.project ?? applyRevision(project, data.projectPatch ?? null);
      options =
        data.options ?? applyRevision(options, data.optionsPatch ?? null);
      let result: unknown;
      if (data.kind === "build") {
        const config = storyConfig(project, options);
        const built = compileAuto(config, project.assets, project, false);
        result = {
          ...built,
          project: finishStory(built.project, project, options, config),
        };
      } else if (data.inspect) {
        const inspected = inspectStory(project, options);
        const preview =
          data.rebuild || !project.scenes.length || inspected.ttsPending
            ? previewStory(inspected.source, options, sceneCache)
            : { project, estimated: estimatedSubtitles(project) };
        result = {
          ...preview,
          validation: inspected.validation,
          ttsReady: inspected.ttsReady,
        };
      } else result = previewStory(project, options, sceneCache);
      if (data.delta) {
        globalThis.postMessage({
          id: data.id,
          resultPatch: revisionDiff(previousResult, result),
        });
        previousResult = result;
      } else globalThis.postMessage({ id: data.id, result });
    } catch (error) {
      globalThis.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
