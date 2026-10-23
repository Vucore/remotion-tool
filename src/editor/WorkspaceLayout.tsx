import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

const STORAGE = "khung-panel-sizes-v1";
const defaults = { media: 252, settings: 302, timeline: 244 };
type Sizes = typeof defaults;
function readSizes(): Sizes {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (
      value &&
      Object.keys(defaults).every(
        (k) => Number.isFinite(value[k]) && value[k] > 0,
      )
    )
      return value;
  } catch {
    /* Use defaults when browser storage is unavailable. */
  }
  return defaults;
}
function Splitter({
  label,
  axis,
  value,
  min,
  max,
  onChange,
  onReset,
  reverse = false,
}: {
  label: string;
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  onReset: () => void;
  reverse?: boolean;
}) {
  const drag = useRef<{ point: number; value: number } | null>(null);
  const clamp = (n: number) => Math.round(Math.max(min, Math.min(max, n)));
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current)
      onChange(
        clamp(
          drag.current.value +
            (reverse ? -1 : 1) *
              (axis === "x"
                ? e.clientX - drag.current.point
                : drag.current.point - e.clientY),
        ),
      );
  };
  return (
    <div
      className={"workspace-splitter splitter-" + axis}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      title={label + " · kéo hoặc dùng phím mũi tên · nhấp đúp để đặt lại"}
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { point: axis === "x" ? e.clientX : e.clientY, value };
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        move(e);
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 20 : 5;
        const d =
          axis === "x"
            ? { ArrowLeft: -step, ArrowRight: step }
            : { ArrowUp: step, ArrowDown: -step };
        if (e.key in d) {
          e.preventDefault();
          onChange(
            clamp(value + (reverse ? -1 : 1) * d[e.key as keyof typeof d]!),
          );
        }
        if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          onChange(e.key === "Home" ? min : max);
        }
      }}
    >
      <span />
    </div>
  );
}
export function useWorkspaceLayout() {
  const [sizes, setSizes] = useState(readSizes);
  const [bounds, setBounds] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([e]) =>
      setBounds({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(sizes));
    } catch {
      /* Storage is optional. */
    }
  }, [sizes]);
  const media = Math.max(
    180,
    Math.min(420, sizes.media, bounds.width - 240 - 280 - 12),
  );
  const settings = Math.max(
    240,
    Math.min(520, sizes.settings, bounds.width - media - 280 - 12),
  );
  const maxTimeline = Math.max(140, Math.min(650, bounds.height - 285));
  const timeline = Math.max(140, Math.min(maxTimeline, sizes.timeline));
  const update = (key: keyof Sizes, value: number) =>
    setSizes((s) => ({ ...s, [key]: value }));
  const style = {
    "--media-width": `${media}px`,
    "--settings-width": `${settings}px`,
    "--timeline-height": `${timeline}px`,
  } as CSSProperties;
  return {
    root,
    style,
    reset: () => setSizes(defaults),
    mediaHandle: (
      <Splitter
        label="Độ rộng tài nguyên"
        axis="x"
        value={media}
        min={180}
        max={Math.max(180, Math.min(420, bounds.width - settings - 292))}
        onChange={(n) => update("media", n)}
        onReset={() => update("media", defaults.media)}
      />
    ),
    // This edge moves left when the right panel gets wider.
    settingsHandle: (
      <div className="settings-splitter">
        <Splitter
          label="Độ rộng thiết lập"
          axis="x"
          reverse
          value={settings}
          min={240}
          max={Math.max(240, Math.min(520, bounds.width - media - 292))}
          onChange={(n) => update("settings", n)}
          onReset={() => update("settings", defaults.settings)}
        />
      </div>
    ),
    timelineHandle: (
      <Splitter
        label="Chiều cao timeline"
        axis="y"
        value={timeline}
        min={140}
        max={maxTimeline}
        onChange={(n) => update("timeline", n)}
        onReset={() => update("timeline", defaults.timeline)}
      />
    ),
  };
}
