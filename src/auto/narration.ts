import type { Caption } from "@remotion/captions";
import type { Asset, VoiceAsset, Voiceover } from "../model";

export type ScriptSection = { order: number; text: string };
export type NarrationPair = ScriptSection & { image: Asset; voice: VoiceAsset };
export type VoiceAlignment = { voiceId: string; captions: Caption[] };

export function parseScript(input: string): ScriptSection[] {
  if (typeof input !== "string" || input.length > 1_000_000)
    throw Error("TXT: tối đa 1 triệu ký tự UTF-8.");
  if (input.includes("\u0000") || input.includes("\ufffd"))
    throw Error("TXT: hãy lưu file ở định dạng UTF-8.");
  const sections: ScriptSection[] = [];
  for (const line of input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")) {
    const marker = line.match(/^\s*(\d{1,5})[.):](?:[ \t]+(.*))?$/);
    if (marker)
      sections.push({ order: Number(marker[1]), text: marker[2] ?? "" });
    else if (sections.length) sections[sections.length - 1].text += `\n${line}`;
    else if (line.trim())
      throw Error(
        "TXT: bắt đầu bằng ‘1. Nội dung cảnh một’, mỗi mục mới ở đầu dòng.",
      );
  }
  if (!sections.length || sections.length > 300)
    throw Error("TXT: cần 1–300 mục đánh số 1., 2., 3.…");
  const seen = new Set<number>();
  for (const section of sections) {
    section.text = section.text.trim().normalize("NFC");
    if (!section.order || seen.has(section.order))
      throw Error(`TXT: số mục ${section.order} không hợp lệ hoặc bị trùng.`);
    seen.add(section.order);
    if (!section.text || section.text.length > 12000)
      throw Error(
        `TXT mục ${section.order}: cần nội dung từ 1 đến 12.000 ký tự.`,
      );
  }
  sections.sort((a, b) => a.order - b.order);
  for (let i = 0; i < sections.length; i++)
    if (sections[i].order !== i + 1)
      throw Error(`TXT: thiếu mục ${i + 1}. Đánh số liên tục từ 1.`);
  return sections;
}

export function fileOrder(name: string): number {
  const match = name.normalize("NFC").match(/^[^\d]*(\d{1,5})(?=\D|$)/);
  const order = Number(match?.[1]);
  if (!Number.isInteger(order) || order < 1)
    throw Error(
      `“${name}”: cần số thứ tự trong tên, ví dụ 01_mo-dau.jpg hoặc voice_01.wav.`,
    );
  return order;
}

export function pairNarration(
  assets: Asset[],
  input: Voiceover,
): NarrationPair[] {
  const sections = parseScript(input.script);
  const indexed = <T extends { name: string }>(files: T[], label: string) => {
    const map = new Map<number, T>();
    for (const file of files) {
      const order = fileOrder(file.name);
      if (map.has(order))
        throw Error(
          `${label}: số ${order} bị trùng ở “${map.get(order)!.name}” và “${file.name}”.`,
        );
      map.set(order, file);
    }
    for (const [order, file] of map)
      if (!sections.some((s) => s.order === order))
        throw Error(`${label} “${file.name}”: không có mục TXT số ${order}.`);
    return map;
  };
  const images = indexed(assets, "Ảnh"),
    voices = indexed(input.assets, "Voice");
  return sections.map((s) => {
    const image = images.get(s.order),
      voice = voices.get(s.order);
    if (!image || !voice)
      throw Error(
        `Cảnh ${s.order}: thiếu ${!image ? "ảnh" : "voice WAV/MP3"} có số thứ tự ${s.order}.`,
      );
    const text =
      input.ttsKey && input.tts?.model === "turbo"
        ? s.text
            .replace(/\[(?:laugh|chuckle|sigh|gasp|cough)\]/gi, " ")
            .replace(/[ \t]+/g, " ")
            .trim()
        : s.text;
    return { ...s, text, image, voice };
  });
}

// Explicit newlines preserve the author's preferred sentence boundaries.
export function splitSentences(text: string, maxChars = 100): string[] {
  const segmenter = new Intl.Segmenter("vi", { granularity: "sentence" });
  const sentences: string[] = [];
  for (const line of text.split(/\n+/).filter((l) => l.trim())) {
    for (const part of segmenter.segment(line)) {
      let pending = "";
      for (const word of part.segment.trim().split(/\s+/)) {
        if (pending && `${pending} ${word}`.length > maxChars) {
          sentences.push(pending);
          pending = "";
        }
        if (word.length > 2000)
          throw Error("Một từ trong TXT vượt quá 2.000 ký tự.");
        pending += `${pending ? " " : ""}${word}`;
      }
      if (pending) sentences.push(pending);
    }
  }
  if (!sentences.length || sentences.length > 300)
    throw Error("Mỗi voice cần 1–300 câu/cụm phụ đề.");
  return sentences;
}

export function parseCaptions(input: unknown, duration: number): Caption[] {
  if (!Array.isArray(input) || !input.length || input.length > 300)
    throw Error("Phụ đề: cần 1–300 cue JSON.");
  let previousEnd = 0;
  return input.map((c) => {
    if (
      !c ||
      typeof c !== "object" ||
      typeof c.text !== "string" ||
      !c.text.trim() ||
      c.text.length > 2000 ||
      !Number.isFinite(c.startMs) ||
      !Number.isFinite(c.endMs) ||
      c.startMs < previousEnd ||
      c.endMs <= c.startMs ||
      c.endMs > duration * 1000 + 0.01
    )
      throw Error(
        "Mốc phụ đề không hợp lệ: cue phải nối theo thứ tự, không chồng và nằm trong thời lượng WAV.",
      );
    if (
      c.confidence !== null &&
      (typeof c.confidence !== "number" ||
        !Number.isFinite(c.confidence) ||
        c.confidence < 0 ||
        c.confidence > 1)
    )
      throw Error("Độ tin cậy của phụ đề không hợp lệ.");
    if (
      c.timestampMs !== null &&
      (typeof c.timestampMs !== "number" ||
        !Number.isFinite(c.timestampMs) ||
        c.timestampMs < c.startMs ||
        c.timestampMs > c.endMs)
    )
      throw Error("Mốc giữa của phụ đề không hợp lệ.");
    previousEnd = c.endMs;
    return {
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      timestampMs: c.timestampMs,
      confidence: c.confidence,
    };
  });
}
