import { useEffect, useState } from "react";
export type ExportJob = {
  id: string;
  filename?: string;
  createdAt?: string;
  status: "queued" | "preparing" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  error?: string;
  url?: string;
  subtitleUrl?: string;
  subtitleFilename?: string;
  mode?: string;
};
const labels = {
  queued: "Đang chờ",
  preparing: "Chuẩn bị",
  rendering: "Đang xuất",
  done: "Hoàn tất",
  error: "Lỗi",
  cancelled: "Đã hủy",
};
export function ExportPanel({
  onTrack,
}: {
  onTrack: (job: ExportJob) => void;
}) {
  const [jobs, setJobs] = useState<ExportJob[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () =>
      void fetch("/api/exports", { signal: controller.signal })
        .then(async (response) => {
          const value = await response.json();
          if (!response.ok) throw Error(value.error);
          setJobs(value);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(String(error));
        });
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  const action = async (job: ExportJob, retry: boolean) => {
    try {
      const response = await fetch(
        `/api/exports/${job.id}${retry ? "/retry" : ""}`,
        { method: retry ? "POST" : "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      onTrack(result);
      setJobs((old) =>
        retry
          ? [result, ...old]
          : old.map((item) => (item.id === job.id ? result : item)),
      );
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <div className="export-history">
      <p>Mỗi lần xuất giữ bản dựng riêng. Bạn có thể sửa tiếp trong lúc chờ.</p>
      {error && <p role="alert">{error}</p>}
      {!jobs.length && <p>Chưa có video được xuất.</p>}
      {jobs.map((job) => (
        <article key={job.id}>
          <div>
            <strong>{job.filename}</strong>
            <small>
              {job.createdAt && new Date(job.createdAt).toLocaleString("vi")} ·{" "}
              {labels[job.status]}{" "}
              {job.status === "rendering"
                ? Math.round(job.progress * 100) + "%"
                : ""}
            </small>
            {job.error && <p>{job.error}</p>}
          </div>
          <div className="export-history-actions">
            {job.url && (
              <a className="button" href={job.url} download={job.filename}>
                MP4
              </a>
            )}
            {job.subtitleUrl && (
              <a
                className="button"
                href={job.subtitleUrl}
                download={job.subtitleFilename}
              >
                SRT
              </a>
            )}
            {["error", "cancelled"].includes(job.status) && (
              <button className="button" onClick={() => void action(job, true)}>
                Xuất lại bản này
              </button>
            )}
            {["queued", "preparing", "rendering"].includes(job.status) && (
              <button
                className="button"
                onClick={() => void action(job, false)}
              >
                Hủy
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
