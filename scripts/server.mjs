import { imageInfo } from "./image-info.mjs";
import { createServer } from "node:http";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { access, mkdir, stat, writeFile, rm } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { ExportJobs } from "./export-jobs.mjs";
import { ProjectLibrary } from "./project-library.mjs";
import { heavyTasks } from "./resource-queue.mjs";
import {
  imageProxy,
  imageMetadata,
  pruneProxies,
  stopMediaHelpers,
} from "./media-proxy.mjs";
import { analyzeVoice } from "./voice-analysis.mjs";
import { parseProject } from "../dist/model.mjs";
import { parseAutoConfig } from "../dist/auto-config.mjs";
import { pairNarration } from "../dist/narration.mjs";
import { narrationTask } from "./narration-task.mjs";
import { MAX_VOICE_BYTES } from "./voice-input.mjs";
import { actorImages } from "../dist/actor-types.mjs";
import { parseTtsSettings, ttsPlan, speechPlan } from "../dist/tts.mjs";
import { processImages, imageRuntimeStatus } from "./image-processing.mjs";
import { parseImageProcessing } from "../dist/image-processing.mjs";
import { generateTts } from "./tts.mjs";
import { validateCues, languageCode } from "../dist/subtitles.mjs";
import {
  translateSubtitles,
  translationLanguages,
} from "./translate-subtitles.mjs";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT || 3210);
const origin = `http://127.0.0.1:${port}`;
const uploads = join(root, "data/uploads");
const exportsDir = join(root, "data/exports");
const fontsDir = join(root, "data/fonts");
await Promise.all([
  mkdir(uploads, { recursive: true }),
  mkdir(exportsDir, { recursive: true }),
  mkdir(fontsDir, { recursive: true }),
  mkdir(join(root, ".cache"), { recursive: true }),
]);
const exportQueue = new ExportJobs(root, origin);
const projectLibrary = new ProjectLibrary(root);
await exportQueue.initialize();
void pruneProxies().catch(() => {});
const jobs = exportQueue.jobs;
const narrationJobs = new Map();
const ttsJobs = new Map();
const translationJobs = new Map();
const imageJobs = new Map();
const voiceControllers = new Set();
let deletingProject = false,
  activeMutations = 0;
async function trackResources(projectId, resources) {
  if (projectId)
    await projectLibrary.request("track", {
      projectId,
      raw: JSON.stringify({ resources }),
    });
}
async function finishResources(job) {
  try {
    await trackResources(job.projectId, [...(job.resources ?? [])]);
  } catch {
    job.status = "error";
    job.error = "Chưa lưu được liên kết tài nguyên. Kiểm tra ổ đĩa và thử lại.";
  } finally {
    job.running = false;
  }
}
const resourcesFor = (job) => (refs) => {
  for (const ref of refs) job.resources.add(ref);
};
async function buildTranslation(job, input) {
  try {
    job.result = await translateSubtitles(input, {
      onResource: resourcesFor(job),
      signal: job.controller.signal,
      onProgress: (progress, message) => {
        job.progress = progress;
        job.message = message;
      },
    });
    if (!job.controller.signal.aborted) {
      job.status = "done";
      job.progress = 1;
    }
  } catch (error) {
    if (job.status !== "cancelled") {
      job.status = "error";
      job.error = error.message;
    }
  } finally {
    await finishResources(job);
  }
}
async function buildTts(job, input) {
  try {
    const result = await heavyTasks.run(
      () =>
        generateTts(input, {
          onResource: resourcesFor(job),
          signal: job.controller.signal,
          onProgress: (progress, message) => {
            job.progress = progress;
            job.message = message;
          },
        }),
      job.controller.signal,
    );
    if (job.controller.signal.aborted) return;
    job.result = result;
    job.status = "done";
    job.progress = 1;
  } catch (error) {
    if (job.status !== "cancelled") {
      job.status = "error";
      job.error = error.message;
    }
  } finally {
    await finishResources(job);
  }
}
const publicNarration = (job) => ({
  id: job.id,
  status: job.status,
  progress: job.progress,
  message: job.message,
  error: job.error,
  ...(job.status === "done" ? { result: job.result } : {}),
});
async function buildNarration(job, config, project, keep) {
  try {
    job.message = "Đang chờ tài nguyên căn phụ đề…";
    job.result = await heavyTasks.run(
      () =>
        narrationTask(
          { config, project, keep },
          job.controller.signal,
          (progress, message) => {
            job.progress = progress;
            job.message = message;
          },
          resourcesFor(job),
        ),
      job.controller.signal,
    );
    if (job.controller.signal.aborted) return;
    job.status = "done";
    job.progress = 1;
  } catch (error) {
    if (job.status !== "cancelled") {
      job.status = "error";
      job.error = error.message;
    }
  } finally {
    await finishResources(job);
  }
}
const json = (res, code, body) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};
const publicJob = (job) => exportQueue.public(job);
async function streamUpload(req, destination, limit, signal) {
  let size = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      callback(
        size > limit
          ? Object.assign(Error("Voice tối đa 100 MB mỗi file."), {
              status: 413,
            })
          : null,
        chunk,
      );
    },
  });
  await pipeline(req, limiter, createWriteStream(destination), { signal });
}
async function body(req, limit = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const e = new Error(
        "File quá lớn. Ảnh tối đa 25 MB; voice WAV/MP3 100 MB; font 5 MB; dự án 16 MB.",
      );
      e.status = 413;
      throw e;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const mime = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".map": "application/json",
  ".srt": "application/x-subrip; charset=utf-8",
};
async function serveFile(req, res, path, attachment = false, fallback) {
  let info;
  try {
    info = await stat(path);
  } catch {
    if (fallback) return serveFile(req, res, fallback, attachment);
    json(res, 404, {
      error:
        "Không tìm thấy file. Hãy nhập lại ảnh nếu đã chuyển thư mục data.",
    });
    return;
  }
  if (!info.isFile()) {
    json(res, 404, { error: "Không tìm thấy file." });
    return;
  }
  const headers = {
    "Content-Type": mime[extname(path)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control":
      path.includes("/data/uploads/") || path.includes("/.cache/proxies/")
        ? "private, max-age=31536000, immutable"
        : "no-cache",
    "Accept-Ranges": "bytes",
  };
  if (req.headers.origin) {
    headers["Access-Control-Allow-Origin"] = req.headers.origin;
    headers["Vary"] = "Origin";
  }
  if (attachment) {
    const name =
      typeof attachment === "string" ? attachment : "khung-video.mp4";
    headers["Content-Disposition"] =
      `attachment; filename="${extname(path) === ".srt" ? "khung-subtitles.srt" : "khung-video.mp4"}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
  }
  const send = (options) => {
    if (req.method === "HEAD") { res.end(); return; }
    const stream = createReadStream(path, options);
    // A cache file may disappear between stat/open during cleanup. Let the
    // browser recover instead of crashing Node with an unhandled stream error.
    stream.once("error", () => res.destroy());
    res.once("close", () => stream.destroy());
    stream.pipe(res);
  };
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range) {
    const start = Number(range[1]),
      end = range[2]
        ? Math.min(Number(range[2]), info.size - 1)
        : info.size - 1;
    if (start > end || start >= info.size) {
      res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${info.size}`,
      "Content-Length": end - start + 1,
    });
    send({ start, end });
  } else {
    res.writeHead(200, { ...headers, "Content-Length": info.size });
    send();
  }
}
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  let mutation = false;
  try {
    const url = new URL(req.url, origin);
    if (
      req.headers.host !== `127.0.0.1:${port}` &&
      req.headers.host !== `localhost:${port}`
    ) {
      json(res, 403, { error: "Công cụ chỉ dùng cục bộ." });
      return;
    }
    const rendererAssetRequest =
      ["GET", "HEAD"].includes(req.method) &&
      /^\/(media|fonts|samples)\//.test(url.pathname) &&
      [3231, 3232].some((p) =>
        [`http://127.0.0.1:${p}`, `http://localhost:${p}`].includes(
          req.headers.origin,
        ),
      );
    if (
      req.headers.origin &&
      ![origin, `http://localhost:${port}`].includes(req.headers.origin) &&
      !rendererAssetRequest
    ) {
      json(res, 403, { error: "Nguồn yêu cầu không hợp lệ." });
      return;
    }
    if (["POST", "PATCH", "DELETE"].includes(req.method)) {
      if (deletingProject)
        throw Object.assign(
          Error("Đang dọn dự án. Hãy thử lại sau giây lát."),
          { status: 409 },
        );
      activeMutations++;
      mutation = true;
    }
    const owner = req.headers["x-khung-project"];
    if (owner) {
      if (typeof owner !== "string" || !/^[a-f0-9-]{36}$/.test(owner))
        throw Error("ID dự án không hợp lệ.");
      if (mutation)
        await projectLibrary.request("exists", { projectId: owner });
    }
    const projectRoute = url.pathname.match(
      /^\/api\/projects(?:\/([a-f0-9-]{36})(\/delete-preview)?)?$/,
    );
    if (projectRoute) {
      const id = projectRoute[1];
      const action =
        req.method === "GET"
          ? id
            ? projectRoute[2]
              ? "delete-preview"
              : "open"
            : "list"
          : req.method === "POST" && !id
            ? "create"
            : req.method === "PATCH" && id
              ? "save"
              : req.method === "DELETE" && id && !projectRoute[2]
                ? "delete"
                : null;
      if (!action) {
        json(res, 405, { error: "Thao tác dự án không hợp lệ." });
        return;
      }
      if (action === "delete" || action === "delete-preview") {
        if (
          voiceControllers.size ||
          activeMutations > (mutation ? 1 : 0) ||
          [
            ...jobs.values(),
            ...imageJobs.values(),
            ...ttsJobs.values(),
            ...narrationJobs.values(),
            ...translationJobs.values(),
          ].some((job) => job.running)
        )
          throw Object.assign(
            Error(
              "Có tác vụ nhập, xử lý hoặc xuất đang chạy. Chờ hoàn tất hoặc dừng tác vụ trước khi xóa dự án.",
            ),
            { status: 409 },
          );
      }
      if (action === "delete") deletingProject = true;
      let result;
      try {
        if (action === "delete")
          await Promise.all([...exportQueue.writes.values()]);
        result = await projectLibrary.request(action, {
          projectId: id,
          raw: ["POST", "PATCH", "DELETE"].includes(req.method)
            ? (await body(req, 64 * 1024 * 1024)).toString()
            : undefined,
          serialize: action === "delete" ? "deletion" : true,
        });
        if (action === "delete") {
          for (const jobId of result.removedJobs) {
            jobs.delete(jobId);
            exportQueue.writes.delete(jobId);
          }
          result = result.body;
        }
      } finally {
        if (action === "delete") deletingProject = false;
      }
      res.writeHead(action === "create" ? 201 : 200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(result);
      return;
    }
    if (url.pathname === "/api/proxy" && ["GET", "HEAD"].includes(req.method)) {
      const src = url.searchParams.get("src") || "";
      const size = Number(url.searchParams.get("size") || 384);
      if (![384, 960, 1440].includes(size))
        throw Error("Kích thước preview không hợp lệ.");
      const controller = new AbortController();
      const closed = () => { if (!res.writableEnded) controller.abort(); };
      res.once("close", closed);
      const original = join(uploads,
        src.match(/^\/media\/([a-zA-Z0-9_-]+\.(?:png|jpg|webp))$/)?.[1] || "missing");
      try {
        const proxy = await imageProxy(src, size, controller.signal);
        if (!res.destroyed) await serveFile(req, res, proxy, false, original);
      } catch {
        if (!res.destroyed && !controller.signal.aborted)
          await serveFile(req, res, original);
      }
      return;
    }
    if (url.pathname === "/api/images/status" && req.method === "GET") {
      json(res, 200, await imageRuntimeStatus());
      return;
    }
    if (url.pathname === "/api/images/process" && req.method === "POST") {
      if ([...imageJobs.values()].some((job) => job.running)) {
        json(res, 409, { error: "Một tác vụ ảnh đang chạy hoặc đang dừng." });
        return;
      }
      const payload = JSON.parse((await body(req)).toString());
      const project = parseProject(payload.project),
        settings = parseImageProcessing(payload.settings);
      if (!project.assets.length) throw Error("Thêm ảnh trước khi xử lý.");
      if (!settings.removeLogo && !settings.upscale)
        throw Error("Bật xóa logo hoặc upscale trước khi chạy.");
      for (const [id, old] of imageJobs) if (!old.running) imageJobs.delete(id);
      const job = {
        id: randomUUID(),
        status: "processing",
        projectId: owner,
        resources: new Set(),
        progress: 0,
        message: "Đang chuẩn bị xử lý ảnh…",
        running: true,
        controller: new AbortController(),
      };
      imageJobs.set(job.id, job);
      json(res, 202, publicNarration(job));
      void (async () => {
        try {
          job.message = "Đang chờ tài nguyên xử lý ảnh…";
          job.result = await heavyTasks.run(
            () =>
              processImages(project.assets, settings, {
                onResource: resourcesFor(job),
                signal: job.controller.signal,
                onProgress: (progress, message) => {
                  job.progress = progress;
                  job.message = message;
                },
              }),
            job.controller.signal,
          );
          if (!job.controller.signal.aborted) {
            job.status = "done";
            job.progress = 1;
          }
        } catch (error) {
          if (job.status !== "cancelled") {
            job.status = "error";
            job.error = error.message;
          }
        } finally {
          await finishResources(job);
        }
      })();
      return;
    }
    const imageJobId = url.pathname.match(
      /^\/api\/images\/process\/([a-f0-9-]{36})$/,
    )?.[1];
    if (imageJobId) {
      const job = imageJobs.get(imageJobId);
      if (!job) {
        json(res, 404, { error: "Không tìm thấy tác vụ ảnh." });
        return;
      }
      if (!["GET", "DELETE"].includes(req.method)) {
        json(res, 405, { error: "Thao tác không hỗ trợ." });
        return;
      }
      if (req.method === "DELETE" && job.running) {
        job.status = "cancelled";
        job.controller.abort();
      }
      json(res, 200, publicNarration(job));
      return;
    }
    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true, name: "Khung" });
      return;
    }
    if (url.pathname === "/api/subtitles/languages" && req.method === "POST") {
      await body(req, 2048);
      const controller = new AbortController();
      const closed = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.once("close", closed);
      try {
        json(res, 200, {
          languages: await translationLanguages({
            signal: controller.signal,
          }),
        });
      } finally {
        res.removeListener("close", closed);
      }
      return;
    }
    if (url.pathname === "/api/subtitles/translate" && req.method === "POST") {
      if ([...translationJobs.values()].some((j) => j.running)) {
        json(res, 409, { error: "Một tác vụ dịch đang chạy hoặc đang dừng." });
        return;
      }
      const payload = JSON.parse((await body(req)).toString());
      const input = {
        cues: validateCues(payload.cues),
        source: languageCode(payload.source),
        target: languageCode(payload.target),
      };
      if (input.source === input.target)
        throw Error("Chọn ngôn ngữ dịch khác ngôn ngữ gốc.");
      for (const [id, old] of translationJobs)
        if (!old.running) translationJobs.delete(id);
      const job = {
        id: randomUUID(),
        status: "translating",
        projectId: owner,
        resources: new Set(),
        progress: 0,
        message: "Đang chuẩn bị dịch…",
        running: true,
        controller: new AbortController(),
      };
      translationJobs.set(job.id, job);
      json(res, 202, publicNarration(job));
      void buildTranslation(job, input);
      return;
    }
    const translationId = url.pathname.match(
      /^\/api\/subtitles\/translate\/([a-f0-9-]{36})$/,
    )?.[1];
    if (translationId) {
      const job = translationJobs.get(translationId);
      if (!job) {
        json(res, 404, {
          error:
            "Không tìm thấy tác vụ dịch. Thử lại để dùng cache các câu đã dịch.",
        });
        return;
      }
      if (!["GET", "DELETE"].includes(req.method)) {
        json(res, 405, { error: "Thao tác không hỗ trợ." });
        return;
      }
      if (req.method === "DELETE" && job.running) {
        job.status = "cancelled";
        job.controller.abort();
      }
      json(res, 200, publicNarration(job));
      return;
    }
    if (url.pathname === "/api/tts" && req.method === "POST") {
      if ([...ttsJobs.values()].some((job) => job.running)) {
        json(res, 409, {
          error:
            "Một tác vụ TTS đang chạy hoặc đang dừng. Đợi vài giây rồi thử lại.",
        });
        return;
      }
      const payload = JSON.parse((await body(req)).toString());
      const project = parseProject(payload.project),
        settings = parseTtsSettings(payload.settings);
      const script = project.voiceover?.script ?? "";
      ttsPlan(script, project.assets);
      speechPlan(script, settings);
      for (const [id, previous] of ttsJobs)
        if (!previous.running) ttsJobs.delete(id);
      const job = {
        id: randomUUID(),
        status: "generating",
        projectId: owner,
        resources: new Set(),
        progress: 0,
        message: "Đang chuẩn bị tạo voice…",
        running: true,
        controller: new AbortController(),
      };
      ttsJobs.set(job.id, job);
      json(res, 202, publicNarration(job));
      void buildTts(job, { script, images: project.assets, settings });
      return;
    }
    const ttsId = url.pathname.match(/^\/api\/tts\/([a-f0-9-]{36})$/)?.[1];
    if (ttsId) {
      const job = ttsJobs.get(ttsId);
      if (!job) {
        json(res, 404, {
          error: "Không tìm thấy tác vụ TTS. Thử lại để dùng các voice đã lưu.",
        });
        return;
      }
      if (!["GET", "DELETE"].includes(req.method)) {
        json(res, 405, { error: "Thao tác không hỗ trợ." });
        return;
      }
      if (req.method === "DELETE" && job.running) {
        job.status = "cancelled";
        job.controller.abort();
      }
      json(res, 200, publicNarration(job));
      return;
    }
    if (url.pathname === "/api/voices" && req.method === "POST") {
      const controller = new AbortController(),
        abort = () => controller.abort();
      const closed = () => {
        if (!res.writableEnded) abort();
      };
      voiceControllers.add(controller);
      req.once("aborted", abort);
      res.once("close", closed);
      try {
        const name = (url.searchParams.get("name") || "voice.wav").slice(
          0,
          500,
        );
        const extension = name.match(/\.(wav|mp3)$/i)?.[1].toLowerCase();
        if (!extension) throw Error("Voice chỉ nhận WAV hoặc MP3.");
        const voiceId = randomUUID(),
          destination = join(uploads, `${voiceId}.${extension}`);
        let uploaded = false;
        let result;
        try {
          await streamUpload(
            req,
            destination,
            MAX_VOICE_BYTES,
            controller.signal,
          );
          result = await analyzeVoice(destination, name, controller.signal);
          if (controller.signal.aborted) return;
          uploaded = true;
        } finally {
          if (!uploaded) await rm(destination, { force: true });
        }
        const { envelope, info } = result;
        await trackResources(owner, [`/media/${voiceId}.${extension}`]);
        json(res, 201, {
          id: voiceId,
          name,
          src: `/media/${voiceId}.${extension}`,
          duration: info.duration,
          envelope,
        });
      } finally {
        voiceControllers.delete(controller);
        req.removeListener("aborted", abort);
        res.removeListener("close", closed);
      }
      return;
    }
    if (url.pathname === "/api/narration" && req.method === "POST") {
      if ([...narrationJobs.values()].some((j) => j.running)) {
        json(res, 409, {
          error: "Một tác vụ căn phụ đề đang chạy hoặc đang dừng.",
        });
        return;
      }
      const payload = JSON.parse((await body(req)).toString());
      const config = parseAutoConfig(payload.config),
        project = parseProject(payload.project);
      if (!config.narration.enabled || !project.voiceover)
        throw Error("Thêm bộ WAV + TXT và bật dựng theo voice.");
      pairNarration(project.assets, project.voiceover);
      for (const [id, previous] of narrationJobs)
        if (!previous.running) narrationJobs.delete(id);
      const job = {
        id: randomUUID(),
        status: "aligning",
        projectId: owner,
        resources: new Set(),
        progress: 0,
        message: "Đang kiểm tra WAV/TXT…",
        running: true,
        controller: new AbortController(),
      };
      narrationJobs.set(job.id, job);
      json(res, 202, publicNarration(job));
      void buildNarration(job, config, project, payload.keep !== false);
      return;
    }
    const narrationId = url.pathname.match(
      /^\/api\/narration\/([a-f0-9-]{36})$/,
    )?.[1];
    if (narrationId) {
      const job = narrationJobs.get(narrationId);
      if (!job) {
        json(res, 404, {
          error: "Không tìm thấy tác vụ căn phụ đề. Hãy dựng lại.",
        });
        return;
      }
      if (req.method === "DELETE" && job.running) {
        job.status = "cancelled";
        job.controller.abort();
      }
      if (!["GET", "DELETE"].includes(req.method)) {
        json(res, 405, { error: "Thao tác không hỗ trợ." });
        return;
      }
      json(res, 200, publicNarration(job));
      return;
    }
    if (url.pathname === "/api/uploads" && req.method === "POST") {
      const buffer = await body(req, 25 * 1024 * 1024);
      let ext;
      if (
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        ext = "png";
      else if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
        ext = "jpg";
      else if (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      )
        ext = "webp";
      if (!ext) {
        json(res, 415, { error: "Chỉ nhận ảnh PNG, JPG và WebP hợp lệ." });
        return;
      }
      const filename = `${createHash("sha256").update(buffer).digest("hex")}.${ext}`;
      const dimensions = imageInfo(buffer);
      if (dimensions.width * dimensions.height > 40_000_000)
        throw Error("Ảnh tối đa 40 megapixel.");
      await writeFile(join(uploads, filename), buffer, { flag: "wx" }).catch(
        (error) => {
          if (error.code !== "EEXIST") throw error;
        },
      );
      const src = `/media/${filename}`;
      await trackResources(owner, [src]);
      let metadata = dimensions;
      if (ext !== "png") {
        try {
          metadata = { ...dimensions, ...(await imageMetadata(src)) };
        } catch {
          metadata = { ...dimensions, width: 0, height: 0 };
        } // Let the browser read EXIF orientation if Pillow is unavailable.
      }
      json(res, 201, { src, ...metadata });
      return;
    }
    if (url.pathname === "/api/fonts" && req.method === "POST") {
      const buffer = await body(req, 5 * 1024 * 1024),
        magic = buffer.toString("ascii", 0, 4);
      const ext =
        magic === "wOF2"
          ? "woff2"
          : magic === "wOFF"
            ? "woff"
            : magic === "OTTO"
              ? "otf"
              : buffer.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]))
                ? "ttf"
                : null;
      if (!ext) {
        json(res, 415, {
          error: "Font không đúng định dạng WOFF/WOFF2/TTF/OTF.",
        });
        return;
      }
      const fontId = randomUUID(),
        filename = `${fontId}.${ext}`;
      await writeFile(join(fontsDir, filename), buffer);
      await trackResources(owner, [`/fonts/${filename}`]);
      json(res, 201, {
        id: `khung-${fontId}`,
        name: (url.searchParams.get("name") || "Font của bạn").slice(0, 200),
        src: `/fonts/${filename}`,
      });
      return;
    }
    if (url.pathname === "/api/exports" && req.method === "POST") {
      if ([...jobs.values()].filter((job) => job.running).length >= 5)
        throw Error(
          "Hàng đợi đã có 5 video. Chờ hoàn tất hoặc hủy một tác vụ.",
        );
      const payload = JSON.parse((await body(req)).toString());
      const project = parseProject(payload.project);
      if (!project.scenes.length)
        throw new Error("Thêm ít nhất một cảnh trước khi xuất.");
      for (const actor of project.actors ?? []) {
        if (
          !project.scenes.some((s) =>
            s.actors?.some((i) => i.actorId === actor.id),
          )
        )
          continue;
        for (const image of actorImages(actor)) {
          try {
            await access(join(uploads, image.src.slice(7)));
          } catch {
            throw Error(
              `Thiếu ảnh/frame “${image.name}” của ${actor.name}. Nạp lại bộ nhân vật.`,
            );
          }
        }
      }
      for (const voice of (project.voiceover?.assets ?? []).filter((v) =>
        project.scenes.some((s) => s.voice?.assetId === v.id),
      )) {
        try {
          await access(join(uploads, voice.src.slice(7)));
        } catch {
          throw Error(`Thiếu WAV “${voice.name}”. Hãy nhập lại voice.`);
        }
      }
      for (const asset of project.assets.filter((a) =>
        project.scenes.some((s) => s.assetId === a.id),
      )) {
        try {
          await access(
            asset.src.startsWith("/media/")
              ? join(uploads, asset.src.slice(7))
              : join(root, "public", asset.src),
          );
        } catch {
          throw new Error(
            `Thiếu ảnh “${asset.name}”. Hãy nhập lại ảnh và thay ảnh của cảnh.`,
          );
        }
      }
      for (const font of project.fonts.filter((f) =>
        project.scenes.some((s) => s.texts.some((t) => t.fontFamily === f.id)),
      )) {
        try {
          await access(join(fontsDir, font.src.slice(7)));
        } catch {
          throw new Error(
            `Thiếu font “${font.name}”. Nhập lại font hoặc chọn font khác.`,
          );
        }
      }
      const filename = Array.from(
        String(payload.filename || "khung-video.mp4").replace(
          /[\r\n"\\/\x00-\x1f]/g,
          "-",
        ),
      )
        .slice(-180)
        .join("");
      const job = await exportQueue.create(project, {
        projectId: owner,
        filename,
        quality: payload.quality,
        mode: payload.mode,
      });
      await trackResources(owner, ["job:" + job.id]);
      json(res, 202, publicJob(job));
      return;
    }
    if (url.pathname === "/api/exports" && req.method === "GET") {
      json(res, 200, [...jobs.values()].map(publicJob).reverse());
      return;
    }
    const retryId = url.pathname.match(
      /^\/api\/exports\/([a-f0-9-]{36})\/retry$/,
    )?.[1];
    if (retryId && req.method === "POST") {
      json(res, 202, publicJob(await exportQueue.retry(retryId)));
      return;
    }
    const jobId = url.pathname.match(/^\/api\/exports\/([a-f0-9-]{36})$/)?.[1];
    if (jobId) {
      const job = jobs.get(jobId);
      if (!job) {
        json(res, 404, { error: "Không tìm thấy tác vụ xuất." });
        return;
      }
      if (
        req.method === "DELETE" &&
        ["queued", "preparing", "rendering"].includes(job.status)
      ) {
        await exportQueue.cancel(job);
      }
      json(res, 200, publicJob(job));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "Thao tác không hỗ trợ." });
      return;
    }
    if (
      /^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp|wav|mp3)$/.test(url.pathname)
    ) {
      await serveFile(req, res, join(uploads, url.pathname.slice(7)));
      return;
    }
    if (/^\/fonts\/[a-f0-9-]{36}\.(woff2?|ttf|otf)$/.test(url.pathname)) {
      await serveFile(req, res, join(fontsDir, url.pathname.slice(7)));
      return;
    }
    if (/^\/exports\/[a-f0-9-]{36}\.(mp4|srt)$/.test(url.pathname)) {
      const subtitle = url.pathname.endsWith(".srt");
      const filename =
        (subtitle
          ? jobs.get(url.pathname.slice(9, -4))?.subtitleFilename
          : jobs.get(url.pathname.slice(9, -4))?.filename) ||
        (subtitle ? "phu-de.srt" : "khung-video.mp4");
      await serveFile(
        req,
        res,
        join(exportsDir, url.pathname.slice(9)),
        filename,
      );
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const staticPath = resolve(root, "public", relative);
    if (
      !staticPath.startsWith(join(root, "public") + "/") &&
      url.pathname !== "/"
    ) {
      json(res, 404, { error: "Không tìm thấy trang." });
      return;
    }
    if (url.pathname === "/") {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; worker-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'",
      );
      await serveFile(req, res, join(root, "index.html"));
    } else if (
      /^\/((app|project-worker|utility-worker)\.(js|css)(\.map)?)$/.test(
        url.pathname,
      )
    )
      await serveFile(req, res, join(root, "dist", relative));
    else await serveFile(req, res, staticPath);
  } catch (error) {
    if (!res.headersSent)
      json(res, error.status || 400, {
        error: error.message || "Không thực hiện được thao tác.",
      });
    else res.end();
  } finally {
    if (mutation) activeMutations--;
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Khung editor: ${origin}`));
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Cổng ${port} đang được dùng. Chạy PORT=3211 npm run dev.`
      : error,
  );
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    for (const job of imageJobs.values())
      if (job.running) job.controller.abort();
    for (const job of translationJobs.values())
      if (job.running) job.controller.abort();
    for (const job of ttsJobs.values()) if (job.running) job.controller.abort();
    for (const job of narrationJobs.values())
      if (job.running) job.controller.abort();
    for (const controller of voiceControllers) controller.abort();
    stopMediaHelpers();
    await exportQueue.close();
    await projectLibrary.close();
    server.close();
    // Export workers finish graceful cancellation or their 5s process-group deadline.
    const timer = setInterval(() => {
      if (
        !voiceControllers.size &&
        ![
          ...jobs.values(),
          ...imageJobs.values(),
          ...ttsJobs.values(),
          ...narrationJobs.values(),
          ...translationJobs.values(),
        ].some((job) => job.running)
      ) {
        clearInterval(timer);
        process.exit(0);
      }
    }, 100);
  });
