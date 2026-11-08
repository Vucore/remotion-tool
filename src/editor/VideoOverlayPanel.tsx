import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Video } from "../Video";
import { timeline, type Project } from "../model";
import {
  MAX_VIDEO_OVERLAYS,
  duplicateVideoOverlay,
  parseOverlayTime,
  TRANSPARENT_GREEN_SCREEN,
  videoOverlayKeyParams,
  type VideoOverlay,
} from "../video-overlays";
import { projectHeaders } from "./workspace-storage";
import { Icon } from "../icons";
import { detectVideoKeyColor } from "./video-key-color";

const bound = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function VideoOverlayPanel({
  project,
  initialFrame,
  busy,
  onChange,
  onUploading,
  onSeek,
}: {
  project: Project;
  initialFrame: number;
  busy: boolean;
  onChange: (layers: VideoOverlay[]) => void;
  onUploading: (value: boolean) => void;
  onSeek: (frame: number) => void;
}) {
  const layers = project.videoOverlays ?? [];
  const latest = useRef(layers);
  latest.current = layers;
  const [selectedId, setSelectedId] = useState(layers.at(-1)?.id ?? "");
  const selected =
    layers.find((layer) => layer.id === selectedId) ?? layers.at(-1);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [keying, setKeying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [frame, setFrame] = useState(initialFrame);
  const [insertTime, setInsertTime] = useState(
    String(initialFrame / project.fps),
  );
  const [startDraft, setStartDraft] = useState(String(selected?.start ?? 0));
  useEffect(
    () => setStartDraft(String(selected?.start ?? 0)),
    [selected?.id, selected?.start],
  );
  const input = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null);
  const controller = useRef<AbortController | null>(null);
  const drag = useRef<{
    id: string;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    width: number;
    resize: boolean;
  } | null>(null);
  const items = timeline(project);
  const totalFrames = Math.max(
    1,
    ...items.map((item) => item.from + item.duration),
  );
  const locked = busy || uploading || keying;
  useEffect(() => () => controller.current?.abort(), []);
  function seek(next: number) {
    const value = bound(Math.round(next), 0, totalFrames - 1);
    setFrame(value);
    setInsertTime(String(Number((value / project.fps).toFixed(3))));
    player.current?.pause();
    player.current?.seekTo(value);
    onSeek(value);
  }
  function patch(patch: Partial<VideoOverlay>) {
    if (selected)
      onChange(
        latest.current.map((layer) =>
          layer.id === selected.id ? { ...layer, ...patch } : layer,
        ),
      );
  }
  function commitStart() {
    try {
      const start = parseOverlayTime(
        startDraft,
        (totalFrames - 1) / project.fps,
      );
      patch({ start });
      seek(start * project.fps);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Thời điểm không hợp lệ.",
      );
    }
  }
  function addOccurrence() {
    if (!selected || locked) return;
    try {
      const start = parseOverlayTime(
        insertTime,
        (totalFrames - 1) / project.fps,
      );
      const next = duplicateVideoOverlay(latest.current, selected.id, start);
      latest.current = next;
      onChange(next);
      setSelectedId(next.at(-1)!.id);
      seek(start * project.fps);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thêm được lần xuất hiện.",
      );
    }
  }
  async function makeBackgroundTransparent() {
    if (!selected || locked) return;
    const id = selected.id;
    const abort = new AbortController();
    controller.current = abort;
    setKeying(true);
    setError("");
    try {
      const localTime =
        selected.trimStart +
        bound(
          frame / project.fps - selected.start,
          0,
          selected.duration - 0.001,
        );
      const keyColor = await detectVideoKeyColor(
        selected.src,
        localTime,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      onChange(
        latest.current.map((layer) =>
          layer.id === id
            ? {
                ...layer,
                ...TRANSPARENT_GREEN_SCREEN,
                keyColor: keyColor ?? selected.keyColor,
              }
            : layer,
        ),
      );
      if (!keyColor)
        setError(
          "Không tìm thấy nền xanh rõ ở khung hình này. Đã bật nền trong suốt; hãy chọn đúng Màu nền cần xóa nếu còn màu sót.",
        );
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Không xử lý được nền xanh.",
        );
    } finally {
      setKeying(false);
      if (controller.current === abort) controller.current = null;
    }
  }
  async function upload(files: File[]) {
    if (locked || !files.length) return;
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    setUploading(true);
    onUploading(true);
    try {
      for (const file of files) {
        if (latest.current.length >= MAX_VIDEO_OVERLAYS)
          throw Error(
            `Tối đa ${MAX_VIDEO_OVERLAYS} lần xuất hiện. Xóa một lần trước khi thêm.`,
          );
        if (!/\.mp4$/i.test(file.name) || file.size > 200 * 1024 ** 2)
          throw Error("Chọn MP4 H.264, tối đa 200 MB mỗi file.");
        const response = await fetch("/api/videos", {
          method: "POST",
          headers: { ...projectHeaders(), "Content-Type": "video/mp4" },
          body: file,
          signal: abort.signal,
        });
        const result = await response.json();
        if (!response.ok) throw Error(`${file.name}: ${result.error}`);
        let keyColor: string | null = null;
        try {
          keyColor = await detectVideoKeyColor(result.src, 0, abort.signal);
        } catch {
          if (abort.signal.aborted) return;
          setError(
            "Clip đã được thêm. Chưa lấy được màu nền tự động; hãy chọn Màu nền cần xóa hoặc bấm Làm nền xanh trong suốt.",
          );
        }
        const start = bound(
          frame / project.fps,
          0,
          Math.max(0, (totalFrames - 1) / project.fps),
        );
        const layer: VideoOverlay = {
          id: crypto.randomUUID(),
          name: file.name,
          src: result.src,
          sourceWidth: result.width,
          sourceHeight: result.height,
          sourceDuration: result.duration,
          start,
          trimStart: 0,
          duration: result.duration,
          x: 80,
          y: 10,
          width: 45,
          opacity: 1,
          muted: false,
          ...TRANSPARENT_GREEN_SCREEN,
          keyColor: keyColor ?? TRANSPARENT_GREEN_SCREEN.keyColor,
        };
        const next = [...latest.current, layer];
        latest.current = next;
        onChange(next);
        setSelectedId(layer.id);
        seek(start * project.fps);
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Không nhập được MP4.",
        );
    } finally {
      setUploading(false);
      onUploading(false);
      controller.current = null;
    }
  }
  function pointerDown(event: PointerEvent<HTMLElement>, resize = false) {
    if (locked || !selected) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: selected.id,
      clientX: event.clientX,
      clientY: event.clientY,
      x: selected.x,
      y: selected.y,
      width: selected.width,
      resize,
    };
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const origin = drag.current,
      rect = stage.current?.getBoundingClientRect();
    if (
      !origin ||
      !rect ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    )
      return;
    const dx = ((event.clientX - origin.clientX) / rect.width) * 100;
    const dy = ((event.clientY - origin.clientY) / rect.height) * 100;
    onChange(
      latest.current.map((layer) =>
        layer.id !== origin.id
          ? layer
          : {
              ...layer,
              ...(origin.resize
                ? { width: bound(origin.width + dx * 2, 1, 200) }
                : {
                    x: bound(origin.x + dx, 0, 100),
                    y: bound(origin.y + dy, 0, 100),
                  }),
            },
      ),
    );
  }
  const selectionVisible =
    selected &&
    frame >= Math.round(selected.start * project.fps) &&
    frame <
      Math.round(selected.start * project.fps) +
        Math.max(1, Math.round(selected.duration * project.fps));
  return (
    <div className="video-overlay-panel">
      <div
        className={`video-overlay-drop${dragOver ? " is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <Icon name="film" />
        <span>
          <strong>Thả MP4 vào đây</strong>
          <small>Clip Subscribe, logo động… · H.264 · tối đa 200 MB/file</small>
        </span>
        <button
          className="button"
          disabled={
            locked ||
            !project.scenes.length ||
            layers.length >= MAX_VIDEO_OVERLAYS
          }
          onClick={() => input.current?.click()}
        >
          Chọn MP4
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="video/mp4,.mp4"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void upload(files);
        }}
      />
      {uploading && <p role="status">Đang nhập và kiểm tra MP4…</p>}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      {!layers.length && (
        <p className="dialog-help">
          Nhập clip nền xanh để ghép lên video. Sau đó kéo clip trong khung xem
          thử và kéo nút ở góc để đổi kích thước.
        </p>
      )}
      {selected && (
        <div className="video-overlay-editor">
          <div className="video-overlay-preview">
            <div
              className="video-overlay-stage"
              ref={stage}
              style={{
                aspectRatio: `${project.width} / ${project.height}`,
                width: `min(100%, ${(440 * project.width) / project.height}px)`,
              }}
            >
              <Player
                ref={player}
                component={Video}
                inputProps={{ project, previewQuality: "full" }}
                compositionWidth={project.width}
                compositionHeight={project.height}
                fps={project.fps}
                durationInFrames={totalFrames}
                initialFrame={bound(initialFrame, 0, totalFrames - 1)}
                controls={false}
                clickToPlay={false}
                style={{ width: "100%", height: "100%" }}
              />
              {selectionVisible && (
                <div
                  className="video-overlay-selection"
                  role="button"
                  tabIndex={locked ? -1 : 0}
                  aria-label={`Di chuyển ${selected.name}. Dùng phím mũi tên; Shift để di chuyển nhanh.`}
                  style={{
                    left: `${selected.x}%`,
                    top: `${selected.y}%`,
                    width: `${selected.width}%`,
                    aspectRatio: `${selected.sourceWidth} / ${selected.sourceHeight}`,
                  }}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  onKeyDown={(event) => {
                    if (
                      locked ||
                      ![
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(event.key)
                    )
                      return;
                    event.preventDefault();
                    const step = event.shiftKey ? 5 : 1;
                    patch({
                      x: bound(
                        selected.x +
                          (event.key === "ArrowLeft"
                            ? -step
                            : event.key === "ArrowRight"
                              ? step
                              : 0),
                        0,
                        100,
                      ),
                      y: bound(
                        selected.y +
                          (event.key === "ArrowUp"
                            ? -step
                            : event.key === "ArrowDown"
                              ? step
                              : 0),
                        0,
                        100,
                      ),
                    });
                  }}
                >
                  <button
                    className="video-overlay-resize"
                    aria-label="Kéo đổi kích thước clip"
                    disabled={locked}
                    onPointerDown={(event) => pointerDown(event, true)}
                    onPointerMove={pointerMove}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                  />
                </div>
              )}
            </div>
            <label className="video-overlay-scrub">
              Xem tại {(frame / project.fps).toFixed(2)} giây
              <input
                type="range"
                min={0}
                max={totalFrames - 1}
                value={frame}
                onChange={(event) => seek(Number(event.target.value))}
              />
            </label>
            {!selectionVisible && (
              <button
                className="button"
                onClick={() => seek(selected.start * project.fps)}
              >
                Đến thời điểm clip xuất hiện
              </button>
            )}
            <p className="dialog-help">
              Kéo khung để đặt vị trí; kéo góc phải dưới để đổi kích thước. Clip
              được ghép cả trong preview và MP4 xuất.
            </p>
          </div>
          <fieldset disabled={locked} className="video-overlay-controls">
            <label>
              Lần xuất hiện đang chỉnh
              <select
                value={selected.id}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  const layer = layers.find(
                    (item) => item.id === event.target.value,
                  );
                  if (layer) seek(layer.start * project.fps);
                }}
              >
                {layers.map((layer, index) => (
                  <option key={layer.id} value={layer.id}>
                    {index + 1}. {layer.name} · {layer.start.toFixed(2)}–
                    {(layer.start + layer.duration).toFixed(2)} giây
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thêm lần nữa tại (giây hoặc phút:giây)
              <input
                type="text"
                inputMode="decimal"
                value={insertTime}
                placeholder="Ví dụ 90 hoặc 1:30"
                onChange={(event) => setInsertTime(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addOccurrence();
                  }
                }}
              />
            </label>
            <button
              className="button"
              disabled={layers.length >= MAX_VIDEO_OVERLAYS}
              onClick={addOccurrence}
            >
              <Icon name="plus" /> Thêm lần xuất hiện
            </button>
            <p className="dialog-help">
              Dùng lại clip đã chọn, giữ lần cũ. Mỗi lần có thời gian, vị trí và
              kích thước riêng; không cần nhập lại file. Tối đa{" "}
              {MAX_VIDEO_OVERLAYS} lần.
            </p>
            <div className="video-overlay-fields">
              <label>
                Ngang (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Number(selected.x.toFixed(2))}
                  onChange={(e) =>
                    patch({ x: bound(Number(e.target.value), 0, 100) })
                  }
                />
              </label>
              <label>
                Dọc (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Number(selected.y.toFixed(2))}
                  onChange={(e) =>
                    patch({ y: bound(Number(e.target.value), 0, 100) })
                  }
                />
              </label>
              <label>
                Rộng (% khung)
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={Number(selected.width.toFixed(2))}
                  onChange={(e) =>
                    patch({ width: bound(Number(e.target.value), 1, 200) })
                  }
                />
              </label>
              <label>
                Xuất hiện (giây)
                <input
                  type="text"
                  inputMode="decimal"
                  value={startDraft}
                  onChange={(e) => setStartDraft(e.target.value)}
                  onBlur={commitStart}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitStart();
                    }
                  }}
                />
              </label>
              <label>
                Cắt đầu clip (giây)
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, selected.sourceDuration - 0.1)}
                  step={0.1}
                  value={selected.trimStart}
                  onChange={(e) => {
                    const trimStart = bound(
                      Number(e.target.value),
                      0,
                      Math.max(0, selected.sourceDuration - 0.1),
                    );
                    patch({
                      trimStart,
                      duration: Math.min(
                        selected.duration,
                        selected.sourceDuration - trimStart,
                      ),
                    });
                  }}
                />
              </label>
              <label>
                Phát trong (giây)
                <input
                  type="number"
                  min={Math.min(
                    0.1,
                    selected.sourceDuration - selected.trimStart,
                  )}
                  max={selected.sourceDuration - selected.trimStart}
                  step={0.1}
                  value={Number(selected.duration.toFixed(3))}
                  onChange={(e) =>
                    patch({
                      duration: bound(
                        Number(e.target.value),
                        Math.min(
                          0.1,
                          selected.sourceDuration - selected.trimStart,
                        ),
                        selected.sourceDuration - selected.trimStart,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label className="video-overlay-check">
              <input
                type="checkbox"
                checked={selected.muted}
                onChange={(e) => patch({ muted: e.target.checked })}
              />
              Tắt âm thanh clip
            </label>
            <label className="video-overlay-check">
              <input
                type="checkbox"
                checked={selected.chromaKey}
                onChange={(e) => patch({ chromaKey: e.target.checked })}
              />
              Xóa nền xanh (Chroma key)
            </label>
            <button
              className="button"
              onClick={() => void makeBackgroundTransparent()}
              disabled={locked}
            >
              {keying ? "Đang lấy màu nền…" : "Làm nền xanh trong suốt"}
            </button>
            <p className="dialog-help">
              MP4 mới tự lấy màu nền xanh để xóa thành trong suốt. Nút trên lấy
              lại màu từ clip đang chọn và khử ám xanh ở viền. Nội dung phía sau
              sẽ hiện qua vùng đã xóa.
            </p>
            {selected.chromaKey && (
              <>
                <label>
                  Màu nền cần xóa
                  <input
                    type="color"
                    value={selected.keyColor}
                    onChange={(e) => patch({ keyColor: e.target.value })}
                  />
                </label>
                {(
                  [
                    ["similarity", "Mức xóa nền"],
                    ["smoothness", "Làm mềm viền"],
                    ["spillSuppression", "Khử ám xanh"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label} ·{" "}
                    {Math.round(
                      (key === "smoothness"
                        ? videoOverlayKeyParams(selected).smoothness
                        : selected[key]) * 100,
                    )}
                    %
                    <input
                      type="range"
                      min={0}
                      max={
                        key === "smoothness"
                          ? videoOverlayKeyParams(selected).similarity / 2
                          : 1
                      }
                      step={0.01}
                      value={
                        key === "smoothness"
                          ? videoOverlayKeyParams(selected).smoothness
                          : selected[key]
                      }
                      onChange={(e) => patch({ [key]: Number(e.target.value) })}
                    />
                  </label>
                ))}
                {selected.similarity >= 0.5 && (
                  <p className="dialog-help" role="status">
                    Mức xóa nền đang cao, có thể làm mất cả nội dung clip. Giảm
                    mức xóa nền hoặc khôi phục thông số bên dưới.
                  </p>
                )}
                <button
                  className="button"
                  onClick={() =>
                    patch({
                      ...TRANSPARENT_GREEN_SCREEN,
                    })
                  }
                >
                  Khôi phục xóa nền xanh
                </button>
              </>
            )}
            {selected.start + selected.duration > totalFrames / project.fps && (
              <p className="dialog-help">
                Phần clip vượt quá cuối video sẽ được cắt khi xuất.
              </p>
            )}
            <button
              className="button danger"
              onClick={() =>
                onChange(layers.filter((layer) => layer.id !== selected.id))
              }
            >
              <Icon name="trash" />
              Xóa lớp video này
            </button>
          </fieldset>
        </div>
      )}
    </div>
  );
}
