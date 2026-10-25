import { projectHeaders } from "./workspace-storage";
import { leanProject } from "./project-client";
import type { Asset, Project } from "../model";
import type { ImageProcessingSettings } from "../auto/image-processing";
export type ImageProcessResult = {
  assets: Asset[];
  errors: { id: string; name: string; error: string }[];
  cached: number;
};
export async function processProjectImages(
  project: Project,
  settings: ImageProcessingSettings,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<ImageProcessResult> {
  let jobId = "",
    complete = false;
  const cancel = async () => {
    if (jobId)
      await fetch(`/api/images/process/${jobId}`, { method: "DELETE" }).catch(
        () => {},
      );
  };
  try {
    if (signal.aborted) throw Error("Đã dừng xử lý ảnh.");
    onProgress("Đang chuẩn bị xử lý ảnh…");
    const response = await fetch("/api/images/process", {
      method: "POST",
      headers: { ...projectHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ project: leanProject(project), settings }),
    });
    let job = await response.json();
    if (!response.ok) throw Error(job.error || "Không bắt đầu được xử lý ảnh.");
    jobId = job.id;
    signal.addEventListener("abort", cancel, { once: true });
    while (true) {
      if (signal.aborted)
        throw Error("Đã dừng xử lý ảnh. Ảnh đang dùng được giữ nguyên.");
      onProgress(job.message || "Đang xử lý ảnh…");
      if (job.status === "done") {
        complete = true;
        return job.result;
      }
      if (["error", "cancelled"].includes(job.status))
        throw Error(job.error || "Đã dừng xử lý ảnh.");
      await new Promise((resolve) => setTimeout(resolve, 700));
      const poll = await fetch(`/api/images/process/${jobId}`, { signal });
      job = await poll.json();
      if (!poll.ok) throw Error(job.error || "Mất kết nối tác vụ ảnh.");
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!complete) await cancel();
  }
}
