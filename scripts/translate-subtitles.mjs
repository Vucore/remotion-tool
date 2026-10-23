import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { languageCode, validateCues } from "../dist/subtitles.mjs";

import { spawn } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
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
    const timer = setTimeout(() => {
      failure = Error("Dịch quá thời gian chờ. Hãy thử lại.");
      stop();
    }, 120000);
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
      failure = Error(
        "Chưa cài môi trường dịch. Chạy npm run setup:python bằng uv.",
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
          throw Error(result.error || "Không dịch được phụ đề.");
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
  } = {},
) {
  const cues = validateCues(input.cues),
    source = languageCode(input.source),
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
  let done = 0;
  while (done < items.length) {
    abort();
    const batch = [];
    let chars = 0;
    while (done + batch.length < items.length && batch.length < 10) {
      const item = items[done + batch.length];
      if (batch.length && chars + item[1].text.length > 4500) break;
      batch.push(item);
      chars += item[1].text.length;
    }
    onProgress(
      done / Math.max(1, items.length),
      `Đang dịch ${done}/${items.length} câu mới…`,
    );
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
        (t) => typeof t !== "string" || !t.trim() || t.length > 12000,
      )
    )
      throw Error("Số câu/nội dung dịch không khớp. Giữ bản gốc và thử lại.");
    abort();
    for (const [index, [original, item]] of batch.entries()) {
      const text = translations[index].trim();
      const temporary = join(cacheDirectory, `${item.key}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify({ text }));
        await rename(temporary, join(cacheDirectory, item.key + ".json"));
      } finally {
        await rm(temporary, { force: true });
      }
      resolved.set(original, text);
    }
    done += batch.length;
  }
  abort();
  onProgress(1, "Đã dịch phụ đề. Mốc thời gian được giữ nguyên.");
  return {
    cues: cues.map((cue) => ({ ...cue, text: resolved.get(cue.text) })),
    source,
    target,
  };
}
