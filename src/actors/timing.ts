import type { ActorDefinition, ActorInstance, ActionKind } from "./types";
export type ObjectMotion =
  | "none"
  | "enter-slide"
  | "enter-fade"
  | "enter-pop"
  | "exit-slide"
  | "exit-fade"
  | "exit-pop"
  | ActionKind;
export const OBJECT_MOTIONS = {
  none: "Đứng yên",
  "enter-slide": "Trượt vào",
  "enter-fade": "Hiện dần",
  "enter-pop": "Bật lên",
  "exit-slide": "Trượt ra",
  "exit-fade": "Mờ đi",
  "exit-pop": "Thu nhỏ và biến mất",
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function fitObject(
  instance: ActorInstance,
  duration: number,
): ActorInstance {
  const from = clamp(instance.from, 0, Math.max(0, duration - 0.05));
  const to =
      instance.to === null ? null : clamp(instance.to, from + 0.05, duration),
    end = to ?? duration;
  const entry = instance.actions.find((a) => a.kind === "enter"),
    exit = instance.actions.find((a) => a.kind === "exit");
  const entryDuration =
    entry && instance.entrance !== "none"
      ? Math.min(entry.end - entry.start, (end - from) / 3)
      : 0;
  const exitDuration =
    exit && instance.exitStyle !== "none"
      ? Math.min(exit.end - exit.start, (end - from) / 3)
      : 0;
  const actions = instance.actions
    .filter((a) => a.kind !== "enter" && a.kind !== "exit")
    .map((a) => ({
      ...a,
      start: Math.max(from + entryDuration, a.start),
      end: Math.min(end - exitDuration, a.end),
    }))
    .filter((a) => a.end - a.start > 0.02)
    .sort((a, b) => a.start - b.start);
  const withoutOverlaps = actions.reduce<typeof actions>((kept, action) => {
    if (!kept.length || action.start >= kept[kept.length - 1].end)
      kept.push(action);
    return kept;
  }, []);
  if (entryDuration)
    withoutOverlaps.unshift({
      kind: "enter",
      start: from,
      end: from + entryDuration,
      intensity: 1,
    });
  if (exitDuration)
    withoutOverlaps.push({
      kind: "exit",
      start: end - exitDuration,
      end,
      intensity: 1,
    });
  return { ...instance, from, to, actions: withoutOverlaps };
}
export function newObject(
  actor: ActorDefinition,
  id: string,
  width: number,
  height: number,
): ActorInstance {
  return {
    id,
    actorId: actor.id,
    x: 50,
    y: 80,
    height: Math.max(
      0.1,
      Math.min(
        48,
        ((((width * 0.75) / height) * actor.height) / actor.width) * 100,
      ),
    ),
    flip: false,
    z: 0,
    speaking: false,
    intensity: 0,
    entrance: "none",
    exitStyle: "none",
    from: 0,
    to: null,
    manual: true,
    opacity: 1,
    shadow: 0,
    glow: 0,
    actions: [],
  };
}
export function setObjectMotion(
  instance: ActorInstance,
  motion: ObjectMotion,
  duration: number,
): ActorInstance {
  const next = structuredClone(instance);
  next.manual = true;
  const end = next.to ?? duration,
    span = end - next.from;
  if (motion.startsWith("enter-") || motion.startsWith("exit-")) {
    const [kind, style] = motion.split("-") as [
      "enter" | "exit",
      "slide" | "fade" | "pop",
    ];
    if (kind === "enter") next.entrance = style;
    else next.exitStyle = style;
    next.actions = next.actions.filter((a) => a.kind !== kind);
    next.actions.push({
      kind,
      start: kind === "enter" ? next.from : end - Math.min(0.6, span / 3),
      end: kind === "enter" ? next.from + Math.min(0.6, span / 3) : end,
      intensity: 1,
    });
  } else {
    next.actions = next.actions.filter(
      (a) => a.kind === "enter" || a.kind === "exit",
    );
    if (motion !== "none") {
      const start = next.from + span * 0.3;
      next.actions.push({
        kind: motion as ActionKind,
        start,
        end: Math.min(end, start + 1.2),
        intensity: 0.8,
      });
    } else {
      next.actions = [];
      next.entrance = "none";
      next.exitStyle = "none";
      next.intensity = 0;
    }
  }
  return fitObject(next, duration);
}
