import { useEffect, useRef, type PointerEvent } from "react";
import {
  captionStyle,
  type StoryOptions,
  type StoryCaption,
} from "../auto/story";
import { NumberField } from "./AdvancedSettings";
import { staticFile } from "remotion";

export function CaptionPosition({
  options,
  onChange,
}: {
  options: StoryOptions;
  onChange: (patch: Partial<StoryOptions>) => void;
}) {
  const caption = options.caption;
  const style = captionStyle(options);
  const x = style.x ?? 50,
    y = style.y ?? 87;
  const latest = useRef(onChange);
  latest.current = onChange;
  const current = useRef(caption);
  current.current = caption;
  const pending = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const patch = (point: { x: number; y: number }) => {
    latest.current({
      caption: {
        ...current.current,
        advanced: { ...current.current.advanced, ...point },
      },
    });
  };
  const flush = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    if (pending.current) {
      patch(pending.current);
      pending.current = null;
    }
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pending.current = {
      x: Math.max(
        0,
        Math.min(
          100,
          Math.round(((event.clientX - rect.left) / rect.width) * 100),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          100,
          Math.round(((event.clientY - rect.top) / rect.height) * 100),
        ),
      ),
    };
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };
  return (
    <div className="caption-position">
      <span className="caption-position-label">Vị trí phụ đề</span>
      <div
        className="animation-mode-buttons"
        role="group"
        aria-label="Đặt nhanh vị trí phụ đề"
      >
        {(
          [
            ["top", "Trên", 14],
            ["middle", "Giữa", 50],
            ["bottom", "Dưới", 87],
          ] as const
        ).map(([position, label, targetY]) => (
          <button
            key={position}
            type="button"
            aria-pressed={x === 50 && y === targetY}
            onClick={() =>
              onChange({
                caption: {
                  ...caption,
                  position: position as StoryCaption["position"],
                  advanced: { ...caption.advanced, x: 50, y: targetY },
                },
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <details className="compact-details">
        <summary>
          Kéo vị trí & tọa độ · {x}% / {y}%
        </summary>
        <button
          type="button"
          className={
            "caption-position-pad " +
            (options.ratio === "9:16" ? "is-portrait" : "is-landscape")
          }
          aria-label="Đặt vị trí phụ đề trên khung minh họa"
          title="Kéo để đặt vị trí. Dùng phím mũi tên để dịch chuyển; Shift để dịch 5%."
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            move(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              move(event);
          }}
          onPointerUp={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            move(event);
            flush();
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={flush}
          onKeyDown={(event) => {
            const delta = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            }[event.key];
            if (!delta) return;
            event.preventDefault();
            const step = event.shiftKey ? 5 : 1;
            patch({
              x: Math.max(0, Math.min(100, x + delta[0] * step)),
              y: Math.max(0, Math.min(100, y + delta[1] * step)),
            });
          }}
        >
          <img
            src={staticFile("samples/demo-a.svg")}
            alt=""
            draggable={false}
          />
          <span
            className="caption-position-marker"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-hidden="true"
          >
            Phụ đề
          </span>
        </button>
        <div className="paired-settings">
          <NumberField
            label="Ngang phụ đề (%)"
            value={x}
            min={0}
            max={100}
            onChange={(value) => patch({ x: value, y })}
          />
          <NumberField
            label="Dọc phụ đề (%)"
            value={y}
            min={0}
            max={100}
            onChange={(value) => patch({ x, y: value })}
          />
        </div>
      </details>
    </div>
  );
}
