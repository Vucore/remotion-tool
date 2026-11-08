import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { watchStorageChanges } from "./storage-client";

export type ExportJob = {
  id: string;
  filename?: string;
  createdAt?: string;
  status: "queued" | "preparing" | "rendering" | "done" | "error" | "cancelled";
  running?: boolean;
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
const active = (job: ExportJob) =>
  ["queued", "preparing", "rendering"].includes(job.status);

export function ExportPanel({
  onTrack,
  onUpdate,
  onDelete,
}: {
  onTrack: (job: ExportJob) => void;
  onUpdate: (job: ExportJob) => void;
  onDelete: (id: string) => void;
}) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    kind: "rename" | "delete";
  } | null>(null);
  const [name, setName] = useState("");
  const revision = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const actions = useRef(new Map<string, HTMLButtonElement>());
  const mutating = useRef(false);
  useEffect(
    () =>
      watchStorageChanges((change) => {
        revision.current++;
        setJobs((old) =>
          old.filter((item) => !change.removedExports.includes(item.id)),
        );
        setEditing((old) =>
          old && change.removedExports.includes(old.id) ? null : old,
        );
      }),
    [],
  );
  useEffect(() => {
    if (editing?.kind === "rename") {
      input.current?.focus();
      input.current?.select();
    } else if (editing?.kind === "delete") keep.current?.focus();
  }, [editing]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const version = revision.current;
      try {
        if (!mutating.current) {
          const response = await fetch("/api/exports", {
            signal: controller.signal,
          });
          const value = await response.json();
          if (!response.ok) throw Error(value.error);
          if (!controller.signal.aborted && version === revision.current)
            setJobs(value);
        }
      } catch (error) {
        if (!controller.signal.aborted && version === revision.current)
          setError(
            error instanceof Error
              ? error.message
              : "Chưa tải được lịch sử. Hãy thử lại.",
          );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => void refresh(), 1500);
        }
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  const closeEditor = () => {
    const id = editing?.id;
    setEditing(null);
    if (id) actions.current.get(id)?.focus();
  };
  const action = async (
    job: ExportJob,
    kind: "retry" | "cancel" | "rename" | "delete",
  ) => {
    if (mutating.current) return;
    mutating.current = true;
    revision.current++;
    setBusy(job.id);
    setError("");
    try {
      const response = await fetch(
        `/api/exports/${job.id}${kind === "retry" ? "/retry" : ""}`,
        {
          method:
            kind === "retry" ? "POST" : kind === "rename" ? "PATCH" : "DELETE",
          ...(kind === "rename"
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: name }),
              }
            : {}),
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (kind === "delete") {
        setJobs((old) => old.filter((item) => item.id !== job.id));
        setEditing(null);
        onDelete(job.id);
        if (result.warning) setError(result.warning);
        requestAnimationFrame(() =>
          actions.current.values().next().value?.focus(),
        );
      } else {
        setJobs((old) =>
          kind === "retry"
            ? [result, ...old]
            : old.map((item) => (item.id === job.id ? result : item)),
        );
        if (kind === "rename") {
          setEditing(null);
          onUpdate(result);
          requestAnimationFrame(() => actions.current.get(job.id)?.focus());
        } else onTrack(result);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Chưa lưu được thay đổi. Hãy thử lại.",
      );
    } finally {
      revision.current++;
      mutating.current = false;
      setBusy(null);
    }
  };
  return (
    <div className="export-history" aria-busy={loading || !!busy}>
      <p>Mỗi lần xuất giữ bản dựng riêng. Bạn có thể sửa tiếp trong lúc chờ.</p>
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải lịch sử…</p>
      ) : (
        !jobs.length && <p>Chưa có video được xuất.</p>
      )}
      {jobs.map((job) => {
        const editable = !active(job) && !job.running;
        const editor = editing?.id === job.id ? editing.kind : null;
        return (
          <article key={job.id}>
            <div className="export-history-row">
              <div className="export-history-info">
                <strong>{job.filename || "Video chưa đặt tên"}</strong>
                <small>
                  {job.createdAt &&
                    new Date(job.createdAt).toLocaleString("vi")}{" "}
                  · {labels[job.status]}{" "}
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
                  <button
                    className="button"
                    disabled={!!busy || !editable}
                    onClick={() => void action(job, "retry")}
                  >
                    Xuất lại bản này
                  </button>
                )}
                {active(job) && (
                  <button
                    className="button"
                    disabled={!!busy}
                    onClick={() => void action(job, "cancel")}
                  >
                    Hủy
                  </button>
                )}
                {editable && (
                  <>
                    <button
                      className="button"
                      ref={(element) => {
                        if (element) actions.current.set(job.id, element);
                        else actions.current.delete(job.id);
                      }}
                      disabled={!!busy}
                      aria-label={`Đổi tên ${job.filename || "video"}`}
                      onClick={() => {
                        setError("");
                        setName((job.filename ?? "").replace(/\.mp4$/i, ""));
                        setEditing({ id: job.id, kind: "rename" });
                      }}
                    >
                      Đổi tên
                    </button>
                    <button
                      className="button export-delete-button"
                      disabled={!!busy}
                      aria-label={`Xóa ${job.filename || "bản xuất"}`}
                      onClick={() => {
                        setError("");
                        setEditing({ id: job.id, kind: "delete" });
                      }}
                    >
                      <Icon name="trash" /> Xóa
                    </button>
                  </>
                )}
              </div>
            </div>
            {editor === "rename" && (
              <form
                className="export-rename"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(job, "rename");
                }}
              >
                <label htmlFor={`export-name-${job.id}`}>Tên video</label>
                <div className="export-rename-input">
                  <input
                    id={`export-name-${job.id}`}
                    ref={input}
                    value={name}
                    required
                    disabled={!!busy}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!busy) closeEditor();
                      }
                    }}
                  />
                  <span>.mp4</span>
                </div>
                <div className="export-edit-actions">
                  <button
                    type="button"
                    className="button"
                    disabled={!!busy}
                    onClick={closeEditor}
                  >
                    Hủy đổi tên
                  </button>
                  <button
                    className="button primary"
                    disabled={!!busy || !name.trim()}
                  >
                    {busy === job.id ? "Đang lưu…" : "Lưu tên"}
                  </button>
                </div>
              </form>
            )}
            {editor === "delete" && (
              <section
                className="export-delete-confirm"
                aria-label="Xác nhận xóa bản xuất"
              >
                <strong>Xóa “{job.filename}”?</strong>
                <p>
                  MP4, SRT kèm theo và lịch sử bản xuất này sẽ bị xóa vĩnh viễn.
                  Ảnh, voice và dự án nguồn được giữ lại.
                </p>
                <div className="export-edit-actions">
                  <button
                    type="button"
                    className="button"
                    ref={keep}
                    disabled={!!busy}
                    onClick={closeEditor}
                  >
                    Giữ lại
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    disabled={!!busy}
                    onClick={() => void action(job, "delete")}
                  >
                    {busy === job.id ? "Đang xóa…" : "Xóa bản xuất"}
                  </button>
                </div>
              </section>
            )}
          </article>
        );
      })}
    </div>
  );
}
