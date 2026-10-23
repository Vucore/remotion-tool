import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { timeline, totalFrames, type Project, type VoiceAsset } from "../model";
import { TRANSITIONS } from "../catalog";

export const timelineClock = (frame: number, fps: number) => {
  const n = Math.max(0, frame) / fps;
  return (
    Math.floor(n / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    Math.floor(n % 60)
      .toString()
      .padStart(2, "0") +
    "." +
    Math.floor((n % 1) * 100)
      .toString()
      .padStart(2, "0")
  );
};
function Waveform({ voice }: { voice: VoiceAsset }) {
  const source = voice.envelope?.values ?? [];
  const values = Array.from(
    { length: Math.min(160, source.length) },
    (_, i) => {
      const start = Math.floor(
          (i * source.length) / Math.min(160, source.length),
        ),
        end = Math.max(
          start + 1,
          Math.floor(((i + 1) * source.length) / Math.min(160, source.length)),
        );
      return Math.max(...source.slice(start, end));
    },
  );
  return (
    <svg
      viewBox={"0 0 " + Math.max(1, values.length * 3) + " 36"}
      preserveAspectRatio="none"
      className="timeline-wave"
      aria-hidden="true"
    >
      {values.length ? (
        values.map((v, i) => (
          <line
            key={i}
            x1={i * 3 + 1}
            x2={i * 3 + 1}
            y1={18 - Math.max(1, v * 15)}
            y2={18 + Math.max(1, v * 15)}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        ))
      ) : (
        <path d="M0 18H160" stroke="currentColor" />
      )}
    </svg>
  );
}
export function Timeline({
  project,
  frame,
  playing,
  estimated,
  busy,
  onSeek,
  onToggle,
  onAdd,
  onMotion,
  onTransition,
  onCaption,
  onVoice,
  onText,
}: {
  project: Project;
  frame: number;
  playing: boolean;
  estimated: boolean;
  busy: boolean;
  onSeek: (f: number) => void;
  onToggle: () => void;
  onAdd: () => void;
  onMotion: () => void;
  onTransition: () => void;
  onCaption: () => void;
  onVoice: () => void;
  onText: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null),
    drag = useRef(false);
  const [width, setWidth] = useState(800),
    [zoom, setZoom] = useState(1);
  const items = useMemo(() => timeline(project), [project]),
    duration = totalFrames(project),
    seconds = duration / project.fps;
  const canvasWidth = Math.max(width, 1) * zoom,
    scale = canvasWidth / Math.max(1, duration),
    safeFrame = Math.max(0, Math.min(frame, duration - 1));
  const active = [...items].reverse().find((i) => safeFrame >= i.from)
    ?.scene.id;
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) =>
      setWidth(Math.max(1, entry.contentRect.width - 32)),
    );
    resize.observe(node);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || drag.current) return;
    const node = viewport.current;
    if (!node) return;
    const x = safeFrame * scale;
    if (x < node.scrollLeft || x > node.scrollLeft + node.clientWidth - 45)
      node.scrollLeft = Math.max(0, x - node.clientWidth * 0.25);
  }, [safeFrame, scale, playing]);
  const tickSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200];
  const step =
    tickSteps.find((n) => n * project.fps * scale >= 70) ??
    Math.max(1, Math.ceil(seconds / 10));
  const ticks = Array.from(
    { length: Math.min(2000, Math.ceil(seconds / step) + 1) },
    (_, i) => i * step,
  ).filter((n) => n <= seconds);
  const captions = items.flatMap((item) =>
    item.scene.texts.flatMap((text) =>
      (text.captions ?? []).map((cue, i) => ({
        id: text.id + "-" + i,
        from: item.from + (cue.startMs / 1000) * project.fps,
        to: item.from + (cue.endMs / 1000) * project.fps,
        text: cue.text,
        visible: text.visible,
      })),
    ),
  );
  const seekPointer = (clientX: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (rect)
      onSeek(
        Math.max(
          0,
          Math.min(duration - 1, Math.round((clientX - rect.left) / scale)),
        ),
      );
  };
  return (
    <section
      className="timeline-panel"
      aria-label="Timeline ảnh, voice và phụ đề"
    >
      <div className="timeline-toolbar">
        <div className="transport">
          <button
            className="icon-button"
            aria-label="Về đầu video"
            disabled={!items.length}
            onClick={() => onSeek(0)}
          >
            <Icon name="rewind" />
          </button>
          <button
            className="transport-play"
            aria-label={playing ? "Tạm dừng" : "Chạy thử"}
            disabled={!items.length}
            onClick={onToggle}
          >
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <span className="transport-time">
            {timelineClock(safeFrame, project.fps)}
            <small> / {timelineClock(duration, project.fps)}</small>
          </span>
        </div>
        <div className="timeline-tools">
          {estimated && captions.length > 0 && (
            <span className="estimate-tag">Phụ đề ước tính</span>
          )}
          <button
            className="icon-button"
            aria-label="Thu nhỏ timeline"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
          >
            <Icon name="minus" />
          </button>
          <input
            aria-label="Phóng timeline"
            type="range"
            min={1}
            max={10}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button
            className="icon-button"
            aria-label="Phóng to timeline"
            disabled={zoom >= 10}
            onClick={() => setZoom((z) => Math.min(10, z * 1.5))}
          >
            <Icon name="plus" />
          </button>
          <button
            className="fit-timeline"
            onClick={() => {
              setZoom(1);
              if (viewport.current) viewport.current.scrollLeft = 0;
            }}
          >
            Vừa khung
          </button>
        </div>
      </div>
      <div className="timeline-grid">
        <div className="track-labels">
          <span className="ruler-label">
            <Icon name="clock" />
          </span>
          <button onClick={onMotion}>
            <Icon name="image" />
            <span>Ảnh</span>
          </button>
          <button onClick={onVoice}>
            <Icon name="voice" />
            <span>Voice</span>
          </button>
          <button onClick={onCaption}>
            <Icon name="text" />
            <span>Phụ đề</span>
          </button>
        </div>
        <div className="timeline-scroll" ref={viewport}>
          <div
            className="timeline-canvas"
            ref={canvas}
            style={{ width: canvasWidth + 32 }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              drag.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              seekPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (drag.current) seekPointer(e.clientX);
            }}
            onPointerUp={() => {
              drag.current = false;
            }}
            onPointerCancel={() => {
              drag.current = false;
            }}
          >
            <div
              className="time-ruler"
              role="slider"
              tabIndex={0}
              aria-label="Vạch phát"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, duration - 1)}
              aria-valuenow={safeFrame}
              aria-valuetext={timelineClock(safeFrame, project.fps)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  onSeek(
                    Math.max(
                      0,
                      Math.min(
                        duration - 1,
                        frame +
                          (e.key === "ArrowLeft" ? -1 : 1) *
                            (e.shiftKey ? project.fps : 1),
                      ),
                    ),
                  );
                }
              }}
            >
              {ticks.map((t) => (
                <span key={t} style={{ left: t * project.fps * scale }}>
                  {Math.floor(t / 60)
                    .toString()
                    .padStart(2, "0") +
                    ":" +
                    (t % 60).toString().padStart(2, "0")}
                </span>
              ))}
            </div>
            <div className="timeline-lanes" style={{ width: canvasWidth }}>
              {ticks.map((t) => (
                <span
                  className="timeline-gridline"
                  key={t}
                  style={{ left: t * project.fps * scale }}
                />
              ))}
              <div className="timeline-lane image-lane">
                {items.map((item, i) => {
                  const asset = project.assets.find(
                    (a) => a.id === item.scene.assetId,
                  );
                  return (
                    <button
                      key={item.scene.id}
                      className={
                        "image-clip" +
                        (active === item.scene.id ? " active" : "")
                      }
                      style={{
                        left: item.from * scale,
                        width: Math.max(1, item.duration * scale),
                      }}
                      aria-label={"Xem cảnh " + (i + 1) + ": " + asset?.name}
                      title={asset?.name}
                      onClick={() => {
                        onSeek(item.from + item.overlap);
                        onMotion();
                      }}
                    >
                      <span
                        className="image-clip-film"
                        style={{
                          backgroundImage: asset
                            ? "url(" + asset.src + ")"
                            : undefined,
                        }}
                      />
                      <span className="clip-label">
                        {i + 1}. {asset?.name}
                      </span>
                      <small>
                        {(item.duration / project.fps).toLocaleString("vi", {
                          maximumFractionDigits: 1,
                        })}
                        s
                      </small>
                    </button>
                  );
                })}
                {items.slice(1).map((item) => (
                  <button
                    key={item.scene.id + "-transition"}
                    className="timeline-transition"
                    style={{ left: item.from * scale - 10 }}
                    title={TRANSITIONS[item.incoming]}
                    aria-label={"Chuyển cảnh: " + TRANSITIONS[item.incoming]}
                    onClick={() => {
                      // The outgoing scene owns the transition at this join.
                      onSeek(Math.max(0, item.from - 1));
                      onTransition();
                    }}
                  >
                    <Icon name="transition" />
                  </button>
                ))}
              </div>
              <div className="timeline-lane voice-lane">
                {items.map((item) => {
                  const voice = project.voiceover?.assets.find(
                    (v) => v.id === item.scene.voice?.assetId,
                  );
                  return voice ? (
                    <button
                      key={voice.id}
                      className="voice-clip"
                      style={{
                        left: item.from * scale,
                        width: Math.max(
                          1,
                          voice.duration * project.fps * scale,
                        ),
                      }}
                      title={voice.name}
                      aria-label={"Nghe " + voice.name}
                      onClick={() => onSeek(item.from)}
                    >
                      <Waveform voice={voice} />
                      <span>{voice.name}</span>
                    </button>
                  ) : null;
                })}
                {!project.voiceover?.assets.length && (
                  <button
                    className="empty-track"
                    disabled={busy}
                    onClick={onVoice}
                  >
                    <Icon name="plus" />
                    Thêm voice
                  </button>
                )}
              </div>
              <div className="timeline-lane caption-lane">
                {captions.map((cue) => (
                  <button
                    key={cue.id}
                    className={
                      "caption-clip" + (!cue.visible ? " hidden-caption" : "")
                    }
                    style={{
                      left: cue.from * scale,
                      width: Math.max(1, (cue.to - cue.from) * scale),
                    }}
                    aria-label={"Phụ đề: " + cue.text}
                    title={cue.text}
                    onClick={() => {
                      onSeek(Math.ceil(cue.from - 1e-8));
                      onCaption();
                    }}
                  >
                    {cue.text}
                  </button>
                ))}
                {!captions.length && (
                  <button
                    className="empty-track"
                    disabled={busy}
                    onClick={onText}
                  >
                    <Icon name="plus" />
                    Thêm TXT
                  </button>
                )}
              </div>
            </div>
            <div className="playhead" style={{ left: safeFrame * scale }}>
              <span />
            </div>
          </div>
        </div>
        {!items.length && (
          <div className="empty-timeline">
            <Icon name="image" />
            <span>Thêm ảnh để bắt đầu</span>
            <button className="button" disabled={busy} onClick={onAdd}>
              Chọn ảnh
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
