import type { Project, Scene } from "../model";
import {
  actorCapabilities,
  actorHash,
  type ActionKind,
  type ActorAction,
  type ActorDefinition,
  type ActorInstance,
  type ActorSettings,
} from "./types";
import { fitObject } from "./timing";

export function planActors(
  project: Project,
  settings: ActorSettings,
  seed: number,
  keepScenes: Set<string> = new Set(),
): string[] {
  const warnings: string[] = [],
    library = project.actors ?? [];
  if (!settings.enabled) {
    for (const scene of project.scenes) {
      if (keepScenes.has(scene.id) && scene.actorsEdited)
        scene.actors = (scene.actors ?? []).map((i) =>
          fitObject(i, scene.duration),
        );
      else {
        delete scene.actors;
        delete scene.actorsEdited;
      }
    }
    return warnings;
  }
  const selected = settings.selected.length
    ? settings.selected.map((id) => {
        const actor = library.find((a) => a.id === id);
        if (!actor)
          throw Error(
            "Một nhân vật đã chọn chưa có trong bộ tài nguyên. Chọn lại nhân vật hoặc nạp đúng thư mục.",
          );
        return actor;
      })
    : library;
  if (!selected.length)
    throw Error(
      "Thêm PNG tách nền, bộ phận hoặc sprite trước khi dựng có nhân vật.",
    );
  if (settings.cast === "all" && selected.length > 4)
    throw Error(
      "Tối đa 4 nhân vật cùng xuất hiện. Chọn ít hơn hoặc dùng luân phiên.",
    );
  for (const cue of settings.cues)
    if (cue.scene > project.scenes.length)
      throw Error(`Kịch bản động tác: chưa có cảnh ${cue.scene}.`);
  project.scenes.forEach((scene, sceneIndex) => {
    if (keepScenes.has(scene.id) && scene.actorsEdited) {
      scene.actors = (scene.actors ?? []).map((i) =>
        fitObject(i, scene.duration),
      );
      return;
    }
    delete scene.actorsEdited;
    const cast =
      settings.cast === "all"
        ? selected
        : [
            settings.cast === "first"
              ? selected[0]
              : selected[sceneIndex % selected.length],
          ];
    const starts = cueStarts(scene);
    const speaker =
      settings.speaker === "narrator"
        ? -1
        : settings.speaker === "first"
          ? 0
          : sceneIndex % cast.length;
    scene.actors = cast.map((actor, i): ActorInstance => {
      const x =
        cast.length > 1
          ? 16 + (i * 68) / (cast.length - 1)
          : settings.layout === "left"
            ? 27
            : settings.layout === "right"
              ? 73
              : settings.layout === "center"
                ? 50
                : sceneIndex % 2
                  ? 70
                  : 30;
      const baseHeight =
        { small: 32, medium: 48, large: 64 }[settings.size] *
        (cast.length > 2 ? 0.8 : 1);
      const availableWidth = Math.min(
        cast.length > 1 ? 0.8 / cast.length : 0.75,
        (2 * Math.min(x, 100 - x)) / 100,
      );
      const fitHeight =
        ((((availableWidth * project.width) / project.height) * actor.height) /
          actor.width) *
        100;
      const intensity = { gentle: 0.35, story: 0.65, energetic: 1 }[
        settings.behavior
      ];
      const actions: ActorAction[] = [],
        capabilities = actorCapabilities(actor);
      const edgeDuration = Math.min(0.65, scene.duration / 4);
      if (settings.entrance !== "none")
        actions.push({
          kind: "enter",
          start: 0,
          end: edgeDuration,
          intensity: 1,
        });
      const exitStart = settings.exit
        ? scene.duration - edgeDuration
        : scene.duration;
      const manual = settings.cues.filter(
        (c) => c.scene === sceneIndex + 1 && c.actor === actor.id,
      );
      for (const c of manual) {
        const start = starts[c.cue - 1];
        if (start === undefined)
          throw Error(
            `Cảnh ${sceneIndex + 1}: chưa có câu ${c.cue} cho động tác.`,
          );
        if (!capabilities.includes(c.action))
          throw Error(
            `${actor.name}: tài nguyên không hỗ trợ động tác ${c.action}.`,
          );
        // An explicit cue takes priority over entrance and the automatic gestures.
        if (start < edgeDuration) {
          const entry = actions.findIndex((a) => a.kind === "enter");
          if (entry >= 0) actions.splice(entry, 1);
        }
        const end = Math.min(
          scene.duration,
          start + Math.min(1.3, (scene.duration - start) * 0.8),
        );
        if (end <= start + 0.03)
          throw Error(
            `Cảnh ${sceneIndex + 1}: cue động tác quá sát cuối cảnh.`,
          );
        actions.push({ kind: c.action, start, end, intensity });
      }
      const choices = preferredActions(actor, settings).filter((kind) =>
        capabilities.includes(kind),
      );
      let lastEnd = edgeDuration;
      for (const [j, cueStart] of starts.entries()) {
        if (settings.behavior === "gentle" && j % 3 !== 1) continue;
        if (settings.behavior === "story" && j % 2 !== 0) continue;
        const start = Math.max(cueStart, edgeDuration + 0.15, lastEnd + 0.25),
          next = starts[j + 1] ?? exitStart;
        const end = Math.min(
          start + (settings.behavior === "energetic" ? 0.9 : 1.3),
          next - 0.1,
          exitStart - 0.1,
        );
        if (
          end - start < 0.35 ||
          actions.some((a) => a.start < end && a.end > start) ||
          !choices.length
        )
          continue;
        const kind =
          choices[
            Number.parseInt(
              actorHash(`${seed}:${scene.id}:${actor.id}:${j}`),
              16,
            ) % choices.length
          ];
        actions.push({ kind, start, end, intensity });
        lastEnd = end;
        if (actions.length >= 60) break;
      }
      if (settings.exit && !actions.some((a) => a.end > exitStart))
        actions.push({
          kind: "exit",
          start: exitStart,
          end: scene.duration,
          intensity: 1,
        });
      actions.sort((a, b) => a.start - b.start);
      if (actions.some((a, j) => j > 0 && a.start < actions[j - 1].end))
        throw Error(
          `Cảnh ${sceneIndex + 1}: động tác của ${actor.name} chồng nhau. Chọn các câu cách xa hơn.`,
        );
      return {
        id: `${scene.id}-${actor.id}`,
        actorId: actor.id,
        x,
        y: 80,
        height: Math.max(0.1, Math.min(baseHeight, fitHeight)),
        flip: x > 50,
        z: i,
        speaking: Boolean(scene.voice) && i === speaker,
        intensity,
        entrance: settings.entrance,
        exitStyle: settings.entrance,
        from: 0,
        to: null,
        manual: false,
        opacity: 1,
        shadow: 0,
        glow: 0,
        actions,
      };
    });
    for (const c of settings.cues.filter((c) => c.scene === sceneIndex + 1))
      if (!cast.some((a) => a.id === c.actor))
        throw Error(
          `Cảnh ${sceneIndex + 1}: nhân vật trong kịch bản động tác không nằm trong dàn nhân vật cảnh. Chọn cùng xuất hiện hoặc đổi phân vai.`,
        );
  });
  if (settings.speaker !== "narrator")
    for (const actor of selected) {
      if (actor.kind === "cutout")
        warnings.push(
          `${actor.name}: PNG nguyên khối có nhún theo voice, không có miệng tách rời.`,
        );
      if (actor.kind === "rig" && !actor.parts.mouthOpen)
        warnings.push(
          `${actor.name}: chưa có cặp mouth_open/mouth_closed; chỉ cử động đầu/thân.`,
        );
      if (actor.kind === "sprite" && !actor.clips.talk)
        warnings.push(
          `${actor.name}: chưa có clip talk; dùng các động tác sẵn có.`,
        );
    }
  return [...new Set(warnings)];
}
export function cueStarts(scene: Scene): number[] {
  const captions = scene.texts.flatMap(
    (t) => t.captions?.map((c) => c.startMs / 1000) ?? [],
  );
  return captions.length
    ? [...new Set(captions)].sort((a, b) => a - b)
    : [scene.duration * 0.2, scene.duration * 0.5, scene.duration * 0.75];
}
function preferredActions(
  actor: ActorDefinition,
  settings: ActorSettings,
): ActionKind[] {
  const choices: ActionKind[] =
    settings.behavior === "gentle"
      ? ["sway", "nod", "float"]
      : settings.behavior === "story"
        ? ["nod", "wave", "point", "sway", "surprised"]
        : ["jump", "happy", "shake", "wave", "nod", "walk", "run"];
  if (actor.kind === "sprite")
    return [
      ...new Set([
        ...(Object.keys(actor.clips).filter(
          (k) => !["idle", "talk", "enter", "exit"].includes(k),
        ) as ActionKind[]),
        ...choices,
      ]),
    ];
  return choices;
}
