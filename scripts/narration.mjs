import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
  mkdtemp,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
  pairNarration,
  parseCaptions,
  splitSentences,
} from "../dist/narration.mjs";
import { wavEnvelope } from "./wav-info.mjs";
import { inspectVoice } from "./voice-input.mjs";

const root = resolve(import.meta.dirname, ".."),
  engineVersion = "stable-ts-v2-khung-1";
const digest = (value) => createHash("sha256").update(value).digest("hex");
function checkAbort(signal) {
  if (signal?.aborted) throw Error("Đã huỷ căn phụ đề.");
}

export async function runAlignment(
  requests,
  { config, signal, cacheDirectory, onProgress },
) {
  const python = join(
    root,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  try {
    await access(python);
  } catch {
    throw Error(
      "Chưa cài bộ căn phụ đề. Chạy một lần: npm run setup:voice. Sau đó nhấn Tạo và xuất MP4 lại.",
    );
  }
  const requestFile = join(cacheDirectory, `${randomUUID()}.request.json`);
  await writeFile(requestFile, JSON.stringify(requests));
  try {
    checkAbort(signal);
    return await new Promise((resolve, reject) => {
      const child = spawn(
        python,
        [
          join(root, "scripts/voice/align.py"),
          "--request",
          requestFile,
          "--model",
          config.model,
          "--language",
          config.language,
          "--model-dir",
          join(root, ".cache/whisper"),
        ],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
      );
      const results = new Map();
      let pending = "",
        stderr = "",
        failure = "",
        killTimer;
      const abort = () => {
        child.kill("SIGTERM");
        killTimer = setTimeout(() => child.kill("SIGKILL"), 3000);
        killTimer.unref();
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (data) => {
        stderr = (stderr + data).slice(-4000);
      });
      child.stdout.on("data", (data) => {
        pending += data;
        if (pending.length > 4_000_000) {
          failure = "Kết quả căn phụ đề quá lớn.";
          abort();
          return;
        }
        let split;
        while ((split = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, split);
          pending = pending.slice(split + 1);
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "error") failure = event.error;
            if (event.type === "result") results.set(event.key, event.captions);
            if (event.type === "progress")
              onProgress(
                event.index / requests.length,
                `Đang căn câu ${event.index + 1}/${requests.length} · ${event.name}`,
              );
          } catch {
            failure = "Bộ căn phụ đề trả dữ liệu không hợp lệ.";
            abort();
          }
        }
      });
      const cleanup = () => {
        clearTimeout(killTimer);
        signal?.removeEventListener("abort", abort);
      };
      child.on("error", (error) => {
        cleanup();
        reject(error);
      });
      child.on("close", (code) => {
        cleanup();
        if (signal?.aborted) reject(Error("Đã huỷ căn phụ đề."));
        else if (code !== 0 || failure)
          reject(
            Error(
              failure ||
                `Không chạy được bộ căn phụ đề. Chạy npm run setup:voice. ${stderr}`,
            ),
          );
        else resolve(results);
      });
    });
  } finally {
    await rm(requestFile, { force: true });
  }
}

export async function prepareNarration(
  config,
  assets,
  input,
  {
    assetDirectory = join(root, "data/uploads"),
    cacheDirectory = join(root, ".cache/alignment"),
    signal,
    onProgress = () => {},
    align = runAlignment,
  } = {},
) {
  if (!input)
    throw Error("Thêm voice WAV/MP3 và một script.txt có đánh số mục.");
  const pairs = pairNarration(assets, input),
    entries = [],
    pending = new Map(),
    resolved = new Map();
  const envelopes = new Map();
  await mkdir(cacheDirectory, { recursive: true });
  let decodedDirectory;
  try {
    for (const pair of pairs) {
      checkAbort(signal);
      if (!/^\/media\/[a-zA-Z0-9_-]+\.(wav|mp3)$/.test(pair.voice.src))
        throw Error("Đường dẫn voice không hợp lệ.");
      const path = join(assetDirectory, pair.voice.src.slice(7));
      const info = await stat(path).catch(() => {
        throw Error(`Thiếu voice “${pair.voice.name}”. Hãy nhập lại.`);
      });
      if (info.size > 100 * 1024 * 1024)
        throw Error(`${pair.voice.name}: voice tối đa 100 MB.`);
      const bytes = await readFile(path);
      const {
        decodedWav,
        info: metadata,
        extension,
      } = await inspectVoice(bytes, { name: pair.voice.src, signal });
      envelopes.set(pair.voice.id, wavEnvelope(decodedWav, metadata));
      if (Math.abs(metadata.duration - pair.voice.duration) > 0.000001)
        throw Error(
          `${pair.voice.name}: thời lượng voice đã thay đổi. Hãy nhập lại.`,
        );
      const sentences = splitSentences(pair.text, config.narration.maxChars);
      const audioHash = digest(bytes),
        key = digest(
          JSON.stringify({
            audioHash,
            sentences,
            language: config.narration.language,
            model: config.narration.model,
            engineVersion,
          }),
        );
      const entry = {
        key,
        name: pair.voice.name,
        path,
        sentences,
        duration: metadata.duration,
        voiceId: pair.voice.id,
        audioHash,
      };
      entries.push(entry);
      try {
        const cached = JSON.parse(
          await readFile(join(cacheDirectory, `${key}.json`), "utf8"),
        );
        const captions = validateResult(cached, entry);
        resolved.set(key, captions);
      } catch {
        // Only the aligner gets a temporary WAV. The project keeps the source MP3.
        if (pending.has(key)) entry.path = pending.get(key).path;
        else if (extension === "mp3") {
          decodedDirectory ??= await mkdtemp(join(cacheDirectory, "voice-"));
          entry.path = join(decodedDirectory, `${key}.wav`);
          await writeFile(entry.path, decodedWav);
        }
        pending.set(key, entry);
      }
    }
    onProgress(
      0,
      pending.size
        ? "Đang nạp bộ căn phụ đề…"
        : "Dùng lại phụ đề đã căn đúng bộ voice/TXT.",
    );
    if (pending.size) {
      const results = await align([...pending.values()], {
        config: config.narration,
        signal,
        cacheDirectory,
        onProgress,
      });
      checkAbort(signal);
      for (const entry of pending.values()) {
        const captions = validateResult(results.get(entry.key), entry);
        resolved.set(entry.key, captions);
        const temporary = join(
          cacheDirectory,
          `${entry.key}.${randomUUID()}.tmp`,
        );
        await writeFile(temporary, JSON.stringify(captions));
        await rename(temporary, join(cacheDirectory, `${entry.key}.json`));
      }
    }
    checkAbort(signal);
    onProgress(1, `Đã căn phụ đề cho ${pairs.length} voice.`);
    return {
      input: {
        ...input,
        assets: input.assets.map((v) => ({
          ...v,
          envelope: envelopes.get(v.id) ?? v.envelope,
        })),
      },
      alignments: entries.map((entry) => ({
        voiceId: entry.voiceId,
        captions: resolved.get(entry.key),
      })),
      manifest: entries.map((entry) => ({
        name: entry.name,
        sha256: entry.audioHash,
        alignmentHash: entry.key,
      })),
    };
  } finally {
    if (decodedDirectory)
      await rm(decodedDirectory, { recursive: true, force: true });
  }
}
function validateResult(value, entry) {
  const captions = parseCaptions(value, entry.duration);
  if (
    captions.length !== entry.sentences.length ||
    captions.some((c, i) => c.text !== entry.sentences[i])
  )
    throw Error(`${entry.name}: phụ đề căn được không khớp TXT.`);
  return captions;
}
