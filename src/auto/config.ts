import { EASINGS, MOTIONS, TRANSITIONS, TEXT_PRESETS } from "../catalog";
import type { Project, Scene, TextLayer } from "../model";
import type { ActorSettings } from "../actors/types";
import { parseActorSettings } from "../actors/schema";
import { NARRATION_LANGUAGES, type NarrationLanguage } from "./languages";

export const AUTO_TEMPLATES = {
  "story-clean@1": "Kể chuyện nhẹ",
  "minimal@1": "Tối giản",
  "warm-travel@1": "Du lịch ấm",
} as const;
export type AutoConfig = {
  autoEditVersion: 1;
  template: keyof typeof AUTO_TEMPLATES;
  seed: number;
  characters: ActorSettings;
  input: {
    directory: string;
    order: "natural" | "name" | "input";
    extensions: string[];
  };
  output: {
    file: string;
    ratio: "9:16" | "16:9";
    fps: number;
    quality: "standard" | "high";
    name: string;
    background: string;
  };
  timing: {
    mode: "per-image" | "total";
    seconds: number;
    minSeconds: number;
    maxSeconds: number;
  };
  narration: {
    enabled: boolean;
    directory: string;
    script: string;
    language: NarrationLanguage;
    model: "tiny" | "base" | "small" | "medium";
    maxChars: number;
  };
  framing: { fit: "cover" | "contain"; focus: { x: number; y: number } };
  motion: {
    policy: "alternate" | "seeded";
    presets: Scene["motion"][];
    amount: number;
    easing: Scene["motionEasing"];
  };
  transition: {
    preset: Scene["transition"];
    seconds: number;
    direction: Scene["transitionDirection"];
    easing: Scene["transitionEasing"];
  };
  text: {
    source: "none" | "filename" | "static" | "file";
    content: string;
    file: string;
    captions: Record<string, string>;
    preset: keyof typeof TEXT_PRESETS;
    style: Partial<TextLayer>;
  };
  look: {
    preset: "natural" | "warm" | "cool" | "mono" | "vintage";
    scene: Partial<Scene>;
  };
  overrides: {
    file: string;
    scene: Partial<Scene>;
    text?: string;
    textStyle?: Partial<TextLayer>;
  }[];
};
type Obj = Record<string, unknown>;
function obj(v: unknown, path: string): Obj {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error(`${path}: cần một object JSON.`);
  return v as Obj;
}
function keys(o: Obj, allowed: string[], path: string) {
  for (const key of Object.keys(o))
    if (!allowed.includes(key))
      throw Error(`${path}.${key}: trường không được hỗ trợ.`);
}
function text(v: unknown, path: string, max = 1000): string {
  if (typeof v !== "string" || v.length > max)
    throw Error(`${path}: cần chuỗi tối đa ${max} ký tự.`);
  return v;
}
function num(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`${path}: cần số từ ${min} đến ${max}.`);
  return v;
}
function choice<T extends string>(
  v: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (!allowed.includes(v as T))
    throw Error(`${path}: chọn ${allowed.join(", ")}.`);
  return v as T;
}
function section(o: Obj, name: string, allowed: string[]): Obj {
  const s = obj(o[name] ?? {}, name);
  keys(s, allowed, name);
  return s;
}
// Low-level scene/text fields are validated by parseProject after merging defaults.
// Identity is controlled by the compiler. Source clocks can be saved from split scenes.
export function scenePatch(v: unknown, path: string): Partial<Scene> {
  const s = obj(v, path);
  keys(
    s,
    [
      "duration",
      "fit",
      "focusX",
      "focusY",
      "x",
      "y",
      "scale",
      "rotate",
      "flip",
      "brightness",
      "contrast",
      "saturation",
      "filter",
      "motion",
      "transition",
      "transitionDuration",
      "texts",
      "effects",
      "overlays",
      "opacity",
      "mask",
      "motionAmount",
      "motionSpeed",
      "motionStart",
      "motionEasing",
      "transitionDirection",
      "transitionEasing",
      "keyframes",
      "motionOffset",
      "motionDuration",
    ],
    path,
  );
  return structuredClone(s) as Partial<Scene>;
}
export function parseAutoConfig(value: unknown): AutoConfig {
  const o = obj(value, "config");
  keys(
    o,
    [
      "autoEditVersion",
      "template",
      "seed",
      "characters",
      "input",
      "output",
      "timing",
      "narration",
      "framing",
      "motion",
      "transition",
      "text",
      "look",
      "overrides",
    ],
    "config",
  );
  if (o.autoEditVersion !== 1)
    throw Error("autoEditVersion: chỉ hỗ trợ phiên bản 1.");
  const template = choice(
    o.template ?? "story-clean@1",
    Object.keys(AUTO_TEMPLATES) as AutoConfig["template"][],
    "template",
  );
  const input = section(o, "input", ["directory", "order", "extensions"]);
  const output = section(o, "output", [
    "file",
    "ratio",
    "fps",
    "quality",
    "name",
    "background",
  ]);
  const timing = section(o, "timing", [
    "mode",
    "seconds",
    "minSeconds",
    "maxSeconds",
  ]);
  const framing = section(o, "framing", ["fit", "focus"]);
  const narration = section(o, "narration", [
    "enabled",
    "directory",
    "script",
    "language",
    "model",
    "maxChars",
  ]);
  if (narration.enabled !== undefined && typeof narration.enabled !== "boolean")
    throw Error("narration.enabled: cần true hoặc false.");
  const focus = obj(framing.focus ?? {}, "framing.focus");
  keys(focus, ["x", "y"], "framing.focus");
  const motion = section(o, "motion", [
    "policy",
    "presets",
    "amount",
    "easing",
  ]);
  const transition = section(o, "transition", [
    "preset",
    "seconds",
    "direction",
    "easing",
  ]);
  const caption = section(o, "text", [
    "source",
    "content",
    "file",
    "captions",
    "preset",
    "style",
  ]);
  const look = section(o, "look", ["preset", "scene"]);
  const presets =
    motion.presets ??
    (template === "minimal@1"
      ? ["none"]
      : ["zoom-in", "pan-left", "zoom-out", "pan-right"]);
  if (!Array.isArray(presets) || !presets.length || presets.length > 24)
    throw Error("motion.presets: cần 1–24 preset.");
  const extensions = input.extensions ?? ["jpg", "jpeg", "png", "webp"];
  if (!Array.isArray(extensions) || !extensions.length)
    throw Error("input.extensions: cần ít nhất một định dạng ảnh.");
  const captions = obj(caption.captions ?? {}, "text.captions");
  if (Object.keys(captions).length > 300)
    throw Error("text.captions: tối đa 300 mục.");
  const style = obj(caption.style ?? {}, "text.style");
  keys(
    style,
    [
      "x",
      "y",
      "size",
      "color",
      "background",
      "bold",
      "align",
      "name",
      "visible",
      "fontFamily",
      "weight",
      "italic",
      "decoration",
      "letterSpacing",
      "lineHeight",
      "casing",
      "writing",
      "width",
      "padding",
      "radius",
      "opacity",
      "rotate",
      "scale",
      "skew",
      "fill",
      "gradientColor",
      "gradientAngle",
      "stroke",
      "strokeColor",
      "shadow",
      "shadowColor",
      "shadowX",
      "shadowY",
      "glow",
      "depth",
      "start",
      "end",
      "animationIn",
      "animationOut",
      "inDuration",
      "outDuration",
      "stagger",
      "easing",
      "loop",
      "loopSpeed",
      "shape",
      "arc",
      "counter",
      "countFrom",
      "countTo",
      "prefix",
      "suffix",
      "decimals",
    ],
    "text.style",
  );
  if (["id", "text", "offset", "span"].some((k) => k in style))
    throw Error("text.style: không đặt id, text, offset hoặc span.");
  const overrides = o.overrides ?? [];
  if (!Array.isArray(overrides) || overrides.length > 300)
    throw Error("overrides: tối đa 300 mục.");
  const result: AutoConfig = {
    autoEditVersion: 1,
    template,
    seed: num(o.seed ?? 42, "seed", 0, 99999),
    characters: parseActorSettings(o.characters),
    input: {
      directory: text(input.directory ?? "./images", "input.directory"),
      order: choice(
        input.order ?? "natural",
        ["natural", "name", "input"],
        "input.order",
      ),
      extensions: extensions.map((e) =>
        choice(e, ["jpg", "jpeg", "png", "webp"], "input.extensions"),
      ),
    },
    output: {
      file: text(output.file ?? "./output/video.mp4", "output.file"),
      ratio: choice(output.ratio ?? "9:16", ["9:16", "16:9"], "output.ratio"),
      fps: num(output.fps ?? 30, "output.fps", 24, 60),
      quality: choice(
        output.quality ?? "high",
        ["standard", "high"],
        "output.quality",
      ),
      name: text(output.name ?? "Video tự động", "output.name", 100),
      background: text(output.background ?? "#f4f0e8", "output.background", 7),
    },
    timing: {
      mode: choice(
        timing.mode ?? "per-image",
        ["per-image", "total"],
        "timing.mode",
      ),
      seconds: num(timing.seconds ?? 4, "timing.seconds", 0.5, 3600),
      minSeconds: num(timing.minSeconds ?? 1, "timing.minSeconds", 0.5, 300),
      maxSeconds: num(timing.maxSeconds ?? 300, "timing.maxSeconds", 0.5, 300),
    },
    narration: {
      enabled: narration.enabled === true,
      directory: text(narration.directory ?? "./voices", "narration.directory"),
      script: text(narration.script ?? "./script.txt", "narration.script"),
      language: choice(
        narration.language ?? "vi",
        Object.keys(NARRATION_LANGUAGES) as NarrationLanguage[],
        "narration.language",
      ),
      model: choice(
        narration.model ?? "small",
        ["tiny", "base", "small", "medium"],
        "narration.model",
      ),
      maxChars: num(narration.maxChars ?? 100, "narration.maxChars", 40, 240),
    },
    framing: {
      fit: choice(framing.fit ?? "cover", ["cover", "contain"], "framing.fit"),
      focus: {
        x: num(focus.x ?? 0.5, "framing.focus.x", 0, 1),
        y: num(focus.y ?? 0.5, "framing.focus.y", 0, 1),
      },
    },
    motion: {
      policy: choice(
        motion.policy ?? "alternate",
        ["alternate", "seeded"],
        "motion.policy",
      ),
      presets: presets.map((p) =>
        choice(p, Object.keys(MOTIONS) as Scene["motion"][], "motion.presets"),
      ),
      amount: num(motion.amount ?? 8, "motion.amount", 0, 100),
      easing: choice(
        motion.easing ?? "ease-in-out",
        Object.keys(EASINGS) as Scene["motionEasing"][],
        "motion.easing",
      ),
    },
    transition: {
      preset: choice(
        transition.preset ?? (template === "minimal@1" ? "none" : "fade"),
        Object.keys(TRANSITIONS) as Scene["transition"][],
        "transition.preset",
      ),
      seconds: num(transition.seconds ?? 0.5, "transition.seconds", 0.1, 2),
      direction: choice(
        transition.direction ?? "left",
        ["left", "right", "up", "down"],
        "transition.direction",
      ),
      easing: choice(
        transition.easing ?? "ease-in-out",
        Object.keys(EASINGS) as Scene["transitionEasing"][],
        "transition.easing",
      ),
    },
    text: {
      source: choice(
        caption.source ?? "none",
        ["none", "filename", "static", "file"],
        "text.source",
      ),
      content: text(caption.content ?? "", "text.content", 2000),
      file: text(caption.file ?? "./captions.json", "text.file"),
      captions: Object.fromEntries(
        Object.entries(captions).map(([k, v]) => [
          text(k, "text.captions key", 500).normalize("NFC"),
          text(v, `text.captions.${k}`, 2000),
        ]),
      ),
      preset: choice(
        caption.preset ?? "subtitle",
        Object.keys(TEXT_PRESETS) as AutoConfig["text"]["preset"][],
        "text.preset",
      ),
      style: structuredClone(style) as Partial<TextLayer>,
    },
    look: {
      preset: choice(
        look.preset ?? (template === "warm-travel@1" ? "warm" : "natural"),
        ["natural", "warm", "cool", "mono", "vintage"],
        "look.preset",
      ),
      scene: scenePatch(look.scene ?? {}, "look.scene"),
    },
    overrides: overrides.map((v, i) => {
      const s = obj(v, `overrides[${i}]`);
      keys(s, ["file", "scene", "text", "textStyle"], `overrides[${i}]`);
      return {
        file: text(s.file, `overrides[${i}].file`, 500),
        scene: scenePatch(s.scene ?? {}, `overrides[${i}].scene`),
        ...(s.text === undefined
          ? {}
          : { text: text(s.text, `overrides[${i}].text`, 2000) }),
        ...(s.textStyle === undefined
          ? {}
          : {
              textStyle: parseAutoConfig({
                autoEditVersion: 1,
                text: { style: s.textStyle },
              }).text.style,
            }),
      };
    }),
  };
  if (![24, 25, 30, 60].includes(result.output.fps))
    throw Error("output.fps: chọn 24, 25, 30 hoặc 60.");
  if (!/^#[0-9a-f]{6}$/i.test(result.output.background))
    throw Error("output.background: cần màu #RRGGBB.");
  if (!/\.mp4$/i.test(result.output.file))
    throw Error("output.file: cần tên file .mp4.");
  if (
    new Set(Object.keys(captions).map((key) => key.normalize("NFC"))).size !==
    Object.keys(captions).length
  )
    throw Error("text.captions: tên ảnh bị trùng sau khi chuẩn hoá Unicode.");
  if (result.timing.mode === "per-image" && result.timing.seconds > 300)
    throw Error("timing.seconds: mỗi ảnh tối đa 300 giây.");
  if (result.timing.minSeconds > result.timing.maxSeconds)
    throw Error("timing.minSeconds phải nhỏ hơn hoặc bằng maxSeconds.");
  if (
    new Set(result.overrides.map((s) => s.file)).size !==
    result.overrides.length
  )
    throw Error("overrides: tên ảnh bị trùng.");
  return result;
}
export const defaultAutoConfig = (): AutoConfig =>
  parseAutoConfig({ autoEditVersion: 1 });

export function configFromScene(project: Project, scene: Scene): AutoConfig {
  const advanced = structuredClone(scene) as Partial<Scene>;
  delete advanced.voice;
  delete advanced.actors;
  delete advanced.actorsEdited;
  const subtitle = scene.texts.find((t) => t.captions);
  advanced.texts = advanced.texts?.filter((t) => !t.captions);
  const subtitleStyle = subtitle
    ? (structuredClone(subtitle) as Partial<TextLayer>)
    : undefined;
  if (subtitleStyle)
    for (const key of ["id", "text", "captions", "offset", "span"] as const)
      delete subtitleStyle[key];
  for (const key of [
    "id",
    "assetId",
    "duration",
    "fit",
    "focusX",
    "focusY",
    "motion",
    "motionAmount",
    "motionEasing",
    "transition",
    "transitionDuration",
    "transitionDirection",
    "transitionEasing",
    "filter",
  ] as const)
    delete advanced[key];
  return parseAutoConfig({
    autoEditVersion: 1,
    template: "story-clean@1",
    characters: project.automation?.config.characters ?? { enabled: false },
    output: {
      ratio: project.width < project.height ? "9:16" : "16:9",
      fps: project.fps,
      name: project.name,
      background: project.background,
    },
    timing: { mode: "per-image", seconds: scene.duration },
    narration: scene.voice
      ? { ...project.automation?.config.narration, enabled: true }
      : { enabled: false },
    framing: {
      fit: scene.fit,
      focus: { x: scene.focusX / 100, y: scene.focusY / 100 },
    },
    motion: {
      presets: [scene.motion],
      amount: scene.motionAmount,
      easing: scene.motionEasing,
    },
    transition: {
      preset: scene.transition,
      seconds: scene.transitionDuration,
      direction: scene.transitionDirection,
      easing: scene.transitionEasing,
    },
    look: {
      preset: scene.filter === "none" ? "natural" : scene.filter,
      scene: advanced,
    },
    text: {
      source: "none",
      ...(subtitleStyle ? { style: subtitleStyle } : {}),
    },
  });
}
