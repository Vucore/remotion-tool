import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  access,
  rename,
  rm,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { resolve, dirname, join, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { makeCancelSignal } from "@remotion/renderer";
import { compileAuto, hash } from "../dist/auto.mjs";
import { parseAutoConfig } from "../dist/auto-config.mjs";
import { imageInfo } from "./image-info.mjs";
import { renderProject } from "./render-project.mjs";
import { inspectVoice } from "./voice-input.mjs";
import { prepareNarration } from "./narration.mjs";
import { parseScript } from "../dist/narration.mjs";
import { loadActorPacks } from "./actor-packs.mjs";

const root = resolve(import.meta.dirname, "..");
const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);
async function readJson(path) {
  const info = await stat(path);
  if (info.size > 16 * 1024 * 1024) throw Error(`${path}: JSON tối đa 16 MB.`);
  return JSON.parse(await readFile(path, "utf8"));
}
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function localResources(files) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://127.0.0.1").pathname,
      file = files.get(path);
    if (!file || !["GET", "HEAD"].includes(req.method)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader(
      "Content-Type",
      {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".otf": "font/otf",
        ".ttf": "font/ttf",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
      }[extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    const info = await stat(file).catch(() => null);
    if (!info) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader("Accept-Ranges", "bytes");
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    let start = 0,
      end = info.size - 1;
    if (range) {
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), end) : end;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
    }
    res.setHeader("Content-Length", end - start + 1);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file, { start, end })
      .on("error", () => res.destroy())
      .pipe(res);
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((done) => {
        server.close(done);
        server.closeAllConnections();
      }),
  };
}
export async function runAuto({
  config: configPath,
  images,
  voices,
  script,
  out,
  planOnly = false,
  overwrite = false,
  resume = false,
  assetDirectory = join(root, "data/uploads"),
  signal,
  onProgress = () => {},
}) {
  const fullConfig = resolve(configPath),
    base = dirname(fullConfig);
  const rawConfig = await readJson(fullConfig);
  const config = parseAutoConfig(
    rawConfig?.presetVersion === 1 ? rawConfig.config : rawConfig,
  );
  if (
    !config.narration.enabled &&
    config.text.source === "file" &&
    !Object.keys(config.text.captions).length
  )
    config.text.captions = await readJson(resolve(base, config.text.file));
  const directory = resolve(base, images ?? config.input.directory),
    output = resolve(base, out ?? config.output.file);
  if (!/\.mp4$/i.test(output)) throw Error("Đầu ra phải có đuôi .mp4.");
  const projectFile = output.replace(/\.mp4$/i, ".khung.json"),
    reportFile = output.replace(/\.mp4$/i, ".report.json");
  for (const path of [output, projectFile, reportFile])
    if (!overwrite && !resume && (await exists(path)))
      throw Error(`Đã có ${path}. Đổi đầu ra hoặc truyền --overwrite.`);
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (e) =>
        e.isFile() &&
        config.input.extensions.includes(
          extname(e.name).slice(1).toLowerCase(),
        ),
    )
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (!entries.length || entries.length > 300)
    throw Error("Thư mục cần 1–300 ảnh JPG/PNG/WebP, không đọc thư mục con.");
  const files = new Map(),
    assets = [],
    manifest = [];
  await mkdir(assetDirectory, { recursive: true });
  for (const entry of entries) {
    if (signal?.aborted) throw Error("Đã huỷ.");
    const original = join(directory, entry.name),
      info = await stat(original);
    if (info.size > 25 * 1024 * 1024)
      throw Error(`${entry.name}: ảnh tối đa 25 MB.`);
    const bytes = await readFile(original);
    let dimensions;
    try {
      dimensions = imageInfo(bytes);
    } catch (error) {
      throw Error(`${entry.name}: ${errorMessage(error)}`);
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const stored = join(assetDirectory, `${digest}.${dimensions.ext}`),
      src = `/media/${digest}.${dimensions.ext}`;
    await writeFile(stored, bytes);
    files.set(src, stored);
    assets.push({
      id: `asset-${hash(entry.name)}-${digest.slice(0, 12)}`,
      name: entry.name,
      src,
      width: dimensions.width,
      height: dimensions.height,
    });
    manifest.push({ name: entry.name, sha256: digest });
  }
  let narration;
  if (config.narration.enabled) {
    const scriptPath = resolve(base, script ?? config.narration.script);
    if ((await stat(scriptPath)).size > 1_000_000)
      throw Error("TXT tối đa 1 MB, mã hoá UTF-8.");
    const content = await readFile(scriptPath, "utf8");
    parseScript(content);
    const voiceDirectory = resolve(base, voices ?? config.narration.directory);
    const voiceFiles = (
      await readdir(voiceDirectory, { withFileTypes: true })
    ).filter((e) => e.isFile() && /\.(wav|mp3)$/i.test(e.name));
    if (!voiceFiles.length || voiceFiles.length > 300)
      throw Error("Thư mục voice cần 1–300 WAV/MP3, không đọc thư mục con.");
    const voiceAssets = [];
    for (const entry of voiceFiles) {
      if (signal?.aborted) throw Error("Đã huỷ.");
      const path = join(voiceDirectory, entry.name);
      if ((await stat(path)).size > 100 * 1024 * 1024)
        throw Error(`${entry.name}: voice tối đa 100 MB.`);
      onProgress(0, `Đang nhập voice · ${entry.name}`);
      const inspected = await inspectVoice(await readFile(path), {
        name: entry.name,
        signal,
      });
      const { bytes, info: metadata, extension } = inspected,
        digest = createHash("sha256").update(bytes).digest("hex");
      const src = `/media/${digest}.${extension}`,
        stored = join(assetDirectory, `${digest}.${extension}`);
      await writeFile(stored, bytes);
      files.set(src, stored);
      voiceAssets.push({
        id: `voice-${hash(entry.name)}-${digest.slice(0, 12)}`,
        name: entry.name,
        src,
        duration: metadata.duration,
      });
    }
    narration = await prepareNarration(
      config,
      assets,
      {
        assets: voiceAssets,
        script: content,
        scriptName: basename(scriptPath),
      },
      {
        assetDirectory,
        signal,
        onProgress: (value, message) => onProgress(value * 0.35, message),
      },
    );
    manifest.push(...narration.manifest, {
      name: basename(scriptPath),
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  let actors = [],
    actorWarnings = [];
  if (config.characters.enabled) {
    const imported = await loadActorPacks(
      config.characters.directories.map((p) => resolve(base, p)),
      { assetDirectory, signal },
    );
    actors = imported.actors;
    actorWarnings = imported.warnings;
    manifest.push(...imported.manifest);
    for (const [src, file] of imported.resources) files.set(src, file);
  }
  const { project, report } = compileAuto(
    config,
    assets,
    undefined,
    false,
    narration,
    actors,
  );
  report.warnings.push(...actorWarnings);
  const usedFonts = new Set(
    project.scenes
      .flatMap((s) => s.texts.map((t) => t.fontFamily))
      .filter((f) => f.startsWith("khung-")),
  );
  if (usedFonts.size)
    throw Error(
      "CLI config này dùng font đã nhập trong editor. Chọn font hệ thống trong text.style.fontFamily.",
    );
  await mkdir(dirname(output), { recursive: true });
  const runHash = createHash("sha256")
    .update(JSON.stringify({ config, manifest, output, engine: "khung-0.5.0" }))
    .digest("hex");
  const runReport = {
    ...report,
    engine: "khung-0.5.0",
    manifest,
    runHash,
    output,
    status: planOnly ? "planned" : "rendering",
  };
  if (
    resume &&
    !planOnly &&
    (await exists(output)) &&
    (await exists(reportFile))
  ) {
    const previous = await readJson(reportFile);
    if (
      previous.status === "done" &&
      previous.runHash === runHash &&
      previous.outputBytes > 0 &&
      previous.outputBytes === (await stat(output)).size
    )
      return {
        project,
        report: { ...previous, skipped: true },
        projectFile,
        reportFile,
      };
  }
  // Planning is useful for validation and does not need a browser or a server.
  if (planOnly) {
    await writeFile(projectFile, JSON.stringify(project, null, 2));
    await writeFile(reportFile, JSON.stringify(runReport, null, 2));
    return { project, report: runReport, projectFile, reportFile };
  }
  const media = await localResources(files),
    cancel = makeCancelSignal(),
    temporary = output.replace(/\.mp4$/i, `.${process.pid}.partial.mp4`);
  const abort = () => cancel.cancel();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw Error("Đã huỷ.");
    await renderProject(project, {
      origin: media.origin,
      output: temporary,
      quality: config.output.quality,
      cancelSignal: cancel.cancelSignal,
      cancelled: () => signal?.aborted,
      onProgress: (value, stage) =>
        onProgress(narration ? 0.35 + value * 0.65 : value, stage),
    });
    if (signal?.aborted) throw Error("Đã huỷ.");
    await rename(temporary, output);
    runReport.status = "done";
    runReport.outputBytes = (await stat(output)).size;
    await writeFile(projectFile, JSON.stringify(project, null, 2));
    await writeFile(reportFile, JSON.stringify(runReport, null, 2));
    return { project, report: runReport, projectFile, reportFile };
  } catch (error) {
    runReport.status = signal?.aborted ? "cancelled" : "error";
    runReport.error = errorMessage(error);
    await writeFile(reportFile, JSON.stringify(runReport, null, 2));
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await media.close();
    await rm(temporary, { force: true });
  }
}
function argumentsFor(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (["--plan", "--overwrite", "--resume", "--help"].includes(key))
      args[key.slice(2)] = true;
    else if (
      [
        "--config",
        "--images",
        "--voices",
        "--script",
        "--out",
        "--batch",
      ].includes(key) &&
      argv[i + 1] &&
      !argv[i + 1].startsWith("--")
    )
      args[key.slice(2)] = argv[++i];
    else throw Error(`Tham số không hợp lệ: ${key}`);
  }
  return args;
}
async function main() {
  const args = argumentsFor(process.argv.slice(2));
  if (args.config && args.batch) throw Error("Chọn --config hoặc --batch.");
  if (args.help || (!args.config && !args.batch)) {
    console.log(
      "npm run auto -- --config ./auto-edit.config.json [--images ./images] [--voices ./voices] [--script ./script.txt] [--out ./video.mp4] [--plan] [--overwrite]\nnpm run auto -- --batch ./jobs.json [--resume]",
    );
    return;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    let jobs;
    if (args.batch) {
      const full = resolve(args.batch),
        payload = await readJson(full);
      if (
        !Array.isArray(payload.jobs) ||
        !payload.jobs.length ||
        payload.jobs.length > 100
      )
        throw Error("jobs.json: cần 1–100 công việc.");
      jobs = payload.jobs.map((job) => {
        if (!job || typeof job.config !== "string")
          throw Error("Mỗi công việc cần đường dẫn config.");
        return { ...job, config: resolve(dirname(full), job.config) };
      });
    } else jobs = [args];
    let failed = 0;
    const summary = jobs.map((job) => ({
      config: job.config,
      status: "pending",
    }));
    for (const [index, job] of jobs.entries()) {
      if (controller.signal.aborted) break;
      console.log(`[${index + 1}/${jobs.length}] ${job.config}`);
      try {
        let percentage = -1;
        const result = await runAuto({
          ...job,
          planOnly: Boolean(args.plan),
          overwrite: Boolean(args.overwrite),
          resume: Boolean(args.resume),
          signal: controller.signal,
          onProgress: (value, stage) => {
            const n = Math.floor(value * 20) * 5;
            if (n !== percentage) {
              percentage = n;
              console.log(`${stage}: ${n}%`);
            }
          },
        });
        summary[index] = {
          config: job.config,
          status: result.report.status,
          skipped: Boolean(result.report.skipped),
          output: result.report.output,
          reportFile: result.reportFile,
        };
        console.log(
          `${result.report.skipped ? "Đã xong, đầu vào không đổi; bỏ qua" : result.report.status}: ${result.report.seconds}s · ${result.report.sceneCount} cảnh · ${result.reportFile}`,
        );
      } catch (error) {
        failed++;
        summary[index] = {
          config: job.config,
          status: controller.signal.aborted ? "cancelled" : "error",
          error: errorMessage(error),
        };
        console.error(errorMessage(error));
      }
    }
    if (args.batch) {
      const path = resolve(args.batch).replace(/\.json$/i, "") + ".report.json";
      await writeFile(
        path,
        JSON.stringify({ version: 1, jobs: summary }, null, 2),
      );
      console.log(`Báo cáo hàng đợi: ${path}`);
    }
    if (failed || controller.signal.aborted)
      process.exitCode = controller.signal.aborted ? 130 : 1;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
