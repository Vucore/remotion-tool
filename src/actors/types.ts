export const ACTIONS = {
  enter: "Đi vào",
  exit: "Đi ra",
  sway: "Đung đưa",
  shake: "Rung/lắc",
  jump: "Nhảy",
  move: "Di chuyển",
  spin: "Xoay",
  float: "Lơ lửng",
  nod: "Gật đầu",
  wave: "Vẫy tay",
  point: "Chỉ tay",
  walk: "Đi bộ",
  run: "Chạy",
  surprised: "Giật mình",
  happy: "Vui mừng",
} as const;
export type ActionKind = keyof typeof ACTIONS;
export type ClipName = "idle" | "talk" | ActionKind;
export type ActorImage = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  file?: string;
};
export const RIG_PARTS = [
  "body",
  "head",
  "armLeft",
  "armRight",
  "legLeft",
  "legRight",
  "eyesOpen",
  "eyesClosed",
  "mouthClosed",
  "mouthOpen",
] as const;
export type RigPart = (typeof RIG_PARTS)[number];
export type RigLayer = {
  image: ActorImage;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  z: number;
};
export type SpriteClip = {
  images: ActorImage[];
  columns: number;
  rows: number;
  count: number;
  fps: number;
  loop: boolean;
};
type ActorBase = { id: string; name: string; width: number; height: number };
export type ActorDefinition = ActorBase &
  (
    | { kind: "cutout"; image: ActorImage }
    | {
        kind: "rig";
        layout: "canvas" | "humanoid";
        parts: Partial<Record<RigPart, RigLayer>>;
      }
    | { kind: "sprite"; clips: Partial<Record<ClipName, SpriteClip>> }
  );
export type ActorAction = {
  kind: ActionKind;
  start: number;
  end: number;
  intensity: number;
};
export type ActorInstance = {
  id: string;
  actorId: string;
  x: number;
  y: number;
  height: number;
  flip: boolean;
  z: number;
  speaking: boolean;
  intensity: number;
  actions: ActorAction[];
  entrance: "slide" | "fade" | "pop" | "none";
  exitStyle: "slide" | "fade" | "pop" | "none";
  from: number;
  to: number | null;
  manual: boolean;
  opacity: number;
  shadow: number;
  glow: number;
};
export type ActorSettings = {
  enabled: boolean;
  directories: string[];
  selected: string[];
  cast: "rotate" | "all" | "first";
  behavior: "gentle" | "story" | "energetic";
  layout: "auto" | "left" | "right" | "center";
  size: "small" | "medium" | "large";
  speaker: "narrator" | "first" | "rotate";
  entrance: "slide" | "fade" | "pop" | "none";
  exit: boolean;
  cues: { scene: number; cue: number; actor: string; action: ActionKind }[];
};
export type ActorImportOptions = {
  kind: "auto" | "cutout" | "rig" | "sprite";
  name?: string;
  columns: number;
  rows: number;
  fps: number;
  frameCount: number;
  rigLayout: "auto" | "canvas" | "humanoid";
};
export const defaultActorImport = (): ActorImportOptions => ({
  kind: "auto",
  columns: 4,
  rows: 1,
  fps: 12,
  frameCount: 0,
  rigLayout: "auto",
});
export const actorHash = (input: string) => {
  let value = 2166136261;
  for (const c of input.normalize("NFC"))
    value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return (value >>> 0).toString(16).padStart(8, "0");
};
export function actorImages(actor: ActorDefinition): ActorImage[] {
  const images =
    actor.kind === "cutout"
      ? [actor.image]
      : actor.kind === "rig"
        ? Object.values(actor.parts).map((p) => p!.image)
        : Object.values(actor.clips).flatMap((c) => c!.images);
  return [...new Map(images.map((i) => [i.src, i])).values()];
}
export function actorCapabilities(actor: ActorDefinition): ActionKind[] {
  const common: ActionKind[] = [
    "enter",
    "exit",
    "sway",
    "shake",
    "jump",
    "move",
    "spin",
    "float",
    "surprised",
    "happy",
  ];
  if (actor.kind === "rig") {
    common.push("nod");
    if (actor.parts.armLeft || actor.parts.armRight)
      common.push("wave", "point");
    if (actor.parts.legLeft && actor.parts.legRight) common.push("walk", "run");
  }
  if (actor.kind === "sprite")
    for (const key of Object.keys(actor.clips))
      if (key in ACTIONS && !common.includes(key as ActionKind))
        common.push(key as ActionKind);
  return common;
}
export function mapActorImages(
  actor: ActorDefinition,
  transform: (image: ActorImage) => ActorImage,
): ActorDefinition {
  if (actor.kind === "cutout")
    return { ...actor, image: transform(actor.image) };
  if (actor.kind === "rig")
    return {
      ...actor,
      parts: Object.fromEntries(
        Object.entries(actor.parts).map(([key, layer]) => [
          key,
          { ...layer!, image: transform(layer!.image) },
        ]),
      ) as Partial<Record<RigPart, RigLayer>>,
    };
  return {
    ...actor,
    clips: Object.fromEntries(
      Object.entries(actor.clips).map(([key, clip]) => [
        key,
        { ...clip!, images: clip!.images.map(transform) },
      ]),
    ) as Partial<Record<ClipName, SpriteClip>>,
  };
}
