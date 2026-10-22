import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { makeCancelSignal } from "@remotion/renderer";
import { renderProject } from "./render-project.mjs";
import { parseProject } from "../dist/model.mjs";
import { parseAutoConfig } from "../dist/auto-config.mjs";
import { compileAuto } from "../dist/auto.mjs";
import { pairNarration } from "../dist/narration.mjs";
import { prepareNarration } from "./narration.mjs";
import { wavInfo, wavEnvelope } from "./wav-info.mjs";
import { actorImages } from "../dist/actor-types.mjs";

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
const jobs = new Map();
const narrationJobs = new Map();
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
    const prepared = await prepareNarration(
      config,
      project.assets,
      project.voiceover,
      {
        signal: job.controller.signal,
        onProgress: (progress, message) => {
          job.progress = progress;
          job.message = message;
        },
      },
    );
    if (job.controller.signal.aborted) return;
    job.result = compileAuto(config, project.assets, project, keep, prepared);
    job.status = "done";
    job.progress = 1;
  } catch (error) {
    if (job.status !== "cancelled") {
      job.status = "error";
      job.error = error.message;
    }
  } finally {
    job.running = false;
  }
}
const json = (res, code, body) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};
const publicJob = (job) => ({
  id: job.id,
  status: job.status,
  progress: job.progress,
  error: job.error,
  url: job.url,
  filename: job.filename,
});
async function body(req, limit = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const e = new Error(
        "File quá lớn. Ảnh tối đa 25 MB; WAV 100 MB; font 5 MB; dự án 16 MB.",
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
  ".map": "application/json",
};
async function serveFile(req, res, path, attachment = false) {
  let info;
  try {
    info = await stat(path);
  } catch {
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
    "Cache-Control": "no-cache",
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
      `attachment; filename="khung-video.mp4"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
  }
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
    createReadStream(path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, "Content-Length": info.size });
    createReadStream(path).pipe(res);
  }
}
async function render(job, project, quality) {
  try {
    await renderProject(project, {
      origin,
      output: join(exportsDir, `${job.id}.mp4`),
      quality,
      cancelSignal: job.cancelSignal,
      cancelled: () => job.status === "cancelled",
      ports: { composition: 3231, render: 3232 },
      onProgress: (progress, status) => {
        if (job.status !== "cancelled") {
          job.progress = progress;
          job.status = status;
        }
      },
    });
    if (job.status !== "cancelled") {
      job.status = "done";
      job.progress = 1;
      job.url = `/exports/${job.id}.mp4`;
    }
  } catch (error) {
    if (job.status !== "cancelled") {
      job.status = "error";
      job.error = `Không xuất được video: ${error.message}`;
      console.error(error);
    }
  } finally {
    job.running = false;
  }
}
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
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
    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true, name: "Khung" });
      return;
    }
    if (url.pathname === "/api/voices" && req.method === "POST") {
      const bytes = await body(req, 100 * 1024 * 1024),
        info = wavInfo(bytes);
      const voiceId = randomUUID();
      await writeFile(join(uploads, `${voiceId}.wav`), bytes);
      json(res, 201, {
        id: voiceId,
        name: (url.searchParams.get("name") || "voice.wav").slice(0, 500),
        src: `/media/${voiceId}.wav`,
        duration: info.duration,
        envelope: wavEnvelope(bytes, info),
      });
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
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(join(uploads, filename), buffer);
      json(res, 201, { src: `/media/${filename}` });
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
      json(res, 201, {
        id: `khung-${fontId}`,
        name: (url.searchParams.get("name") || "Font của bạn").slice(0, 200),
        src: `/fonts/${filename}`,
      });
      return;
    }
    if (url.pathname === "/api/exports" && req.method === "POST") {
      if ([...jobs.values()].some((j) => j.running)) {
        json(res, 409, {
          error:
            "Một tác vụ xuất đang chạy hoặc đang dừng. Đợi vài giây rồi thử lại.",
        });
        return;
      }
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
      const job = {
        id: randomUUID(),
        filename: Array.from(
          String(payload.filename || "khung-video.mp4").replace(
            /[\r\n"\\/\x00-\x1f]/g,
            "-",
          ),
        )
          .slice(-180)
          .join(""),
        status: "preparing",
        progress: 0,
        running: true,
        ...makeCancelSignal(),
      };
      jobs.set(job.id, job);
      json(res, 202, publicJob(job));
      void render(job, project, payload.quality);
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
        ["preparing", "rendering"].includes(job.status)
      ) {
        job.status = "cancelled";
        job.cancel();
      }
      json(res, 200, publicJob(job));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "Thao tác không hỗ trợ." });
      return;
    }
    if (/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp|wav)$/.test(url.pathname)) {
      await serveFile(req, res, join(uploads, url.pathname.slice(7)));
      return;
    }
    if (/^\/fonts\/[a-f0-9-]{36}\.(woff2?|ttf|otf)$/.test(url.pathname)) {
      await serveFile(req, res, join(fontsDir, url.pathname.slice(7)));
      return;
    }
    if (/^\/exports\/[a-f0-9-]{36}\.mp4$/.test(url.pathname)) {
      const filename =
        jobs.get(url.pathname.slice(9, -4))?.filename || "khung-video.mp4";
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
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'",
      );
      await serveFile(req, res, join(root, "index.html"));
    } else if (/^\/(app\.(js|css)(\.map)?)$/.test(url.pathname))
      await serveFile(req, res, join(root, "dist", relative));
    else await serveFile(req, res, staticPath);
  } catch (error) {
    if (!res.headersSent)
      json(res, error.status || 400, {
        error: error.message || "Không thực hiện được thao tác.",
      });
    else res.end();
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
  process.on(signal, () => {
    for (const job of narrationJobs.values())
      if (job.running) job.controller.abort();
    for (const job of jobs.values())
      if (["preparing", "rendering"].includes(job.status)) job.cancel();
    server.close();
    process.exit(0);
  });
