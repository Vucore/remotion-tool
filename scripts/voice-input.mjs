import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { RenderInternals } from "@remotion/renderer";
import { wavInfo } from "./wav-info.mjs";

export const MAX_VOICE_BYTES = 100 * 1024 * 1024;
const aborted = () =>
  Object.assign(Error("Đã huỷ nhập voice."), { name: "AbortError" });

// Use the pinned, local Remotion binary; never invoke a shell or download tools.
export async function runVoiceFfmpeg(
  args,
  { signal, timeoutMs = 60_000 } = {},
) {
  if (signal?.aborted) throw aborted();
  let executable;
  try {
    executable = RenderInternals.getExecutablePath({
      type: "ffmpeg",
      indent: false,
      logLevel: "error",
      binariesDirectory: null,
    });
  } catch (cause) {
    throw Error(
      "Thiếu FFmpeg đi kèm Remotion. Chạy npm install rồi nhập voice lại.",
      { cause },
    );
  }
  const directory = dirname(executable);
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: directory,
      env: {
        ...process.env,
        ...(process.platform === "darwin"
          ? { DYLD_LIBRARY_PATH: directory }
          : {}),
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "",
      timedOut = false,
      killTimer;
    const stop = () => {
      child.kill("SIGTERM");
      killTimer ??= setTimeout(() => child.kill("SIGKILL"), 3000);
      killTimer.unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    timer.unref();
    signal?.addEventListener("abort", stop, { once: true });
    if (signal?.aborted) stop();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (value) => {
      stderr = (stderr + value).slice(-3000);
    });
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", stop);
    };
    child.once("error", (cause) => {
      cleanup();
      reject(
        signal?.aborted
          ? aborted()
          : Error(
              "Không chạy được FFmpeg đi kèm Remotion. Kiểm tra npm install và quyền chạy chương trình.",
              { cause },
            ),
      );
    });
    child.once("close", (code) => {
      cleanup();
      if (signal?.aborted) reject(aborted());
      else if (timedOut)
        reject(
          Error(
            "Đọc MP3 quá lâu. Hãy kiểm tra file hoặc chuyển sang WAV rồi nhập lại.",
          ),
        );
      else if (code !== 0)
        reject(
          Error(
            "Không đọc được MP3. File có thể bị hỏng hoặc không đúng định dạng MP3.",
            { cause: Error(stderr) },
          ),
        );
      else resolve();
    });
  });
}

export async function inspectVoice(bytes, { name, signal } = {}) {
  if (signal?.aborted) throw aborted();
  if (!Buffer.isBuffer(bytes) || !bytes.length)
    throw Error("File voice trống hoặc không hợp lệ.");
  if (bytes.length > MAX_VOICE_BYTES)
    throw Error("Voice WAV/MP3 tối đa 100 MB mỗi file.");
  const format =
    typeof name === "string"
      ? name.match(/\.(wav|mp3)$/i)?.[1].toLowerCase()
      : undefined;
  if (!format) throw Error("Voice chỉ nhận WAV hoặc MP3.");
  if (format === "wav")
    return { bytes, decodedWav: bytes, info: wavInfo(bytes), extension: "wav" };

  const temporary = await mkdtemp(join(tmpdir(), "khung-voice-"));
  try {
    const source = join(temporary, "input.mp3"),
      output = join(temporary, "voice.wav");
    await writeFile(source, bytes);
    // No -ar/-ac/volume/atempo: preserve sample rate, channels, level and speed.
    // Decode slightly past the limit, then reject rather than accept a cut clip.
    await runVoiceFfmpeg(
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-xerror",
        "-err_detect",
        "explode",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "mp3",
        "-i",
        source,
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-t",
        "300.1",
        "-c:a",
        "pcm_s24le",
        "-map_metadata",
        "-1",
        "-fflags",
        "+bitexact",
        "-flags:a",
        "+bitexact",
        "-y",
        output,
      ],
      { signal },
    );
    if (signal?.aborted) throw aborted();
    if ((await stat(output)).size > MAX_VOICE_BYTES)
      throw Error("Voice sau giải mã vượt quá 100 MB.");
    const decoded = await readFile(output);
    // Playback/export always use the untouched source, never this analysis WAV.
    return {
      bytes,
      decodedWav: decoded,
      info: wavInfo(decoded),
      extension: "mp3",
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
