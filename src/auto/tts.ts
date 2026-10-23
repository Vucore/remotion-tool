import { fileOrder, parseScript } from "./narration";
import { TTS_LANGUAGES } from "./languages";

export type TtsSpeaker = {
  id: string;
  name: string;
  voiceMode: "preset" | "reference";
  voice: string;
  reference: { src: string; name: string } | null;
};
export type SpeechTurn = { text: string; speakerId: string };
export type SceneDialogue = { order: number; turns: SpeechTurn[] };
export type TtsSettings = {
  speakers: TtsSpeaker[];
  dialogue: SceneDialogue[];
  enabled: boolean;
  baseUrl: string;
  model: "turbo" | "multilingual";
  languageId: keyof typeof TTS_LANGUAGES;
  outputFormat: "wav" | "mp3";
  voiceMode: "preset" | "reference";
  voice: string;
  reference: { src: string; name: string } | null;
  temperature: number;
  repetitionPenalty: number;
  topP: number;
  seed: number | null;
  topK: number;
  normLoudness: boolean;
  exaggeration: number;
  cfgWeight: number;
  minP: number;
};

export const defaultTtsSettings = (): TtsSettings => ({
  speakers: [],
  dialogue: [],
  enabled: false,
  baseUrl: "https://emsimv10--chatterbox-multi-tts-web.modal.run",
  model: "turbo",
  languageId: "en",
  outputFormat: "wav",
  voiceMode: "preset",
  voice: "",
  reference: null,
  temperature: 0.8,
  repetitionPenalty: 1.2,
  topP: 0.95,
  seed: null,
  topK: 1000,
  normLoudness: true,
  exaggeration: 0.5,
  cfgWeight: 0.5,
  minP: 0.05,
});

export function parseTtsSettings(input: unknown): TtsSettings {
  if (
    input !== undefined &&
    (!input || typeof input !== "object" || Array.isArray(input))
  )
    throw Error("Thiết lập TTS không hợp lệ.");
  const value = { ...defaultTtsSettings(), ...(input as Partial<TtsSettings>) };
  const choice = <T extends string>(
    item: T,
    choices: readonly T[],
    label: string,
  ): T => {
    if (!choices.includes(item)) throw Error(`TTS: ${label} không hợp lệ.`);
    return item;
  };
  const number = (item: number, min: number, max: number, label: string) => {
    if (
      typeof item !== "number" ||
      !Number.isFinite(item) ||
      item < min ||
      item > max
    )
      throw Error(`TTS: ${label} cần từ ${min} đến ${max}.`);
    return item;
  };
  if (
    typeof value.enabled !== "boolean" ||
    typeof value.normLoudness !== "boolean"
  )
    throw Error("TTS: lựa chọn bật/tắt không hợp lệ.");
  let endpoint: URL;
  try {
    endpoint = new URL(value.baseUrl);
  } catch {
    throw Error("TTS: nhập URL HTTPS của ứng dụng Modal.");
  }
  if (
    endpoint.protocol !== "https:" ||
    !/^[a-z0-9-]+\.modal\.run$/i.test(endpoint.hostname) ||
    endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !["/", "/api/cli"].includes(endpoint.pathname)
  )
    throw Error(
      "TTS: URL cần là https://ten-ung-dung.modal.run (hoặc /api/cli).",
    );
  if (
    typeof value.voice !== "string" ||
    value.voice.length > 200 ||
    Array.from(value.voice).some((c) => c.charCodeAt(0) < 32)
  )
    throw Error("TTS: tên giọng preset tối đa 200 ký tự.");
  let reference: TtsSettings["reference"] = null;
  if (value.reference !== null) {
    if (
      !value.reference ||
      typeof value.reference !== "object" ||
      typeof value.reference.src !== "string" ||
      !/^\/media\/[a-zA-Z0-9_-]+\.(wav|mp3)$/.test(value.reference.src) ||
      typeof value.reference.name !== "string" ||
      !value.reference.name ||
      value.reference.name.length > 500
    )
      throw Error("TTS: file giọng mẫu cần là WAV/MP3 đã nhập vào công cụ.");
    reference = { src: value.reference.src, name: value.reference.name };
  }
  if (
    value.seed !== null &&
    (!Number.isSafeInteger(value.seed) ||
      value.seed < 0 ||
      value.seed > 2147483647)
  )
    throw Error("TTS: seed cần là số nguyên 0–2147483647 hoặc để trống.");
  if (
    !Number.isSafeInteger(value.topK) ||
    value.topK < 1 ||
    value.topK > 1000000
  )
    throw Error("TTS: top_k cần là số nguyên 1–1000000.");
  if (
    !Array.isArray(value.speakers) ||
    value.speakers.length > 50 ||
    !Array.isArray(value.dialogue) ||
    value.dialogue.length > 300
  )
    throw Error("TTS: tối đa 50 người nói và 300 cảnh phân vai.");
  const ids = new Set<string>();
  const speakers: TtsSpeaker[] = value.speakers.map((speaker) => {
    if (
      !speaker ||
      typeof speaker.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(speaker.id) ||
      speaker.id === "default" ||
      ids.has(speaker.id) ||
      typeof speaker.name !== "string" ||
      !speaker.name.trim() ||
      speaker.name.length > 100
    )
      throw Error("TTS: tên hoặc mã người nói không hợp lệ/bị trùng.");
    ids.add(speaker.id);
    const parsed = parseTtsSettings({
      ...defaultTtsSettings(),
      voiceMode: speaker.voiceMode,
      voice: speaker.voice,
      reference: speaker.reference,
    });
    return {
      id: speaker.id,
      name: speaker.name.trim(),
      voiceMode: parsed.voiceMode,
      voice: parsed.voice,
      reference: parsed.reference,
    };
  });
  const orders = new Set<number>();
  let totalTurns = 0;
  const dialogue: SceneDialogue[] = value.dialogue.map((scene) => {
    if (
      !scene ||
      !Number.isInteger(scene.order) ||
      scene.order < 1 ||
      scene.order > 300 ||
      orders.has(scene.order) ||
      !Array.isArray(scene.turns) ||
      !scene.turns.length ||
      scene.turns.length > 100
    )
      throw Error(
        "TTS: cảnh phân vai cần 1–100 lượt nói, không trùng số cảnh.",
      );
    orders.add(scene.order);
    totalTurns += scene.turns.length;
    return {
      order: scene.order,
      turns: scene.turns.map((turn) => {
        if (
          !turn ||
          typeof turn.text !== "string" ||
          turn.text.length > 12000 ||
          typeof turn.speakerId !== "string" ||
          (turn.speakerId !== "default" && !ids.has(turn.speakerId))
        )
          throw Error("TTS: lượt nói hoặc người nói không hợp lệ.");
        return { text: turn.text, speakerId: turn.speakerId };
      }),
    };
  });
  if (totalTurns > 3000)
    throw Error("TTS: tối đa 3.000 lượt nói trong một dự án.");
  return {
    speakers,
    dialogue,
    enabled: value.enabled,
    baseUrl: endpoint.origin,
    model: choice(value.model, ["turbo", "multilingual"], "model"),
    languageId: choice(
      value.languageId,
      Object.keys(TTS_LANGUAGES) as TtsSettings["languageId"][],
      "ngôn ngữ",
    ),
    outputFormat: choice(value.outputFormat, ["wav", "mp3"], "định dạng"),
    voiceMode: choice(value.voiceMode, ["preset", "reference"], "nguồn giọng"),
    voice: value.voice.trim(),
    reference,
    temperature: number(value.temperature, 0.05, 2, "temperature"),
    repetitionPenalty: number(
      value.repetitionPenalty,
      1,
      3,
      "repetition_penalty",
    ),
    topP: number(value.topP, 0, 1, "top_p"),
    seed: value.seed,
    topK: value.topK,
    normLoudness: value.normLoudness,
    exaggeration: number(value.exaggeration, 0, 2, "exaggeration"),
    cfgWeight: number(value.cfgWeight, 0, 1, "cfg_weight"),
    minP: number(value.minP, 0, 1, "min_p"),
  };
}

// Only parameters actually sent to this model participate in the cache/freshness key.
export function ttsParameters(settings: TtsSettings) {
  const s = parseTtsSettings(settings);
  return {
    model: s.model,
    mode: "single",
    output_format: s.outputFormat,
    temperature: s.temperature,
    repetition_penalty: s.repetitionPenalty,
    top_p: s.topP,
    ...(s.seed !== null ? { seed: s.seed } : {}),
    ...(s.voiceMode === "preset" && s.voice ? { voice: s.voice } : {}),
    ...(s.model === "turbo"
      ? { top_k: s.topK, norm_loudness: s.normLoudness }
      : {
          language_id: s.languageId,
          exaggeration: s.exaggeration,
          cfg_weight: s.cfgWeight,
          min_p: s.minP,
        }),
  };
}

// Presentation tags direct speech synthesis, but are not spoken subtitle words.
export function spokenTtsText(text: string, model: TtsSettings["model"]) {
  return model === "turbo"
    ? text
        .replace(/\[(?:laugh|chuckle|sigh|gasp|cough)\]/gi, " ")
        .replace(/[ \t]+/g, " ")
        .trim()
    : text;
}

export function ttsPlan(script: string, images: { name: string }[]) {
  const sections = parseScript(script);
  const byOrder = new Map<number, string>();
  if (!images.length) throw Error("Thêm ảnh và TXT trước khi tạo voice.");
  for (const image of images) {
    const order = fileOrder(image.name);
    if (byOrder.has(order)) throw Error(`Ảnh: số ${order} bị trùng.`);
    if (!sections.some((s) => s.order === order))
      throw Error(`${image.name}: không có mục TXT số ${order}.`);
    byOrder.set(order, image.name);
  }
  for (const section of sections)
    if (!byOrder.has(section.order))
      throw Error(`Thiếu ảnh cho mục TXT số ${section.order}.`);
  return sections;
}

export const normalizedSpeech = (text: string) =>
  text.normalize("NFC").replace(/\s+/g, " ").trim();
export function sceneTurns(
  section: { order: number; text: string },
  settings: TtsSettings,
): SpeechTurn[] {
  const configured = settings.dialogue.find(
    (scene) => scene.order === section.order,
  );
  if (!configured) return [{ text: section.text, speakerId: "default" }];
  if (
    normalizedSpeech(configured.turns.map((turn) => turn.text).join("\n")) !==
    normalizedSpeech(section.text)
  )
    throw Error(
      `Cảnh ${section.order}: phân vai không khớp TXT. Mở Lời đọc & giọng để cập nhật.`,
    );
  return configured.turns;
}
export function speakerSettings(
  settings: TtsSettings,
  speakerId: string,
): TtsSettings {
  if (speakerId === "default")
    return { ...settings, speakers: [], dialogue: [] };
  const speaker = settings.speakers.find((item) => item.id === speakerId);
  if (!speaker) throw Error("Không tìm thấy người nói. Hãy gán lại giọng.");
  return {
    ...settings,
    voiceMode: speaker.voiceMode,
    voice: speaker.voice,
    reference: speaker.reference,
    speakers: [],
    dialogue: [],
  };
}
export function speechPlan(script: string, settings: TtsSettings) {
  const sections = parseScript(script);
  for (const scene of settings.dialogue)
    if (!sections.some((section) => section.order === scene.order))
      throw Error(`Phân vai chứa cảnh ${scene.order} không có trong TXT.`);
  return sections.map((section) => ({
    ...section,
    turns: sceneTurns(section, settings).map((turn) => {
      const options = speakerSettings(settings, turn.speakerId);
      if (!spokenTtsText(turn.text, settings.model).trim())
        throw Error(
          `Cảnh ${section.order}: lượt nói đang trống. Nhập lời hoặc xóa lượt.`,
        );
      if (options.voiceMode === "reference" && !options.reference)
        throw Error(
          `Cảnh ${section.order}: chọn file clone cho ${settings.speakers.find((s) => s.id === turn.speakerId)?.name ?? "giọng mặc định"}.`,
        );
      return { ...turn, options };
    }),
  }));
}

// A local freshness marker, not a security hash. Server cache uses SHA-256.
export function ttsInputKey(script: string, settings: TtsSettings) {
  const s = parseTtsSettings(settings);
  const data = JSON.stringify(
    speechPlan(script, s).map((section) => ({
      order: section.order,
      turns: section.turns.map((turn) => ({
        text: turn.text,
        parameters: ttsParameters(turn.options),
        baseUrl: s.baseUrl,
        reference:
          turn.options.voiceMode === "reference"
            ? (turn.options.reference?.src ?? "")
            : "",
      })),
    })),
  );
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < data.length; i++)
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(data.charCodeAt(i))) * 0x100000001b3n,
    );
  return "chatterbox-v1-" + hash.toString(16).padStart(16, "0");
}
