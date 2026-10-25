import { parseAutoConfig, type AutoConfig } from "./config";
import { compareNames, compileAuto, type SceneCompileCache } from "./compile";
import {
  MOTIONS,
  TRANSITIONS,
  OVERLAYS,
  FONT_FAMILIES,
  TEXT_ANIMATIONS,
  TEXT_PRESETS,
  EASINGS,
} from "../catalog";
import { textTemplate } from "../text-template";
import {
  fileOrder,
  pairNarration,
  parseScript,
  splitSentences,
} from "./narration";
import { planActors } from "../actors/plan";
import { NARRATION_LANGUAGES, type NarrationLanguage } from "./languages";
import { defaultTtsSettings, parseTtsSettings, type TtsSettings } from "./tts";
import { parseRandomSelection, type RandomSelection } from "./random-selection";
import {
  makeText,
  makeScene,
  parseProject,
  type Project,
  type Asset,
  type VoiceAsset,
  type OverlaySpec,
  type TextLayer,
  type Scene,
  emptyProject,
} from "../model";

export const STORY_STYLES = {
  calm: "Nhẹ nhàng",
  lively: "Vui nhộn",
  still: "Tối giản",
} as const;
export const STORY_OVERLAYS = { none: "Không thêm", ...OVERLAYS } as const;
export type StoryOverlay = Pick<
  OverlaySpec,
  "kind" | "amount" | "color" | "speed" | "size"
>;
export type CaptionAdvanced = Partial<
  Omit<
    TextLayer,
    | "id"
    | "text"
    | "captions"
    | "name"
    | "visible"
    | "size"
    | "color"
    | "background"
    | "fontFamily"
    | "animationIn"
    | "start"
    | "end"
    | "offset"
    | "span"
    | "counter"
    | "countFrom"
    | "countTo"
    | "prefix"
    | "suffix"
    | "decimals"
  >
>;
export type StoryImage = Pick<
  Scene,
  | "motionSpeed"
  | "motionEasing"
  | "motionStart"
  | "motionDuration"
  | "motionOffset"
  | "focusX"
  | "focusY"
  | "x"
  | "y"
  | "scale"
  | "rotate"
  | "flip"
  | "opacity"
  | "mask"
  | "keyframes"
>;
export const defaultStoryImage = (): StoryImage => {
  const s = makeScene("preview");
  return Object.fromEntries(
    [
      "motionSpeed",
      "motionEasing",
      "motionStart",
      "motionDuration",
      "motionOffset",
      "focusX",
      "focusY",
      "x",
      "y",
      "scale",
      "rotate",
      "flip",
      "opacity",
      "mask",
      "keyframes",
    ].map((k) => [k, s[k as keyof Scene]]),
  ) as StoryImage;
};
export type StoryCaption = {
  preset: "boxed" | "plain" | keyof typeof TEXT_PRESETS;
  size: number;
  color: string;
  background: string;
  position: "bottom" | "middle" | "top";
  animation: TextLayer["animationIn"];
  font: string;
  maxChars: number;
  advanced: CaptionAdvanced;
  transparent: boolean;
};
export const defaultCaption = (): StoryCaption => ({
  preset: "boxed",
  size: 48,
  color: "#ffffff",
  background: "#17382e",
  position: "bottom",
  animation: "none",
  font: "Arial",
  maxChars: 64,
  advanced: {},
  transparent: false,
});
export function newStoryOverlay(kind: keyof typeof OVERLAYS): StoryOverlay {
  return {
    kind,
    amount: kind === "grain" ? 0.12 : kind === "flash" ? 0.15 : 0.3,
    color: ["vignette", "letterbox", "scanlines"].includes(kind)
      ? "#000000"
      : kind === "stars"
        ? "#ffe3a0"
        : "#ffffff",
    speed: 0.7,
    size: 1,
  };
}
export type StoryOptions = {
  name: string;
  ratio: "9:16" | "16:9";
  style: keyof typeof STORY_STYLES;
  overlay: keyof typeof STORY_OVERLAYS;
  overlays: StoryOverlay[];
  motion: "auto" | "random" | keyof typeof MOTIONS;
  motionRandom: RandomSelection<keyof typeof MOTIONS>;
  motionAmount: number;
  image: StoryImage;
  transition: "auto" | "random" | keyof typeof TRANSITIONS;
  transitionRandom: RandomSelection<keyof typeof TRANSITIONS>;
  transitionSeconds: number;
  transitionDirection: "left" | "right" | "up" | "down";
  transitionEasing: Scene["transitionEasing"];
  caption: StoryCaption;
  characters: boolean;
  subtitles: boolean;
  seconds: number;
  fit: "contain" | "cover";
  quality: "high" | "standard";
  language: NarrationLanguage;
  tts: TtsSettings;
  model: "tiny" | "base" | "small" | "medium";
  sceneOverrides: Record<string, SceneStoryOverride>;
};
export type SceneStoryOverride = Partial<
  Pick<
    StoryOptions,
    | "motion"
    | "motionRandom"
    | "motionAmount"
    | "image"
    | "fit"
    | "transition"
    | "transitionRandom"
    | "transitionSeconds"
    | "transitionDirection"
    | "transitionEasing"
    | "caption"
    | "subtitles"
  >
>;
export function sceneStoryOptions(
  options: StoryOptions,
  file: string,
): StoryOptions {
  const patch = options.sceneOverrides[file];
  return patch
    ? {
        ...options,
        ...patch,
        image: { ...options.image, ...patch.image },
        caption: {
          ...options.caption,
          ...patch.caption,
          maxChars: options.caption.maxChars,
          advanced: patch.caption?.advanced ?? options.caption.advanced,
        },
      }
    : options;
}
export const defaultStoryOptions = (): StoryOptions => ({
  name: "Câu chuyện của tôi",
  ratio: "9:16",
  style: "calm",
  overlay: "none",
  overlays: [],
  motion: "auto",
  motionRandom: {
    presets: ["zoom-in", "zoom-out", "pan-left", "pan-right"],
    seed: 42,
  },
  motionAmount: 5,
  image: defaultStoryImage(),
  transition: "auto",
  transitionRandom: { presets: ["fade", "slide", "wipe", "zoom"], seed: 42 },
  transitionSeconds: 0.45,
  transitionDirection: "left",
  transitionEasing: "linear",
  caption: defaultCaption(),
  characters: true,
  subtitles: true,
  seconds: 4,
  fit: "contain",
  quality: "high",
  language: "vi",
  tts: defaultTtsSettings(),
  model: "small",
  sceneOverrides: {},
});

export function parseStoryOptions(input: unknown): StoryOptions {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Mẫu dựng không hợp lệ. Hãy chọn tệp mẫu đã lưu từ Khung.");
  const o = { ...defaultStoryOptions(), ...input };
  o.tts = parseTtsSettings(o.tts);
  o.caption = { ...defaultCaption(), ...o.caption };
  o.caption.advanced = { ...o.caption.advanced };
  o.image = { ...defaultStoryImage(), ...o.image };
  o.motionRandom = parseRandomSelection(
    o.motionRandom,
    defaultStoryOptions().motionRandom,
    MOTIONS,
    "Chuyển động",
  );
  o.transitionRandom = parseRandomSelection(
    o.transitionRandom,
    defaultStoryOptions().transitionRandom,
    TRANSITIONS,
    "Chuyển cảnh",
  );
  const choices: Record<string, readonly unknown[]> = {
    ratio: ["9:16", "16:9"],
    style: Object.keys(STORY_STYLES),
    overlay: Object.keys(STORY_OVERLAYS),
    fit: ["contain", "cover"],
    quality: ["high", "standard"],
    language: Object.keys(NARRATION_LANGUAGES),
    model: ["tiny", "base", "small", "medium"],
    motion: ["auto", "random", ...Object.keys(MOTIONS)],
    transition: ["auto", "random", ...Object.keys(TRANSITIONS)],
    transitionDirection: ["left", "right", "up", "down"],
    transitionEasing: Object.keys(EASINGS),
  };
  for (const [key, values] of Object.entries(choices))
    if (!values.includes(o[key as keyof StoryOptions]))
      throw Error("Mẫu dựng: lựa chọn " + key + " không hợp lệ.");
  if (typeof o.name !== "string" || !o.name.trim() || o.name.length > 100)
    throw Error("Tên video cần từ 1 đến 100 ký tự.");
  if (!Number.isFinite(o.seconds) || o.seconds < 1 || o.seconds > 300)
    throw Error("Thời gian mỗi ảnh cần từ 1 đến 300 giây.");
  if (typeof o.characters !== "boolean" || typeof o.subtitles !== "boolean")
    throw Error("Mẫu dựng: lựa chọn nhân vật/phụ đề không hợp lệ.");
  const finite = (n: number, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (!finite(o.motionAmount, 0, 100) || !finite(o.transitionSeconds, 0.1, 2))
    throw Error("Mức chuyển động hoặc thời gian chuyển cảnh không hợp lệ.");
  const c = o.caption;
  if (
    !["boxed", "plain", ...Object.keys(TEXT_PRESETS)].includes(c.preset) ||
    !["bottom", "middle", "top"].includes(c.position) ||
    !(c.animation in TEXT_ANIMATIONS) ||
    !FONT_FAMILIES.includes(c.font as (typeof FONT_FAMILIES)[number]) ||
    !finite(c.size, 8, 400) ||
    !finite(c.maxChars, 40, 240) ||
    typeof c.transparent !== "boolean"
  )
    throw Error("Kiểu phụ đề không hợp lệ.");
  if (
    ![c.color, c.background].every(
      (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
    )
  )
    throw Error("Màu phụ đề không hợp lệ.");
  if (
    !Array.isArray(o.overlays) ||
    o.overlays.length > 8 ||
    o.overlays.some((layer) => !layer || typeof layer !== "object") ||
    new Set(o.overlays.map((l) => l.kind)).size !== o.overlays.length
  )
    throw Error("Chọn tối đa tám lớp phủ khác nhau.");
  for (const l of o.overlays)
    if (
      !l ||
      !(l.kind in OVERLAYS) ||
      !finite(l.amount, 0, 1) ||
      !finite(l.speed, 0, 5) ||
      !finite(l.size, 0.1, 5) ||
      typeof l.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(l.color)
    )
      throw Error("Thiết lập lớp phủ không hợp lệ.");
  const forbidden = [
    "id",
    "text",
    "captions",
    "name",
    "visible",
    "size",
    "color",
    "background",
    "fontFamily",
    "animationIn",
    "start",
    "end",
    "offset",
    "span",
    "counter",
    "countFrom",
    "countTo",
    "prefix",
    "suffix",
    "decimals",
  ];
  for (const key of Object.keys(c.advanced))
    if (!(key in makeText()) || forbidden.includes(key))
      throw Error("Thông số phụ đề không hợp lệ: " + key);
  for (const key of Object.keys(o.image))
    if (!(key in defaultStoryImage()))
      throw Error("Thông số ảnh không hợp lệ: " + key);
  // Reuse the canonical scene/text validator for every advanced field.
  parseProject({
    ...emptyProject(),
    assets: [
      {
        id: "validate",
        name: "validate.svg",
        src: "/samples/coast.svg",
        width: 100,
        height: 100,
      },
    ],
    scenes: [
      {
        ...makeScene("validate"),
        ...o.image,
        texts: [{ ...makeText(), ...captionStyle(o) }],
      },
    ],
  });
  if (
    !o.sceneOverrides ||
    typeof o.sceneOverrides !== "object" ||
    Array.isArray(o.sceneOverrides) ||
    Object.keys(o.sceneOverrides).length > 300
  )
    throw Error("Thiết lập theo cảnh không hợp lệ.");
  for (const [file, patch] of Object.entries(o.sceneOverrides)) {
    if (
      !file ||
      file.length > 500 ||
      !patch ||
      typeof patch !== "object" ||
      Array.isArray(patch) ||
      Object.keys(patch).some(
        (k) =>
          ![
            "motion",
            "motionRandom",
            "motionAmount",
            "image",
            "fit",
            "transition",
            "transitionRandom",
            "transitionSeconds",
            "transitionDirection",
            "transitionEasing",
            "caption",
            "subtitles",
          ].includes(k),
      )
    )
      throw Error("Thiết lập riêng của cảnh không hợp lệ.");
    parseStoryOptions({ ...sceneStoryOptions(o, file), sceneOverrides: {} });
  }
  return o;
}

export type StoryInput = {
  order: number;
  image: Asset;
  text: string;
  voice?: VoiceAsset;
};
export function storyInputs(project: Project): StoryInput[] {
  if (!project.assets.length) throw Error("Thêm ít nhất một ảnh bối cảnh.");
  if (
    new Set(project.assets.map((a) => a.name.normalize("NFC"))).size !==
    project.assets.length
  )
    throw Error("Ảnh có tên trùng nhau. Đổi tên ảnh rồi nhập lại.");
  const script = project.voiceover?.script.trim() ?? "";
  const voices = project.voiceover?.assets ?? [];
  if (voices.length) {
    if (!script)
      throw Error(
        "Đã có voice. Thêm một TXT đánh số để ghép lời đọc và phụ đề.",
      );
    return pairNarration(project.assets, project.voiceover!);
  }
  const ordered = [...project.assets].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  if (!script)
    return ordered.map((image, i) => ({ order: i + 1, image, text: "" }));
  const sections = parseScript(script);
  const images = new Map<number, (typeof ordered)[number]>();
  for (const image of ordered) {
    const order = fileOrder(image.name);
    if (images.has(order))
      throw Error("Ảnh bị trùng số " + order + ". Đổi tên rồi nhập lại.");
    if (!sections.some((s) => s.order === order))
      throw Error(image.name + ": chưa có mục TXT tương ứng.");
    images.set(order, image);
  }
  return sections.map((section) => {
    const image = images.get(section.order);
    if (!image) throw Error("Thiếu ảnh cho mục TXT số " + section.order + ".");
    return { ...section, image };
  });
}

export function storyConfig(project: Project, input: StoryOptions): AutoConfig {
  const o = parseStoryOptions(input),
    rows = storyInputs(project);
  const voice = Boolean(project.voiceover?.assets.length);
  const motion =
    o.motion === "random"
      ? o.motionRandom.presets
      : o.motion !== "auto"
        ? [o.motion]
        : o.style === "still"
          ? ["none"]
          : o.style === "lively"
            ? ["zoom-in", "pan-left", "zoom-out", "pan-right"]
            : ["zoom-in", "zoom-out"];
  return parseAutoConfig({
    autoEditVersion: 1,
    output: {
      name: o.name.trim(),
      ratio: o.ratio,
      quality: o.quality,
      fps: 30,
      background: "#171f1b",
    },
    narration: {
      enabled: voice,
      language: o.tts.enabled
        ? o.tts.model === "turbo"
          ? "en"
          : o.tts.languageId
        : o.language,
      model: o.model,
      maxChars: o.caption.maxChars,
    },
    timing: { seconds: o.seconds },
    framing: {
      fit: o.fit,
      focus: { x: o.image.focusX / 100, y: o.image.focusY / 100 },
    },
    motion: {
      policy: o.motion === "random" ? "seeded" : "alternate",
      seed: o.motionRandom.seed,
      presets: motion,
      amount: o.motionAmount,
      easing: o.image.motionEasing,
    },
    transition: {
      policy: o.transition === "random" ? "seeded" : "fixed",
      presets: o.transitionRandom.presets,
      seed: o.transitionRandom.seed,
      preset:
        o.transition === "random"
          ? o.transitionRandom.presets[0]
          : o.transition !== "auto"
            ? o.transition
            : o.style === "still"
              ? "none"
              : o.style === "lively"
                ? "slide"
                : "fade",
      seconds: o.transitionSeconds,
      direction: o.transitionDirection,
      easing: o.transitionEasing,
    },
    text: {
      source: "none",
      preset: "subtitle",
      style: captionStyle(o),
    },
    look: {
      scene: {
        ...o.image,
        overlays: effectiveOverlays(o).map((layer, i) => ({
          ...layer,
          id: "story-overlay-" + i,
        })),
      },
    },
    characters: {
      enabled: o.characters && Boolean(project.actors?.length),
      cast: "rotate",
      layout: "auto",
      size: "medium",
      speaker: "narrator",
      behavior:
        o.style === "lively"
          ? "energetic"
          : o.style === "still"
            ? "gentle"
            : "story",
      entrance: o.style === "still" ? "fade" : "slide",
    },
    overrides: rows.map((row, index) => {
      const patch = o.sceneOverrides[row.image.name],
        scoped = sceneStoryOptions(o, row.image.name);
      return {
        file: row.image.name,
        ...(patch?.motion === "random"
          ? { motionRandom: scoped.motionRandom }
          : {}),
        ...(patch?.transition === "random"
          ? { transitionRandom: scoped.transitionRandom }
          : {}),
        scene: {
          ...(patch?.image ? scoped.image : {}),
          ...(patch?.fit ? { fit: scoped.fit } : {}),
          ...(patch?.motion && patch.motion !== "random"
            ? {
                motion:
                  scoped.motion === "auto"
                    ? motion[index % motion.length]
                    : scoped.motion,
              }
            : {}),
          ...(patch?.motionAmount !== undefined
            ? { motionAmount: scoped.motionAmount }
            : {}),
          ...(patch?.transition && patch.transition !== "random"
            ? {
                transition:
                  scoped.transition === "auto"
                    ? scoped.style === "still"
                      ? "none"
                      : scoped.style === "lively"
                        ? "slide"
                        : "fade"
                    : scoped.transition,
              }
            : {}),
          ...(patch?.transitionSeconds !== undefined
            ? { transitionDuration: scoped.transitionSeconds }
            : {}),
          ...(patch?.transitionDirection
            ? { transitionDirection: scoped.transitionDirection }
            : {}),
          ...(patch?.transitionEasing
            ? { transitionEasing: scoped.transitionEasing }
            : {}),
          ...(!voice
            ? {
                duration: Math.min(
                  300,
                  Math.max(
                    o.seconds,
                    row.text ? row.text.split(/\s+/).length / 3 + 0.6 : 0,
                  ),
                ),
              }
            : {}),
        },
        ...(patch?.caption || patch?.subtitles !== undefined
          ? { textStyle: captionStyle(scoped) }
          : {}),
      };
    }),
  });
}

// Without audio these timings are explicitly estimates, never forced alignment.
export function finishStory(
  project: Project,
  source: Project,
  options: StoryOptions,
  config: AutoConfig,
): Project {
  if (!config.narration.enabled) {
    const rows = storyInputs(source);
    for (const scene of project.scenes) {
      const row = rows.find((r) => r.image.id === scene.assetId);
      if (!row?.text) continue;
      const sentences = splitSentences(row.text, config.narration.maxChars);
      const weight = sentences.reduce((n, s) => n + s.length, 0);
      const available = scene.duration * 1000 - 300;
      let at = 150;
      const captions = sentences.map((text, i) => {
        const startMs = at;
        at =
          i === sentences.length - 1
            ? scene.duration * 1000 - 150
            : at + (available * text.length) / weight;
        return {
          text,
          startMs,
          endMs: at,
          timestampMs: null,
          confidence: null,
        };
      });
      scene.texts = [
        {
          ...makeText(),
          ...config.text.style,
          ...config.overrides.find((o) => o.file === row.image.name)?.textStyle,
          id: scene.id + "-caption",
          name: "Phụ đề ước lượng",
          text: sentences[0],
          captions,
        },
      ];
    }
    planActors(project, config.characters, config.seed);
  }
  for (const scene of project.scenes) {
    const file = project.assets.find((a) => a.id === scene.assetId)?.name ?? "";
    for (const text of scene.texts)
      text.visible = sceneStoryOptions(options, file).subtitles;
  }
  return parseProject(project);
}

export function optionsFromProject(
  project: Project,
  includeOverrides = true,
): StoryOptions {
  const config = project.automation?.config;
  const overlay = config?.look.scene.overlays?.[0]?.kind ?? "none";
  return {
    ...defaultStoryOptions(),
    sceneOverrides: includeOverrides
      ? (Object.fromEntries(
          (config?.overrides ?? [])
            .filter(
              (o) =>
                o.textStyle ||
                o.motionRandom ||
                o.transitionRandom ||
                Object.keys(o.scene).some((k) => k !== "duration"),
            )
            .map((o) => {
              const image = Object.fromEntries(
                Object.keys(defaultStoryImage())
                  .filter((k) => o.scene[k as keyof Scene] !== undefined)
                  .map((k) => [k, o.scene[k as keyof Scene]]),
              );
              const scoped = o.textStyle
                ? optionsFromProject(
                    {
                      ...project,
                      automation: {
                        locks: [],
                        config: {
                          ...config!,
                          text: {
                            ...config!.text,
                            style: { ...config!.text.style, ...o.textStyle },
                          },
                        },
                      },
                    },
                    false,
                  )
                : null;
              return [
                o.file,
                {
                  ...(Object.keys(image).length ? { image } : {}),
                  ...(o.scene.fit ? { fit: o.scene.fit } : {}),
                  ...(o.scene.motion ? { motion: o.scene.motion } : {}),
                  ...(o.motionRandom
                    ? { motion: "random", motionRandom: o.motionRandom }
                    : {}),
                  ...(o.scene.motionAmount !== undefined
                    ? { motionAmount: o.scene.motionAmount }
                    : {}),
                  ...(o.scene.transition
                    ? { transition: o.scene.transition }
                    : {}),
                  ...(o.transitionRandom
                    ? {
                        transition: "random",
                        transitionRandom: o.transitionRandom,
                      }
                    : {}),
                  ...(o.scene.transitionDuration !== undefined
                    ? { transitionSeconds: o.scene.transitionDuration }
                    : {}),
                  ...(o.scene.transitionDirection
                    ? { transitionDirection: o.scene.transitionDirection }
                    : {}),
                  ...(o.scene.transitionEasing
                    ? { transitionEasing: o.scene.transitionEasing }
                    : {}),
                  ...(scoped
                    ? { caption: scoped.caption, subtitles: scoped.subtitles }
                    : {}),
                },
              ];
            }),
        ) as StoryOptions["sceneOverrides"])
      : {},
    name: project.name || "Câu chuyện của tôi",
    ratio: project.width < project.height ? "9:16" : "16:9",
    fit: config?.framing.fit ?? "contain",
    motion:
      config?.motion.policy === "seeded"
        ? "random"
        : config?.motion.presets.length === 1
          ? config.motion.presets[0]
          : "auto",
    motionRandom:
      config?.motion.policy === "seeded"
        ? { presets: config.motion.presets, seed: config.motion.seed }
        : defaultStoryOptions().motionRandom,
    motionAmount: config?.motion.amount ?? 5,
    image: {
      ...defaultStoryImage(),
      ...Object.fromEntries(
        Object.keys(defaultStoryImage())
          .filter((k) => config?.look.scene[k as keyof Scene] !== undefined)
          .map((k) => [k, config!.look.scene[k as keyof Scene]]),
      ),
      motionEasing: config?.motion.easing ?? "linear",
    },
    transition:
      config?.transition.policy === "seeded"
        ? "random"
        : (config?.transition.preset ?? "auto"),
    transitionRandom: config
      ? { presets: config.transition.presets, seed: config.transition.seed }
      : defaultStoryOptions().transitionRandom,
    transitionSeconds: config?.transition.seconds ?? 0.45,
    transitionDirection: config?.transition.direction ?? "left",
    transitionEasing: config?.transition.easing ?? "linear",
    overlays: (config?.look.scene.overlays ?? [])
      .filter((l) => l.enabled !== false)
      .slice(0, 8)
      .map((l) => ({
        ...newStoryOverlay(l.kind),
        kind: l.kind,
        amount: l.amount ?? 0.3,
        color: l.color ?? "#ffffff",
        speed: l.speed ?? 0.7,
        size: l.size ?? 1,
      })),
    caption: {
      ...defaultCaption(),
      size: config?.text.style.size ?? 48,
      transparent: config?.text.style.background === "transparent",
      advanced: Object.fromEntries(
        Object.entries(config?.text.style ?? {}).filter(
          ([k]) =>
            ![
              "id",
              "text",
              "captions",
              "name",
              "visible",
              "size",
              "color",
              "background",
              "fontFamily",
              "animationIn",
              "start",
              "end",
              "offset",
              "span",
              "counter",
              "countFrom",
              "countTo",
              "prefix",
              "suffix",
              "decimals",
            ].includes(k),
        ),
      ),
      color: config?.text.style.color ?? "#ffffff",
      background:
        config?.text.style.background &&
        config.text.style.background !== "transparent"
          ? config.text.style.background
          : "#17382e",
      position:
        (config?.text.style.y ?? 87) < 35
          ? "top"
          : (config?.text.style.y ?? 87) < 70
            ? "middle"
            : "bottom",
      font: FONT_FAMILIES.includes(
        config?.text.style.fontFamily as (typeof FONT_FAMILIES)[number],
      )
        ? config!.text.style.fontFamily!
        : "Arial",
      maxChars: config?.narration.maxChars ?? 64,
      preset: config?.text.style.stroke
        ? "outline"
        : config?.text.style.background === "transparent"
          ? "plain"
          : "boxed",
      animation: Object.keys(TEXT_ANIMATIONS).includes(
        config?.text.style.animationIn ?? "none",
      )
        ? ((config?.text.style.animationIn as StoryCaption["animation"]) ??
          "none")
        : "none",
    },
    style: config?.motion.presets.every((p) => p === "none")
      ? "still"
      : config?.transition.preset === "slide"
        ? "lively"
        : "calm",
    overlay:
      overlay in STORY_OVERLAYS ? (overlay as StoryOptions["overlay"]) : "none",
    seconds:
      config?.timing.mode === "per-image"
        ? Math.max(1, config.timing.seconds)
        : 4,
    characters: project.actors?.length
      ? (config?.characters.enabled ?? true)
      : true,
    subtitles: config?.text.style.visible !== false,
    quality: config?.output.quality ?? "high",
    model: config?.narration.model ?? "small",
    language:
      project.voiceover?.uploadLanguage ?? config?.narration.language ?? "vi",
    tts: project.voiceover?.tts ?? defaultTtsSettings(),
  };
}

export function effectiveOverlays(o: StoryOptions): StoryOverlay[] {
  return o.overlays.length
    ? o.overlays
    : o.overlay !== "none"
      ? [newStoryOverlay(o.overlay)]
      : [];
}
export function captionStyle(o: StoryOptions): Partial<TextLayer> {
  const c = o.caption;
  const isBasic = ["boxed", "outline", "highlight", "plain"].includes(c.preset);
  return {
    ...(!isBasic ? textTemplate(c.preset) : {}),
    visible: o.subtitles,
    size: c.size,
    width: 84,
    y: { bottom: 87, middle: 50, top: 14 }[c.position],
    color: c.color,
    background:
      c.transparent ||
      c.preset === "outline" ||
      c.preset === "plain" ||
      (!isBasic && textTemplate(c.preset).background === "transparent")
        ? "transparent"
        : c.background,
    ...(isBasic
      ? {
          stroke: c.preset === "outline" ? 3 : 0,
          strokeColor: "#102018",
          shadow: c.preset === "outline" || c.preset === "plain" ? 5 : 0,
        }
      : {}),
    fontFamily: c.font,
    animationIn: c.animation,
    animationOut: "none",
    inDuration: 0.2,
    padding: 16,
    radius: c.preset === "highlight" ? 2 : 10,
    ...c.advanced,
  };
}

export function previewStory(
  source: Project,
  input: StoryOptions,
  sceneCache?: SceneCompileCache,
): { project: Project; estimated: boolean; error?: string } {
  if (!source.assets.length)
    return {
      project: {
        ...emptyProject(),
        width: input.ratio === "9:16" ? 1080 : 1920,
        height: input.ratio === "9:16" ? 1920 : 1080,
      },
      estimated: false,
    };
  try {
    const options = parseStoryOptions({
      ...input,
      name: input.name.trim() || "Video",
    });
    const config = storyConfig(
      { ...source, scenes: [], voiceover: undefined },
      options,
    );
    const order = (name: string) => {
      try {
        return fileOrder(name);
      } catch {
        return 0;
      }
    };
    let sections: ReturnType<typeof parseScript> = [];
    try {
      if (source.voiceover?.script.trim())
        sections = parseScript(source.voiceover.script);
    } catch {
      /* Validation is reported in the input panel. */
    }
    const rows = [...source.assets]
      .sort((a, b) => compareNames(a.name, b.name))
      .map((asset) => {
        const n = order(asset.name);
        return {
          asset,
          text: sections.find((s) => s.order === n)?.text ?? "",
          voice: n
            ? source.voiceover?.assets.find((v) => order(v.name) === n)
            : undefined,
        };
      });
    config.overrides = rows.map((r) => ({
      ...config.overrides.find((o) => o.file === r.asset.name),
      file: r.asset.name,
      scene: {
        ...config.overrides.find((o) => o.file === r.asset.name)?.scene,
        duration: r.voice
          ? Math.ceil(r.voice.duration * 30 - 1e-8) / 30
          : Math.min(
              300,
              Math.max(
                options.seconds,
                r.text ? r.text.split(/\s+/).length / 3 + 0.6 : 0,
              ),
            ),
      },
    }));
    const result = compileAuto(
      config,
      source.assets,
      source,
      false,
      undefined,
      source.actors ?? [],
      sceneCache,
    ).project;
    result.voiceover = source.voiceover;
    let estimated = false;
    for (const scene of result.scenes) {
      const row = rows.find((r) => r.asset.id === scene.assetId)!;
      if (row.voice)
        scene.voice = { assetId: row.voice.id, duration: row.voice.duration };
      if (!row.text) continue;
      const sentences = splitSentences(row.text, options.caption.maxChars);
      const old = source.scenes
        .find(
          (s) =>
            s.assetId === scene.assetId && s.voice?.assetId === row.voice?.id,
        )
        ?.texts.find((t) => t.captions)?.captions;
      let captions =
        row.voice &&
        old &&
        old.length === sentences.length &&
        old.every((c, i) => c.text === sentences[i])
          ? structuredClone(old)
          : undefined;
      if (!captions) {
        estimated = true;
        let at = 80;
        const end = (row.voice?.duration ?? scene.duration) * 1000 - 80;
        const weight = sentences.reduce((n, t) => n + t.length, 0);
        captions = sentences.map((text, i) => {
          const startMs = at;
          at =
            i === sentences.length - 1
              ? end
              : at + ((end - 80) * text.length) / weight;
          return {
            text,
            startMs,
            endMs: at,
            timestampMs: null,
            confidence: null,
          };
        });
      }
      scene.texts = [
        {
          ...makeText(),
          ...captionStyle(sceneStoryOptions(options, row.asset.name)),
          id: scene.id + "-caption",
          name: "Phụ đề",
          text: sentences[0],
          captions,
        },
      ];
    }
    planActors(result, config.characters, config.seed);
    return { project: parseProject(result), estimated };
  } catch (error) {
    return {
      project: source.scenes.length
        ? source
        : { ...emptyProject(), assets: source.assets },
      estimated: true,
      error:
        error instanceof Error ? error.message : "Không tạo được bản xem thử.",
    };
  }
}
