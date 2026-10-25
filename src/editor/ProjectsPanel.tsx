import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { listSavedProjects, type ProjectDeletion } from "./workspace-storage";
import type { SavedProject } from "./workspace";
import { proxySource } from "./performance";

const date = new Intl.DateTimeFormat("vi", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export function ProjectsPanel({
  currentId,
  currentName,
  busy,
  onOpen,
  onCreate,
  onDuplicate,
  onPrepareDelete,
  onDelete,
}: {
  currentId: string | null;
  currentName: string;
  busy: boolean;
  onOpen: (id: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onPrepareDelete: (id: string) => Promise<ProjectDeletion>;
  onDelete: (plan: ProjectDeletion) => Promise<void>;
}) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [limit, setLimit] = useState(30);
  const [reload, setReload] = useState(0);
  const [deletePlan, setDeletePlan] = useState<ProjectDeletion | null>(null);
  const confirmation = useRef<HTMLElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (deletePlan) {
      confirmation.current?.scrollIntoView({ block: "nearest" });
      keepButton.current?.focus({ preventScroll: true });
    }
  }, [deletePlan]);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    void listSavedProjects()
      .then((result) => {
        if (!disposed) setProjects(result.projects);
      })
      .catch((error: Error) => {
        if (!disposed) setError(error.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [reload]);
  const filtered = useMemo(
    () =>
      projects
        .map((project) =>
          project.id === currentId
            ? { ...project, name: currentName }
            : project,
        )
        .filter((project) =>
          project.name
            .toLocaleLowerCase("vi")
            .includes(search.toLocaleLowerCase("vi")),
        ),
    [projects, search, currentId, currentName],
  );
  const perform = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Chưa mở được dự án. Hãy thử lại.",
      );
    }
  };
  return (
    <section className="projects-panel" aria-busy={busy || loading}>
      <form
        className="project-create"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(() => onCreate(name.trim() || "Câu chuyện mới"));
        }}
      >
        <label htmlFor="new-project-name">Bắt đầu video mới</label>
        <div>
          <input
            id="new-project-name"
            value={name}
            maxLength={100}
            placeholder="Tên video mới"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            className="button primary"
            disabled={busy || loading || Boolean(deletePlan)}
          >
            <Icon name="plus" />
            Tạo mới
          </button>
        </div>
        <small>Dự án đang làm được tự lưu trước khi chuyển.</small>
      </form>
      <div className="projects-heading">
        <h3>
          Video của bạn <span>{projects.length}</span>
        </h3>
        <button
          type="button"
          className="button"
          disabled={busy || loading || Boolean(deletePlan)}
          onClick={() => void perform(onDuplicate)}
        >
          <Icon name="copy" />
          Nhân bản đang mở
        </button>
      </div>
      <input
        type="search"
        className="project-search"
        aria-label="Tìm dự án"
        placeholder="Tìm theo tên video…"
        value={search}
        disabled={busy}
        onChange={(e) => {
          setSearch(e.target.value);
          setLimit(30);
        }}
      />
      {error && (
        <p className="projects-error" role="alert">
          {error}{" "}
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setDeletePlan(null);
              setReload((v) => v + 1);
            }}
          >
            Thử lại
          </button>
        </p>
      )}
      {deletePlan && (
        <section
          ref={confirmation}
          className="project-delete-confirm"
          aria-label="Xác nhận xóa dự án"
        >
          <h3>Xóa “{deletePlan.name}”?</h3>
          <p>
            Xóa bản dựng và {deletePlan.files} tệp riêng (
            {new Intl.NumberFormat("vi", { maximumFractionDigits: 1 }).format(
              deletePlan.bytes / 1024 ** 2,
            )}{" "}
            MB)
            {deletePlan.exports ? `, gồm ${deletePlan.exports} bản xuất` : ""}.
            Tài nguyên còn dùng ở dự án khác được giữ lại.
          </p>
          <p>
            Không thể hoàn tác. Nếu đây là dự án cuối, Khung sẽ mở một dự án
            trống mới.
          </p>
          <div>
            <button
              ref={keepButton}
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setDeletePlan(null)}
            >
              Giữ lại
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await onDelete(deletePlan);
                  setProjects((items) =>
                    items.filter((item) => item.id !== deletePlan.id),
                  );
                  setDeletePlan(null);
                })
              }
            >
              <Icon name="trash" />
              Xóa dự án và tệp riêng
            </button>
          </div>
        </section>
      )}
      {loading ? (
        <p className="projects-empty" role="status">
          Đang mở danh sách…
        </p>
      ) : error && !projects.length ? null : !filtered.length ? (
        <p className="projects-empty">
          {search
            ? "Không tìm thấy video này."
            : "Chưa có dự án. Tạo video đầu tiên ở trên."}
        </p>
      ) : (
        <ul className="project-list">
          {filtered.slice(0, limit).map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className="project-open"
                disabled={
                  busy || Boolean(deletePlan) || project.id === currentId
                }
                aria-current={project.id === currentId ? "true" : undefined}
                onClick={() => void perform(() => onOpen(project.id))}
              >
                <span className="project-cover">
                  {project.thumbnail ? (
                    <img
                      src={proxySource(project.thumbnail, 384)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Icon name="film" />
                  )}
                </span>
                <span className="project-description">
                  <strong title={project.name}>{project.name}</strong>
                  <small>
                    {project.images} ảnh · {project.ratio} ·{" "}
                    {date.format(new Date(project.updatedAt))}
                  </small>
                </span>
                {project.id === currentId ? (
                  <span className="project-current">
                    <Icon name="check" />
                    Đang mở
                  </span>
                ) : (
                  <Icon name="next" />
                )}
              </button>
              <button
                type="button"
                className="icon-button project-delete-button"
                title={"Xóa dự án " + project.name}
                aria-label={"Xóa dự án " + project.name}
                disabled={busy || Boolean(deletePlan)}
                onClick={() =>
                  void perform(async () =>
                    setDeletePlan(await onPrepareDelete(project.id)),
                  )
                }
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <button
          className="button projects-more"
          disabled={busy}
          onClick={() => setLimit((value) => value + 30)}
        >
          Xem thêm
        </button>
      )}
    </section>
  );
}
