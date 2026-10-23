import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--model"))
  throw Error("Dùng npm run setup:voice -- --model small");
const model = args[1] || "small";
if (!["tiny", "base", "small", "medium"].includes(model))
  throw Error("Model: tiny, base, small hoặc medium.");
function run(command, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveResult()
        : reject(Error(`${command} dừng với mã ${code}.`)),
    );
  });
}
try {
  await run("uv", ["sync"]);
  await run(
    join(
      root,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
    [
      join(root, "scripts/voice/align.py"),
      "--download",
      "--model",
      model,
      "--model-dir",
      join(root, ".cache/whisper"),
    ],
  );
  console.log("Voice đã sẵn sàng trong môi trường uv .venv dùng chung.");
} catch (error) {
  console.error(
    error.code === "ENOENT"
      ? "Cần cài uv trước: https://docs.astral.sh/uv/getting-started/installation/"
      : error.message,
  );
  process.exitCode = 1;
}
