import {
  MOTIONS,
  TRANSITIONS,
  EASINGS,
  TEXT_ANIMATIONS,
  TEXT_LOOPS,
  OVERLAYS,
  MASKS,
  FONT_FAMILIES,
  type EasingName,
} from "./catalog";
import {
  EFFECT_MAP,
  effectFields,
  type EffectSpec,
  type FieldSchema,
  type Value,
} from "./effects/catalog";
import { validateNativeEffect } from "./effects/runtime";
import { parseAutoConfig, type AutoConfig } from "./auto/config";
import type { Caption } from "@remotion/captions";
import { parseCaptions } from "./auto/narration";
import { parseTtsSettings, type TtsSettings } from "./auto/tts";
import { NARRATION_LANGUAGES, type NarrationLanguage } from "./auto/languages";
import type { ActorDefinition, ActorInstance } from "./actors/types";
import { parseActorLibrary, parseActorInstances } from "./actors/schema";
import {
  parseImageProcessing,
  type ImageProcessingSettings,
} from "./auto/image-processing";
export type Motion = keyof typeof MOTIONS;
export type Transition = keyof typeof TRANSITIONS;
export type Filter = "none" | "warm" | "cool" | "mono" | "vintage";
export type Asset = {
  original?: { src: string; width: number; height: number };
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};
export type VoiceAsset = {
  id: string;
  name: string;
  src: string;
  duration: number;
  envelope?: { stepMs: number; values: number[] };
};
export type Voiceover = {
  assets: VoiceAsset[];
  script: string;
  scriptName: string;
  ttsKey?: string;
  tts?: TtsSettings;
  uploadLanguage?: NarrationLanguage;
};
export type TextLayer = {
  captions?: Caption[];
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  background: string;
  bold: boolean;
  align: "left" | "center" | "right";
  name: string;
  visible: boolean;
  fontFamily: string;
  weight: number;
  italic: boolean;
  decoration: "none" | "underline" | "line-through" | "overline";
  letterSpacing: number;
  lineHeight: number;
  casing: "none" | "uppercase" | "lowercase" | "capitalize";
  writing: "horizontal-tb" | "vertical-rl" | "vertical-lr";
  width: number;
  padding: number;
  radius: number;
  opacity: number;
  rotate: number;
  scale: number;
  skew: number;
  fill: "solid" | "gradient" | "outline";
  gradientColor: string;
  gradientAngle: number;
  stroke: number;
  strokeColor: string;
  shadow: number;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  glow: number;
  depth: number;
  start: number;
  end: number | null;
  animationIn: keyof typeof TEXT_ANIMATIONS;
  animationOut: keyof typeof TEXT_ANIMATIONS;
  inDuration: number;
  outDuration: number;
  stagger: number;
  easing: EasingName;
  loop: keyof typeof TEXT_LOOPS;
  loopSpeed: number;
  shape: "normal" | "arc-up" | "arc-down";
  arc: number;
  counter: boolean;
  countFrom: number;
  countTo: number;
  prefix: string;
  suffix: string;
  decimals: number;
  offset: number;
  span: number | null;
};
export type FontAsset = { id: string; name: string; src: string };
export type ImageKeyframe = {
  time: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};
export type OverlaySpec = {
  id: string;
  kind: keyof typeof OVERLAYS;
  enabled: boolean;
  amount: number;
  color: string;
  speed: number;
  size: number;
  seed: number;
  start: number;
  end: number | null;
  offset: number;
};
export type Scene = {
  actors?: ActorInstance[];
  actorsEdited?: boolean;
  voice?: { assetId: string; duration: number };
  id: string;
  assetId: string;
  duration: number;
  fit: "cover" | "contain";
  focusX: number;
  focusY: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  flip: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  filter: Filter;
  motion: Motion;
  transition: Transition;
  transitionDuration: number;
  texts: TextLayer[];
  effects: EffectSpec[];
  overlays: OverlaySpec[];
  opacity: number;
  mask: keyof typeof MASKS;
  motionAmount: number;
  motionSpeed: number;
  motionEasing: EasingName;
  transitionDirection: "left" | "right" | "up" | "down";
  transitionEasing: EasingName;
  keyframes: ImageKeyframe[];
  motionOffset: number;
  motionStart: number;
  motionDuration: number | null;
};
export type Project = {
  imageProcessing?: ImageProcessingSettings;
  actors?: ActorDefinition[];
  voiceover?: Voiceover;
  version: 1;
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
  assets: Asset[];
  scenes: Scene[];
  fonts: FontAsset[];
  automation?: { config: AutoConfig; locks: string[] };
};
export const id = () => crypto.randomUUID();
export const emptyProject = (): Project => ({
  version: 1,
  name: "Video chưa đặt tên",
  width: 1080,
  height: 1920,
  fps: 30,
  background: "#f4f0e8",
  assets: [],
  scenes: [],
  fonts: [],
});
export const makeScene = (assetId: string): Scene => ({
  id: id(),
  assetId,
  duration: 4,
  fit: "cover",
  focusX: 50,
  focusY: 50,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  flip: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  filter: "none",
  motion: "none",
  transition: "fade",
  transitionDuration: 0.5,
  texts: [],
  effects: [],
  overlays: [],
  opacity: 1,
  mask: "none",
  motionAmount: 15,
  motionSpeed: 1,
  motionEasing: "linear",
  transitionDirection: "left",
  transitionEasing: "linear",
  keyframes: [],
  motionOffset: 0,
  motionStart: 0,
  motionDuration: null,
});
export const makeText = (): TextLayer => ({
  id: id(),
  text: "Viết câu chuyện của bạn",
  x: 50,
  y: 75,
  size: 64,
  color: "#ffffff",
  background: "#153d35",
  bold: true,
  align: "center",
  name: "Lớp chữ",
  visible: true,
  fontFamily: "Arial",
  weight: 700,
  italic: false,
  decoration: "none",
  letterSpacing: 0,
  lineHeight: 1.25,
  casing: "none",
  writing: "horizontal-tb",
  width: 90,
  padding: 14,
  radius: 8,
  opacity: 1,
  rotate: 0,
  scale: 1,
  skew: 0,
  fill: "solid",
  gradientColor: "#ffd68a",
  gradientAngle: 90,
  stroke: 0,
  strokeColor: "#152d25",
  shadow: 0,
  shadowColor: "#000000",
  shadowX: 0,
  shadowY: 4,
  glow: 0,
  depth: 0,
  start: 0,
  end: null,
  animationIn: "none",
  animationOut: "none",
  inDuration: 0.6,
  outDuration: 0.5,
  stagger: 0.05,
  easing: "ease-out",
  loop: "none",
  loopSpeed: 1,
  shape: "normal",
  arc: 30,
  counter: false,
  countFrom: 0,
  countTo: 100,
  prefix: "",
  suffix: "",
  decimals: 0,
  offset: 0,
  span: null,
});
export const timeline = (p: Project) => {
  let cursor = 0;
  const narrated = p.scenes.some((s) => s.voice);
  return p.scenes
    .map((scene, index) => {
      const duration = Math.max(1, Math.round(scene.duration * p.fps));
      const previous = p.scenes[index - 1];
      const overlap =
        previous && previous.transition !== "none"
          ? Math.min(
              Math.round(previous.transitionDuration * p.fps),
              Math.floor((previous.duration * p.fps) / 2),
              Math.floor(duration / 2),
            )
          : 0;
      // Narration owns the clock. Only the outgoing visual extends across the boundary.
      const from = narrated ? cursor : cursor - overlap;
      cursor = from + duration;
      return {
        scene,
        from,
        duration,
        overlap,
        end: cursor,
        incoming: previous?.transition ?? "none",
        direction: previous?.transitionDirection ?? "left",
        easing: previous?.transitionEasing ?? "linear",
      };
    })
    .map((item, index, items) => ({
      ...item,
      visualDuration:
        item.duration + (narrated ? (items[index + 1]?.overlap ?? 0) : 0),
    }));
};
export const totalFrames = (p: Project) =>
  Math.max(1, timeline(p).at(-1)?.end ?? 1);
export const sceneAt = (p: Project, frame: number) =>
  [...timeline(p)].reverse().find((s) => frame >= s.from && frame < s.end)
    ?.scene.id;
export function moveScene(p: Project, source: string, target: string): Project {
  const scenes = [...p.scenes];
  const from = scenes.findIndex((s) => s.id === source);
  const to = scenes.findIndex((s) => s.id === target);
  if (from < 0 || to < 0) return p;
  scenes.splice(to, 0, scenes.splice(from, 1)[0]);
  return { ...p, scenes };
}
export function splitScene(
  p: Project,
  sceneId: string,
  frame: number,
): Project | null {
  const item = timeline(p).find((t) => t.scene.id === sceneId);
  if (!item) return null;
  if (item.scene.voice || item.scene.actors?.length) return null;
  const cut = frame - item.from;
  const next = timeline(p)[p.scenes.findIndex((s) => s.id === sceneId) + 1];
  if (
    cut < Math.max(item.overlap, p.fps / 2) ||
    cut > item.duration - Math.max(next?.overlap ?? 0, p.fps / 2)
  )
    return null;
  const first = {
    ...item.scene,
    duration: cut / p.fps,
    transition: "none" as const,
    motionDuration:
      item.scene.motionDuration ??
      Math.max(1 / p.fps, item.scene.duration - item.scene.motionStart),
    texts: sliceTimed(item.scene.texts, 0, cut / p.fps, item.scene.duration),
    effects: sliceTimed(
      item.scene.effects,
      0,
      cut / p.fps,
      item.scene.duration,
    ),
    overlays: sliceTimed(
      item.scene.overlays,
      0,
      cut / p.fps,
      item.scene.duration,
    ),
  };
  const second = {
    ...item.scene,
    id: id(),
    duration: (item.duration - cut) / p.fps,
    motionOffset: item.scene.motionOffset + cut / p.fps,
    motionDuration:
      item.scene.motionDuration ??
      Math.max(1 / p.fps, item.scene.duration - item.scene.motionStart),
    texts: sliceTimed(
      item.scene.texts,
      cut / p.fps,
      item.scene.duration,
      item.scene.duration,
    ),
    effects: sliceTimed(
      item.scene.effects,
      cut / p.fps,
      item.scene.duration,
      item.scene.duration,
    ),
    overlays: sliceTimed(
      item.scene.overlays,
      cut / p.fps,
      item.scene.duration,
      item.scene.duration,
    ),
  };
  return {
    ...p,
    scenes: p.scenes.flatMap((s) => (s.id === sceneId ? [first, second] : [s])),
  };
}
function sliceTimed<
  T extends {
    id: string;
    start: number;
    end: number | null;
    offset: number;
    span?: number | null;
  },
>(layers: T[], from: number, to: number, duration: number): T[] {
  return layers
    .filter(
      (layer) =>
        layer.start < to &&
        (layer.end ?? duration) > from &&
        (layer.end ?? duration) > layer.start,
    )
    .map((layer) => {
      const end = Math.min(layer.end ?? duration, duration),
        start = Math.max(layer.start, from);
      return {
        ...layer,
        id: from === 0 ? layer.id : id(),
        start: start - from,
        end: end >= to ? null : end - from,
        offset: layer.offset + Math.max(0, from - layer.start),
        ...("span" in layer ? { span: layer.span ?? end - layer.start } : {}),
      };
    });
}
const number = (v: unknown, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error("Giá trị số trong dự án không hợp lệ.");
  return v;
};
const str = (v: unknown, max = 500) => {
  if (typeof v !== "string" || v.length > max)
    throw new Error("Nội dung dự án không hợp lệ.");
  return v;
};
const color = (v: unknown) => {
  const s = str(v, 9);
  if (!/^#[0-9a-f]{6}$/i.test(s)) throw new Error("Màu không hợp lệ.");
  return s;
};
const pick = <T extends string>(v: unknown, options: readonly T[]): T => {
  if (!options.includes(v as T)) throw new Error("Tuỳ chọn không được hỗ trợ.");
  return v as T;
};
export function parseProject(value: unknown): Project {
  if (!value || typeof value !== "object")
    throw new Error("Không đọc được dự án.");
  const p = value as Project;
  const actorLibrary = parseActorLibrary(p.actors);
  const fonts = (p.fonts ?? []).map((f) => {
    const src = str(f.src, 200);
    if (!/^\/fonts\/[a-f0-9-]{36}\.(woff2?|ttf|otf)$/.test(src))
      throw new Error("Đường dẫn font không hợp lệ.");
    if (f.id !== `khung-${src.split("/").at(-1)!.split(".")[0]}`)
      throw new Error("ID font không khớp tài nguyên. Hãy nhập lại font.");
    return { id: str(f.id, 100), name: str(f.name, 200), src };
  });
  if (
    fonts.length > 30 ||
    new Set(fonts.map((f) => f.id)).size !== fonts.length
  )
    throw new Error("Thư viện font không hợp lệ hoặc vượt quá 30 font.");
  if (
    p.version !== 1 ||
    !Array.isArray(p.assets) ||
    !Array.isArray(p.scenes) ||
    p.assets.length > 300 ||
    p.scenes.length > 300
  )
    throw new Error("Dự án không đúng định dạng hoặc vượt quá 300 cảnh.");
  const assets = p.assets.map((a) => {
    const src = str(a.src, 200);
    if (
      !/^\/(media\/[a-zA-Z0-9_-]+\.(png|jpg|webp)|samples\/(coast|forest|sunset)\.svg)$/.test(
        src,
      )
    )
      throw new Error(
        "Đường dẫn ảnh không được hỗ trợ. Hãy nhập ảnh từ công cụ.",
      );
    return {
      id: str(a.id),
      name: str(a.name),
      src,
      ...(a.original
        ? {
            original: {
              src: (() => {
                const value = str(a.original.src, 200);
                if (!/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(value))
                  throw Error("Đường dẫn ảnh gốc không hợp lệ.");
                return value;
              })(),
              width: number(a.original.width, 1, 30000),
              height: number(a.original.height, 1, 30000),
            },
          }
        : {}),
      width: number(a.width, 1, 30000),
      height: number(a.height, 1, 30000),
    };
  });
  if (new Set(assets.map((a) => a.id)).size !== assets.length)
    throw new Error("ID ảnh bị trùng.");
  let voiceover: Voiceover | undefined;
  if (p.voiceover !== undefined) {
    if (
      !p.voiceover ||
      !Array.isArray(p.voiceover.assets) ||
      p.voiceover.assets.length > 300
    )
      throw Error("Đầu vào voice cần tối đa 300 WAV/MP3.");
    voiceover = {
      script: str(p.voiceover.script, 1_000_000),
      scriptName: str(p.voiceover.scriptName, 500),
      ...(p.voiceover.uploadLanguage !== undefined
        ? {
            uploadLanguage: pick(
              p.voiceover.uploadLanguage,
              Object.keys(NARRATION_LANGUAGES) as NarrationLanguage[],
            ),
          }
        : {}),
      ...(p.voiceover.tts !== undefined
        ? { tts: parseTtsSettings(p.voiceover.tts) }
        : {}),
      ...(p.voiceover.ttsKey !== undefined
        ? { ttsKey: str(p.voiceover.ttsKey, 100) }
        : {}),
      assets: p.voiceover.assets.map((v) => {
        const src = str(v.src, 200);
        if (!/^\/media\/[a-zA-Z0-9_-]+\.(wav|mp3)$/.test(src))
          throw Error("Đường dẫn voice không hợp lệ. Nhập lại từ công cụ.");
        return {
          id: str(v.id),
          name: str(v.name),
          src,
          duration: number(v.duration, 0.5, 300),
          ...(v.envelope
            ? { envelope: parseVoiceEnvelope(v.envelope, v.duration) }
            : {}),
        };
      }),
    };
    if (
      voiceover.ttsKey &&
      (!/^chatterbox-v1-[a-f0-9]{16}$/.test(voiceover.ttsKey) || !voiceover.tts)
    )
      throw Error("Thông tin voice TTS không hợp lệ.");
    if (
      new Set(voiceover.assets.map((v) => v.id)).size !==
      voiceover.assets.length
    )
      throw Error("ID voice bị trùng.");
  }
  const scenes = p.scenes.map((original) => {
    const s = { ...makeScene(original.assetId), ...original };
    if (
      !Array.isArray(s.overlays) ||
      s.overlays.length > 8 ||
      !Array.isArray(s.keyframes) ||
      s.keyframes.length > 100
    )
      throw new Error("Tối đa 8 lớp phủ và 100 keyframe cho mỗi cảnh.");
    if (
      !assets.some((a) => a.id === s.assetId) ||
      !Array.isArray(s.texts) ||
      s.texts.length > 30
    )
      throw new Error("Cảnh thiếu ảnh hoặc có quá nhiều lớp chữ.");
    return {
      ...(s.actors !== undefined
        ? { actors: parseActorInstances(s.actors, actorLibrary, s.duration) }
        : {}),
      ...(s.actorsEdited !== undefined
        ? { actorsEdited: Boolean(s.actorsEdited) }
        : {}),
      ...(s.voice
        ? {
            voice: {
              assetId: str(s.voice.assetId),
              duration: number(s.voice.duration, 0.5, 300),
            },
          }
        : {}),
      id: str(s.id),
      assetId: s.assetId,
      duration: number(s.duration, 0.5, 300),
      fit: pick(s.fit, ["cover", "contain"]),
      focusX: number(s.focusX, 0, 100),
      focusY: number(s.focusY, 0, 100),
      x: number(s.x, -100, 100),
      y: number(s.y, -100, 100),
      scale: number(s.scale, 0.1, 5),
      rotate: number(s.rotate, -180, 180),
      flip: Boolean(s.flip),
      brightness: number(s.brightness, 0, 200),
      contrast: number(s.contrast, 0, 200),
      saturation: number(s.saturation, 0, 200),
      filter: pick(s.filter, ["none", "warm", "cool", "mono", "vintage"]),
      motion: pick(s.motion, Object.keys(MOTIONS) as Motion[]),
      transition: pick(s.transition, Object.keys(TRANSITIONS) as Transition[]),
      transitionDuration: number(s.transitionDuration, 0.1, 2),
      texts: s.texts.map((originalText) => {
        const t = {
          ...makeText(),
          ...originalText,
          weight: originalText.weight ?? (originalText.bold ? 700 : 400),
        };
        if (
          ![...FONT_FAMILIES, ...fonts.map((f) => f.id)].includes(t.fontFamily)
        )
          throw new Error("Font của lớp chữ không tồn tại.");
        return {
          ...(t.captions !== undefined
            ? { captions: parseCaptions(t.captions, s.duration) }
            : {}),
          id: str(t.id),
          text: str(t.text, 2000),
          x: number(t.x, 0, 100),
          y: number(t.y, 0, 100),
          size: number(t.size, 8, 400),
          color: color(t.color),
          background:
            t.background === "transparent"
              ? "transparent"
              : color(t.background),
          bold: Boolean(t.bold),
          align: pick(t.align, ["left", "center", "right"]),
          name: str(t.name, 100),
          visible: Boolean(t.visible),
          fontFamily: t.fontFamily,
          weight: number(t.weight, 100, 900),
          italic: Boolean(t.italic),
          decoration: pick(t.decoration, [
            "none",
            "underline",
            "line-through",
            "overline",
          ]),
          letterSpacing: number(t.letterSpacing, -20, 80),
          lineHeight: number(t.lineHeight, 0.5, 3),
          casing: pick(t.casing, [
            "none",
            "uppercase",
            "lowercase",
            "capitalize",
          ]),
          writing: pick(t.writing, [
            "horizontal-tb",
            "vertical-rl",
            "vertical-lr",
          ]),
          width: number(t.width, 5, 100),
          padding: number(t.padding, 0, 100),
          radius: number(t.radius, 0, 100),
          opacity: number(t.opacity, 0, 1),
          rotate: number(t.rotate, -360, 360),
          scale: number(t.scale, 0.1, 5),
          skew: number(t.skew, -60, 60),
          fill: pick(t.fill, ["solid", "gradient", "outline"]),
          gradientColor: color(t.gradientColor),
          gradientAngle: number(t.gradientAngle, 0, 360),
          stroke: number(t.stroke, 0, 20),
          strokeColor: color(t.strokeColor),
          shadow: number(t.shadow, 0, 100),
          shadowColor: color(t.shadowColor),
          shadowX: number(t.shadowX, -100, 100),
          shadowY: number(t.shadowY, -100, 100),
          glow: number(t.glow, 0, 100),
          depth: number(t.depth, 0, 30),
          start: number(t.start, 0, 300),
          end: t.end === null ? null : number(t.end, t.start, 300),
          animationIn: pick(
            t.animationIn,
            Object.keys(TEXT_ANIMATIONS) as TextLayer["animationIn"][],
          ),
          animationOut: pick(
            t.animationOut,
            Object.keys(TEXT_ANIMATIONS) as TextLayer["animationOut"][],
          ),
          inDuration: number(t.inDuration, 0.05, 10),
          outDuration: number(t.outDuration, 0.05, 10),
          stagger: number(t.stagger, 0, 0.5),
          easing: pick(t.easing, Object.keys(EASINGS) as EasingName[]),
          loop: pick(t.loop, Object.keys(TEXT_LOOPS) as TextLayer["loop"][]),
          loopSpeed: number(t.loopSpeed, 0.1, 5),
          shape: pick(t.shape, ["normal", "arc-up", "arc-down"]),
          arc: number(t.arc, 5, 100),
          counter: Boolean(t.counter),
          countFrom: number(t.countFrom, -1e9, 1e9),
          countTo: number(t.countTo, -1e9, 1e9),
          prefix: str(t.prefix, 100),
          suffix: str(t.suffix, 100),
          decimals: number(t.decimals, 0, 5),
          offset: number(t.offset, 0, 3600),
          span: t.span === null ? null : number(t.span, 0.001, 3600),
        };
      }),
      effects: parseEffects(s.effects),
      overlays: s.overlays.map((o) => ({
        id: str(o.id),
        kind: pick(o.kind, Object.keys(OVERLAYS) as OverlaySpec["kind"][]),
        enabled: Boolean(o.enabled),
        amount: number(o.amount, 0, 1),
        color: color(o.color),
        speed: number(o.speed, 0.1, 5),
        size: number(o.size, 0.1, 5),
        seed: number(o.seed, 0, 99999),
        start: number(o.start, 0, 300),
        end: o.end === null ? null : number(o.end, o.start, 300),
        offset: number(o.offset ?? 0, 0, 3600),
      })),
      opacity: number(s.opacity, 0, 1),
      mask: pick(s.mask, Object.keys(MASKS) as Scene["mask"][]),
      motionAmount: number(s.motionAmount, 0, 100),
      motionStart: number(s.motionStart, 0, 300),
      motionSpeed: number(s.motionSpeed, 0.1, 5),
      motionEasing: pick(s.motionEasing, Object.keys(EASINGS) as EasingName[]),
      transitionDirection: pick(s.transitionDirection, [
        "left",
        "right",
        "up",
        "down",
      ]),
      transitionEasing: pick(
        s.transitionEasing,
        Object.keys(EASINGS) as EasingName[],
      ),
      keyframes: s.keyframes.map((k) => ({
        time: number(k.time, 0, 3600),
        x: number(k.x, -100, 100),
        y: number(k.y, -100, 100),
        scale: number(k.scale, 0.1, 5),
        rotate: number(k.rotate, -360, 360),
        opacity: number(k.opacity, 0, 1),
      })),
      motionOffset: number(s.motionOffset, 0, 3600),
      motionDuration:
        s.motionDuration === null
          ? null
          : number(s.motionDuration, 0.001, 3600),
    };
  });
  if (new Set(scenes.map((s) => s.id)).size !== scenes.length)
    throw new Error("ID cảnh bị trùng.");
  for (const scene of scenes) {
    if (scene.voice) {
      const asset = voiceover?.assets.find(
        (v) => v.id === scene.voice!.assetId,
      );
      if (!asset || Math.abs(asset.duration - scene.voice.duration) > 0.000001)
        throw Error("Cảnh thiếu voice hoặc thời lượng không khớp tài nguyên.");
      if (scene.duration + 0.000001 < scene.voice.duration)
        throw Error(
          "Thời lượng cảnh không được ngắn hơn voice. Công cụ giữ nguyên toàn bộ lời đọc.",
        );
      for (const t of scene.texts)
        if (t.captions) parseCaptions(t.captions, scene.voice.duration);
    }
    if (
      scene.fit === "cover" &&
      scene.effects.some((effect) => effect.enabled) &&
      (scene.focusX !== 50 || scene.focusY !== 50)
    )
      throw new Error(
        "Stack hiệu ứng gốc dùng điểm lấy khung ở giữa (focus x/y = 0.5). Dùng bộ lọc màu hoặc lớp phủ nếu cần đổi điểm lấy khung.",
      );
    for (const items of [scene.texts, scene.effects, scene.overlays])
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new Error("ID lớp trong cảnh bị trùng.");
    if (
      new Set(scene.keyframes.map((k) => k.time)).size !==
      scene.keyframes.length
    )
      throw new Error("Hai keyframe không được trùng thời gian.");
  }
  const result: Project = {
    version: 1,
    name: str(p.name, 100),
    width: number(p.width, 240, 3840),
    height: number(p.height, 240, 3840),
    fps:
      pick(String(p.fps), ["24", "25", "30", "60"]) === "60"
        ? 60
        : Number(p.fps),
    background: color(p.background),
    assets,
    scenes,
    fonts,
    ...(p.actors !== undefined ? { actors: actorLibrary } : {}),
    ...(p.imageProcessing
      ? { imageProcessing: parseImageProcessing(p.imageProcessing) }
      : {}),
    ...(voiceover ? { voiceover } : {}),
  };
  if (p.automation !== undefined) {
    if (
      !p.automation ||
      !Array.isArray(p.automation.locks) ||
      p.automation.locks.length > 300
    )
      throw new Error("Cấu hình tự động hoặc danh sách cảnh giữ không hợp lệ.");
    result.automation = {
      config: parseAutoConfig(p.automation.config),
      locks: [
        ...new Set(p.automation.locks.map((value) => str(value, 500))),
      ].filter((value) => scenes.some((s) => s.id === value)),
    };
  }
  if (
    result.width * 16 !== result.height * 9 &&
    result.width * 9 !== result.height * 16
  )
    throw new Error("Chỉ hỗ trợ video dọc 9:16 và ngang 16:9.");
  if (
    result.width % 2 ||
    result.height % 2 ||
    totalFrames(result) > 60 * 60 * result.fps
  )
    throw new Error("Kích thước phải là số chẵn; video tối đa 60 phút.");
  return result;
}

function parseVoiceEnvelope(input: VoiceAsset["envelope"], duration: number) {
  if (
    !input ||
    input.stepMs !== 50 ||
    !Array.isArray(input.values) ||
    input.values.length !== Math.ceil(duration * 20 - 1e-8)
  )
    throw Error("Nhịp voice không khớp thời lượng âm thanh.");
  return { stepMs: 50, values: input.values.map((v) => number(v, 0, 1)) };
}

export function validateParam(value: unknown, field: FieldSchema): Value {
  if (field.type === "number" || field.type === "rotation-degrees") {
    const n = number(value, field.min ?? -100000, field.max ?? 100000);
    if (field.integer && !Number.isInteger(n))
      throw new Error("Tham số phải là số nguyên.");
    return n;
  }
  if (field.type === "boolean") {
    if (typeof value !== "boolean")
      throw new Error("Tham số bật/tắt không hợp lệ.");
    return value;
  }
  if (field.type === "color") {
    const s = str(value, 100);
    if (
      !/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(
        s,
      )
    )
      throw new Error("Màu hiệu ứng không hợp lệ.");
    return s;
  }
  if (field.type === "enum")
    return pick(value, Object.keys(field.variants ?? {}));
  if (field.type === "uv-coordinate") {
    if (!Array.isArray(value) || value.length !== 2)
      throw new Error("Toạ độ hiệu ứng cần hai giá trị.");
    return value.map((v) => number(v, field.min ?? -100, field.max ?? 100));
  }
  if (field.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (field.minLength ?? 0) ||
      value.length > Math.min(64, field.maxLength ?? 64)
    )
      throw new Error("Mảng tham số hiệu ứng không hợp lệ.");
    return value.map((v) => validateParam(v, field.item!)) as Value;
  }
  if (field.type === "string") return str(value, 2 * 1024 * 1024);
  throw new Error(`Kiểu tham số ${field.type} chưa được hỗ trợ.`);
}
export function parseEffects(input: unknown): EffectSpec[] {
  if (!Array.isArray(input) || input.length > 24)
    throw new Error("Tối đa 24 hiệu ứng cho mỗi cảnh.");
  return input.map((effect) => {
    const entry = EFFECT_MAP[effect.kind];
    if (!entry) throw new Error("Hiệu ứng không tồn tại trong phiên bản này.");
    const params: Record<string, Value> = {};
    const fields = effectFields(entry, effect.params ?? {}, true);
    for (const [key, field] of Object.entries(fields)) {
      const value = effect.params?.[key] ?? entry.defaults[key];
      if (value !== undefined) params[key] = validateParam(value, field);
    }
    for (const key of Object.keys(effect.params ?? {}))
      if (!(key in fields) || key === "disabled")
        throw new Error("Tham số hiệu ứng không được hỗ trợ.");
    const automation: EffectSpec["automation"] = {};
    for (const [key, raw] of Object.entries(effect.automation ?? {})) {
      const a = raw as { from: number; to: number; easing: string };
      const field = fields[key];
      if (!field || !["number", "rotation-degrees"].includes(field.type))
        throw new Error("Chỉ tự động hoá tham số số.");
      automation[key] = {
        from: validateParam(a.from, field) as number,
        to: validateParam(a.to, field) as number,
        easing: pick(a.easing, Object.keys(EASINGS) as EasingName[]),
      };
    }
    const result = {
      id: str(effect.id),
      kind: entry.kind,
      enabled: Boolean(effect.enabled),
      start: number(effect.start, 0, 300),
      end: effect.end === null ? null : number(effect.end, effect.start, 300),
      params,
      automation,
      offset: number(effect.offset ?? 0, 0, 3600),
      span: effect.span == null ? null : number(effect.span, 0.001, 3600),
    };
    validateNativeEffect(result);
    return result;
  });
}
