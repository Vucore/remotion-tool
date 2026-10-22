import {
  emptyProject,
  makeScene,
  makeText,
  parseProject,
  totalFrames,
  type Asset,
  type Project,
  type Scene,
  type Voiceover,
} from "../model";
import { parseAutoConfig, type AutoConfig } from "./config";
import { textTemplate } from "../text-template";
import { makeEffect, EFFECT_MAP, effectFields } from "../effects/catalog";
import {
  pairNarration,
  parseCaptions,
  splitSentences,
  type VoiceAlignment,
} from "./narration";
import type { ActorDefinition } from "../actors/types";
import { parseActorLibrary } from "../actors/schema";
import { planActors } from "../actors/plan";

export function hash(value: string): string {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++)
    n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16).padStart(8, "0");
}
export function compareNames(a: string, b: string): number {
  const aa =
      a
        .normalize("NFC")
        .toLowerCase()
        .match(/\d+|\D+/g) ?? [],
    bb =
      b
        .normalize("NFC")
        .toLowerCase()
        .match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    if (aa[i] === bb[i]) continue;
    if (/^\d+$/.test(aa[i]) && /^\d+$/.test(bb[i])) {
      const x = aa[i].replace(/^0+/, "") || "0",
        y = bb[i].replace(/^0+/, "") || "0";
      if (x.length !== y.length) return x.length - y.length;
      if (x !== y) return x < y ? -1 : 1;
    } else return aa[i] < bb[i] ? -1 : 1;
  }
  return aa.length - bb.length || (a < b ? -1 : a > b ? 1 : 0);
}
export type AutoReport = {
  version: 1;
  template: string;
  seed: number;
  frames: number;
  seconds: number;
  sceneCount: number;
  warnings: string[];
  files: string[];
};
export function compileAuto(
  input: unknown,
  assets: Asset[],
  previous?: Project,
  keepLocks = true,
  narration?: { input: Voiceover; alignments: VoiceAlignment[] },
  actorLibrary: ActorDefinition[] = previous?.actors ?? [],
): { project: Project; report: AutoReport } {
  const config = parseAutoConfig(input),
    fps = config.output.fps;
  if (config.narration.enabled && !narration)
    throw Error(
      "Cần bộ WAV + script.txt và căn câu trước khi dựng video có voice.",
    );
  const pairs =
    config.narration.enabled && narration
      ? pairNarration(assets, narration.input)
      : undefined;
  if (!assets.length || assets.length > 300)
    throw Error("Bộ ảnh cần từ 1 đến 300 ảnh.");
  const names = assets.map((a) => a.name.normalize("NFC"));
  if (new Set(names).size !== names.length)
    throw Error(
      "Bộ ảnh có tên trùng. Đổi tên ảnh để config xác định đúng từng ảnh.",
    );
  const ordered = pairs ? pairs.map((p) => p.image) : [...assets];
  if (!pairs && config.input.order !== "input")
    ordered.sort((a, b) =>
      config.input.order === "natural"
        ? compareNames(a.name, b.name)
        : a.name < b.name
          ? -1
          : a.name > b.name
            ? 1
            : 0,
    );
  for (const override of config.overrides)
    if (!names.includes(override.file.normalize("NFC")))
      throw Error(`overrides: không tìm thấy ảnh “${override.file}”.`);
  const lockSet = new Set(keepLocks ? (previous?.automation?.locks ?? []) : []);
  const warnings: string[] = [];
  const fixed = new Set<string>();
  let previousMotion: Scene["motion"] | undefined;
  const scenes = ordered.map((asset, index) => {
    const sceneId = `auto-${hash(asset.name.normalize("NFC"))}`;
    const old = previous?.scenes.find((s) => s.id === sceneId);
    if (old && lockSet.has(sceneId)) {
      fixed.add(sceneId);
      previousMotion = old.motion;
      return { ...structuredClone(old), assetId: asset.id };
    }
    const override = config.overrides.find(
      (o) => o.file.normalize("NFC") === asset.name.normalize("NFC"),
    );
    if (
      override?.scene.duration !== undefined ||
      config.look.scene.duration !== undefined
    )
      fixed.add(sceneId);
    let motion = config.motion.presets[index % config.motion.presets.length];
    if (config.motion.policy === "seeded") {
      const candidates = config.motion.presets.filter(
        (p) => p !== previousMotion,
      );
      motion =
        candidates[
          Number.parseInt(hash(`${config.seed}:${index}`), 16) %
            candidates.length
        ] ?? motion;
    }
    const scene: Scene = {
      ...makeScene(asset.id),
      id: sceneId,
      duration:
        config.timing.mode === "per-image"
          ? Math.round(config.timing.seconds * fps) / fps
          : config.timing.minSeconds,
      fit: config.framing.fit,
      focusX: config.framing.focus.x * 100,
      focusY: config.framing.focus.y * 100,
      x: 0,
      y: 0,
      motion,
      motionAmount: config.motion.amount,
      motionEasing: config.motion.easing,
      transition: config.transition.preset,
      transitionDuration: config.transition.seconds,
      transitionDirection: config.transition.direction,
      transitionEasing: config.transition.easing,
      filter: config.look.preset === "natural" ? "none" : config.look.preset,
      ...structuredClone(config.look.scene),
      ...structuredClone(override?.scene ?? {}),
    };
    previousMotion = scene.motion;
    for (const key of ["texts", "effects", "overlays", "keyframes"] as const)
      if (!Array.isArray(scene[key]))
        throw Error(`${asset.name}: ${key} phải là một danh sách.`);
    scene.texts = scene.texts.map((t) => ({ ...makeText(), ...t }));
    scene.effects = scene.effects.map((effect) => {
      const defaults = makeEffect(effect.kind);
      const params = { ...defaults.params, ...effect.params };
      const fields = effectFields(EFFECT_MAP[effect.kind], params);
      for (const key of Object.keys(defaults.params))
        if (!(key in fields) && !(key in (effect.params ?? {})))
          delete params[key];
      return {
        ...defaults,
        ...effect,
        params,
      };
    });
    scene.overlays = scene.overlays.map((layer, i) => ({
      enabled: true,
      amount: 0.4,
      color: "#ffffff",
      speed: 1,
      size: 1,
      seed: (config.seed + i) % 100000,
      start: 0,
      end: null,
      offset: 0,
      ...(layer as Partial<typeof layer>),
      kind: layer.kind,
      id: layer.id,
    }));
    const caption = pairs
      ? ""
      : (override?.text ?? captionFor(config, asset.name));
    if (caption)
      scene.texts = [
        {
          ...makeText(),
          ...textTemplate(config.text.preset),
          ...structuredClone(config.text.style),
          id: `${sceneId}-text`,
          text: caption,
          width: config.text.style.width ?? 84,
        },
      ];
    for (const [kind, layers] of Object.entries({
      texts: scene.texts,
      effects: scene.effects,
      overlays: scene.overlays,
    }))
      layers.forEach((layer, i) => {
        layer.id = `${sceneId}-${kind}-${i}`;
      });
    return scene;
  });
  // Manually duplicated or split scenes can be retained explicitly as well.
  for (const scene of previous?.scenes ?? [])
    if (lockSet.has(scene.id) && !scenes.some((s) => s.id === scene.id)) {
      if (pairs) {
        warnings.push(
          "Bản dựng voice chỉ giữ một cảnh cho mỗi bộ ảnh/WAV/TXT; cảnh thêm/chia thủ công không được đưa vào bản dựng mới.",
        );
        continue;
      }
      if (!assets.some((a) => a.id === scene.assetId))
        throw Error(
          "Một cảnh đang giữ dùng ảnh ngoài bộ ảnh. Bỏ giữ hoặc thêm lại ảnh trước khi dựng.",
        );
      scenes.push(structuredClone(scene));
      fixed.add(scene.id);
    }
  if (scenes.length > 300)
    throw Error("Bản dựng vượt quá 300 cảnh, kể cả cảnh đang giữ.");
  if (pairs && narration) {
    if (
      narration.alignments.length !== pairs.length ||
      new Set(narration.alignments.map((a) => a.voiceId)).size !== pairs.length
    )
      throw Error("Kết quả căn câu thiếu hoặc trùng WAV.");
    scenes.forEach((scene, index) => {
      const pair = pairs[index];
      const aligned = narration.alignments.find(
        (a) => a.voiceId === pair.voice.id,
      );
      const captions = parseCaptions(aligned?.captions, pair.voice.duration);
      const expected = splitSentences(pair.text, config.narration.maxChars);
      if (
        expected.length !== captions.length ||
        captions.some((c, i) => c.text !== expected[i])
      )
        throw Error(
          `${pair.voice.name}: kết quả phụ đề không khớp TXT. Hãy căn lại.`,
        );
      const oldStyle = scene.texts.find((t) => t.captions);
      scene.duration = Math.ceil(pair.voice.duration * fps - 1e-8) / fps;
      scene.voice = { assetId: pair.voice.id, duration: pair.voice.duration };
      scene.texts = [
        ...scene.texts.filter((t) => !t.captions),
        {
          ...makeText(),
          ...textTemplate(config.text.preset),
          animationIn: "none",
          animationOut: "none",
          ...structuredClone(config.text.style),
          ...(oldStyle && lockSet.has(scene.id) ? oldStyle : {}),
          id: `${scene.id}-voice-caption`,
          name: "Phụ đề theo voice",
          text: captions[0].text,
          start: 0,
          end: null,
          offset: 0,
          span: null,
          captions,
        },
      ];
    });
    warnings.push(
      "Thời lượng và text lấy từ WAV/TXT; timing, duration override và nội dung text thông thường không áp dụng. Cảnh giữ vẫn được cập nhật voice/phụ đề.",
    );
  } else {
    for (const scene of scenes) {
      delete scene.voice;
      scene.texts = scene.texts.filter((t) => !t.captions);
    }
  }
  const base: Project = {
    ...emptyProject(),
    name: config.output.name,
    width: config.output.ratio === "9:16" ? 1080 : 1920,
    height: config.output.ratio === "9:16" ? 1920 : 1080,
    fps,
    background: config.output.background,
    assets: ordered,
    scenes,
    fonts: previous?.fonts ?? [],
    actors: parseActorLibrary(actorLibrary),
    ...(pairs && narration
      ? { voiceover: structuredClone(narration.input) }
      : previous?.voiceover
        ? { voiceover: structuredClone(previous.voiceover) }
        : {}),
  };
  if (!pairs && config.timing.mode === "total")
    fitTotal(base, config, fixed, lockSet, warnings);
  warnings.push(...planActors(base, config.characters, config.seed, lockSet));
  for (const scene of scenes)
    if (scene.duration * fps < 1) throw Error("Thời lượng cảnh quá ngắn.");
  base.automation = {
    config,
    locks: scenes.filter((s) => lockSet.has(s.id)).map((s) => s.id),
  };
  let project: Project;
  try {
    project = parseProject(base);
  } catch (error) {
    throw Error(
      `Không tạo được bản dựng: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    project,
    report: {
      version: 1,
      template: config.template,
      seed: config.seed,
      frames: totalFrames(project),
      seconds: totalFrames(project) / fps,
      sceneCount: scenes.length,
      warnings,
      files: ordered.map((a) => a.name),
    },
  };
}
function captionFor(config: AutoConfig, name: string) {
  if (config.text.source === "none") return "";
  if (config.text.source === "filename")
    return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  if (config.text.source === "static") return config.text.content;
  if (!(name.normalize("NFC") in config.text.captions))
    throw Error(
      `text.captions: thiếu nội dung cho ảnh “${name}”. Nạp ${config.text.file} hoặc dùng source: none.`,
    );
  return config.text.captions[name.normalize("NFC")];
}
function fitTotal(
  project: Project,
  config: AutoConfig,
  fixed: Set<string>,
  locks: Set<string>,
  warnings: string[],
) {
  const fps = project.fps,
    target = Math.round(config.timing.seconds * fps),
    scenes = project.scenes;
  const lower = scenes.map((s) =>
    fixed.has(s.id)
      ? Math.round(s.duration * fps)
      : Math.ceil(config.timing.minSeconds * fps),
  );
  const upper = scenes.map((s) =>
    fixed.has(s.id)
      ? Math.round(s.duration * fps)
      : Math.floor(config.timing.maxSeconds * fps),
  );
  // Retain a locked outgoing transition without allowing its overlap to grow during allocation.
  for (let i = 1; i < scenes.length; i++)
    if (
      locks.has(scenes[i - 1].id) &&
      !fixed.has(scenes[i].id) &&
      scenes[i - 1].transition !== "none"
    )
      lower[i] = Math.max(
        lower[i],
        Math.min(
          upper[i],
          2 *
            Math.min(
              Math.round(scenes[i - 1].transitionDuration * fps),
              Math.floor(lower[i - 1] / 2),
            ),
        ),
      );
  const overlaps = scenes.slice(0, -1).map((s, i) => {
    if (s.transition === "none") return 0;
    const desired = Math.round(s.transitionDuration * fps),
      frames = Math.min(
        desired,
        Math.floor(lower[i] / 2),
        Math.floor(lower[i + 1] / 2),
      );
    if (!locks.has(s.id)) {
      s.transitionDuration = frames / fps;
      if (frames !== desired)
        warnings.push(
          `Cảnh ${i + 1}: nối cảnh rút còn ${(frames / fps).toFixed(2)}s theo thời lượng cảnh tối thiểu.`,
        );
    }
    return frames;
  });
  const overlap = overlaps.reduce((a, b) => a + b, 0),
    min = lower.reduce((a, b) => a + b, 0) - overlap,
    max = upper.reduce((a, b) => a + b, 0) - overlap;
  if (target < min || target > max)
    throw Error(
      `timing.seconds: không đạt ${target / fps}s với giới hạn/cảnh đang giữ. Khoảng khả thi: ${min / fps}–${max / fps}s.`,
    );
  const frames = [...lower];
  let remaining = target + overlap - frames.reduce((a, b) => a + b, 0);
  while (remaining > 0) {
    const active = frames.map((_, i) => i).filter((i) => frames[i] < upper[i]);
    if (!active.length) throw Error("Không phân bổ được thời lượng yêu cầu.");
    const increment = Math.max(1, Math.floor(remaining / active.length));
    for (const i of active) {
      const add = Math.min(increment, upper[i] - frames[i], remaining);
      frames[i] += add;
      remaining -= add;
      if (!remaining) break;
    }
  }
  scenes.forEach((s, i) => {
    s.duration = frames[i] / fps;
  });
  if (totalFrames(project) !== target)
    throw Error(
      "Không đạt tổng thời lượng khi giữ chuyển cảnh. Bỏ giữ cảnh hoặc tăng minSeconds rồi thử lại.",
    );
}
