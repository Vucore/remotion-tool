import { id, type Asset, type Project, type VoiceAsset } from "../model";
import { defaultActorImport } from "../actors/types";
import { uploadActorFiles } from "./actor-upload";
import { parseScript } from "../auto/narration";

export type ImportKind = "images" | "voices" | "script" | "characters";
export async function importStoryFiles(
  files: File[],
  previous: Project,
  kind: ImportKind,
  progress: (text: string) => void,
  appendImages = false,
) {
  files = files.filter(
    (f) =>
      !f.name.startsWith(".") &&
      !(f.webkitRelativePath || "").split("/").some((p) => p.startsWith(".")),
  );
  if (!files.length) throw Error("Chưa chọn tệp đầu vào.");
  if (kind !== "characters") {
    const extensions = {
      images: /\.(png|jpe?g|webp)$/i,
      voices: /\.(wav|mp3)$/i,
      script: /\.txt$/i,
    };
    const labels = {
      images: "Ô Ảnh chỉ nhận PNG, JPG hoặc WebP.",
      voices: "Ô Voice nhận file WAV hoặc MP3.",
      script: "Ô Lời đọc chỉ nhận một file TXT.",
    };
    if (files.some((f) => !extensions[kind].test(f.name)))
      throw Error(labels[kind]);
  }
  if (
    (kind === "images" || kind === "voices") &&
    files.length +
      (kind === "images" && appendImages ? previous.assets.length : 0) >
      300
  )
    throw Error("Mỗi bộ đầu vào tối đa 300 ảnh và 300 voice WAV/MP3.");
  if (kind === "images") {
    const names = [
      ...(appendImages ? previous.assets.map((a) => a.name) : []),
      ...files.map((f) => f.name),
    ].map((n) => n.normalize("NFC"));
    if (new Set(names).size !== names.length)
      throw Error(
        "Tên ảnh bị trùng. Đổi tên hoặc dùng Thay ảnh để thay cả bộ.",
      );
  }
  if (kind === "script" && files.length !== 1)
    throw Error("Chọn một TXT chứa toàn bộ lời đọc, chia theo mục 1., 2., 3.…");
  let script = "",
    scriptName = "";
  if (kind === "script") {
    if (files[0].size > 1_000_000)
      throw Error("TXT tối đa 1 MB, mã hoá UTF-8.");
    script = await files[0].text();
    parseScript(script);
    scriptName = files[0].name;
  }
  const assets: Asset[] = [],
    voices: VoiceAsset[] = [];
  let done = 0;
  if (kind === "images")
    for (const file of files) {
      progress("Đang nhập ảnh " + ++done + "/" + files.length + "…");
      if (file.size > 25 * 1024 * 1024)
        throw Error(file.name + ": ảnh tối đa 25 MB.");
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw Error(file.name + ": " + result.error);
      const image = new Image();
      image.src = result.src;
      await image.decode();
      if (image.naturalWidth > 30000 || image.naturalHeight > 30000)
        throw Error(file.name + ": ảnh tối đa 30.000px.");
      assets.push({
        id: id(),
        name: file.name,
        src: result.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    }
  if (kind === "voices")
    for (const file of files) {
      progress("Đang nhập voice " + ++done + "/" + files.length + "…");
      if (file.size > 100 * 1024 * 1024)
        throw Error(file.name + ": voice tối đa 100 MB.");
      const isMp3 = /\.mp3$/i.test(file.name);
      if (isMp3) progress("Đang đọc MP3 " + done + "/" + files.length + "…");
      const response = await fetch(
        "/api/voices?name=" + encodeURIComponent(file.name),
        {
          method: "POST",
          headers: { "Content-Type": isMp3 ? "audio/mpeg" : "audio/wav" },
          body: file,
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(file.name + ": " + result.error);
      voices.push(result);
    }
  if (kind === "characters") progress("Đang nhận diện bộ nhân vật…");
  const packs =
    kind === "characters"
      ? await uploadActorFiles(files, defaultActorImport())
      : undefined;
  const next: Project = {
    ...previous,
    assets:
      kind === "images"
        ? [...(appendImages ? previous.assets : []), ...assets]
        : previous.assets,
    scenes: [],
    actors: packs?.actors ?? previous.actors,
    voiceover: {
      ...(kind !== "voices" ? previous.voiceover : {}),
      assets: kind === "voices" ? voices : (previous.voiceover?.assets ?? []),
      script: kind === "script" ? script : (previous.voiceover?.script ?? ""),
      scriptName:
        kind === "script" ? scriptName : (previous.voiceover?.scriptName ?? ""),
    },
    automation: undefined,
  };
  return { project: next, warnings: packs?.warnings ?? [] };
}
