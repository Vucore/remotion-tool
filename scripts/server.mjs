import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  makeCancelSignal,
} from "@remotion/renderer";
import { parseProject } from "../dist/model.mjs";

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
let bundlePromise;
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
});
async function body(req, limit = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const e = new Error(
        "File quá lớn. Ảnh tối đa 25 MB; font 5 MB; dự án 16 MB.",
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
  if (attachment)
    headers["Content-Disposition"] = 'attachment; filename="khung-video.mp4"';
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
    if (!bundlePromise)
      bundlePromise = bundle({
        entryPoint: join(root, "src/remotion.tsx"),
        publicDir: join(root, "public"),
        outDir: join(root, ".cache/remotion"),
        onProgress: (value) => {
          if (job.status === "preparing") job.progress = (value / 100) * 0.12;
        },
      }).catch((error) => {
        bundlePromise = undefined;
        throw error;
      });
    const serveUrl = await bundlePromise;
    if (job.status === "cancelled") return;
    const inputProps = {
      project: {
        ...project,
        assets: project.assets.map((a) => ({ ...a, src: origin + a.src })),
        fonts: project.fonts.map((f) => ({ ...f, src: origin + f.src })),
      },
    };
    const composition = await selectComposition({
      serveUrl,
      id: "ImageVideo",
      inputProps,
      port: 3231,
      chromiumOptions: { gl: "angle" },
    });
    if (job.status === "cancelled") return;
    job.status = "rendering";
    job.progress = 0.15;
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      crf: quality === "high" ? 18 : 23,
      pixelFormat: "yuv420p",
      outputLocation: join(exportsDir, `${job.id}.mp4`),
      concurrency: 2,
      cancelSignal: job.cancelSignal,
      port: 3232,
      chromiumOptions: { gl: "angle" },
      onProgress: ({ progress }) => {
        if (job.status === "rendering") job.progress = 0.15 + progress * 0.85;
      },
    });
    if (job.status !== "cancelled") {
      job.status = "done";
      job.progress = 1;
      job.url = `/exports/${job.id}.mp4`;
    }
  } catch (error) {
    if (job.status === "cancelled") job.status = "cancelled";
    else {
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
    if (/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(url.pathname)) {
      await serveFile(req, res, join(uploads, url.pathname.slice(7)));
      return;
    }
    if (/^\/fonts\/[a-f0-9-]{36}\.(woff2?|ttf|otf)$/.test(url.pathname)) {
      await serveFile(req, res, join(fontsDir, url.pathname.slice(7)));
      return;
    }
    if (/^\/exports\/[a-f0-9-]{36}\.mp4$/.test(url.pathname)) {
      await serveFile(req, res, join(exportsDir, url.pathname.slice(9)), true);
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
    for (const job of jobs.values())
      if (["preparing", "rendering"].includes(job.status)) job.cancel();
    server.close();
    process.exit(0);
  });
