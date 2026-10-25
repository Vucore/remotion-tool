import { projectHeaders } from "./workspace-storage";
import { leanProject } from "./project-client";
import { parseProject, type Project } from "../model";
import { parseTtsSettings, type TtsSettings } from "../auto/tts";

export async function createTtsVoices(
  project: Project,
  settings: TtsSettings,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<Project> {
  let jobId = "",
    complete = false;
  const cancel = async () => {
    if (jobId)
      await fetch(`/api/tts/${jobId}`, { method: "DELETE" }).catch(() => {});
  };
  try {
    if (signal.aborted) throw Error("Đã dừng tạo voice.");
    onProgress("Đang gửi TXT đến Chatterbox…");
    // Obtain the job ID even if cancellation happens while this POST is pending.
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { ...projectHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ project: leanProject(project), settings }),
    });
    let job = await response.json();
    if (!response.ok)
      throw Error(job.error || "Không bắt đầu được tác vụ TTS.");
    jobId = job.id;
    signal.addEventListener("abort", cancel, { once: true });
    while (true) {
      if (signal.aborted) throw Error("Đã dừng tạo voice.");
      onProgress(job.message || "Đang tạo voice…");
      if (job.status === "done") {
        const next = parseProject({
          ...project,
          scenes: [],
          automation: undefined,
          voiceover: {
            ...project.voiceover,
            assets: job.result.assets,
            tts: parseTtsSettings(settings),
            ttsKey: job.result.ttsKey,
          },
        });
        complete = true;
        return next;
      }
      if (job.status === "error" || job.status === "cancelled")
        throw Error(job.error || "Đã dừng tạo voice.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const poll = await fetch(`/api/tts/${jobId}`, { signal });
      job = await poll.json();
      if (!poll.ok)
        throw Error(
          job.error ||
            "Mất kết nối tác vụ TTS. Thử lại để dùng các voice đã lưu.",
        );
    }
  } catch (error) {
    if (signal.aborted) throw Error("Đã dừng tạo voice.");
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!complete) await cancel();
  }
}
