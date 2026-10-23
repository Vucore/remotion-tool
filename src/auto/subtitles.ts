import { timeline, type Project } from "../model";

export type SubtitleCue = { startMs: number; endMs: number; text: string };
export function estimatedSubtitles(project: Project) {
  return project.scenes.some(
    (scene) =>
      !scene.voice && scene.texts.some((layer) => layer.captions?.length),
  );
}
export const SUBTITLE_LANGUAGES = {
  vi: { name: "Tiếng Việt", file: "tiengviet" },
  en: { name: "Tiếng Anh", file: "tienganh" },
  zh: { name: "Tiếng Trung", file: "tiengtrung" },
  "zh-TW": { name: "Tiếng Trung phồn thể", file: "tiengtrungphonthe" },
  ja: { name: "Tiếng Nhật", file: "tiengnhat" },
  ko: { name: "Tiếng Hàn", file: "tienghan" },
  fr: { name: "Tiếng Pháp", file: "tiengphap" },
  de: { name: "Tiếng Đức", file: "tiengduc" },
  es: { name: "Tiếng Tây Ban Nha", file: "tiengtaybannha" },
  pt: { name: "Tiếng Bồ Đào Nha", file: "tiengbodaonha" },
  ru: { name: "Tiếng Nga", file: "tiengnga" },
  it: { name: "Tiếng Ý", file: "tiengy" },
  th: { name: "Tiếng Thái", file: "tiengthai" },
  id: { name: "Tiếng Indonesia", file: "tiengindonesia" },
  ms: { name: "Tiếng Mã Lai", file: "tiengmalai" },
  hi: { name: "Tiếng Hindi", file: "tienghindi" },
  ar: { name: "Tiếng Ả Rập", file: "tiengarap" },
  nl: { name: "Tiếng Hà Lan", file: "tienghalan" },
  tr: { name: "Tiếng Thổ Nhĩ Kỳ", file: "tiengthonhiky" },
  pl: { name: "Tiếng Ba Lan", file: "tiengbalan" },
  sv: { name: "Tiếng Thụy Điển", file: "tiengthuydien" },
  da: { name: "Tiếng Đan Mạch", file: "tiengdanmach" },
  fi: { name: "Tiếng Phần Lan", file: "tiengphanlan" },
  no: { name: "Tiếng Na Uy", file: "tiengnauy" },
  el: { name: "Tiếng Hy Lạp", file: "tienghylap" },
  he: { name: "Tiếng Hebrew", file: "tienghebrew" },
  sw: { name: "Tiếng Swahili", file: "tiengswahili" },
  uk: { name: "Tiếng Ukraina", file: "tiengukraina" },
} as const;
export function languageCode(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value)
  )
    throw Error("Mã ngôn ngữ không hợp lệ, ví dụ vi, en hoặc zh-TW.");
  return value;
}
export function subtitleFilename(
  name: string,
  language: string,
  second?: string,
  names: Record<string, string> = {},
) {
  const part = (code: string) => {
    languageCode(code);
    const label = names[code]
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return (
      code +
      "_" +
      (SUBTITLE_LANGUAGES[code as keyof typeof SUBTITLE_LANGUAGES]?.file ??
        label ??
        code.toLowerCase())
    );
  };
  const base =
    name
      .replace(/\.(?:srt|mp4)$/i, "")
      .replace(/[\\/:*?"<>|\r\n]/g, "_")
      .trim()
      .slice(0, 100) || "video";
  return `${base}_${part(language)}${second ? "_" + part(second) + "_songngu" : ""}.srt`;
}
export function validateCues(input: unknown): SubtitleCue[] {
  if (!Array.isArray(input) || !input.length || input.length > 10000)
    throw Error("Phụ đề cần 1–10.000 câu.");
  let previousStart = -1,
    total = 0;
  return input.map((cue) => {
    if (
      !cue ||
      !Number.isFinite(cue.startMs) ||
      !Number.isFinite(cue.endMs) ||
      cue.startMs < previousStart ||
      cue.startMs < 0 ||
      cue.endMs <= cue.startMs ||
      cue.endMs > 360_000_000 ||
      typeof cue.text !== "string" ||
      !cue.text.trim() ||
      cue.text.length > 12000
    )
      throw Error("Câu phụ đề không hợp lệ hoặc mốc thời gian sai thứ tự.");
    previousStart = cue.startMs;
    total += cue.text.length;
    if (total > 2_000_000) throw Error("Nội dung phụ đề tối đa 2 triệu ký tự.");
    return { startMs: cue.startMs, endMs: cue.endMs, text: cue.text.trim() };
  });
}
export function projectSubtitles(project: Project): SubtitleCue[] {
  const cues = timeline(project).flatMap((item) =>
    item.scene.texts.flatMap((layer) =>
      (layer.captions ?? []).map((cue) => ({
        text: cue.text,
        startMs: (item.from / project.fps) * 1000 + cue.startMs,
        endMs: (item.from / project.fps) * 1000 + cue.endMs,
      })),
    ),
  );
  return cues.sort((a, b) => a.startMs - b.startMs);
}
export function srtTimestamp(ms: number) {
  const value = Math.max(0, Math.round(ms));
  return `${String(Math.floor(value / 3600000)).padStart(2, "0")}:${String(Math.floor(value / 60000) % 60).padStart(2, "0")}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")},${String(value % 1000).padStart(3, "0")}`;
}
export function toSrt(input: SubtitleCue[]) {
  return (
    validateCues(input)
      .map(
        (cue, i) =>
          `${i + 1}\n${srtTimestamp(cue.startMs)} --> ${srtTimestamp(Math.max(Math.round(cue.startMs) + 1, cue.endMs))}\n${cue.text.replace(/\r\n?/g, "\n").replace(/\n\s*\n/g, "\n")}`,
      )
      .join("\n\n") + "\n"
  );
}
export function parseSrt(text: string): SubtitleCue[] {
  if (
    text.length > 2_000_000 ||
    text.includes("\ufffd") ||
    text.includes("\u0000")
  )
    throw Error("SRT cần UTF-8, tối đa 2 MB.");
  const stamp = "(\\d{1,3}):([0-5]\\d):([0-5]\\d)[,.](\\d{3})";
  const timing = new RegExp(`^${stamp}\\s+-->\\s+${stamp}(?:[ \\t]+.*)?$`);
  const value = (parts: RegExpMatchArray, from: number) =>
    (+parts[from] * 3600 + +parts[from + 1] * 60 + +parts[from + 2]) * 1000 +
    +parts[from + 3];
  const cues = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n[ \t]*\n/)
    .map((block, index) => {
      const lines = block.split("\n");
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const match = lines.shift()?.trim().match(timing);
      if (!match || !lines.join("\n").trim())
        throw Error(`SRT: kiểm tra mốc thời gian/nội dung ở câu ${index + 1}.`);
      return {
        startMs: value(match, 1),
        endMs: value(match, 5),
        text: lines.join("\n"),
      };
    });
  return validateCues(cues);
}
export function bilingualCues(
  original: SubtitleCue[],
  translated: SubtitleCue[],
): SubtitleCue[] {
  if (
    original.length !== translated.length ||
    original.some(
      (c, i) =>
        c.startMs !== translated[i].startMs || c.endMs !== translated[i].endMs,
    )
  )
    throw Error("Bản dịch không khớp mốc phụ đề gốc.");
  return original.map((cue, i) => ({
    ...cue,
    text: cue.text + "\n" + translated[i].text,
  }));
}
