import { projectHeaders } from "./workspace-storage";
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
  onPartial?: (project: Project) => void,
  signal?: AbortSignal,
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
  const warnings: string[] = [];
  let done = 0,
    cursor = 0;
  const snapshot = (): Project => ({
    ...previous,
    scenes: [],
    automation: undefined,
    assets:
      kind === "images"
        ? [...(appendImages ? previous.assets : []), ...assets.filter(Boolean)]
        : previous.assets,
    voiceover: {
      ...(kind !== "voices" ? previous.voiceover : {}),
      assets:
        kind === "voices"
          ? voices.filter(Boolean)
          : (previous.voiceover?.assets ?? []),
      script: previous.voiceover?.script ?? "",
      scriptName: previous.voiceover?.scriptName ?? "",
    },
  });
  let lastPublish = 0;
  const publish = (force = false) => {
    if (!(kind === "images" ? assets : voices).some(Boolean)) return;
    if (force || performance.now() - lastPublish > 500) {
      lastPublish = performance.now();
      onPartial?.(snapshot());
    }
  };
  if (kind === "images" || kind === "voices") {
    const consume = async () => {
      while (cursor < files.length && !signal?.aborted) {
        const index = cursor++,
          file = files[index];
        try {
          const isImage = kind === "images",
            isMp3 = /\.mp3$/i.test(file.name);
          if (file.size > (isImage ? 25 : 100) * 1024 * 1024)
            throw Error(isImage ? "Ảnh tối đa 25 MB." : "Voice tối đa 100 MB.");
          const response = await fetch(
            isImage
              ? "/api/uploads"
              : "/api/voices?name=" + encodeURIComponent(file.name),
            {
              method: "POST",
              headers: {
                ...projectHeaders(),
                "Content-Type": isImage
                  ? file.type || "application/octet-stream"
                  : isMp3
                    ? "audio/mpeg"
                    : "audio/wav",
              },
              body: file,
              signal,
            },
          );
          const result = await response.json();
          if (!response.ok) throw Error(result.error);
          if (isImage) {
            let width = result.width,
              height = result.height;
            if (!width || !height) {
              const image = new Image();
              image.src = result.src;
              await image.decode();
              width = image.naturalWidth;
              height = image.naturalHeight;
            }
            if (width > 30000 || height > 30000 || width * height > 40_000_000)
              throw Error("Ảnh tối đa 40 megapixel / 30.000px.");
            assets[index] = {
              id: id(),
              name: file.name,
              src: result.src,
              width,
              height,
            };
          } else voices[index] = result;
        } catch (error) {
          if (!signal?.aborted)
            warnings.push(
              file.name +
                ": " +
                (error instanceof Error ? error.message : String(error)),
            );
        } finally {
          progress(
            `Đã nhập ${++done}/${files.length} ${kind === "images" ? "ảnh" : "voice"}…`,
          );
          publish();
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(2, files.length) }, consume),
    );
    publish(true);
    if (signal?.aborted)
      warnings.push("Đã dừng nhập; các file đã nhận được giữ lại.");
    if (!(kind === "images" ? assets : voices).filter(Boolean).length)
      throw Error(warnings.join(" · ") || "Đã dừng nhập file.");
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
        ? [...(appendImages ? previous.assets : []), ...assets.filter(Boolean)]
        : previous.assets,
    scenes: [],
    actors: packs?.actors ?? previous.actors,
    voiceover: {
      ...(kind !== "voices" ? previous.voiceover : {}),
      assets:
        kind === "voices"
          ? voices.filter(Boolean)
          : (previous.voiceover?.assets ?? []),
      script: kind === "script" ? script : (previous.voiceover?.script ?? ""),
      scriptName:
        kind === "script" ? scriptName : (previous.voiceover?.scriptName ?? ""),
    },
    automation: undefined,
  };
  return { project: next, warnings: [...warnings, ...(packs?.warnings ?? [])] };
}
