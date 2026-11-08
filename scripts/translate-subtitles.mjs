import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { languageCode, validateCues } from "../dist/subtitles.mjs";

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(import.meta.dirname, "..");
let nextGoogleRequestAt = 0;
function keyFor(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function runTranslator(payload, { signal } = {}) {
  return new Promise((resolveResult, reject) => {
    if (signal?.aborted) return reject(Error("Đã dừng dịch phụ đề."));
    const python = join(
      root,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    const child = spawn(python, [join(root, "scripts/translate.py")], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      failure;
    const stop = () => {
      child.kill("SIGTERM");
      force = setTimeout(() => child.kill("SIGKILL"), 3000);
      force.unref();
    };
    let force;
    const timer = setTimeout(
      () => {
        failure = Object.assign(Error("Google phản hồi quá lâu."), {
          code: "NETWORK",
        });
        stop();
      },
      120000 +
        (payload.texts ?? []).reduce(
          (sum, text) => sum + Math.ceil(Array.from(text).length / 3000),
          0,
        ) *
          90000,
    );
    const cancel = () => {
      failure = Error("Đã dừng dịch phụ đề.");
      stop();
    };
    signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 4_000_000) {
        failure = Error("Phản hồi dịch quá lớn.");
        stop();
      }
    });
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.on("error", () => {
      failure = Object.assign(
        Error("Chưa cài môi trường dịch. Chạy npm run setup:python bằng uv."),
        { code: "SETUP" },
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(force);
      signal?.removeEventListener("abort", cancel);
      if (failure) return reject(failure);
      try {
        const result = JSON.parse(output);
        if (code !== 0 || result.error)
          throw Object.assign(
            Error(result.error || "Không dịch được phụ đề."),
            { code: result.code },
          );
        resolveResult(result);
      } catch (error) {
        reject(
          error instanceof SyntaxError
            ? Error(
                "Bộ dịch trả dữ liệu không hợp lệ. Chạy npm run setup:python.",
              )
            : error,
        );
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
export async function translationLanguages({
  signal,
  translator = runTranslator,
} = {}) {
  const result = await translator({ action: "languages" }, { signal });
  if (!Array.isArray(result.languages))
    throw Error("Không lấy được danh sách ngôn ngữ.");
  return result.languages.filter(
    (l) =>
      typeof l.code === "string" &&
      /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(l.code) &&
      typeof l.name === "string",
  );
}
export async function translateSubtitles(
  input,
  {
    cacheDirectory = resolve(import.meta.dirname, "../.cache/translations"),
    signal,
    translator = runTranslator,
    onProgress = () => {},
    onResource,
    wait = (ms, signal) => delay(ms, undefined, { signal }),
    requestIntervalMs = translator === runTranslator ? 500 : 0,
    maxBatchChars = 3000,
    rateLimitDelaysMs = [],
    networkDelaysMs = [],
  } = {},
) {
  const cues = validateCues(input.cues),
    source = input.source === "auto" ? "auto" : languageCode(input.source),
    target = languageCode(input.target);
  if (source === target) throw Error("Chọn ngôn ngữ dịch khác ngôn ngữ gốc.");
  const abort = () => {
    if (signal?.aborted) throw Error("Đã dừng dịch phụ đề.");
  };
  abort();
  await mkdir(cacheDirectory, { recursive: true });
  const resolved = new Map(),
    pending = new Map();
  for (const cue of cues) {
    const text = cue.text.replace(/<\/?(?:b|i|u|font)(?:\s[^>]*)?>/gi, "");
    const key = keyFor({
      provider: "deep-translator-google-1",
      source,
      target,
      text,
    });
    await onResource?.([`/.cache/translations/${key}.json`]);
    if (resolved.has(cue.text) || pending.has(cue.text)) continue;
    try {
      const cached = JSON.parse(
        await readFile(join(cacheDirectory, key + ".json"), "utf8"),
      );
      if (
        typeof cached.text !== "string" ||
        !cached.text.trim() ||
        cached.text.length > 12000
      )
        throw Error("cache");
      resolved.set(cue.text, cached.text);
    } catch {
      pending.set(cue.text, { text, key });
    }
  }
  const items = [...pending.entries()];
  const batches = [];
  let batch = [],
    size = 0;
  for (const entry of items) {
    const length = Array.from(entry[1].text).length;
    if (batch.length && size + 7 + length > maxBatchChars) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    size += length + (batch.length ? 7 : 0);
    batch.push(entry);
  }
  if (batch.length) batches.push(batch);
  const failedOriginals = new Set();
  let done = 0;
  for (const batch of batches) {
    let limited = 0,
      network = 0,
      text,
      failedIndices;
    while (text === undefined) {
      abort();
      if (requestIntervalMs && nextGoogleRequestAt > Date.now())
        await wait(nextGoogleRequestAt - Date.now(), signal);
      abort();
      onProgress(
        done / Math.max(1, items.length),
        `Đang dịch ${done}/${items.length} câu mới; ${cues.length - items.length} câu có thể dùng cache…`,
        null,
      );
      try {
        if (requestIntervalMs)
          nextGoogleRequestAt = Date.now() + requestIntervalMs;
        const result = await translator(
          {
            action: "translate",
            texts: batch.map(([, item]) => item.text),
            source,
            target,
          },
          { signal },
        );
        const translations = result.translations;
        if (
          !Array.isArray(translations) ||
          translations.length !== batch.length ||
          translations.some(
            (value) =>
              typeof value !== "string" ||
              !value.trim() ||
              value.length > 12000,
          )
        )
          throw Error(
            "Số câu/nội dung dịch không khớp. Giữ bản gốc và thử lại.",
          );
        failedIndices = result.failedIndices ?? [];
        if (
          !Array.isArray(failedIndices) ||
          failedIndices.some(
            (i) => !Number.isInteger(i) || i < 0 || i >= batch.length,
          )
        )
          throw Error("Danh sách câu chưa dịch không khớp.");
        text = translations.map((value) => value.trim());
      } catch (error) {
        abort();
        const pauses =
          error.code === "RATE_LIMIT"
            ? rateLimitDelaysMs
            : ["NETWORK", "PROVIDER_RESPONSE"].includes(error.code)
              ? networkDelaysMs
              : [];
        const attempt = error.code === "RATE_LIMIT" ? limited++ : network++;
        if (attempt >= pauses.length) {
          if (error.code === "RATE_LIMIT")
            error.message =
              "Google vẫn đang chặn sau nhiều lần chờ. Các câu thành công đã lưu; bấm Dịch tiếp sau để tiếp tục từ cache.";
          throw error;
        }
        const retryAt = Date.now() + pauses[attempt];
        if (requestIntervalMs)
          nextGoogleRequestAt = Math.max(nextGoogleRequestAt, retryAt);
        onProgress(
          done / Math.max(1, items.length),
          `${error.code === "RATE_LIMIT" ? "Google đang giới hạn lượt dịch" : "Google tạm thời không phản hồi"}. Tự thử lại sau ${Math.ceil(pauses[attempt] / 1000)} giây (${attempt + 1}/${pauses.length}). Đã lưu ${done}/${items.length} câu mới.`,
          retryAt,
        );
        await wait(pauses[attempt], signal);
      }
    }
    abort();
    for (const [index, [original, item]] of batch.entries()) {
      abort();
      if (failedIndices.includes(index)) {
        failedOriginals.add(original);
        resolved.set(original, original);
        continue;
      }
      const temporary = join(cacheDirectory, `${item.key}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify({ text: text[index] }));
        await rename(temporary, join(cacheDirectory, item.key + ".json"));
      } finally {
        await rm(temporary, { force: true });
      }
      resolved.set(original, text[index]);
    }
    done += batch.length;
  }
  abort();
  const untranslatedIndices = cues.flatMap((cue, i) =>
    failedOriginals.has(cue.text) ? [i] : [],
  );
  onProgress(
    1,
    untranslatedIndices.length
      ? `Có ${untranslatedIndices.length} câu chưa dịch, được giữ nguyên bản gốc. Mốc thời gian được giữ nguyên.`
      : "Đã dịch đủ phụ đề. Mốc thời gian được giữ nguyên.",
    null,
  );
  return {
    cues: cues.map((cue) => ({ ...cue, text: resolved.get(cue.text) })),
    source,
    target,
    untranslatedIndices,
  };
}
