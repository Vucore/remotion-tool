import { validateCues, type SubtitleCue } from "../auto/subtitles";

export type TranslationJob = {
  id: string;
  status: string;
  progress?: number;
  message?: string;
  retryAt?: number | null;
  error?: string;
  errorCode?: string;
  result?: { cues: SubtitleCue[]; untranslatedIndices?: number[] };
};
export function subtitleWait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(Error("Đã dừng dịch."));
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      reject(Error("Đã dừng dịch."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

// Reuse the client ID after a lost POST response; never start a second job accidentally.
export async function translateSubtitleDocument(
  input: { cues: SubtitleCue[]; source: string; target: string },
  {
    signal,
    headers = {},
    onUpdate = () => {},
    onUntranslated = () => {},
    fetchImpl = fetch,
    wait = subtitleWait,
  }: {
    signal: AbortSignal;
    headers?: Record<string, string>;
    onUpdate?: (job: TranslationJob) => void;
    onUntranslated?: (indices: number[]) => void;
    fetchImpl?: typeof fetch;
    wait?: typeof subtitleWait;
  },
): Promise<SubtitleCue[]> {
  const requestId = crypto.randomUUID();
  const body = JSON.stringify({ ...input, requestId });
  let jobId: string = requestId,
    complete = false;
  const cancel = async () => {
    await fetchImpl(`/api/subtitles/translate/${jobId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  };
  async function read(
    url: string,
    init: RequestInit,
    honorAbort: boolean,
  ): Promise<TranslationJob> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetchImpl(url, {
          ...init,
          signal: honorAbort
            ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
            : AbortSignal.timeout(30000),
        });
        const result = await response.json();
        if (!response.ok) {
          const error = Object.assign(
            Error(result.error || "Không kết nối được tác vụ dịch."),
            {
              code: response.status === 409 ? "BUSY" : "HTTP",
              status: response.status,
            },
          );
          throw error;
        }
        return result;
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (signal.aborted || (status && status < 500)) throw error;
        if (attempt >= 3)
          throw Object.assign(
            error instanceof Error ? error : Error("Mất kết nối tác vụ dịch."),
            { code: status ? "HTTP" : "NETWORK" },
          );
        onUpdate({
          id: jobId,
          status: "reconnecting",
          message: `Mất kết nối; đang thử nối lại (${attempt + 1}/3)…`,
        });
        await wait((attempt + 1) * 2000, honorAbort ? signal : undefined);
      }
    }
  }
  signal.addEventListener("abort", cancel, { once: true });
  try {
    let job = await read(
      "/api/subtitles/translate",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body,
      },
      false,
    );
    jobId = job.id;
    while (true) {
      signal.throwIfAborted();
      onUpdate(job);
      if (job.status === "done") {
        const cues = validateCues(job.result?.cues);
        if (
          cues.length !== input.cues.length ||
          cues.some(
            (cue, i) =>
              cue.startMs !== input.cues[i].startMs ||
              cue.endMs !== input.cues[i].endMs,
          )
        )
          throw Error(
            "Bản dịch chưa đầy đủ hoặc lệch timestamp. Đã giữ bản gốc; hãy thử lại.",
          );
        onUntranslated(job.result?.untranslatedIndices ?? []);
        complete = true;
        return cues;
      }
      if (["error", "cancelled"].includes(job.status))
        throw Object.assign(Error(job.error || "Đã dừng dịch."), {
          code: job.errorCode,
        });
      await wait(1000, signal);
      job = await read(`/api/subtitles/translate/${jobId}`, {}, true);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!complete) await cancel();
  }
}
