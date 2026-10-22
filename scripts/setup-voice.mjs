import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, ".."),
  envDir = join(root, ".venv-voice");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--model"))
  throw Error("Dùng npm run setup:voice -- --model small");
const model = args[1] || "small";
if (!["tiny", "base", "small", "medium"].includes(model))
  throw Error("Model: tiny, base, small hoặc medium.");
const python = join(
  envDir,
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(Error(`${command} dừng với mã ${code}.`)),
    );
  });
}
try {
  // uv selects a supported Python without modifying the system interpreter.
  if (!existsSync(python))
    await run("uv", ["venv", "--python", "3.11", envDir]);
  await run("uv", [
    "pip",
    "install",
    "--python",
    python,
    "-r",
    join(root, "scripts/voice/requirements.txt"),
  ]);
  await run(python, [
    join(root, "scripts/voice/align.py"),
    "--download",
    "--model",
    model,
    "--model-dir",
    join(root, ".cache/whisper"),
  ]);
  console.log(
    "Voice đã sẵn sàng. Đưa ảnh + WAV + script.txt vào Khung để tự dựng.",
  );
} catch (error) {
  console.error(
    error.code === "ENOENT"
      ? "Cần cài uv trước khi chạy setup:voice: https://docs.astral.sh/uv/getting-started/installation/"
      : error.message,
  );
  process.exitCode = 1;
}
