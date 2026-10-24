import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  rename,
  stat,
  rm,
  readdir,
  utimes,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { setPriority } from "node:os";
import { ResourceQueue } from "./resource-queue.mjs";
const root = resolve(import.meta.dirname, "..");
const queue = new ResourceQueue();
const pending = new Map();
const children = new Set();
let generated = 0;
export function imagePath(src) {
  if (/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(src))
    return join(root, "data/uploads", src.slice(7));
  throw Error("Đường dẫn ảnh không hợp lệ.");
}
function helper(source, destination = "-", size = 384) {
  return queue.run(
    () =>
      new Promise((resolve, reject) => {
        const python = join(
          root,
          ".venv",
          process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
        );
        const child = spawn(
          python,
          [
            join(root, "scripts/media-proxy.py"),
            source,
            destination,
            String(size),
          ],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        children.add(child);
        child.once("close", () => children.delete(child));
        try {
          setPriority(child.pid, 10);
        } catch {
          /* Best effort on supported OSes. */
        }
        let output = "",
          error = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), 30000);
        child.stdout.on("data", (data) => {
          output = (output + data).slice(-4000);
        });
        child.stderr.on("data", (data) => {
          error = (error + data).slice(-1000);
        });
        child.once("error", (cause) => {
          clearTimeout(timer);
          reject(
            Error("Thiếu Python/Pillow cho preview. Chạy uv sync.", { cause }),
          );
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) reject(Error(error || "Không đọc được ảnh."));
          else {
            try {
              resolve(JSON.parse(output));
            } catch {
              reject(Error("Metadata ảnh không hợp lệ."));
            }
          }
        });
      }),
    undefined,
    destination === "-" ? 1 : 0,
  );
}
export const imageMetadata = (src) => helper(imagePath(src));
export async function imageProxy(src, size = 384) {
  const source = imagePath(src);
  const info = await stat(source);
  const key = createHash("sha256")
    .update(JSON.stringify(["proxy-1", src, info.size, info.mtimeMs, size]))
    .digest("hex");
  const destination = join(root, ".cache/proxies", key + ".webp");
  try {
    await access(destination);
    void utimes(destination, new Date(), new Date()).catch(() => {});
    return destination;
  } catch {
    /* Generate on first use. */
  }
  if (!pending.has(key)) {
    const task = (async () => {
      await mkdir(join(root, ".cache/proxies"), { recursive: true });
      const temporary = destination + "." + randomUUID();
      try {
        await helper(source, temporary, size);
        await rename(temporary, destination);
      } finally {
        await rm(temporary, { force: true });
      }
      if (++generated % 25 === 0) void pruneProxies().catch(() => {});
      return destination;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return pending.get(key);
}

export async function pruneProxies(maxBytes = 512 * 1024 ** 2) {
  const directory = join(root, ".cache/proxies");
  const files = [];
  for (const name of await readdir(directory).catch(() => [])) {
    if (!/^[a-f0-9]{64}\.webp$/.test(name) || pending.has(name.slice(0, -5)))
      continue;
    try {
      const info = await stat(join(directory, name));
      files.push({ name, size: info.size, time: info.mtimeMs });
    } catch {
      /* Already removed. */
    }
  }
  let bytes = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of files.sort((a, b) => a.time - b.time)) {
    if (bytes <= maxBytes) break;
    await rm(join(directory, file.name), { force: true });
    bytes -= file.size;
  }
}

export function stopMediaHelpers() {
  for (const child of children) child.kill("SIGTERM");
}
