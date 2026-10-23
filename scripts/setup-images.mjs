import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--scale" || !["2", "4"].includes(args[1]))
  throw Error(
    "Dùng npm run setup:images -- --scale 2 (hoặc 4). Cài thư viện trước bằng uv sync.",
  );
const python = join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const child = spawn(
  python,
  [
    "-c",
    "from scripts.images.image_upscaler import download_weights; import sys; print(download_weights(int(sys.argv[1])))",
    args[1],
  ],
  { cwd: root, stdio: "inherit" },
);
child.on("error", () => {
  console.error("Không tìm thấy .venv. Chạy uv sync trước.");
  process.exitCode = 1;
});
child.on("close", (code) => {
  if (code) process.exitCode = code;
});
