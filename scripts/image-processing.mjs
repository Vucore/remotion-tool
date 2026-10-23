import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseImageProcessing } from "../dist/image-processing.mjs";
const root = resolve(import.meta.dirname, "..");
const python = join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const exists = async (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const hashFile = async (path) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};
const aborted = () =>
  Error("Đã dừng xử lý ảnh. Ảnh trong dự án được giữ nguyên.");
export async function imageRuntimeStatus() {
  const weights = (scale) =>
    join(root, ".cache/models/realesrgan", `RealESRGAN_x${scale}plus.pth`);
  const models = {
    lama: await exists(join(root, "lama_fp32.onnx")),
    upscale2:
      (await exists(weights(2))) ||
      (await exists(join(root, "weights/RealESRGAN_x2plus.pth"))),
    upscale4:
      (await exists(weights(4))) ||
      (await exists(join(root, "weights/RealESRGAN_x4plus.pth"))),
  };
  if (!(await exists(python)))
    return { python: false, missing: [".venv"], ...models };
  const missing = await new Promise((resolveResult) => {
    const child = spawn(
      python,
      [
        "-c",
        "import importlib.util,json; print(json.dumps([m for m in ['cv2','numpy','onnxruntime','PIL','torch'] if importlib.util.find_spec(m) is None]))",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let output = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
    child.stdout.on("data", (chunk) => {
      if (output.length < 4096) output += chunk;
    });
    child.on("error", () => {});
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolveResult(JSON.parse(output));
      } catch {
        resolveResult(["Không đọc được môi trường .venv"]);
      }
    });
  });
  return { python: true, missing, ...models };
}
export function runImageWorker(
  payload,
  { signal, onProgress = () => {} } = {},
) {
  return new Promise((resolveResult, reject) => {
    if (signal?.aborted) return reject(aborted());
    const child = spawn(python, [join(root, "scripts/process-images.py")], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "",
      failure,
      force;
    const events = [];
    const stop = () => {
      child.kill("SIGTERM");
      force ??= setTimeout(() => child.kill("SIGKILL"), 3000);
      force.unref();
    };
    const cancel = () => {
      failure = aborted();
      stop();
    };
    const timer = setTimeout(
      () => {
        failure = Error(
          "Xử lý ảnh quá 30 phút. Giảm hệ số upscale hoặc kích thước ảnh.",
        );
        stop();
      },
      30 * 60 * 1000,
    );
    signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        try {
          const event = JSON.parse(line);
          events.push(event);
          if (events.length > 2000)
            throw Error("Quá nhiều phản hồi xử lý ảnh.");
          if (event.type === "fatal") failure = Error(event.error);
          onProgress(event);
        } catch (error) {
          failure ??= Error("Bộ xử lý ảnh trả dữ liệu không hợp lệ.");
          stop();
        }
      }
      if (buffer.length > 16000) {
        failure = Error("Phản hồi xử lý ảnh quá lớn.");
        stop();
      }
    });
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.on("error", () => {
      failure = Error("Chưa có môi trường Python. Chạy uv sync trước.");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(force);
      signal?.removeEventListener("abort", cancel);
      if (signal?.aborted) return reject(aborted());
      if (failure) return reject(failure);
      if (code !== 0)
        return reject(
          Error(
            "Bộ xử lý ảnh dừng bất thường. Kiểm tra uv sync, model và bộ nhớ máy.",
          ),
        );
      resolveResult(events);
    });
    if (signal?.aborted) cancel();
    child.stdin.end(JSON.stringify(payload));
  });
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
function pngSize(bytes) {
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw Error("Kết quả xử lý không phải ảnh PNG hợp lệ.");
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (
    !width ||
    !height ||
    width > 30000 ||
    height > 30000 ||
    width * height > 40_000_000
  )
    throw Error("Kích thước ảnh kết quả vượt giới hạn.");
  return { width, height };
}
export async function processImages(
  assets,
  settings,
  {
    assetDirectory = join(root, "data/uploads"),
    cacheDirectory = join(root, ".cache/images"),
    signal,
    onProgress = () => {},
    worker = runImageWorker,
    modelSignature,
  } = {},
) {
  const config = parseImageProcessing(settings);
  if (!config.removeLogo && !config.upscale)
    throw Error("Bật xóa logo hoặc upscale trước khi chạy.");
  if (!assets.length || assets.length > 300)
    throw Error("Chọn từ 1 đến 300 ảnh.");
  const temporary = await mkdtemp(join(tmpdir(), "khung-images-"));
  try {
    await mkdir(cacheDirectory, { recursive: true });
    await mkdir(assetDirectory, { recursive: true });
    const signature = modelSignature ?? {
      lama: config.removeLogo
        ? await hashFile(join(root, "lama_fp32.onnx")).catch(() => {
            throw Error("Thiếu lama_fp32.onnx trong thư mục dự án.");
          })
        : null,
      upscale: config.upscale
        ? await hashFile(
            (await exists(
              join(
                root,
                ".cache/models/realesrgan",
                `RealESRGAN_x${config.scale}plus.pth`,
              ),
            ))
              ? join(
                  root,
                  ".cache/models/realesrgan",
                  `RealESRGAN_x${config.scale}plus.pth`,
                )
              : join(root, "weights", `RealESRGAN_x${config.scale}plus.pth`),
          ).catch(() => {
            throw Error(
              `Thiếu model upscale x${config.scale}. Chạy npm run setup:images -- --scale ${config.scale}.`,
            );
          })
        : null,
    };
    const tasks = [],
      results = [],
      errors = [];
    let cached = 0;
    for (const asset of assets) {
      if (signal?.aborted) throw aborted();
      const source = asset.original ?? {
        src: asset.src,
        width: asset.width,
        height: asset.height,
      };
      if (!/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(source.src))
        throw Error(`${asset.name}: xử lý ảnh chỉ nhận ảnh đã upload.`);
      const input = join(assetDirectory, source.src.slice(7));
      if ((await stat(input)).size > 25 * 1024 * 1024)
        throw Error(`${asset.name}: ảnh nguồn tối đa 25 MB.`);
      const key = createHash("sha256")
        .update(
          JSON.stringify({
            version: "images-v1",
            source: await hashFile(input),
            config: { ...config, autoOnImport: undefined },
            signature,
          }),
        )
        .digest("hex");
      const recordPath = join(cacheDirectory, `${key}.json`);
      const decorate = (file, size) => ({
        ...asset,
        src: `/media/${file}`,
        ...size,
        original: source,
      });
      try {
        const record = JSON.parse(await readFile(recordPath, "utf8"));
        if (!/^[a-f0-9]{64}\.png$/.test(record.file)) throw Error("cache");
        const path = join(assetDirectory, record.file);
        if ((await stat(path)).size > 170 * 1024 * 1024) throw Error("cache");
        const bytes = await readFile(path);
        if (
          createHash("sha256").update(bytes).digest("hex") !==
          record.file.slice(0, 64)
        )
          throw Error("cache");
        results.push(decorate(record.file, pngSize(bytes)));
        cached++;
      } catch {
        tasks.push({
          asset,
          source,
          input,
          output: join(temporary, `${tasks.length}.png`),
          name: asset.name,
          recordPath,
          decorate,
        });
      }
    }
    if (tasks.length) {
      const events = await worker(
        {
          settings: config,
          tasks: tasks.map(({ input, output, name }) => ({
            input,
            output,
            name,
          })),
        },
        {
          signal,
          onProgress: (event) => {
            if (event.type === "progress")
              onProgress((cached + event.index) / assets.length, event.message);
          },
        },
      );
      if (signal?.aborted) throw aborted();
      for (const [index, task] of tasks.entries()) {
        const event = events.find(
          (event) =>
            event.index === index && ["result", "error"].includes(event.type),
        );
        if (event?.type !== "result") {
          errors.push({
            id: task.asset.id,
            name: task.name,
            error: event?.error || "Không nhận được kết quả ảnh.",
          });
          continue;
        }
        try {
          if ((await stat(task.output)).size > 170 * 1024 * 1024)
            throw Error("Ảnh kết quả vượt 170 MB.");
          const bytes = await readFile(task.output),
            size = pngSize(bytes),
            file = `${createHash("sha256").update(bytes).digest("hex")}.png`;
          await atomicWrite(join(assetDirectory, file), bytes);
          await atomicWrite(task.recordPath, JSON.stringify({ file }));
          results.push(task.decorate(file, size));
        } catch (error) {
          errors.push({
            id: task.asset.id,
            name: task.name,
            error: error.message,
          });
        }
      }
    }
    onProgress(
      1,
      `Đã xử lý ${results.length}/${assets.length} ảnh${errors.length ? ` · ${errors.length} lỗi` : ""}.`,
    );
    return {
      assets: assets.flatMap((asset) => {
        const result = results.find((item) => item.id === asset.id);
        return result ? [result] : [];
      }),
      errors,
      cached,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
