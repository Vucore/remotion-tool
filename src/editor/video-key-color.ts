import { greenScreenColor } from "../video-overlays";

export function detectVideoKeyColor(
  src: string,
  time: number,
  signal: AbortSignal,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    let finished = false;
    const timer = window.setTimeout(
      () => finish(Error("Không đọc được màu nền. Hãy chọn Màu nền cần xóa.")),
      8000,
    );
    const abort = () => finish(new DOMException("Đã hủy", "AbortError"));
    function finish(error: Error | null, color: string | null = null) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      video.onloadeddata = video.onseeked = video.onerror = null;
      video.removeAttribute("src");
      video.load();
      if (error) reject(error);
      else resolve(color);
    }
    function sample() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw Error("Không đọc được màu nền của clip.");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(
          null,
          greenScreenColor(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height,
          ),
        );
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : Error("Không đọc được màu nền của clip."),
        );
      }
    }
    video.onloadeddata = () => {
      video.onloadeddata = null;
      if (time > 0 && video.duration > 0) {
        video.onseeked = sample;
        video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
      } else sample();
    };
    video.onerror = () => finish(Error("Không đọc được clip để lấy màu nền."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    video.src = src;
  });
}
