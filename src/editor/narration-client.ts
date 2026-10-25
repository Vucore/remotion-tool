import { projectHeaders } from "./workspace-storage";
import { leanProject } from "./project-client";
import { parseProject, type Project } from "../model";
import type { AutoConfig } from "../auto/config";
import type { AutoReport } from "../auto/compile";

export async function buildWithNarration(
  project: Project,
  config: AutoConfig,
  keep: boolean,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<{ project: Project; report: AutoReport }> {
  let jobId = "",
    completed = false;
  const cancel = async () => {
    if (jobId)
      await fetch(`/api/narration/${jobId}`, { method: "DELETE" }).catch(
        () => {},
      );
  };
  try {
    if (signal.aborted) throw Error("Đã huỷ căn phụ đề.");
    onProgress("Đang kiểm tra ảnh, voice và TXT…");
    const response = await fetch("/api/narration", {
      method: "POST",
      headers: { ...projectHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ project: leanProject(project), config, keep }),
    });
    let job = await response.json();
    if (!response.ok)
      throw Error(job.error || "Không bắt đầu được tác vụ căn phụ đề.");
    jobId = job.id;
    signal.addEventListener("abort", cancel, { once: true });
    while (true) {
      if (signal.aborted) throw Error("Đã huỷ căn phụ đề.");
      onProgress(job.message || "Đang căn câu theo lời đọc…");
      if (job.status === "done") {
        completed = true;
        return {
          project: parseProject(job.result.project),
          report: job.result.report,
        };
      }
      if (job.status === "error" || job.status === "cancelled")
        throw Error(job.error || "Đã huỷ căn phụ đề.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const poll = await fetch(`/api/narration/${jobId}`, { signal });
      job = await poll.json();
      if (!poll.ok)
        throw Error(
          job.error || "Mất kết nối tác vụ căn phụ đề. Hãy dựng lại.",
        );
    }
  } catch (error) {
    if (signal.aborted) throw Error("Đã huỷ căn phụ đề.");
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!completed) await cancel();
  }
}
