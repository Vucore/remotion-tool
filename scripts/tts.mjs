import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  parseTtsSettings,
  ttsInputKey,
  ttsParameters,
  ttsPlan,
  spokenTtsText,
} from "../dist/tts.mjs";
import { inspectVoice, MAX_VOICE_BYTES } from "./voice-input.mjs";
import { wavEnvelope } from "./wav-info.mjs";

const root = resolve(import.meta.dirname, "..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const checkAbort = (signal) => {
  if (signal?.aborted) throw Error("Đã dừng tạo voice.");
};

async function readLimited(response, limit) {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw Error("TTS trả file vượt quá giới hạn 100 MB.");
  }
  if (!response.body) throw Error("TTS trả file rỗng.");
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("TTS trả dữ liệu vượt quá giới hạn.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

async function atomicWrite(path, bytes) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function generateTts(
  { script, images, settings },
  {
    assetDirectory = join(root, "data/uploads"),
    cacheDirectory = join(root, ".cache/tts"),
    signal,
    onProgress = () => {},
    fetchImpl = fetch,
    timeoutMs = 600_000,
  } = {},
) {
  const options = parseTtsSettings(settings),
    sections = ttsPlan(script, images);
  const parameters = ttsParameters(options);
  for (const section of sections)
    if (!spokenTtsText(section.text, options.model).trim())
      throw Error(
        `TXT mục ${section.order}: cần nội dung lời đọc ngoài thẻ cảm xúc.`,
      );
  checkAbort(signal);
  let reference;
  if (options.voiceMode === "reference") {
    if (!options.reference)
      throw Error("Chọn file giọng mẫu WAV/MP3 trước khi tạo voice.");
    const path = join(assetDirectory, options.reference.src.slice(7));
    const info = await stat(path).catch(() => {
      throw Error("Không tìm thấy file giọng mẫu. Hãy chọn lại.");
    });
    if (!info.isFile() || info.size > 25 * 1024 * 1024)
      throw Error("File giọng mẫu tối đa 25 MB.");
    const bytes = await readFile(path);
    await inspectVoice(bytes, { name: options.reference.src, signal });
    reference = {
      bytes,
      extension: options.reference.src.endsWith(".mp3") ? "mp3" : "wav",
      hash: hash(bytes),
    };
  }
  await mkdir(cacheDirectory, { recursive: true });
  await mkdir(assetDirectory, { recursive: true });
  const voices = [];
  let cached = 0;
  for (const [index, section] of sections.entries()) {
    checkAbort(signal);
    const label = `${index + 1}/${sections.length}`;
    onProgress(
      index / sections.length,
      `Đang tạo voice ${label} · lần đầu có thể cần khởi động GPU…`,
    );
    const key = hash(
      JSON.stringify({
        version: 1,
        endpoint: options.baseUrl,
        parameters,
        text: section.text,
        reference: reference?.hash ?? null,
      }),
    );
    const cachePath = join(cacheDirectory, `${key}.json`);
    let audio;
    try {
      const record = JSON.parse(await readFile(cachePath, "utf8"));
      if (
        typeof record.file !== "string" ||
        !/^[a-f0-9]{64}\.(wav|mp3)$/.test(record.file) ||
        !record.file.endsWith(`.${options.outputFormat}`)
      )
        throw Error("cache");
      const path = join(assetDirectory, record.file);
      if ((await stat(path)).size > MAX_VOICE_BYTES) throw Error("cache");
      const bytes = await readFile(path);
      if (hash(bytes) !== record.file.slice(0, 64)) throw Error("cache");
      const inspected = await inspectVoice(bytes, {
        name: record.file,
        signal,
      });
      audio = {
        src: `/media/${record.file}`,
        duration: inspected.info.duration,
        envelope: wavEnvelope(inspected.decodedWav, inspected.info),
      };
      cached++;
    } catch {
      checkAbort(signal);
    }
    if (!audio) {
      const form = new FormData();
      for (const [name, value] of Object.entries(parameters))
        form.append(name, String(value));
      form.append("text", section.text);
      if (reference)
        form.append(
          "voice_file",
          new Blob([reference.bytes], {
            type: reference.extension === "mp3" ? "audio/mpeg" : "audio/wav",
          }),
          `reference.${reference.extension}`,
        );
      const timeout = AbortSignal.timeout(timeoutMs);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeout])
        : timeout;
      let bytes;
      try {
        const response = await fetchImpl(`${options.baseUrl}/api/cli`, {
          method: "POST",
          body: form,
          signal: requestSignal,
          redirect: "error",
        });
        if (!response.ok) {
          let detail = "";
          try {
            const raw = (await readLimited(response, 8192)).toString("utf8");
            try {
              const parsed = JSON.parse(raw);
              detail =
                typeof parsed.detail === "string"
                  ? parsed.detail
                  : typeof parsed.error === "string"
                    ? parsed.error
                    : raw;
            } catch {
              detail = raw;
            }
          } catch {
            /* HTTP status still explains the failure. */
          }
          throw Error(
            `API TTS HTTP ${response.status}${
              detail
                ? `: ${detail
                    .replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .slice(0, 600)}`
                : ". Kiểm tra cấu hình và thử lại."
            }`,
          );
        }
        const type = response.headers.get("content-type") || "";
        if (/json|text|zip|html/i.test(type))
          throw Error(
            "API TTS cần trả audio trực tiếp ở mode=single, nhưng nhận được dữ liệu khác.",
          );
        bytes = await readLimited(response, MAX_VOICE_BYTES);
        checkAbort(signal);
      } catch (error) {
        checkAbort(signal);
        if (timeout.aborted)
          throw Error(
            `Voice ${section.order}: API TTS hết thời gian chờ. Thử lại để tiếp tục các mục chưa có.`,
          );
        throw Error(`Voice ${section.order}: ${error.message}`);
      }
      const inspected = await inspectVoice(bytes, {
        name: `voice.${options.outputFormat}`,
        signal,
      });
      const file = `${hash(bytes)}.${options.outputFormat}`;
      await atomicWrite(join(assetDirectory, file), inspected.bytes);
      audio = {
        src: `/media/${file}`,
        duration: inspected.info.duration,
        envelope: wavEnvelope(inspected.decodedWav, inspected.info),
      };
      await atomicWrite(cachePath, JSON.stringify({ file }));
    }
    checkAbort(signal);
    voices.push({
      id: randomUUID(),
      name: `${String(section.order).padStart(2, "0")}_tts.${options.outputFormat}`,
      ...audio,
    });
    onProgress((index + 1) / sections.length, `Đã có voice ${label}`);
  }
  checkAbort(signal);
  return {
    assets: voices,
    ttsKey: ttsInputKey(script, options),
    tts: options,
    cached,
  };
}
