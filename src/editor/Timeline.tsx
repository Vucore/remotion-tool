import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Icon } from "../icons";
import { timeline, type Project, type VoiceAsset } from "../model";
import { TRANSITIONS } from "../catalog";
import {
  lastAt,
  visibleItems,
  waveformPeaks,
  proxySource,
  type PlaybackClock,
} from "./performance";

export const timelineClock = (frame: number, fps: number) => {
  const n = Math.max(0, frame) / fps;
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}.${Math.floor((n % 1) * 100)
    .toString()
    .padStart(2, "0")}`;
};
const Waveform = memo(function Waveform({
  voice,
  width,
}: {
  voice: VoiceAsset;
  width: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const columns = Math.min(
    1024,
    Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(8, width / 3)))),
  );
  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext("2d");
    if (!node || !context) return;
    node.width = columns;
    node.height = 36;
    context.clearRect(0, 0, columns, 36);
    context.strokeStyle = "#578d72";
    context.beginPath();
    const peaks = waveformPeaks(voice.envelope?.values ?? [], columns);
    if (!peaks.length) {
      context.moveTo(0, 18);
      context.lineTo(columns, 18);
    }
    peaks.forEach((v, i) => {
      const x = (i * columns) / peaks.length;
      context.moveTo(x, 18 - Math.max(1, v * 15));
      context.lineTo(x, 18 + Math.max(1, v * 15));
    });
    context.stroke();
  }, [voice, columns]);
  return <canvas ref={canvas} className="timeline-wave" aria-hidden="true" />;
});
function TransportTime({
  clock,
  fps,
  duration,
}: {
  clock: PlaybackClock;
  fps: number;
  duration: number;
}) {
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let previous = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      clearTimeout(timer);
      timer = undefined;
      previous = performance.now();
      if (label.current)
        label.current.textContent = timelineClock(clock.get(), fps);
    };
    const unsubscribe = clock.subscribe(() => {
      const elapsed = performance.now() - previous;
      if (elapsed >= 100) draw();
      else if (!timer) timer = setTimeout(draw, 100 - elapsed);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [clock, fps]);
  return (
    <span className="transport-time">
      <span ref={label}>{timelineClock(clock.get(), fps)}</span>
      <small> / {timelineClock(duration, fps)}</small>
    </span>
  );
}
function Playhead({
  clock,
  scale,
  viewport,
  playing,
  drag,
}: {
  clock: PlaybackClock;
  scale: number;
  viewport: RefObject<HTMLDivElement | null>;
  playing: boolean;
  drag: RefObject<boolean>;
}) {
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const x = clock.get() * scale;
      if (head.current) head.current.style.transform = `translateX(${x}px)`;
      const node = viewport.current;
      if (
        playing &&
        !drag.current &&
        node &&
        (x < node.scrollLeft || x > node.scrollLeft + node.clientWidth - 45)
      )
        node.scrollLeft = Math.max(0, x - node.clientWidth * 0.25);
    };
    update();
    return clock.subscribe(update);
  }, [clock, scale, viewport, playing, drag]);
  return (
    <div
      ref={head}
      className="playhead"
      style={{ left: 0, willChange: "transform" }}
    >
      <span />
    </div>
  );
}
export function Timeline({
  project,
  clock,
  frame,
  playing,
  loading = false,
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
  clock: PlaybackClock;
  frame: number;
  playing: boolean;
  loading?: boolean;
  estimated: boolean;
  busy: boolean;
  onSeek: (frame: number) => void;
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
    ruler = useRef<HTMLDivElement>(null),
    drag = useRef(false);
  const [width, setWidth] = useState(800),
    [zoom, setZoom] = useState(1),
    [scroll, setScroll] = useState(0);
  const data = useMemo(() => {
    const items = timeline(project);
    const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
    const voices = new Map(
      project.voiceover?.assets.map((voice) => [voice.id, voice]) ?? [],
    );
    const captions = items
      .flatMap((item) =>
        item.scene.texts.flatMap((text) =>
          (text.captions ?? []).map((cue, i) => ({
            id: text.id + "-" + i,
            from: item.from + (cue.startMs / 1000) * project.fps,
            end: item.from + (cue.endMs / 1000) * project.fps,
            text: cue.text,
            visible: text.visible,
          })),
        ),
      )
      .sort((a, b) => a.from - b.from);
    return {
      items,
      assets,
      voices,
      captions,
      duration: Math.max(1, items.at(-1)?.end ?? 1),
    };
  }, [project]);
  const { items, assets, voices, captions, duration } = data;
  const seconds = duration / project.fps,
    canvasWidth = width * zoom,
    scale = canvasWidth / duration;
  const active = items[lastAt(items, frame)]?.scene.id;
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(1, entry.contentRect.width - 32)),
    );
    observer.observe(node);
    let raf = 0;
    const update = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setScroll(node.scrollLeft);
        });
    };
    node.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", update);
      cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    let last = 0;
    return clock.subscribe(() => {
      if (performance.now() - last < 100) return;
      last = performance.now();
      ruler.current?.setAttribute("aria-valuenow", String(clock.get()));
      ruler.current?.setAttribute(
        "aria-valuetext",
        timelineClock(clock.get(), project.fps),
      );
    });
  }, [clock, project.fps]);
  const from = Math.max(0, (scroll - 150) / scale),
    to = (scroll + width + 180) / scale;
  const visible = visibleItems(items, from, to);
  const visibleCaptions = visibleItems(captions, from, to);
  // Below 28 pixels a cue becomes a density block, avoiding thousands of nodes at fit zoom.
  const cueBlocks = useMemo(() => {
    const blocks: typeof captions = [];
    for (const cue of visibleCaptions) {
      const previous = blocks.at(-1);
      if (
        previous &&
        (cue.end - cue.from) * scale < 28 &&
        (cue.from - previous.end) * scale < 4 &&
        (previous.end - previous.from) * scale < 28
      ) {
        blocks[blocks.length - 1] = {
          ...previous,
          end: Math.max(previous.end, cue.end),
          text: "Nhiều câu · phóng to để xem",
        };
      } else blocks.push(cue);
    }
    return blocks;
  }, [captions, from, to, scale]); // eslint-disable-line react-hooks/exhaustive-deps
  const step =
    [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200].find(
      (n) => n * project.fps * scale >= 70,
    ) ?? Math.ceil(seconds / 10);
  const firstTick = Math.max(0, Math.floor(from / project.fps / step));
  const ticks = Array.from(
    { length: Math.min(100, Math.ceil((to - from) / project.fps / step) + 2) },
    (_, i) => (firstTick + i) * step,
  ).filter((n) => n <= seconds);
  const pendingSeek = useRef<number | null>(null),
    seekRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(seekRaf.current), []);
  const seekPointer = (clientX: number, flush = false) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return;
    pendingSeek.current = Math.max(
      0,
      Math.min(duration - 1, Math.round((clientX - rect.left) / scale)),
    );
    const commit = () => {
      seekRaf.current = 0;
      if (pendingSeek.current !== null) onSeek(pendingSeek.current);
      pendingSeek.current = null;
    };
    if (flush) {
      cancelAnimationFrame(seekRaf.current);
      commit();
    } else if (!seekRaf.current)
      seekRaf.current = requestAnimationFrame(commit);
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
          <TransportTime clock={clock} fps={project.fps} duration={duration} />
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
            max={500}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button
            className="icon-button"
            aria-label="Phóng to timeline"
            disabled={zoom >= 500}
            onClick={() => setZoom((z) => Math.min(500, z * 1.5))}
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
            onPointerUp={(e) => {
              if (drag.current) seekPointer(e.clientX, true);
              drag.current = false;
            }}
            onPointerCancel={() => {
              drag.current = false;
            }}
          >
            <div
              ref={ruler}
              className="time-ruler"
              role="slider"
              tabIndex={0}
              aria-label="Vạch phát"
              aria-valuemin={0}
              aria-valuemax={duration - 1}
              aria-valuenow={frame}
              aria-valuetext={timelineClock(frame, project.fps)}
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                  e.preventDefault();
                  onSeek(
                    Math.max(
                      0,
                      Math.min(
                        duration - 1,
                        clock.get() +
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
                  {timelineClock(t * project.fps, project.fps).split(".")[0]}
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
                {visible.map((item) => {
                  const asset = assets.get(item.scene.assetId),
                    w = item.duration * scale;
                  const i = items.indexOf(item);
                  return (
                    <button
                      key={item.scene.id}
                      className={
                        "image-clip" +
                        (active === item.scene.id ? " active" : "")
                      }
                      style={{
                        left: item.from * scale,
                        width: Math.max(1, w),
                        minWidth: 0,
                      }}
                      aria-label={`Xem cảnh ${i + 1}: ${asset?.name}`}
                      title={asset?.name}
                      onClick={() => {
                        onSeek(item.from + item.overlap);
                        onMotion();
                      }}
                    >
                      {w >= 36 && (
                        <span
                          className="image-clip-film"
                          style={{
                            backgroundImage: asset
                              ? `url(${proxySource(asset.src, 384)})`
                              : undefined,
                          }}
                        />
                      )}
                      {w >= 48 && (
                        <>
                          <span className="clip-label">
                            {i + 1}. {asset?.name}
                          </span>
                          <small>
                            {(item.duration / project.fps).toLocaleString(
                              "vi",
                              { maximumFractionDigits: 1 },
                            )}
                            s
                          </small>
                        </>
                      )}
                    </button>
                  );
                })}
                {visible
                  .filter(
                    (item) => item !== items[0] && item.duration * scale >= 28,
                  )
                  .map((item) => (
                    <button
                      key={item.scene.id + "-transition"}
                      className="timeline-transition"
                      style={{ left: item.from * scale - 10 }}
                      title={TRANSITIONS[item.incoming]}
                      aria-label={"Chuyển cảnh: " + TRANSITIONS[item.incoming]}
                      onClick={() => {
                        onSeek(Math.max(0, item.from - 1));
                        onTransition();
                      }}
                    >
                      <Icon name="transition" />
                    </button>
                  ))}
              </div>
              <div className="timeline-lane voice-lane">
                {visible.map((item) => {
                  const voice = voices.get(item.scene.voice?.assetId ?? "");
                  const w = voice ? voice.duration * project.fps * scale : 0;
                  return (
                    voice && (
                      <button
                        key={item.scene.id}
                        className="voice-clip"
                        style={{
                          left: item.from * scale,
                          width: Math.max(1, w),
                          minWidth: 0,
                        }}
                        title={voice.name}
                        aria-label={"Nghe " + voice.name}
                        onClick={() => onSeek(item.from)}
                      >
                        {w >= 35 && <Waveform voice={voice} width={w} />}
                        {w >= 60 && <span>{voice.name}</span>}
                      </button>
                    )
                  );
                })}
                {!voices.size && (
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
                {cueBlocks.map((cue) => (
                  <button
                    key={cue.id}
                    className={
                      "caption-clip" + (!cue.visible ? " hidden-caption" : "")
                    }
                    style={{
                      left: cue.from * scale,
                      width: Math.max(1, (cue.end - cue.from) * scale),
                      minWidth: 0,
                    }}
                    aria-label={"Phụ đề: " + cue.text}
                    title={cue.text}
                    onClick={() => {
                      onSeek(Math.ceil(cue.from - 1e-8));
                      onCaption();
                    }}
                  >
                    {(cue.end - cue.from) * scale >= 28 ? cue.text : ""}
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
            <Playhead
              clock={clock}
              scale={scale}
              viewport={viewport}
              playing={playing}
              drag={drag}
            />
          </div>
        </div>
        {!items.length && (
          <div className="empty-timeline">
            <Icon name="image" />
            <span>
              {loading ? "Đang dựng preview…" : "Thêm ảnh để bắt đầu"}
            </span>
            {!loading && (
              <button className="button" disabled={busy} onClick={onAdd}>
                Chọn ảnh
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
