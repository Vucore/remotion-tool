import { useCallback, useEffect, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  Asset,
  Motion,
  Project,
  Scene,
  emptyProject,
  id,
  makeScene,
  makeText,
  moveScene,
  parseProject,
  sceneAt,
  splitScene,
  timeline,
  totalFrames,
} from "./model";
import { Video } from "./Video";
import { Icon } from "./icons";
import { TextPanel } from "./panels/TextPanel";
import { EffectsPanel } from "./panels/EffectsPanel";

const STORAGE = "khung-editor-project-v1";
const clock = (frames: number, fps: number) =>
  `${Math.floor(frames / fps / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor((frames / fps) % 60)
    .toString()
    .padStart(2, "0")}.${Math.floor(frames % fps)
    .toString()
    .padStart(2, "0")}`;
const seconds = (frames: number, fps: number) =>
  `${(frames / fps).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}s`;
function initial(): Project {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) return parseProject(JSON.parse(saved));
  } catch {
    /* A bad browser cache must not prevent opening the editor. */
  }
  return emptyProject();
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const Button = ({
  icon,
  children,
  onClick,
  title,
  disabled,
  className = "",
}: {
  icon?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    className={`button ${children ? "" : "icon-button"} ${className}`}
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}
  >
    {icon && <Icon name={icon} />} {children}
  </button>
);
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);
const Range = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (n: number) => void;
}) => (
  <label className="range-field">
    <span>
      {label}
      <output>
        {Number(value.toFixed(2))}
        {suffix}
      </output>
    </span>
    <input
      aria-label={label}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </label>
);
type Job = {
  id: string;
  status: "preparing" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  error?: string;
  url?: string;
};

export function App() {
  const [history, setHistory] = useState<{
    past: Project[];
    present: Project;
    future: Project[];
  }>({ past: [], present: initial(), future: [] });
  const project = history.present;
  const [selected, setSelected] = useState<string | null>(
    () => project.scenes[0]?.id ?? null,
  );
  const [panel, setPanel] = useState<"image" | "text" | "effects">("image");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [quality, setQuality] = useState("standard");
  const [startingExport, setStartingExport] = useState(false);
  const [help, setHelp] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const player = useRef<PlayerRef>(null);
  const imagesInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pollingFailures = useRef(0);
  const selectedScene = project.scenes.find((s) => s.id === selected);
  const selectedAsset = project.assets.find(
    (a) => a.id === selectedScene?.assetId,
  );
  const items = timeline(project);
  const duration = totalFrames(project);
  const hasScenes = project.scenes.length > 0;
  const busy =
    startingExport || (job && ["preparing", "rendering"].includes(job.status));
  const commit = useCallback((change: Project | ((p: Project) => Project)) => {
    setHistory((h) => ({
      past: [...h.past.slice(-79), h.present],
      present: typeof change === "function" ? change(h.present) : change,
      future: [],
    }));
  }, []);
  const undo = useCallback(
    () =>
      setHistory((h) =>
        h.past.length
          ? {
              past: h.past.slice(0, -1),
              present: h.past[h.past.length - 1],
              future: [h.present, ...h.future],
            }
          : h,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setHistory((h) =>
        h.future.length
          ? {
              past: [...h.past, h.present],
              present: h.future[0],
              future: h.future.slice(1),
            }
          : h,
      ),
    [],
  );
  const update = (patch: Partial<Scene>) =>
    commit((p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === selected ? { ...s, ...patch } : s)),
    }));
  const seek = useCallback(
    (f: number) => {
      const clamped = Math.max(0, Math.min(duration - 1, Math.round(f)));
      player.current?.seekTo(clamped);
      setFrame(clamped);
    },
    [duration],
  );
  const choose = (sceneId: string) => {
    setSelected(sceneId);
    const item = items.find((t) => t.scene.id === sceneId);
    if (item) seek(item.from + item.overlap);
  };

  async function cancelExport() {
    if (!job?.id) return;
    try {
      const response = await fetch(`/api/exports/${job.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Không huỷ được tác vụ.");
      setJob(await response.json());
    } catch {
      setJob({
        ...job,
        status: "error",
        error:
          "Không kết nối được server để huỷ. Hãy kiểm tra công cụ đang chạy.",
      });
    }
  }

  useEffect(() => {
    setSaved(false);
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(project));
        setSaved(true);
      } catch {
        setMessage(
          "Trình duyệt không lưu được dự án. Hãy dùng Lưu dự án để tải JSON.",
        );
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [project]);
  useEffect(() => {
    if (selected && !project.scenes.some((s) => s.id === selected))
      setSelected(project.scenes[0]?.id ?? null);
  }, [project.scenes, selected]);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const updateFrame = ({ detail }: { detail: { frame: number } }) =>
      setFrame(detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", updateFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", updateFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, [hasScenes, previewRevision]);
  useEffect(() => {
    if (frame >= duration) seek(duration - 1);
  }, [duration, frame, seek]);
  useEffect(() => {
    if (!job || !["preparing", "rendering"].includes(job.status)) return;
    const tick = setInterval(async () => {
      try {
        const response = await fetch(`/api/exports/${job.id}`);
        if (!response.ok) throw new Error();
        pollingFailures.current = 0;
        setJob(await response.json());
      } catch {
        pollingFailures.current++;
        if (pollingFailures.current >= 3)
          setJob({
            ...job,
            status: "error",
            error: "Mất kết nối với server. Chạy lại công cụ rồi thử xuất lại.",
          });
      }
    }, 700);
    return () => clearInterval(tick);
  }, [job]);
  useEffect(() => {
    if (exportOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [exportOpen]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(t);
  }, [message]);

  const save = useCallback(() => {
    download(
      `${project.name.trim() || "video"}.khung.json`,
      JSON.stringify(project, null, 2),
    );
    setMessage(
      "Đã tải file dự án. Ảnh gốc được giữ trong thư mục data của công cụ.",
    );
  }, [project]);
  const remove = useCallback(() => {
    if (!selected) return;
    player.current?.pause();
    commit((p) => ({
      ...p,
      scenes: p.scenes.filter((s) => s.id !== selected),
    }));
  }, [commit, selected]);
  const split = () => {
    if (!selected) return;
    const result = splitScene(project, selected, frame);
    if (result) commit(result);
    else
      setMessage(
        "Đặt vạch phát bên trong cảnh, cách mép và đoạn chuyển cảnh ít nhất 0,5 giây.",
      );
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const node = e.target as HTMLElement;
      if (
        node.matches("input, textarea, select") ||
        node.isContentEditable ||
        exportOpen
      )
        return;
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (modifier && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.code === "Space") {
        e.preventDefault();
        player.current?.toggle();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seek(frame + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek(frame - 1);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [exportOpen, frame, redo, remove, save, seek, undo]);

  async function importImages(files: FileList | File[]) {
    if (!files.length || uploading) return;
    setUploading(true);
    const imported: Asset[] = [];
    const errors: string[] = [];
    const available = Math.max(0, 300 - project.assets.length);
    if (files.length > available)
      errors.push(`Thư viện tối đa 300 ảnh; chỉ nhập thêm ${available} ảnh.`);
    for (const file of Array.from(files).slice(0, available)) {
      try {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
          throw new Error(`${file.name}: chỉ hỗ trợ PNG, JPG và WebP.`);
        if (file.size > 25 * 1024 * 1024)
          throw new Error(`${file.name}: ảnh vượt quá 25 MB.`);
        const response = await fetch(
          `/api/uploads?name=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        const image = new Image();
        image.src = data.src;
        await image.decode();
        if (image.naturalWidth > 30000 || image.naturalHeight > 30000)
          throw new Error(
            `${file.name}: kích thước ảnh quá lớn (tối đa 30.000 px).`,
          );
        imported.push({
          id: id(),
          name: file.name,
          src: data.src,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Không nhập được ảnh.",
        );
      }
    }
    if (imported.length)
      commit((p) => ({ ...p, assets: [...p.assets, ...imported] }));
    setUploading(false);
    setMessage(
      errors.length
        ? errors.join(" ")
        : `Đã nhập ${imported.length} ảnh. Nhấn vào ảnh để thêm cảnh.`,
    );
  }
  function addAsset(asset: Asset) {
    if (project.scenes.length >= 300) {
      setMessage("Bản hiện tại hỗ trợ tối đa 300 cảnh.");
      return;
    }
    const scene = makeScene(asset.id);
    const next = { ...project, scenes: [...project.scenes, scene] };
    commit(next);
    setSelected(scene.id);
    const item = timeline(next).at(-1)!;
    requestAnimationFrame(() => {
      player.current?.seekTo(item.from + item.overlap);
      setFrame(item.from + item.overlap);
    });
  }
  const example = () => {
    if (
      project.scenes.length &&
      !confirm(
        "Thay video đang chỉnh bằng ví dụ? Bạn có thể hoàn tác để quay lại.",
      )
    )
      return;
    const assets: Asset[] = ["coast", "forest", "sunset"].map((name, i) => ({
      id: id(),
      name: ["Bờ biển yên bình", "Qua miền xanh", "Chạm hoàng hôn"][i],
      src: `/samples/${name}.svg`,
      width: 1600,
      height: 1000,
    }));
    const scenes = assets.map((a, i) => ({
      ...makeScene(a.id),
      duration: 4,
      motion: (i % 2 ? "pan-left" : "zoom-in") as Motion,
      texts: [
        {
          ...makeText(),
          text: ["Đi một chút,", "thở thật sâu,", "và kể chuyện của bạn."][i],
          y: 78,
          size: 76,
        },
      ],
    }));
    player.current?.pause();
    player.current?.seekTo(0);
    commit({ ...emptyProject(), name: "Một khoảng bình yên", assets, scenes });
    setSelected(scenes[0].id);
    setFrame(0);
    setPanel("image");
  };
  const duplicate = () => {
    if (!selectedScene) return;
    const scene = {
      ...selectedScene,
      id: id(),
      texts: selectedScene.texts.map((t) => ({ ...t, id: id() })),
      effects: selectedScene.effects.map((e) => ({
        ...structuredClone(e),
        id: id(),
      })),
      overlays: selectedScene.overlays.map((o) => ({ ...o, id: id() })),
    };
    const next = {
      ...project,
      scenes: project.scenes.flatMap((s) =>
        s.id === selected ? [s, scene] : [s],
      ),
    };
    commit(next);
    setSelected(scene.id);
    const item = timeline(next).find((t) => t.scene.id === scene.id)!;
    requestAnimationFrame(() => {
      player.current?.seekTo(item.from + item.overlap);
      setFrame(item.from + item.overlap);
    });
  };
  const reorder = (direction: number) => {
    const at = project.scenes.findIndex((s) => s.id === selected);
    const target = project.scenes[at + direction];
    if (target && selected) commit((p) => moveScene(p, selected, target.id));
  };
  async function openProject(file?: File) {
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error("File dự án tối đa 16 MB.");
      const p = parseProject(JSON.parse(await file.text()));
      if (
        project.scenes.length &&
        !confirm("Mở dự án này? Bạn có thể hoàn tác để trở lại dự án hiện tại.")
      )
        return;
      player.current?.pause();
      commit(p);
      setSelected(p.scenes[0]?.id ?? null);
      seek(0);
      setMessage("Đã mở dự án.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "File dự án không hợp lệ.",
      );
    }
  }
  async function render() {
    pollingFailures.current = 0;
    setStartingExport(true);
    setJob(null);
    player.current?.pause();
    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, quality }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJob(data);
    } catch (error) {
      setJob({
        id: "",
        status: "error",
        progress: 0,
        error:
          error instanceof Error
            ? error.message
            : "Không bắt đầu được tác vụ xuất.",
      });
    } finally {
      setStartingExport(false);
    }
  }

  return (
    <div className="editor-shell">
      <header className="topbar">
        <a href="/" className="brand" title="Khung — ghép ảnh thành video">
          <span className="brand-mark">
            <Icon name="film" size={24} />
          </span>
          <strong>
            khung<span>.</span>
          </strong>
        </a>
        <span className="top-divider" />
        <div className="project-title">
          <input
            aria-label="Tên dự án"
            value={project.name}
            maxLength={100}
            onChange={(e) => commit((p) => ({ ...p, name: e.target.value }))}
          />
          <small>
            <span className={`save-dot ${saved ? "" : "saving"}`} />
            {saved ? "Đã lưu trên trình duyệt" : "Đang lưu…"}
          </small>
        </div>
        <div className="top-actions">
          <Button
            icon="undo"
            title="Hoàn tác (⌘/Ctrl Z)"
            disabled={!history.past.length}
            onClick={undo}
          />
          <Button
            icon="redo"
            title="Làm lại (⌘/Ctrl Shift Z)"
            disabled={!history.future.length}
            onClick={redo}
          />
          <span className="top-divider" />
          <Button
            icon="folder"
            title="Mở dự án JSON"
            onClick={() => projectInput.current?.click()}
          />
          <Button icon="save" title="Tải file dự án JSON" onClick={save}>
            <span className="label-wide">Lưu dự án</span>
          </Button>
          <Button
            icon="download"
            className="primary"
            disabled={!project.scenes.length}
            onClick={() => {
              setJob(null);
              setExportOpen(true);
            }}
          >
            Xuất video
          </Button>
        </div>
      </header>
      <input
        hidden
        ref={imagesInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => {
          if (e.target.files) void importImages(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={projectInput}
        type="file"
        accept=".json"
        onChange={(e) => {
          void openProject(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="workspace">
        <aside className="media-panel">
          <div className="panel-title">
            <h2>Ảnh của bạn</h2>
            <span className="count">{project.assets.length}</span>
          </div>
          <p className="muted panel-intro">
            Thêm ảnh, rồi chọn ảnh để tạo cảnh.
          </p>
          <button
            className={`upload-zone ${dragOver ? "drag-over" : ""}`}
            disabled={uploading}
            onClick={() => imagesInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void importImages(e.dataTransfer.files);
            }}
          >
            <span className="upload-symbol">
              <Icon name="upload" size={22} />
            </span>
            <strong>{uploading ? "Đang nhập ảnh…" : "Nhập ảnh"}</strong>
            <span>Kéo thả vào đây hoặc chọn từ máy</span>
            <small>JPG, PNG, WebP · tối đa 25 MB/ảnh</small>
          </button>
          {project.assets.length > 0 ? (
            <div className="asset-grid">
              {project.assets.map((a) => (
                <div className="asset" key={a.id}>
                  <button
                    title={`Thêm cảnh: ${a.name}`}
                    onClick={() => addAsset(a)}
                  >
                    <img
                      src={a.src}
                      alt={a.name}
                      onError={(e) => {
                        e.currentTarget.style.opacity = ".2";
                      }}
                    />
                    <span className="asset-add">
                      <Icon name="plus" size={16} />
                    </span>
                  </button>
                  <span title={a.name}>{a.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="library-empty">
              <Icon name="image" size={32} />
              <p>
                Góc nhỏ cho
                <br />
                những bức ảnh của bạn.
              </p>
            </div>
          )}
          <div className="media-bottom">
            <Button icon="play" className="subtle" onClick={example}>
              Thử với ảnh mẫu
            </Button>
            <Button
              icon="plus"
              className="subtle"
              onClick={() => {
                if (
                  !project.scenes.length ||
                  confirm(
                    "Tạo dự án mới? Lưu file dự án nếu bạn muốn giữ bản hiện tại.",
                  )
                ) {
                  commit(emptyProject());
                  setSelected(null);
                  setFrame(0);
                }
              }}
            >
              Dự án mới
            </Button>
          </div>
        </aside>

        <main className="preview-panel">
          <div className="preview-toolbar">
            <span className="preview-label">
              <span className="live-dot" />
              Xem trước
            </span>
            <div className="format-controls">
              <select
                aria-label="Tỷ lệ khung hình"
                value={
                  project.width < project.height ? "1080x1920" : "1920x1080"
                }
                onChange={(e) => {
                  const [width, height] = e.target.value.split("x").map(Number);
                  commit((p) => ({ ...p, width, height }));
                }}
              >
                <option value="1080x1920">9:16 · Dọc</option>
                <option value="1920x1080">16:9 · Ngang</option>
              </select>
              <Button
                icon="expand"
                title="Xem toàn màn hình"
                disabled={!project.scenes.length}
                onClick={() => player.current?.requestFullscreen()}
              />
            </div>
          </div>
          <div
            className={`stage ${project.scenes.length ? "" : "stage-empty"}`}
          >
            {project.scenes.length ? (
              <Player
                key={previewRevision}
                ref={player}
                component={Video}
                inputProps={{ project }}
                durationInFrames={duration}
                compositionWidth={project.width}
                compositionHeight={project.height}
                fps={project.fps}
                style={{ height: "100%", width: "100%" }}
                controls={false}
                clickToPlay={false}
                doubleClickToFullscreen
                spaceKeyToPlayOrPause={false}
                moveToBeginningWhenEnded={false}
                errorFallback={({ error }) => (
                  <div className="preview-error">
                    <p>Không hiển thị được cảnh.</p>
                    <small>{error.message}</small>
                    <p>
                      Tắt hiệu ứng vừa thêm hoặc kiểm tra ảnh/font trong thư mục
                      data, rồi thử lại.
                    </p>
                    <button
                      className="button"
                      onClick={() => setPreviewRevision((v) => v + 1)}
                    >
                      Tải lại xem trước
                    </button>
                  </div>
                )}
              />
            ) : (
              <div className="canvas-empty">
                <div className="empty-frames">
                  <span />
                  <span />
                  <Icon name="image" size={40} />
                </div>
                <h1>Bắt đầu từ một bức ảnh.</h1>
                <p>
                  Biến những khoảnh khắc tĩnh
                  <br />
                  thành một câu chuyện chuyển động.
                </p>
                <Button
                  icon="plus"
                  className="primary"
                  onClick={() => imagesInput.current?.click()}
                >
                  Chọn ảnh đầu tiên
                </Button>
                <button className="text-button" onClick={example}>
                  Hoặc khám phá video mẫu <Icon name="next" size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="playback">
            <div className="playback-start">
              <Button
                icon="rewind"
                title="Về đầu video"
                disabled={!project.scenes.length}
                onClick={() => seek(0)}
              />
              <Button
                icon={playing ? "pause" : "play"}
                title={playing ? "Tạm dừng (Space)" : "Phát video (Space)"}
                className="play-button"
                disabled={!project.scenes.length}
                onClick={() => player.current?.toggle()}
              />
              <span className="timecode">
                {clock(frame, project.fps)}
                <span> / {clock(duration - 1, project.fps)}</span>
              </span>
            </div>
            <span className="resolution">
              {project.width} × {project.height}{" "}
              <span>· {project.fps} fps</span>
            </span>
          </div>
        </main>

        <aside className="inspector">
          <div className="panel-title">
            <h2>
              {selectedScene
                ? `Cảnh ${project.scenes.findIndex((s) => s.id === selected) + 1}`
                : "Thiết lập video"}
            </h2>
            {selectedScene && (
              <span className="count">
                <Icon name="settings" size={14} />
              </span>
            )}
          </div>
          {selectedScene ? (
            <>
              <div
                className="inspector-tabs"
                role="tablist"
                aria-label="Thuộc tính cảnh"
              >
                {(["image", "text", "effects"] as const).map((key, i) => (
                  <button
                    role="tab"
                    aria-selected={panel === key}
                    key={key}
                    onClick={() => setPanel(key)}
                  >
                    <Icon name={["image", "text", "effect"][i]} size={16} />
                    {["Ảnh", "Chữ", "Hiệu ứng"][i]}
                  </button>
                ))}
              </div>
              <div className="inspector-content">
                {panel === "image" && (
                  <>
                    <section className="control-section">
                      <h3>Thời lượng</h3>
                      <Field label="Hiển thị cảnh (giây)">
                        <input
                          aria-label="Thời lượng cảnh"
                          type="number"
                          min="0.5"
                          max="300"
                          step="0.5"
                          value={selectedScene.duration}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (n >= 0.5 && n <= 300) update({ duration: n });
                          }}
                        />
                      </Field>
                      <p className="field-hint">
                        Phần nối cảnh được chồng lấn vào nhau.
                      </p>
                    </section>
                    <section className="control-section">
                      <h3>Khung ảnh</h3>
                      <div className="segmented">
                        <button
                          aria-pressed={selectedScene.fit === "cover"}
                          onClick={() => update({ fit: "cover" })}
                        >
                          Lấp đầy
                        </button>
                        <button
                          aria-pressed={selectedScene.fit === "contain"}
                          onClick={() => update({ fit: "contain" })}
                        >
                          Giữ toàn ảnh
                        </button>
                      </div>
                      <Range
                        label="Phóng to"
                        value={selectedScene.scale * 100}
                        min={10}
                        max={300}
                        suffix="%"
                        onChange={(n) => update({ scale: n / 100 })}
                      />
                      <Range
                        label="Vị trí ngang"
                        value={selectedScene.x}
                        min={-100}
                        max={100}
                        suffix="%"
                        onChange={(x) => update({ x })}
                      />
                      <Range
                        label="Vị trí dọc"
                        value={selectedScene.y}
                        min={-100}
                        max={100}
                        suffix="%"
                        onChange={(y) => update({ y })}
                      />
                      <Range
                        label="Góc xoay"
                        value={selectedScene.rotate}
                        min={-180}
                        max={180}
                        suffix="°"
                        onChange={(rotate) => update({ rotate })}
                      />
                      <div className="row-buttons">
                        <Button
                          icon="flip"
                          onClick={() => update({ flip: !selectedScene.flip })}
                        >
                          {selectedScene.flip ? "Bỏ lật" : "Lật ngang"}
                        </Button>
                        <button
                          className="text-button"
                          onClick={() =>
                            update({
                              fit: "cover",
                              x: 0,
                              y: 0,
                              scale: 1,
                              rotate: 0,
                              flip: false,
                            })
                          }
                        >
                          Đặt lại
                        </button>
                      </div>
                    </section>
                    <section className="control-section">
                      <h3>Thay ảnh</h3>
                      <select
                        aria-label="Ảnh của cảnh"
                        value={selectedScene.assetId}
                        onChange={(e) => update({ assetId: e.target.value })}
                      >
                        {project.assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <p className="field-hint truncate">
                        {selectedAsset?.width} × {selectedAsset?.height} ·{" "}
                        {selectedAsset?.name}
                      </p>
                    </section>
                  </>
                )}
                {panel === "text" && (
                  <TextPanel
                    key={selectedScene.id}
                    scene={selectedScene}
                    project={project}
                    onChange={update}
                    onFonts={(fonts) => commit((p) => ({ ...p, fonts }))}
                    onMessage={setMessage}
                    onPreview={(time) => {
                      const item = items.find((t) => t.scene.id === selected);
                      if (item) {
                        seek(item.from + Math.round(time * project.fps));
                        player.current?.play();
                      }
                    }}
                  />
                )}
                {panel === "effects" && (
                  <EffectsPanel
                    key={selectedScene.id}
                    scene={selectedScene}
                    onChange={update}
                    localTime={
                      (frame -
                        (items.find((t) => t.scene.id === selected)?.from ??
                          0)) /
                      project.fps
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <div className="inspector-content">
              <div className="inspector-empty">
                <Icon name="settings" size={30} />
                <p>
                  Chọn một cảnh để chỉnh ảnh,
                  <br />
                  thêm chữ và hiệu ứng.
                </p>
              </div>
              <section className="control-section">
                <h3>Video của bạn</h3>
                <Field label="Tốc độ khung hình">
                  <select
                    value={project.fps}
                    onChange={(e) =>
                      commit((p) => ({ ...p, fps: Number(e.target.value) }))
                    }
                  >
                    {[24, 25, 30, 60].map((fps) => (
                      <option key={fps} value={fps}>
                        {fps} fps
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Màu nền">
                  <input
                    type="color"
                    value={project.background}
                    onChange={(e) =>
                      commit((p) => ({ ...p, background: e.target.value }))
                    }
                  />
                </Field>
              </section>
            </div>
          )}
          <div className="inspector-footer">
            <label>
              Nền video
              <input
                aria-label="Màu nền video"
                type="color"
                value={project.background}
                onChange={(e) =>
                  commit((p) => ({ ...p, background: e.target.value }))
                }
              />
            </label>
            <select
              aria-label="FPS video"
              value={project.fps}
              onChange={(e) =>
                commit((p) => ({ ...p, fps: Number(e.target.value) }))
              }
            >
              {[24, 25, 30, 60].map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </select>
          </div>
        </aside>
      </div>

      <section className="timeline-panel" aria-label="Dải cảnh video">
        <div className="timeline-toolbar">
          <div className="timeline-heading">
            <h2>Câu chuyện của bạn</h2>
            <span>
              {project.scenes.length} cảnh{" "}
              <span className="divider-dot">·</span>{" "}
              {project.scenes.length ? seconds(duration, project.fps) : "0s"}
            </span>
          </div>
          <div className="timeline-actions">
            <Button
              icon="back"
              title="Đưa cảnh sang trái"
              disabled={!selectedScene || project.scenes[0]?.id === selected}
              onClick={() => reorder(-1)}
            />
            <Button
              icon="next"
              title="Đưa cảnh sang phải"
              disabled={
                !selectedScene || project.scenes.at(-1)?.id === selected
              }
              onClick={() => reorder(1)}
            />
            <span className="top-divider" />
            <Button
              icon="scissors"
              title="Chia cảnh tại vạch phát"
              disabled={!selectedScene}
              onClick={split}
            />
            <Button
              icon="copy"
              title="Nhân bản cảnh"
              disabled={!selectedScene || project.scenes.length >= 300}
              onClick={duplicate}
            />
            <Button
              icon="trash"
              title="Xoá cảnh (Delete)"
              disabled={!selectedScene}
              onClick={remove}
            />
          </div>
        </div>
        <div className="timeline-scroll">
          {project.scenes.length ? (
            <div className="timeline-track">
              <div className="scene-row">
                {items.map((item, index) => {
                  const asset = project.assets.find(
                    (a) => a.id === item.scene.assetId,
                  );
                  return (
                    <div
                      key={item.scene.id}
                      className={`scene-card ${selected === item.scene.id ? "selected" : ""} ${dragging === item.scene.id ? "dragging" : ""}`}
                      style={{
                        width: Math.max(
                          125,
                          (item.duration / project.fps) * 32,
                        ),
                      }}
                      draggable
                      onDragStart={(e) => {
                        setDragging(item.scene.id);
                        e.dataTransfer.setData("text/plain", item.scene.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const source = e.dataTransfer.getData("text/plain");
                        if (source !== item.scene.id)
                          commit((p) => moveScene(p, source, item.scene.id));
                        setDragging(null);
                      }}
                    >
                      <button
                        className="scene-select"
                        aria-label={`Chọn cảnh ${index + 1}: ${asset?.name}`}
                        aria-pressed={selected === item.scene.id}
                        onClick={() => choose(item.scene.id)}
                      >
                        <div className="scene-thumb">
                          <img src={asset?.src} alt="" />
                          <span className="scene-index">{index + 1}</span>
                          {item.scene.motion !== "none" && (
                            <span className="scene-motion">
                              <Icon name="motion" size={14} />
                            </span>
                          )}
                          {item.scene.texts.length > 0 && (
                            <span className="scene-text-badge">
                              <Icon name="text" size={12} />
                            </span>
                          )}
                        </div>
                        <div className="scene-caption">
                          <span>{asset?.name}</span>
                          <b>
                            {item.scene.duration.toLocaleString("vi-VN", {
                              maximumFractionDigits: 2,
                            })}
                            s
                          </b>
                        </div>
                      </button>
                      {index < items.length - 1 && (
                        <span
                          className="transition-chip"
                          title={`Chuyển cảnh: ${item.scene.transition}`}
                        >
                          <Icon
                            name={
                              item.scene.transition === "none"
                                ? "next"
                                : "motion"
                            }
                            size={12}
                          />
                        </span>
                      )}
                    </div>
                  );
                })}
                <button
                  className="add-scene"
                  onClick={() => imagesInput.current?.click()}
                >
                  <Icon name="plus" size={24} />
                  <span>Thêm ảnh</span>
                </button>
              </div>
              <div className="scrub-row">
                <span>{clock(frame, project.fps)}</span>
                <input
                  aria-label="Vạch phát video"
                  type="range"
                  min={0}
                  max={duration - 1}
                  value={frame}
                  onChange={(e) => {
                    const f = Number(e.target.value);
                    seek(f);
                    const current = sceneAt(project, f);
                    if (current) setSelected(current);
                  }}
                />
                <span>{clock(duration - 1, project.fps)}</span>
              </div>
            </div>
          ) : (
            <div className="timeline-empty">
              <Icon name="film" size={23} />
              <p>
                Các cảnh sẽ xuất hiện ở đây.
                <span>Nhập ảnh rồi nhấn vào ảnh để bắt đầu.</span>
              </p>
            </div>
          )}
        </div>
        <footer className="statusbar">
          <span>
            <span className="status-dot" />
            Làm việc cục bộ · ảnh được lưu trên máy
          </span>
          <button onClick={() => setHelp(!help)}>
            <Icon name="help" size={14} />
            Hướng dẫn & phím tắt
          </button>
        </footer>
      </section>
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button aria-label="Đóng thông báo" onClick={() => setMessage("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {help && (
        <div className="help-panel">
          <div className="panel-title">
            <h2>Bắt đầu trong vài bước</h2>
            <Button
              icon="close"
              title="Đóng hướng dẫn"
              onClick={() => setHelp(false)}
            />
          </div>
          <ol>
            <li>Nhập ảnh, nhấn vào ảnh để thêm cảnh.</li>
            <li>Chọn cảnh bên dưới; kéo để đổi thứ tự.</li>
            <li>Chỉnh ảnh, thêm chữ và chọn hiệu ứng bên phải.</li>
            <li>Phát xem trước, rồi nhấn Xuất video.</li>
          </ol>
          <p>
            <kbd>Space</kbd> Phát / dừng
            <br />
            <kbd>← →</kbd> Từng frame
            <br />
            <kbd>⌘ / Ctrl Z</kbd> Hoàn tác
            <br />
            <kbd>⌘ / Ctrl S</kbd> Lưu dự án
            <br />
            <kbd>Delete</kbd> Xoá cảnh đang chọn
          </p>
          <small>
            File JSON giữ cấu hình. Để mở lại đầy đủ, giữ cả thư mục data chứa
            ảnh.
          </small>
        </div>
      )}
      <dialog
        ref={dialog}
        className="export-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setExportOpen(false);
        }}
        onClose={() => setExportOpen(false)}
      >
        <div className="dialog-header">
          <span className="dialog-symbol">
            <Icon name="download" size={23} />
          </span>
          <Button
            icon="close"
            title="Đóng xuất video"
            disabled={Boolean(busy)}
            onClick={() => setExportOpen(false)}
          />
        </div>
        <h2>
          {job?.status === "done"
            ? "Video đã sẵn sàng."
            : "Xuất câu chuyện của bạn"}
        </h2>
        <p className="muted">
          MP4 · H.264 · {project.width} × {project.height} ·{" "}
          {seconds(duration, project.fps)}
        </p>
        {!busy && (!job || ["error", "cancelled"].includes(job.status)) && (
          <>
            <Field label="Chất lượng">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                <option value="standard">
                  Tiêu chuẩn · dung lượng vừa phải
                </option>
                <option value="high">Cao · hình ảnh rõ hơn</option>
              </select>
            </Field>
            <p className="field-hint">
              Xuất trên máy của bạn. Hãy giữ công cụ đang chạy đến khi hoàn tất.
              Bản đầu chưa có âm thanh.
            </p>
          </>
        )}
        {busy && (
          <div className="export-progress">
            <div>
              <strong>
                {job?.status === "rendering"
                  ? "Đang dựng video…"
                  : "Đang chuẩn bị…"}
              </strong>
              <span>{Math.round((job?.progress ?? 0) * 100)}%</span>
            </div>
            <progress max={1} value={job?.progress ?? 0} />
            <p>
              Bạn có thể tiếp tục sau khi tác vụ hoàn tất hoặc huỷ bên dưới.
            </p>
          </div>
        )}
        {job?.status === "error" && (
          <p role="alert" className="error-message">
            {job.error}
          </p>
        )}
        {job?.status === "cancelled" && (
          <p className="muted">
            Đã huỷ xuất video. Dự án của bạn vẫn được giữ.
          </p>
        )}
        {job?.status === "done" && (
          <div className="export-done">
            <Icon name="check" size={32} />
            <p>
              Đã xuất thành công. File cũng nằm trong
              <br />
              thư mục <code>data/exports</code>.
            </p>
            <a className="button primary full-width" href={job.url} download>
              Tải video MP4 <Icon name="download" />
            </a>
          </div>
        )}
        <div className="dialog-actions">
          {busy ? (
            <Button
              onClick={() => void cancelExport()}
              disabled={startingExport}
            >
              Huỷ xuất
            </Button>
          ) : (
            job?.status !== "done" && (
              <Button
                className="primary full-width"
                icon="download"
                onClick={() => void render()}
              >
                {job ? "Xuất lại" : "Bắt đầu xuất MP4"}
              </Button>
            )
          )}
        </div>
      </dialog>
    </div>
  );
}
