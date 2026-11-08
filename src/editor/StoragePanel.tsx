import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import {
  clearStorage,
  notifyStorageChange,
  storageReport,
  storageSize,
  type StorageGroup,
  type StorageReport,
} from "./storage-client";

const sections = [
  ["cache", "Cache có thể tạo lại"],
  ["models", "Model đã tải"],
  ["exports", "Video đã xuất"],
  ["system", "Thư mục và tệp ẩn khác"],
] as const;
export function StoragePanel({
  beforeDelete,
  onDeleting,
}: {
  beforeDelete: () => Promise<unknown>;
  onDeleting: (busy: boolean) => void;
}) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<StorageGroup | null>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const confirmation = useRef<HTMLElement>(null);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const performing = useRef(false);
  const scan = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError("");
    try {
      const value = await storageReport(controller.signal);
      if (!controller.signal.aborted) setReport(value);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Chưa kiểm tra được dung lượng. Thử lại.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void scan();
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, [scan]);
  useEffect(() => {
    if (confirm) {
      confirmation.current?.scrollIntoView({ block: "nearest" });
      keep.current?.focus({ preventScroll: true });
    }
  }, [confirm]);
  const cancel = () => {
    setConfirm(null);
    trigger.current?.focus();
  };
  const remove = async () => {
    if (!confirm || performing.current) return;
    performing.current = true;
    setDeleting(true);
    setError("");
    setNotice("");
    onDeleting(true);
    try {
      await beforeDelete();
      const result = await clearStorage(confirm);
      notifyStorageChange(result);
      setConfirm(null);
      await scan();
      if (result.failures.length)
        setError(
          `Chưa xóa được ${result.failures.length} tệp. Kiểm tra lại quyền truy cập rồi thử lại.`,
        );
      else
        setNotice(
          `Đã dọn ${result.removed.toLocaleString("vi")} tệp. Dung lượng đã được kiểm tra lại.`,
        );
    } catch (error) {
      if (alive.current) {
        await scan();
        setConfirm(null);
        setError(
          error instanceof Error
            ? error.message
            : "Chưa dọn được dung lượng. Kiểm tra lại rồi thử lại.",
        );
      }
    } finally {
      performing.current = false;
      if (alive.current) setDeleting(false);
      onDeleting(false);
    }
  };
  return (
    <div className="storage-panel" aria-busy={loading || deleting}>
      <div className="storage-toolbar">
        <div>
          <strong>
            {report
              ? `Tổng đã quét · ${storageSize(report.totalBytes)}`
              : "Đang kiểm tra…"}
          </strong>
          <p>Kho dùng chung của mọi dự án. Chỉ quét khi mở hoặc kiểm tra lại.</p>
          {report && <small className="storage-root">{report.root}</small>}
        </div>
        <button
          className="button"
          disabled={loading || deleting}
          onClick={() => {
            setConfirm(null);
            void scan();
          }}
        >
          <Icon name="refresh" /> Kiểm tra lại
        </button>
      </div>
      {report && (
        <div className="storage-cache-summary">
          <div>
            <strong>.cache</strong>
            <p>
              Gồm model và mọi thư mục con · {report.cache.files.toLocaleString("vi")} tệp
            </p>
            {report.cache.incomplete && (
              <p role="status">Chưa đọc được toàn bộ .cache. Xem lỗi ở từng thư mục bên dưới.</p>
            )}
            {report.cache.skipped > 0 && (
              <p>Bỏ qua {report.cache.skipped.toLocaleString("vi")} symlink.</p>
            )}
          </div>
          <div>
            <strong>{storageSize(report.cache.diskBytes)}</strong>
            <small>Nội dung tệp: {storageSize(report.cache.bytes)}</small>
          </div>
        </div>
      )}
      {loading && <p role="status">Đang đọc dung lượng trên đĩa…</p>}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="storage-notice" role="status">
          {notice}
        </p>
      )}
      {report?.busy && (
        <p className="storage-busy" role="status">
          Có tác vụ đang chạy. Chờ hoàn tất rồi bấm Kiểm tra lại để dọn dữ liệu.
        </p>
      )}
      {confirm && (
        <section
          className="storage-confirm"
          ref={confirmation}
          aria-label="Xác nhận dọn dung lượng"
        >
          <h3>Xóa {confirm.title.toLocaleLowerCase("vi")}?</h3>
          <p>
            <strong>{storageSize(confirm.diskBytes)}</strong> ·{" "}
            {confirm.deletableFiles.toLocaleString("vi")} tệp có thể dọn
          </p>
          <p>{confirm.effect} Không thể hoàn tác thao tác xóa.</p>
          <div>
            <button
              ref={keep}
              className="button"
              disabled={deleting}
              onClick={cancel}
            >
              Giữ lại
            </button>
            <button
              className="button danger"
              disabled={deleting || loading}
              onClick={() => void remove()}
            >
              {deleting ? "Đang dọn…" : "Xóa dữ liệu này"}
            </button>
          </div>
        </section>
      )}
      {report &&
        sections.map(([category, label]) => (
          <section
            key={category}
            className="storage-section"
            aria-label={label}
          >
            <h3>{label}</h3>
            {report.groups
              .filter((group) => group.category === category)
              .map((group) => (
                <article className="storage-row" key={group.id}>
                  <div className="storage-info">
                    <strong>{group.title}</strong>
                    <code>{group.path}</code>
                    <p>{group.description}</p>
                    <small>
                      {group.files.toLocaleString("vi")} tệp
                      {group.contents.length
                        ? " · " + group.contents.join(" · ")
                        : ""}
                      {group.skipped
                        ? ` · Bỏ qua ${group.skipped} symlink`
                        : ""}
                    </small>
                    {group.canDelete && (
                      <details>
                        <summary>Khi xóa</summary>
                        <p>{group.effect}</p>
                      </details>
                    )}
                    {!group.canDelete && group.reason && (
                      <small>{group.reason}</small>
                    )}
                    {group.deletableFiles < group.files &&
                      group.category === "exports" && (
                        <small>
                          Các tệp ngoài định dạng bản xuất của app được giữ lại.
                        </small>
                      )}
                  </div>
                  <div className="storage-row-action">
                    <strong
                      title={`Nội dung tệp: ${storageSize(group.bytes)}; hiển thị MB chiếm trên đĩa, gồm metadata thư mục`}
                    >
                      {storageSize(group.diskBytes)}
                    </strong>
                    {group.canDelete ? (
                      <button
                        className="button"
                        disabled={loading || deleting || report.busy}
                        aria-label={`Xóa ${group.title}`}
                        onClick={(event) => {
                          trigger.current = event.currentTarget;
                          setError("");
                          setNotice("");
                          setConfirm(group);
                        }}
                      >
                        <Icon name="trash" /> Xóa
                      </button>
                    ) : (
                      <span>Chỉ xem</span>
                    )}
                  </div>
                </article>
              ))}
          </section>
        ))}
      {report && (
        <p className="storage-footnote">
          Kiểm tra lúc {new Date(report.scannedAt).toLocaleString("vi")}. Thống
          kê dung lượng chiếm trên đĩa, gồm metadata thư mục. 1 MB = 1.000.000
          byte. Hardlink chỉ tính một lần. Không đi theo symlink hoặc tính cache ngoài dự án; dung lượng
          giải phóng thực tế có thể khác do APFS/nén.
        </p>
      )}
    </div>
  );
}
