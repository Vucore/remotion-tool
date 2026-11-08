import { parseEnv } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { defaultTtsSettings, parseVieNeuBaseUrl } from "../dist/tts.mjs";
import { inspectVoice, runVoiceFfmpeg } from "./voice-input.mjs";
import { wavInfo } from "./wav-info.mjs";

// Secrets belong to this backend process, never to a saved project or browser bundle.
let envError = false;
let fileEnv = {};
try {
  const parsed = parseEnv(
    await readFile(join(resolve(import.meta.dirname, ".."), ".env"), "utf8"),
  );
  fileEnv = {
    VIENEU_BASE_URL: parsed.VIENEU_BASE_URL,
    VIENEU_API_KEY: parsed.VIENEU_API_KEY,
  };
} catch (error) {
  envError = error.code !== "ENOENT";
}

const apiKey = () =>
  (process.env.VIENEU_API_KEY ?? fileEnv.VIENEU_API_KEY)?.trim();

export function vieneuConfig() {
  if (envError) throw Error("VieNeu: không đọc được .env của dự án.");
  return {
    configured: !!apiKey(),
    baseUrl: parseVieNeuBaseUrl(
      (process.env.VIENEU_BASE_URL ?? fileEnv.VIENEU_BASE_URL) ||
        defaultTtsSettings().vieneu.baseUrl,
    ),
  };
}

function connection(baseUrl) {
  const config = vieneuConfig();
  if (parseVieNeuBaseUrl(baseUrl) !== config.baseUrl)
    throw Error(
      "VieNeu: URL dự án khác URL backend. Dùng URL server trong Kết nối API hoặc sửa VIENEU_BASE_URL rồi khởi động lại.",
    );
  const key = apiKey();
  if (!key)
    throw Error(
      "VieNeu: thiếu VIENEU_API_KEY trong .env. Thêm key rồi khởi động lại server.",
    );
  if (/[\r\n]/.test(key)) throw Error("VieNeu: API key không hợp lệ.");
  return { baseUrl: config.baseUrl, key };
}

async function readLimited(response, limit) {
  if (!response.body) throw Error("VieNeu trả dữ liệu rỗng.");
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body.cancel();
    throw Error("VieNeu trả dữ liệu vượt giới hạn.");
  }
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("VieNeu trả dữ liệu vượt giới hạn.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function detail(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(detail).join("; ");
  return value?.msg || value?.message || value?.error || value?.detail || "";
}

// Follow only same-origin Modal result redirects. Never forward the Bearer key elsewhere.
async function request(
  connection,
  path,
  init,
  { fetchImpl = fetch, signal } = {},
) {
  let url = new URL(path, connection.baseUrl),
    options = init;
  for (let count = 0; count < 6; count++) {
    signal?.throwIfAborted();
    const response = await fetchImpl(url.href, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${connection.key}`,
      },
      redirect: "manual",
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw Error("VieNeu: chuyển hướng thiếu địa chỉ kết quả.");
    const next = new URL(location, url);
    if (next.origin !== connection.baseUrl || next.username || next.password)
      throw Error("VieNeu: từ chối chuyển hướng API key sang địa chỉ khác.");
    if (
      response.status === 303 ||
      ([301, 302].includes(response.status) && options?.method === "POST")
    )
      options = { method: "GET" };
    url = next;
  }
  throw Error("VieNeu: quá nhiều lần chuyển hướng kết quả.");
}

async function checked(response, key) {
  if (response.ok) return response;
  let message = "";
  try {
    const raw = (await readLimited(response, 8192)).toString("utf8");
    try {
      message = String(detail(JSON.parse(raw)));
    } catch {
      message = raw;
    }
  } catch {
    /* Keep the HTTP status when the error body is unavailable. */
  }
  message = message
    .split(key)
    .join("[đã ẩn]")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 600);
  throw Error(`VieNeu HTTP ${response.status}${message ? `: ${message}` : ""}`);
}

export async function vieneuVoices(baseUrl, context = {}) {
  const auth = connection(baseUrl);
  const signal = AbortSignal.any([
    AbortSignal.timeout(30_000),
    ...(context.signal ? [context.signal] : []),
  ]);
  const response = await checked(
    await request(
      auth,
      "/v1/voices",
      { method: "GET" },
      { ...context, signal },
    ),
    auth.key,
  );
  const data = JSON.parse(
    (await readLimited(response, 128 * 1024)).toString("utf8"),
  );
  const entries = Array.isArray(data) ? data : (data.voices ?? data.data);
  if (!Array.isArray(entries))
    throw Error("VieNeu: danh sách giọng không đúng định dạng.");
  const voices = entries
    .slice(0, 500)
    .map((entry) => {
      const id =
        typeof entry === "string"
          ? entry
          : (entry?.id ?? entry?.voice_id ?? entry?.name);
      const name =
        typeof entry === "string"
          ? entry
          : (entry?.name ?? entry?.display_name ?? id);
      return { id, name };
    })
    .filter(
      (voice) =>
        typeof voice.id === "string" &&
        voice.id.length > 0 &&
        voice.id.length <= 200 &&
        !/[\x00-\x1f]/.test(voice.id),
    )
    .map((voice) => ({
      id: voice.id,
      name:
        typeof voice.name === "string" ? voice.name.slice(0, 200) : voice.id,
    }));
  if (!voices.length) throw Error("VieNeu: server chưa trả giọng mẫu nào.");
  return voices;
}

export async function validateVieNeuReference(bytes, extension, signal) {
  if (bytes.length > 10 * 1024 * 1024)
    throw Error("VieNeu: giọng mẫu tối đa 10 MiB.");
  const inspected = await inspectVoice(bytes, {
    name: `reference.${extension}`,
    signal,
  });
  if (inspected.info.duration < 3 || inspected.info.duration > 8)
    throw Error(
      "VieNeu: clip clone cần dài 3–8 giây. Chọn một WAV/MP3 ngắn, rõ tiếng.",
    );
  return inspected;
}

export async function generateVieNeuSpeech(
  { text, settings, reference },
  context = {},
) {
  const auth = connection(settings.vieneu.baseUrl);
  if (!text.trim() || text.length > 2000)
    throw Error("VieNeu: mỗi lượt nói cần 1–2.000 ký tự.");
  const timeout = AbortSignal.timeout(context.timeoutMs ?? 900_000);
  const signal = context.signal
    ? AbortSignal.any([context.signal, timeout])
    : timeout;
  const transport = { fetchImpl: context.fetchImpl, signal };
  let response;
  if (settings.voiceMode === "reference") {
    if (!reference) throw Error("VieNeu: chọn file clone trước khi tạo voice.");
    const form = new FormData();
    form.append(
      "ref_audio",
      new Blob([reference.bytes]),
      `reference.${reference.extension}`,
    );
    form.append(
      "text_file",
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      "script.txt",
    );
    form.append("mode", "single");
    form.append("response_format", "wav");
    form.append("denoise", String(settings.vieneu.denoise));
    // One turn per job retains the existing scene/voice cache and multi-speaker order.
    response = await checked(
      await request(
        auth,
        "/v1/audio/clone/file?background=true",
        { method: "POST", body: form },
        transport,
      ),
      auth.key,
    );
    if (response.status !== 202)
      throw Error("VieNeu: API clone nền cần trả tác vụ HTTP 202.");
    const job = JSON.parse(
      (await readLimited(response, 16384)).toString("utf8"),
    );
    if (
      typeof job.job_id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(job.job_id)
    )
      throw Error("VieNeu: mã tác vụ nền không hợp lệ.");
    const path = `/v1/audio/jobs/${encodeURIComponent(job.job_id)}`;
    while (true) {
      await delay(2000, undefined, { signal });
      const status = await checked(
        await request(auth, path, { method: "GET" }, transport),
        auth.key,
      );
      const result = JSON.parse(
        (await readLimited(status, 16384)).toString("utf8"),
      );
      if (result.status === "failed")
        throw Error(
          `VieNeu: tác vụ clone lỗi${result.error ? ` · ${String(detail(result.error)).split(auth.key).join("[đã ẩn]").slice(0, 600)}` : ""}`,
        );
      if (result.status === "completed") break;
      if (result.status !== "pending")
        throw Error("VieNeu: trạng thái tác vụ không hợp lệ.");
    }
    response = await checked(
      await request(auth, `${path}/result`, { method: "GET" }, transport),
      auth.key,
    );
  } else {
    response = await checked(
      await request(
        auth,
        "/v1/audio/speech",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "vieneu-v3-turbo",
            input: text,
            voice: settings.voice || "Hải Đăng",
            response_format: "wav",
          }),
        },
        transport,
      ),
      auth.key,
    );
  }
  if (/json|text|zip|html/i.test(response.headers.get("content-type") || "")) {
    await response.body?.cancel();
    throw Error(
      "VieNeu: cần nhận WAV trực tiếp cho từng lượt, không phải ZIP hoặc JSON.",
    );
  }
  const bytes = await readLimited(response, 64 * 1024 * 1024);
  wavInfo(bytes, { minimumDuration: 0.05 });
  if (settings.outputFormat === "wav") return bytes;
  const temporary = await mkdtemp(join(tmpdir(), "khung-vieneu-"));
  try {
    const source = join(temporary, "voice.wav"),
      output = join(temporary, "voice.mp3");
    await writeFile(source, bytes);
    await runVoiceFfmpeg(
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-i",
        source,
        "-map",
        "0:a:0",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "320k",
        "-map_metadata",
        "-1",
        "-y",
        output,
      ],
      { signal },
    );
    return await readFile(output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
