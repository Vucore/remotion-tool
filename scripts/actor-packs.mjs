import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildActorPacks } from "../dist/actors.mjs";
import { defaultActorImport, actorImages } from "../dist/actor-types.mjs";
import { imageInfo } from "./image-info.mjs";

export async function loadActorPacks(
  directories,
  { assetDirectory, signal } = {},
) {
  const images = [],
    manifests = [],
    resources = new Map(),
    manifest = [];
  await mkdir(assetDirectory, { recursive: true });
  for (const directory of directories) {
    const root = resolve(directory),
      prefix = basename(root);
    const visit = async (dir, depth = 0) => {
      if (signal?.aborted) throw Error("Đã huỷ nhập nhân vật.");
      if (depth > 6) throw Error("Thư mục nhân vật lồng quá 6 cấp.");
      for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
        (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      )) {
        const path = join(dir, entry.name),
          local = `${prefix}/${relative(root, path).replaceAll("\\", "/")}`;
        if (entry.isDirectory()) {
          await visit(path, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        if (/^character\.json$/i.test(entry.name)) {
          if ((await stat(path)).size > 1_000_000)
            throw Error(`${path}: character.json tối đa 1 MB.`);
          const content = await readFile(path, "utf8");
          manifests.push({ path: local, data: JSON.parse(content) });
          manifest.push({
            name: local,
            sha256: createHash("sha256").update(content).digest("hex"),
          });
        } else if (/\.(png|webp)$/i.test(entry.name)) {
          if (images.length >= 1200)
            throw Error("Tối đa 1.200 ảnh/frame trong thư viện nhân vật.");
          if ((await stat(path)).size > 25 * 1024 * 1024)
            throw Error(`${path}: ảnh tối đa 25 MB.`);
          const bytes = await readFile(path),
            info = imageInfo(bytes);
          if (!["png", "webp"].includes(info.ext))
            throw Error(`${path}: nhân vật cần PNG/WebP.`);
          const digest = createHash("sha256").update(bytes).digest("hex"),
            file = `${digest}.${info.ext}`,
            src = `/media/${file}`,
            stored = join(assetDirectory, file);
          await writeFile(stored, bytes);
          resources.set(src, stored);
          images.push({
            id: `actor-image-${digest.slice(0, 20)}`,
            name: entry.name,
            path: local,
            src,
            width: info.width,
            height: info.height,
          });
          manifest.push({ name: local, sha256: digest });
        }
      }
    };
    await visit(root);
  }
  const result = buildActorPacks(images, defaultActorImport(), manifests);
  const used = new Set(result.actors.flatMap(actorImages).map((i) => i.src));
  return {
    ...result,
    manifest,
    resources: new Map([...resources].filter(([src]) => used.has(src))),
  };
}
