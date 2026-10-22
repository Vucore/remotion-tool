import {
  ACTIONS,
  RIG_PARTS,
  actorCapabilities,
  actorImages,
  type ActionKind,
  type ActorDefinition,
  type ActorImage,
  type ActorInstance,
  type ActorSettings,
  type ClipName,
  type RigLayer,
  type RigPart,
  type SpriteClip,
} from "./types";
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Dữ liệu nhân vật cần một object.");
  return v as Record<string, unknown>;
};
const num = (v: unknown, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`Giá trị nhân vật phải từ ${min} đến ${max}.`);
  return v;
};
const integer = (v: unknown, min: number, max: number) => {
  const n = num(v, min, max);
  if (!Number.isInteger(n)) throw Error("Cần số nguyên cho sprite/cue.");
  return n;
};
const text = (v: unknown, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("Tên/định danh nhân vật không hợp lệ.");
  return v;
};
function pick<T extends string>(v: unknown, values: readonly T[]): T {
  if (!values.includes(v as T))
    throw Error(`Lựa chọn nhân vật không hợp lệ: ${String(v)}.`);
  return v as T;
}
const bool = (v: unknown) => {
  if (typeof v !== "boolean")
    throw Error("Thiết lập nhân vật phải là true/false.");
  return v;
};
function list(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max)
    throw Error(`Danh sách nhân vật vượt giới hạn ${max}.`);
  return v;
}
function fields(o: Record<string, unknown>, allowed: string[]) {
  for (const k of Object.keys(o))
    if (!allowed.includes(k))
      throw Error(`Thiết lập nhân vật không hỗ trợ trường ${k}.`);
}

export function parseActorSettings(input: unknown): ActorSettings {
  const o = object(input ?? {});
  fields(o, [
    "enabled",
    "directories",
    "selected",
    "cast",
    "behavior",
    "layout",
    "size",
    "speaker",
    "entrance",
    "exit",
    "cues",
  ]);
  return {
    enabled: bool(o.enabled ?? false),
    directories: list(o.directories ?? ["./characters"], 20).map((p) =>
      text(p, 1000),
    ),
    selected: [...new Set(list(o.selected ?? [], 20).map((p) => text(p)))],
    cast: pick(o.cast ?? "rotate", ["rotate", "all", "first"]),
    behavior: pick(o.behavior ?? "gentle", ["gentle", "story", "energetic"]),
    layout: pick(o.layout ?? "auto", ["auto", "left", "right", "center"]),
    size: pick(o.size ?? "medium", ["small", "medium", "large"]),
    speaker: pick(o.speaker ?? "narrator", ["narrator", "first", "rotate"]),
    entrance: pick(o.entrance ?? "slide", ["slide", "fade", "pop", "none"]),
    exit: bool(o.exit ?? false),
    cues: list(o.cues ?? [], 1000).map((v) => {
      const c = object(v);
      fields(c, ["scene", "cue", "actor", "action"]);
      return {
        scene: integer(c.scene, 1, 300),
        cue: integer(c.cue, 1, 300),
        actor: text(c.actor),
        action: pick(c.action, Object.keys(ACTIONS) as ActionKind[]),
      };
    }),
  };
}
function image(input: unknown): ActorImage {
  const o = object(input),
    src = text(o.src, 200);
  if (!/^\/media\/[a-zA-Z0-9_-]+\.(png|webp)$/.test(src))
    throw Error("Ảnh nhân vật phải là PNG/WebP được nhập vào công cụ.");
  if (
    o.file !== undefined &&
    (typeof o.file !== "string" ||
      o.file.startsWith("/") ||
      o.file.split(/[\\/]/).includes(".."))
  )
    throw Error("Tên file nguồn nhân vật phải là đường dẫn tương đối.");
  return {
    id: text(o.id),
    name: text(o.name, 500),
    src,
    width: integer(o.width, 1, 30000),
    height: integer(o.height, 1, 30000),
    ...(o.file !== undefined ? { file: text(o.file, 1000) } : {}),
  };
}
export function parseActorLibrary(input: unknown): ActorDefinition[] {
  const actors = list(input ?? [], 20).map((v): ActorDefinition => {
    const o = object(v),
      base = {
        id: text(o.id),
        name: text(o.name),
        width: num(o.width, 1, 30000),
        height: num(o.height, 1, 30000),
      };
    if (o.kind === "cutout")
      return { ...base, kind: "cutout", image: image(o.image) };
    if (o.kind === "rig") {
      const source = object(o.parts),
        parts: Partial<Record<RigPart, RigLayer>> = {};
      fields(source, [...RIG_PARTS]);
      for (const [key, val] of Object.entries(source)) {
        const p = object(val);
        parts[key as RigPart] = {
          image: image(p.image),
          x: num(p.x, -100, 200),
          y: num(p.y, -100, 200),
          width: num(p.width, 0.1, 300),
          height: num(p.height, 0.1, 300),
          pivotX: num(p.pivotX, 0, 100),
          pivotY: num(p.pivotY, 0, 100),
          z: num(p.z, 0, 100),
        };
      }
      if (!parts.head || !parts.body)
        throw Error(`${base.name}: bộ phận cần ít nhất head.png và body.png.`);
      if (Boolean(parts.eyesOpen) !== Boolean(parts.eyesClosed))
        throw Error(
          `${base.name}: cần cả eyes_open và eyes_closed để chớp mắt.`,
        );
      if (Boolean(parts.mouthOpen) !== Boolean(parts.mouthClosed))
        throw Error(`${base.name}: cần cả mouth_open và mouth_closed để nói.`);
      return {
        ...base,
        kind: "rig",
        layout: pick(o.layout, ["canvas", "humanoid"]),
        parts,
      };
    }
    if (o.kind === "sprite") {
      const source = object(o.clips),
        clips: Partial<Record<ClipName, SpriteClip>> = {};
      fields(source, ["idle", "talk", ...Object.keys(ACTIONS)]);
      if (!Object.keys(source).length || Object.keys(source).length > 17)
        throw Error("Sprite cần 1–17 động tác.");
      for (const [key, val] of Object.entries(source)) {
        const c = object(val),
          images = list(c.images, 240).map(image);
        const columns = integer(c.columns, 1, 64),
          rows = integer(c.rows, 1, 64),
          count = integer(c.count, 1, 240),
          fps = num(c.fps, 1, 60);
        if (
          !images.length ||
          (images.length > 1 &&
            (columns !== 1 || rows !== 1 || images.length !== count))
        )
          throw Error("Chuỗi frame phải đủ số ảnh và dùng lưới 1×1.");
        if (
          images.length === 1 &&
          (count > columns * rows ||
            images[0].width % columns ||
            images[0].height % rows)
        )
          throw Error(
            "Kích thước sprite sheet không chia hết cho hàng/cột hoặc thiếu ô.",
          );
        const ratio = images[0].width / columns / (images[0].height / rows);
        if (Math.abs(ratio - base.width / base.height) > 0.001)
          throw Error(
            "Các clip sprite cần cùng tỷ lệ khung hình để đổi động tác không bị méo.",
          );
        if (
          images.some(
            (i) =>
              Math.abs(i.width / columns / (i.height / rows) - ratio) > 0.00001,
          )
        )
          throw Error("Các frame trong một động tác phải có cùng tỷ lệ.");
        clips[key as ClipName] = {
          images,
          columns,
          rows,
          count,
          fps,
          loop: bool(c.loop),
        };
      }
      return { ...base, kind: "sprite", clips };
    }
    throw Error("Loại nhân vật phải là cutout, rig hoặc sprite.");
  });
  if (new Set(actors.map((a) => a.id)).size !== actors.length)
    throw Error("ID bộ nhân vật bị trùng.");
  if (actors.reduce((sum, a) => sum + actorImages(a).length, 0) > 1200)
    throw Error("Thư viện nhân vật tối đa 1.200 ảnh/frame.");
  return actors;
}
export function parseActorInstances(
  input: unknown,
  library: ActorDefinition[],
  duration: number,
): ActorInstance[] {
  const items = list(input ?? [], 4).map((v) => {
    const o = object(v),
      actorId = text(o.actorId),
      actor = library.find((a) => a.id === actorId);
    if (!actor)
      throw Error("Cảnh tham chiếu bộ nhân vật chưa có trong thư viện.");
    const actions = list(o.actions, 100)
      .map((v) => {
        const a = object(v),
          kind = pick(a.kind, Object.keys(ACTIONS) as ActionKind[]),
          start = num(a.start, 0, duration),
          end = num(a.end, start, duration);
        if (end <= start || !actorCapabilities(actor).includes(kind))
          throw Error(
            `${actor.name}: động tác ${kind} không phù hợp tài nguyên hoặc thời gian.`,
          );
        return { kind, start, end, intensity: num(a.intensity, 0, 2) };
      })
      .sort((a, b) => a.start - b.start);
    if (actions.some((a, i) => i > 0 && a.start < actions[i - 1].end - 0.00001))
      throw Error("Hai động tác của cùng nhân vật không được chồng thời gian.");
    const from = num(o.from ?? 0, 0, duration),
      to =
        o.to === null || o.to === undefined ? null : num(o.to, from, duration);
    if ((to ?? duration) <= from)
      throw Error("Thời gian hiển thị vật thể phải dài hơn 0.");
    return {
      id: text(o.id),
      actorId,
      x: num(o.x, 0, 100),
      y: num(o.y, 0, 100),
      height: num(o.height, 0.1, 90),
      flip: bool(o.flip),
      z: num(o.z, 0, 100),
      speaking: bool(o.speaking),
      intensity: num(o.intensity, 0, 2),
      entrance: pick(o.entrance, ["slide", "fade", "pop", "none"]),
      exitStyle: pick(o.exitStyle ?? o.entrance, [
        "slide",
        "fade",
        "pop",
        "none",
      ]),
      from,
      to,
      manual: bool(o.manual ?? false),
      opacity: num(o.opacity ?? 1, 0, 1),
      shadow: num(o.shadow ?? 0, 0, 50),
      glow: num(o.glow ?? 0, 0, 50),
      actions,
    };
  });
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw Error("ID nhân vật trong cảnh bị trùng.");
  return items;
}
