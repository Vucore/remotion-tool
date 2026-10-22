import {
  buildActorPacks,
  type PackManifest,
  type SourceImage,
} from "../actors/import";
import type { ActorImportOptions } from "../actors/types";

export async function uploadActorFiles(
  files: File[],
  options: ActorImportOptions,
) {
  const sources: SourceImage[] = [],
    manifests: PackManifest[] = [];
  const images = files.filter((f) => /\.(png|webp)$/i.test(f.name));
  if (!images.length || images.length > 1200)
    throw Error("Chọn 1–1.200 ảnh PNG/WebP cho bộ nhân vật.");
  for (const file of files.filter((f) => /^character\.json$/i.test(f.name))) {
    if (file.size > 1_000_000) throw Error("character.json tối đa 1 MB.");
    manifests.push({
      path: file.webkitRelativePath || file.name,
      data: JSON.parse(await file.text()),
    });
  }
  for (const file of images) {
    if (file.size > 25 * 1024 * 1024)
      throw Error(`${file.name}: tối đa 25 MB mỗi ảnh/frame.`);
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    const result = await response.json();
    if (!response.ok) throw Error(`${file.name}: ${result.error}`);
    const image = new Image();
    image.src = result.src;
    await image.decode();
    if (image.naturalWidth > 30000 || image.naturalHeight > 30000)
      throw Error(`${file.name}: kích thước quá 30.000px.`);
    sources.push({
      id: `actor-image-${result.src.split("/").at(-1)!.split(".")[0]}`,
      name: file.name,
      path: file.webkitRelativePath || file.name,
      src: result.src,
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
  }
  return buildActorPacks(sources, options, manifests);
}
