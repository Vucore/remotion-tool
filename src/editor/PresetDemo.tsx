import { useEffect, useState, type CSSProperties } from "react";
import {
  imagePose,
  transitionStyle,
  outgoingTransitionStyle,
} from "../animation";
import { makeScene, makeText, type Motion, type Transition } from "../model";
import { captionStyle, type StoryOptions } from "../auto/story";
import { TextAtFrame } from "../TextRender";
import { Icon } from "../icons";

function useDemoFrame(active: boolean) {
  const [frame, setFrame] = useState(36);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (reduced.matches) return;
      setFrame(Math.floor(((now - start) / 1000) * 30) % 120);
      raf = requestAnimationFrame(tick);
    };
    const refresh = () => {
      cancelAnimationFrame(raf);
      if (active && !reduced.matches) raf = requestAnimationFrame(tick);
    };
    refresh();
    reduced.addEventListener("change", refresh);
    return () => {
      cancelAnimationFrame(raf);
      reduced.removeEventListener("change", refresh);
    };
  }, [active]);
  return active ? frame : 36;
}

export function PresetDemo({
  id,
  label,
  type,
  selected,
  options,
  onClick,
}: {
  id: string;
  label: string;
  type: "motion" | "transition" | "caption";
  selected: boolean;
  options: StoryOptions;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false),
    [focused, setFocused] = useState(false);
  const frame = useDemoFrame(hover || focused);
  const source = "/samples/demo-a.svg",
    second = "/samples/demo-b.svg";
  const scene = {
    ...makeScene("demo"),
    ...options.image,
    motionAmount: Math.max(10, options.motionAmount),
    keyframes: [],
    motionStart: 0,
    motionOffset: 0,
    motionDuration: null,
    motion: (id === "auto"
      ? ["zoom-in", "zoom-out", "pan-left"][Math.floor(frame / 40)]
      : id) as Motion,
  };
  const pose = type === "motion" ? imagePose(scene, frame, 30, 120) : null;
  const p = Math.max(0, Math.min(1, (frame - 15) / 75));
  const transition = (id === "auto" ? "fade" : id) as Transition;
  const imgStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  return (
    <button
      className={"preset-tile demo-tile" + (selected ? " selected" : "")}
      aria-pressed={selected}
      title={label + " · rê chuột để xem"}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <span className="demo-art" aria-hidden="true">
        {type === "motion" && pose && (
          <img
            src={source}
            alt=""
            style={{
              ...imgStyle,
              transformOrigin: `${scene.focusX}% ${scene.focusY}%`,
              transform: `perspective(300px) translate(${pose.x}%,${pose.y}%) rotate(${pose.rotate}deg) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) scale(${pose.scale})`,
              opacity: pose.opacity,
            }}
          />
        )}
        {type === "transition" && (
          <>
            <span
              className="demo-layer"
              style={outgoingTransitionStyle(
                transition,
                p,
                options.transitionDirection,
              )}
            >
              <img src={source} style={imgStyle} alt="" />
              {(transition === "fade-black" || transition === "fade-white") && (
                <span
                  className="demo-layer"
                  style={{
                    background: transition === "fade-black" ? "#000" : "#fff",
                    opacity: Math.min(1, p * 2),
                  }}
                />
              )}
            </span>
            <span
              className="demo-layer"
              style={transitionStyle(
                transition,
                p,
                options.transitionDirection,
              )}
            >
              <img src={second} style={imgStyle} alt="" />
              {(transition === "fade-black" || transition === "fade-white") && (
                <span
                  className="demo-layer"
                  style={{
                    background: transition === "fade-black" ? "#000" : "#fff",
                    opacity: 1 - Math.max(0, Math.min(1, (p - 0.5) * 2)),
                  }}
                />
              )}
            </span>
          </>
        )}
        {type === "caption" && (
          <svg className="caption-demo-stage" viewBox="0 0 1080 620">
            <foreignObject width="1080" height="620">
              <div style={{ position: "relative", width: 1080, height: 620 }}>
                <TextAtFrame
                  text={{
                    ...makeText(),
                    ...captionStyle(options),
                    x: 50,
                    y: 50,
                    width: 95,
                    size: 95,
                    visible: true,
                    text: "Ngày xưa…",
                    start: 0,
                    end: 4,
                  }}
                  frame={frame}
                  fps={30}
                  sceneFrames={120}
                  width={1080}
                />
              </div>
            </foreignObject>
          </svg>
        )}
        <span className="demo-play">
          <Icon name="play" />
        </span>
      </span>
      <span className="preset-label">
        {label}
        {selected && <Icon name="check" />}
      </span>
    </button>
  );
}
