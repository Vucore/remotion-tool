import type { CSSProperties } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease } from "./animation";
import type { TextLayer } from "./model";
type AnimatedStyle = {
  x: number;
  y: number;
  scale: number;
  rx: number;
  ry: number;
  rotate: number;
  opacity: number;
  blur: number;
  skew: number;
  sx: number;
  sy: number;
  tracking: number;
  clip: number;
};
function textEntrance(
  kind: TextLayer["animationIn"],
  p: number,
): AnimatedStyle {
  const s = 1 - p,
    r = {
      x: 0,
      y: 0,
      scale: 1,
      rx: 0,
      ry: 0,
      rotate: 0,
      opacity: 1,
      blur: 0,
      skew: 0,
      sx: 1,
      sy: 1,
      tracking: 0,
      clip: 0,
    };
  if (kind === "none") return r;
  r.opacity = clamp(p);
  switch (kind) {
    case "typewriter":
    case "typewriter-cursor":
    case "word-highlight":
      r.opacity = 1;
      break;
    case "slide-up":
    case "letter-rise":
    case "word-rise":
      r.y = s * 70;
      break;
    case "slide-down":
      r.y = -s * 70;
      break;
    case "slide-left":
      r.x = -s * 100;
      break;
    case "slide-right":
      r.x = s * 100;
      break;
    case "pop":
    case "word-pop":
      r.scale = 0.3 + p * 0.7 + Math.sin(clamp(p) * Math.PI) * 0.15;
      break;
    case "zoom":
      r.scale = 0.1 + p * 0.9;
      break;
    case "zoom-out":
      r.scale = 2 - p;
      break;
    case "bounce":
      r.y = -(1 - ease("bounce", clamp(p))) * 100;
      break;
    case "rotate":
    case "letter-spin":
      r.rotate = s * -90;
      r.scale = 0.5 + p * 0.5;
      break;
    case "flip-x":
      r.ry = s * 90;
      break;
    case "flip-y":
      r.rx = s * -90;
      break;
    case "blur":
      r.blur = s * 18;
      break;
    case "wipe":
      r.clip = s * 100;
      break;
    case "stretch":
      r.sx = 0.4 + p * 0.6;
      r.sy = 1 + s * 0.6;
      break;
    case "skew":
      r.skew = s * -35;
      r.x = s * 50;
      break;
    case "scale-x":
      r.sx = p;
      break;
    case "scale-y":
      r.sy = p;
      break;
    case "tracking-in":
      r.tracking = s * 18;
      break;
    case "tracking-out":
      r.tracking = -s * 6;
      break;
  }
  return r;
}
function styleOf(
  a: AnimatedStyle,
  b: AnimatedStyle,
  unit: number,
): CSSProperties {
  return {
    opacity: clamp(a.opacity * b.opacity),
    transform: `perspective(900px) translate(${(a.x + b.x) * unit}px,${(a.y + b.y) * unit}px) rotate(${a.rotate + b.rotate}deg) rotateX(${a.rx + b.rx}deg) rotateY(${a.ry + b.ry}deg) scale(${a.scale * b.scale}) scaleX(${a.sx * b.sx}) scaleY(${a.sy * b.sy}) skewX(${a.skew + b.skew}deg)`,
    filter:
      a.blur + b.blur > 0 ? `blur(${(a.blur + b.blur) * unit}px)` : undefined,
    clipPath:
      a.clip + b.clip > 0
        ? `inset(0 ${clamp((a.clip + b.clip) / 100) * 100}% 0 0)`
        : undefined,
    letterSpacing: (a.tracking + b.tracking) * unit,
  };
}
export function AnimatedText({
  text: source,
  sceneFrames,
  width,
}: {
  text: TextLayer;
  sceneFrames: number;
  width: number;
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const cue = source.captions?.find(
    (c) => (frame * 1000) / fps >= c.startMs && (frame * 1000) / fps < c.endMs,
  );
  if (source.captions && !cue) return null;
  const text = cue
    ? {
        ...source,
        text: cue.text,
        start: cue.startMs / 1000,
        end: cue.endMs / 1000,
        offset: 0,
        span: null,
      }
    : source;
  const start = text.start,
    end = Math.min(text.end ?? sceneFrames / fps, sceneFrames / fps),
    elapsed = frame / fps - start,
    time = elapsed + text.offset,
    duration = text.span ?? end - start;
  if (!text.visible || duration <= 0 || elapsed < 0 || elapsed >= end - start)
    return null;
  const unit = width / 1080;
  const inDuration = Math.min(text.inDuration, duration / 2),
    outDuration = Math.min(text.outDuration, duration / 2);
  const pIn = ease(text.easing, time / Math.max(0.001, inDuration)),
    pOut =
      text.animationOut === "none"
        ? 1
        : ease(text.easing, (duration - time) / Math.max(0.001, outDuration));
  const countValue =
    text.countFrom +
    (text.countTo - text.countFrom) *
      clamp(ease(text.easing, time / Math.max(0.001, duration - outDuration)));
  let content = text.counter
    ? `${text.prefix}${countValue.toLocaleString("vi-VN", { minimumFractionDigits: Math.round(text.decimals), maximumFractionDigits: Math.round(text.decimals) })}${text.suffix}`
    : text.text;
  if (text.casing === "uppercase") content = content.toLocaleUpperCase("vi");
  else if (text.casing === "lowercase")
    content = content.toLocaleLowerCase("vi");
  else if (text.casing === "capitalize")
    content = content.replace(/(^|\s)\S/gu, (s) => s.toLocaleUpperCase("vi"));
  const w = time * text.loopSpeed * Math.PI * 2;
  let loopX = 0,
    loopY = 0,
    loopScale = 1,
    loopRotation = 0,
    loopOpacity = 1,
    hue = 0;
  switch (text.loop) {
    case "float":
      loopY = Math.sin(w * 0.5) * 12;
      break;
    case "pulse":
      loopScale = 1 + Math.sin(w) * 0.06;
      break;
    case "sway":
      loopRotation = Math.sin(w * 0.5) * 4;
      break;
    case "shake":
      loopX = Math.sin(w * 5) * 4;
      loopY = Math.cos(w * 7) * 2;
      break;
    case "bounce":
      loopY = -Math.abs(Math.sin(w * 0.5)) * 20;
      break;
    case "blink":
      loopOpacity = Math.sin(w) > 0 ? 1 : 0.15;
      break;
    case "rainbow":
      hue = w * 30;
      break;
    case "neon-flicker":
      loopOpacity = 0.55 + Math.abs(Math.sin(w * 5) * Math.sin(w * 7)) * 0.45;
      break;
    case "spin":
      loopRotation = w * 20;
      break;
    case "heartbeat":
      loopScale =
        1 + Math.max(0, Math.sin(w)) * Math.max(0, Math.sin(w * 2)) * 0.12;
      break;
  }
  const perUnit =
    text.shape === "normal" &&
    (/^(letter|word|typewriter)/.test(text.animationIn) ||
      /^(letter|word|typewriter)/.test(text.animationOut) ||
      text.loop === "wave");
  const perWord =
    text.animationIn.startsWith("word") || text.animationOut.startsWith("word");
  const pieces = perWord
    ? content.split(/(\s+)/u)
    : Array.from(
        new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(content),
        (s) => s.segment,
      );
  const total = Math.max(1, pieces.filter((s) => s.trim()).length);
  const typedCount = Math.ceil(
    clamp(time / Math.max(0.001, inDuration)) * total,
  );
  const caretOn =
    text.animationIn === "typewriter-cursor" && Math.floor(time * 2) % 2 === 0;
  const maxStagger = Math.max(
    0,
    Math.min(
      text.stagger,
      (duration * 0.45 - Math.min(inDuration, 0.2)) / Math.max(1, total - 1),
    ),
  );
  const global = styleOf(
    textEntrance(perUnit ? "none" : text.animationIn, pIn),
    textEntrance(perUnit ? "none" : text.animationOut, pOut),
    unit,
  );
  const shadows: string[] = [];
  if (text.shadow > 0)
    shadows.push(
      `${text.shadowX * unit}px ${text.shadowY * unit}px ${text.shadow * unit}px ${text.shadowColor}`,
    );
  if (text.glow > 0)
    shadows.push(
      `0 0 ${text.glow * unit}px ${text.color}`,
      `0 0 ${text.glow * unit * 2}px ${text.color}`,
    );
  for (let i = 1; i <= text.depth; i++)
    shadows.push(`${i * unit}px ${i * unit}px 0 ${text.shadowColor}`);
  const ink: CSSProperties = {
    fontFamily: `"${text.fontFamily}", Arial, sans-serif`,
    fontSize: text.size * unit,
    fontWeight: text.weight,
    fontStyle: text.italic ? "italic" : "normal",
    lineHeight: text.lineHeight,
    letterSpacing:
      text.letterSpacing * unit +
      (perUnit ? 0 : Number(global.letterSpacing ?? 0)),
    textDecoration: text.decoration,
    textShadow: shadows.join(",") || undefined,
    WebkitTextStroke: text.stroke
      ? `${text.stroke * unit}px ${text.strokeColor}`
      : undefined,
    paintOrder: "stroke fill",
    color: text.fill === "outline" ? "transparent" : text.color,
    ...(text.fill === "gradient"
      ? {
          backgroundImage: `linear-gradient(${text.gradientAngle}deg,${text.color},${text.gradientColor})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }
      : {}),
  };
  let inkIndex = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: `${text.x}%`,
        top: `${text.y}%`,
        transform: `translate(-50%,-50%) translate(${loopX * unit}px,${loopY * unit}px) rotate(${text.rotate + loopRotation}deg) skewX(${text.skew}deg) scale(${text.scale * loopScale})`,
        opacity: text.opacity * loopOpacity,
        width: text.shape === "normal" ? "max-content" : `${text.width}%`,
        maxWidth: `${text.width}%`,
        textAlign: text.align,
        writingMode: text.writing,
        filter: hue ? `hue-rotate(${hue}deg)` : undefined,
      }}
    >
      <div
        style={{
          background: text.background,
          padding: text.background === "transparent" ? 0 : text.padding * unit,
          borderRadius: text.radius * unit,
        }}
      >
        <div
          style={{
            ...global,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {text.shape !== "normal" ? (
            <svg
              width="100%"
              viewBox={`0 0 ${(width * text.width) / 100} ${(text.size * 3 + text.arc * 4) * unit}`}
              style={{ overflow: "visible", display: "block" }}
            >
              <defs>
                <path
                  id={`arc-${text.id}`}
                  d={`M 0 ${(text.size * 3 + text.arc * 4) * unit * 0.6} Q ${(width * text.width) / 200} ${((text.size * 3 + text.arc * 4) * 0.6 + (text.shape === "arc-up" ? -1 : 1) * text.arc * 3) * unit} ${(width * text.width) / 100} ${(text.size * 3 + text.arc * 4) * unit * 0.6}`}
                />
                <linearGradient
                  id={`gradient-${text.id}`}
                  gradientTransform={`rotate(${text.gradientAngle})`}
                >
                  <stop stopColor={text.color} />
                  <stop offset="100%" stopColor={text.gradientColor} />
                </linearGradient>
              </defs>
              <text
                style={{
                  ...ink,
                  backgroundImage: undefined,
                  WebkitTextFillColor: undefined,
                }}
                fill={
                  text.fill === "gradient"
                    ? `url(#gradient-${text.id})`
                    : text.fill === "outline"
                      ? "transparent"
                      : text.color
                }
                stroke={text.strokeColor}
                strokeWidth={text.stroke * unit}
              >
                <textPath
                  href={`#arc-${text.id}`}
                  startOffset={
                    text.align === "left"
                      ? "0%"
                      : text.align === "right"
                        ? "100%"
                        : "50%"
                  }
                  textAnchor={
                    text.align === "left"
                      ? "start"
                      : text.align === "right"
                        ? "end"
                        : "middle"
                  }
                >
                  {content.replace(/\n/g, " ")}
                </textPath>
              </text>
            </svg>
          ) : (
            <span style={ink}>
              {text.animationIn === "typewriter-cursor" && typedCount === 0 && (
                <span
                  style={{
                    display: "inline-block",
                    height: "1em",
                    borderLeft: `${2 * unit}px solid ${caretOn ? text.color : "transparent"}`,
                    verticalAlign: "middle",
                  }}
                />
              )}
              {!perUnit
                ? content
                : pieces.map((piece, i) => {
                    if (!piece.trim()) return piece;
                    const index = inkIndex++;
                    const pin = ease(
                      text.easing,
                      (time - index * maxStagger) /
                        Math.max(0.001, Math.min(inDuration, duration * 0.3)),
                    );
                    const pout = ease(
                      text.easing,
                      (duration - time - (total - index - 1) * maxStagger) /
                        Math.max(0.001, Math.min(outDuration, duration * 0.3)),
                    );
                    const incoming = textEntrance(text.animationIn, pin),
                      outgoing = textEntrance(text.animationOut, pout);
                    const typeIn = text.animationIn.startsWith("typewriter"),
                      typeOut = text.animationOut.startsWith("typewriter");
                    const revealed =
                      (!typeIn ||
                        index <
                          Math.ceil(
                            clamp(time / Math.max(0.001, inDuration)) * total,
                          )) &&
                      (!typeOut ||
                        index <
                          Math.ceil(
                            clamp(
                              (duration - time) / Math.max(0.001, outDuration),
                            ) * total,
                          ));
                    const highlighted =
                      text.animationIn === "word-highlight" &&
                      Math.floor(clamp(time / duration) * total) === index;
                    return (
                      <span
                        key={i}
                        style={{
                          ...styleOf(incoming, outgoing, unit),
                          display: "inline-block",
                          visibility: revealed ? "visible" : "hidden",
                          boxShadow:
                            caretOn && index === typedCount - 1
                              ? `${2 * unit}px 0 ${text.color}`
                              : undefined,
                          ...(text.loop === "wave"
                            ? {
                                transform: `${styleOf(incoming, outgoing, unit).transform} translateY(${Math.sin(w - index * 0.5) * 8 * unit}px)`,
                              }
                            : {}),
                          ...(highlighted
                            ? {
                                background: text.gradientColor,
                                color:
                                  text.background === "transparent"
                                    ? "#10271d"
                                    : text.background,
                                WebkitTextFillColor:
                                  text.background === "transparent"
                                    ? "#10271d"
                                    : text.background,
                                borderRadius: 4,
                                padding: "0 .08em",
                              }
                            : {}),
                        }}
                      >
                        {piece}
                      </span>
                    );
                  })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
