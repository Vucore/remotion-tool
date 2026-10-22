import {
  actorHash,
  defaultActorImport,
  RIG_PARTS,
  type ActorDefinition,
  type ActorImage,
  type ActorImportOptions,
  type ClipName,
  type RigLayer,
  type RigPart,
  type SpriteClip,
} from "./types";
import { parseActorLibrary } from "./schema";

export type SourceImage = ActorImage & { path: string };
export type PackManifest = { path: string; data: unknown };
const clean = (s: string) => s.replace(/\\/g, "/").replace(/^\.\//, "");
const stem = (s: string) =>
  s
    .split("/")
    .at(-1)!
    .replace(/\.[^.]+$/, "");
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const partNames: Record<string, RigPart> = {
  head: "head",
  dau: "head",
  body: "body",
  than: "body",
  torso: "body",
  armleft: "armLeft",
  leftarm: "armLeft",
  taytrai: "armLeft",
  armright: "armRight",
  rightarm: "armRight",
  tayphai: "armRight",
  legleft: "legLeft",
  leftleg: "legLeft",
  chantrai: "legLeft",
  legright: "legRight",
  rightleg: "legRight",
  chanphai: "legRight",
  eyesopen: "eyesOpen",
  eyes: "eyesOpen",
  matmo: "eyesOpen",
  eyesclosed: "eyesClosed",
  matnham: "eyesClosed",
  mouthclosed: "mouthClosed",
  miengdong: "mouthClosed",
  mouthopen: "mouthOpen",
  miengmo: "mouthOpen",
};
const clipNames: Record<string, ClipName> = {
  idle: "idle",
  dung: "idle",
  stand: "idle",
  talk: "talk",
  talking: "talk",
  noi: "talk",
  walk: "walk",
  walking: "walk",
  dibo: "walk",
  run: "run",
  running: "run",
  chay: "run",
  wave: "wave",
  vaytay: "wave",
  point: "point",
  chitay: "point",
  nod: "nod",
  gatdau: "nod",
  jump: "jump",
  nhay: "jump",
  happy: "happy",
  vui: "happy",
  surprised: "surprised",
  giatminh: "surprised",
  shake: "shake",
  lac: "shake",
  float: "float",
  bay: "float",
  spin: "spin",
  xoay: "spin",
  enter: "enter",
  exit: "exit",
  sway: "sway",
  move: "move",
};
export const isActorPath = (path: string) =>
  clean(path)
    .split("/")
    .some((p) =>
      ["character", "characters", "actor", "actors", "nhanvat"].includes(
        key(p),
      ),
    );
const imageOnly = (image: SourceImage): ActorImage => ({
  id: image.id,
  name: image.name,
  src: image.src,
  width: image.width,
  height: image.height,
  file: image.file ?? image.name,
});
function clipFor(path: string): ClipName | undefined {
  const name = stem(path)
    .replace(/[_-]\d+x\d+(?:[_-]\d+(?:\.\d+)?fps)?$/i, "")
    .replace(/[_-]\d+$/, "");
  return (
    clipNames[key(name)] ?? clipNames[key(clean(path).split("/").at(-2) ?? "")]
  );
}
function numberSort(a: SourceImage, b: SourceImage) {
  const x = a.path.match(/\d+/g)?.at(-1),
    y = b.path.match(/\d+/g)?.at(-1);
  return (
    (x && y ? Number(x) - Number(y) : 0) ||
    (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  );
}
const placements: Record<
  RigPart,
  [number, number, number, number, number, number, number]
> = {
  head: [32, 0, 36, 33, 50, 95, 40],
  body: [33, 29, 34, 39, 50, 85, 30],
  armLeft: [17, 31, 18, 37, 65, 8, 20],
  armRight: [65, 31, 18, 37, 35, 8, 20],
  legLeft: [34, 64, 15, 36, 50, 5, 10],
  legRight: [51, 64, 15, 36, 50, 5, 10],
  eyesOpen: [39, 11, 22, 7, 50, 50, 50],
  eyesClosed: [39, 11, 22, 7, 50, 50, 50],
  mouthClosed: [43, 22, 14, 6, 50, 50, 60],
  mouthOpen: [43, 22, 14, 6, 50, 50, 60],
};
const canvasPivots: Partial<Record<RigPart, [number, number]>> = {
  head: [50, 31],
  armLeft: [33, 34],
  armRight: [67, 34],
  legLeft: [42, 65],
  legRight: [58, 65],
  body: [50, 65],
};
function rigLayer(part: RigPart, image: ActorImage, canvas: boolean): RigLayer {
  const [x, y, width, height, pivotX, pivotY, z] = placements[part];
  return canvas
    ? {
        image,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        pivotX: canvasPivots[part]?.[0] ?? 50,
        pivotY: canvasPivots[part]?.[1] ?? 50,
        z,
      }
    : { image, x, y, width, height, pivotX, pivotY, z };
}

export function buildActorPacks(
  sources: SourceImage[],
  options: ActorImportOptions = defaultActorImport(),
  manifests: PackManifest[] = [],
): { actors: ActorDefinition[]; warnings: string[] } {
  if (!sources.length || sources.length > 1200)
    throw Error("Bộ nhân vật cần 1–1.200 ảnh PNG/WebP.");
  const images = sources.map((s) => ({ ...s, path: clean(s.path) }));
  if (new Set(images.map((i) => i.path)).size !== images.length)
    throw Error(
      "Hai tài nguyên nhân vật trùng đường dẫn. Hãy chọn thư mục hoặc đổi tên file.",
    );
  // A descriptor owns its entire directory, including nested part/frame folders.
  if (manifests.length) {
    const claimed = new Set<string>(),
      declared: ActorDefinition[] = [];
    for (const manifest of manifests) {
      const folder = clean(manifest.path).replace(/[^/]+$/, "");
      const files = images.filter((i) => i.path.startsWith(folder));
      if (!files.length)
        throw Error(`${manifest.path}: không có PNG/WebP trong thư mục bộ.`);
      if (files.some((i) => claimed.has(i.path)))
        throw Error(
          "Không đặt character.json lồng trong một bộ đã có character.json.",
        );
      files.forEach((i) => claimed.add(i.path));
      declared.push(fromManifest(files, manifest));
    }
    const remaining = images.filter((i) => !claimed.has(i.path));
    const inferred = remaining.length
      ? buildActorPacks(remaining, options)
      : { actors: [], warnings: [] };
    return {
      actors: parseActorLibrary([...declared, ...inferred.actors]),
      warnings: inferred.warnings,
    };
  }
  const dirs = images.map((i) => i.path.split("/").slice(0, -1));
  let shared = 0;
  while (
    dirs.every((d) => d[shared] !== undefined && d[shared] === dirs[0][shared])
  )
    shared++;
  const root = dirs[0].slice(0, shared).join("/");
  const rootNames = root.split("/").filter(Boolean);
  let folderName = rootNames.at(-1) ?? "";
  if (clipNames[key(folderName)]) folderName = rootNames.at(-2) ?? "";
  if (
    ["characters", "character", "actors", "actor", "nhanvat"].includes(
      key(folderName),
    )
  )
    folderName = "";
  const relative = (path: string) =>
    root ? path.slice(root.length + 1) : path;
  const children = [
    ...new Set(
      images
        .map((i) => relative(i.path).split("/")[0])
        .filter((p) => !/\.[^.]+$/.test(p)),
    ),
  ];
  const nestedPacks =
    children.length > 0 && children.every((c) => !clipNames[key(c)]);
  const groups = nestedPacks
    ? children.map((child) => ({
        name: child,
        images: images.filter((i) => relative(i.path).startsWith(`${child}/`)),
      }))
    : [{ name: options.name || folderName || stem(images[0].name), images }];
  if (nestedPacks) {
    const rootImages = images.filter((i) => !relative(i.path).includes("/"));
    if (rootImages.length)
      groups.push({
        name: options.name || folderName || stem(rootImages[0].name),
        images: rootImages,
      });
  }
  const warnings: string[] = [],
    actors: ActorDefinition[] = [];
  for (const group of groups) {
    const groupDirs = group.images.map((i) => i.path.split("/").slice(0, -1));
    let common = 0;
    while (
      groupDirs.every(
        (d) => d[common] !== undefined && d[common] === groupDirs[0][common],
      )
    )
      common++;
    if (clipNames[key(groupDirs[0][common - 1] ?? "")]) common--;
    const prefixLength =
      common > 0 ? groupDirs[0].slice(0, common).join("/").length + 1 : 0;
    group.images = group.images.map((i) => ({
      ...i,
      file: i.path.slice(prefixLength),
    }));
    const manifest = manifests.find((m) =>
      group.images.every((i) =>
        i.path.startsWith(clean(m.path).replace(/[^/]+$/, "")),
      ),
    );
    const partsDetected = group.images.filter(
      (i) => partNames[key(stem(i.name))],
    );
    const isRig =
      partsDetected.some((i) => partNames[key(stem(i.name))] === "head") &&
      partsDetected.some((i) => partNames[key(stem(i.name))] === "body");
    const spriteDetected =
      group.images.some(
        (i) => /[_-]\d+x\d+/i.test(stem(i.name)) || clipFor(i.path),
      ) ||
      (group.images.length > 1 &&
        group.images.every((i) => /^(?:frame[_-]?)?\d+$/i.test(stem(i.name))));
    const kind =
      options.kind === "auto"
        ? isRig
          ? "rig"
          : spriteDetected
            ? "sprite"
            : "cutout"
        : options.kind;
    if (manifest) actors.push(fromManifest(group.images, manifest));
    else if (kind === "cutout")
      for (const image of group.images) {
        const name = group.images.length === 1 ? group.name : stem(image.name);
        actors.push({
          id: `actor-${actorHash(`${name}:cutout`)}`,
          name,
          kind: "cutout",
          image: imageOnly(image),
          width: image.width,
          height: image.height,
        });
      }
    else if (kind === "rig") {
      const sameSize = group.images.every(
        (i) =>
          i.width === group.images[0].width &&
          i.height === group.images[0].height,
      );
      const canvas =
        options.rigLayout === "canvas" ||
        (options.rigLayout === "auto" && sameSize);
      const parts: Partial<Record<RigPart, RigLayer>> = {};
      for (const image of group.images) {
        const part = partNames[key(stem(image.name))];
        if (!part) {
          warnings.push(
            `${group.name}: bỏ qua ảnh không nhận ra bộ phận “${image.name}”.`,
          );
          continue;
        }
        if (parts[part])
          throw Error(`${group.name}: có hai ảnh cho bộ phận ${part}.`);
        parts[part] = rigLayer(part, imageOnly(image), canvas);
      }
      actors.push({
        id: `actor-${actorHash(`${group.name}:rig`)}`,
        name: group.name,
        kind: "rig",
        layout: canvas ? "canvas" : "humanoid",
        width: canvas ? group.images[0].width : 1000,
        height: canvas ? group.images[0].height : 1600,
        parts,
      });
    } else {
      const grouped = new Map<ClipName, SourceImage[]>();
      for (const image of group.images) {
        const clip = clipFor(image.path) ?? "idle";
        grouped.set(clip, [...(grouped.get(clip) ?? []), image]);
      }
      const clips: Partial<Record<ClipName, SpriteClip>> = {};
      for (const [name, files] of grouped) {
        const grid = stem(files[0].name).match(
          /[_-](\d+)x(\d+)(?:[_-](\d+(?:\.\d+)?)fps)?$/i,
        );
        const sheet = files.length === 1 && (grid || options.kind === "sprite");
        if (
          files.length > 1 &&
          files.some((i) => /[_-]\d+x\d+/i.test(stem(i.name)))
        )
          throw Error(
            `${group.name}/${name}: chỉ một sheet cho mỗi động tác; không trộn sheet với chuỗi frame.`,
          );
        const columns = sheet ? Number(grid?.[1] ?? options.columns) : 1,
          rows = sheet ? Number(grid?.[2] ?? options.rows) : 1;
        clips[name] = {
          images: files.sort(numberSort).map(imageOnly),
          columns,
          rows,
          count: sheet ? options.frameCount || columns * rows : files.length,
          fps: Number(grid?.[3] ?? options.fps),
          loop: ![
            "wave",
            "nod",
            "point",
            "jump",
            "surprised",
            "enter",
            "exit",
          ].includes(name),
        };
      }
      const first = clips.idle ?? Object.values(clips)[0]!;
      actors.push({
        id: `actor-${actorHash(`${group.name}:sprite`)}`,
        name: group.name,
        kind: "sprite",
        width: first.images[0].width / first.columns,
        height: first.images[0].height / first.rows,
        clips,
      });
    }
  }
  return { actors: parseActorLibrary(actors), warnings };
}

function fromManifest(
  images: SourceImage[],
  manifest: PackManifest,
): ActorDefinition {
  if (!manifest.data || typeof manifest.data !== "object")
    throw Error("character.json không hợp lệ.");
  const data = manifest.data as Record<string, unknown>;
  if (data.actorPackVersion !== 1 || typeof data.name !== "string")
    throw Error("character.json cần actorPackVersion: 1 và name.");
  const folder = clean(manifest.path).replace(/[^/]+$/, "");
  const findImage = (file: unknown) => {
    if (typeof file !== "string" || clean(file).split("/").includes(".."))
      throw Error("Đường dẫn ảnh trong character.json không hợp lệ.");
    const found = images.find((i) => i.path === folder + clean(file));
    if (!found)
      throw Error(`character.json: thiếu tài nguyên ${String(file)}.`);
    return { ...imageOnly(found), file: clean(file) };
  };
  const id = `actor-${actorHash(`${data.name}:${data.kind}`)}`;
  if (data.kind === "cutout") {
    const image = findImage(data.file);
    return parseActorLibrary([
      {
        id,
        name: data.name,
        kind: "cutout",
        image,
        width: image.width,
        height: image.height,
      },
    ])[0];
  }
  if (data.kind === "rig") {
    const parts: Partial<Record<RigPart, RigLayer>> = {};
    if (!data.parts || typeof data.parts !== "object")
      throw Error("character.json: thiếu parts.");
    for (const [key, value] of Object.entries(data.parts)) {
      if (
        !RIG_PARTS.includes(key as RigPart) ||
        !value ||
        typeof value !== "object"
      )
        throw Error(`Bộ phận không hỗ trợ: ${key}.`);
      const p = value as Record<string, unknown>,
        image = findImage(p.file);
      const placement = Object.fromEntries(
        Object.entries(p).filter(([key]) => key !== "file"),
      );
      parts[key as RigPart] = {
        ...rigLayer(key as RigPart, image, data.layout === "canvas"),
        ...placement,
        image,
      };
    }
    return parseActorLibrary([
      {
        id,
        name: data.name,
        kind: "rig",
        layout: data.layout ?? "humanoid",
        width: data.width ?? 1000,
        height: data.height ?? 1600,
        parts,
      },
    ])[0];
  }
  if (data.kind === "sprite") {
    if (!data.clips || typeof data.clips !== "object")
      throw Error("character.json: thiếu clips.");
    const clips: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(data.clips)) {
      const c = value as Record<string, unknown>;
      if (!c || typeof c !== "object")
        throw Error("Động tác sprite không hợp lệ.");
      const files = c.files ?? (c.file ? [c.file] : []);
      if (!Array.isArray(files) || !files.length)
        throw Error(`${name}: cần file hoặc files.`);
      const columns = c.columns ?? 1,
        rows = c.rows ?? 1;
      clips[name] = {
        images: files.map(findImage),
        columns,
        rows,
        count:
          c.count ??
          (files.length > 1 ? files.length : Number(columns) * Number(rows)),
        fps: c.fps ?? 12,
        loop: c.loop ?? true,
      };
    }
    const first = Object.values(clips)[0] as SpriteClip | undefined;
    return parseActorLibrary([
      {
        id,
        name: data.name,
        kind: "sprite",
        width:
          data.width ?? (first ? first.images[0].width / first.columns : 1),
        height:
          data.height ?? (first ? first.images[0].height / first.rows : 1),
        clips,
      },
    ])[0];
  }
  throw Error("character.json: loại tài nguyên không hỗ trợ.");
}

// Generated by the UI for reusable packs; users do not have to author this JSON.
export function actorDescriptor(actor: ActorDefinition) {
  const base = {
    actorPackVersion: 1,
    name: actor.name,
    kind: actor.kind,
    width: actor.width,
    height: actor.height,
  };
  if (actor.kind === "cutout")
    return { ...base, file: actor.image.file ?? actor.image.name };
  if (actor.kind === "rig")
    return {
      ...base,
      layout: actor.layout,
      parts: Object.fromEntries(
        Object.entries(actor.parts).map(([part, layer]) => {
          const { image, ...placement } = layer!;
          return [part, { file: image.file ?? image.name, ...placement }];
        }),
      ),
    };
  return {
    ...base,
    clips: Object.fromEntries(
      Object.entries(actor.clips).map(([name, clip]) => [
        name,
        {
          files: clip!.images.map((i) => i.file ?? i.name),
          columns: clip!.columns,
          rows: clip!.rows,
          count: clip!.count,
          fps: clip!.fps,
          loop: clip!.loop,
        },
      ]),
    ),
  };
}
