import { useCurrentFrame, useVideoConfig } from "remotion";
import { hash, starPolygon } from "./animation";
import type { OverlaySpec } from "./model";
export function Overlays({
  layers,
  sceneFrames,
}: {
  layers: OverlaySpec[];
  sceneFrames: number;
}) {
  const frame = useCurrentFrame(),
    { fps, width, height } = useVideoConfig();
  return (
    <>
      {layers.map((layer) => {
        const elapsed = frame / fps - layer.start;
        const t = elapsed + layer.offset;
        if (
          !layer.enabled ||
          layer.amount === 0 ||
          elapsed < 0 ||
          frame / fps >=
            Math.min(layer.end ?? sceneFrames / fps, sceneFrames / fps)
        )
          return null;
        const s = layer.size,
          u = width / 1080,
          color = layer.color,
          opacity = layer.amount;
        const base = {
          position: "absolute" as const,
          inset: 0,
          pointerEvents: "none" as const,
          opacity,
        };
        if (layer.kind === "vignette")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                background: `radial-gradient(ellipse, transparent ${Math.max(5, Math.min(90, 35 / s))}%, ${color} 100%)`,
              }}
            />
          );
        if (layer.kind === "letterbox")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                borderTop: `${height * 0.08 * s}px solid ${color}`,
                borderBottom: `${height * 0.08 * s}px solid ${color}`,
              }}
            />
          );
        if (layer.kind === "frame")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                border: `${10 * u * s}px solid ${color}`,
                margin: width * 0.025,
              }}
            />
          );
        if (layer.kind === "scanlines")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                background: `repeating-linear-gradient(0deg,transparent 0 ${3 * u * s}px,${color} ${3 * u * s}px ${4 * u * s}px)`,
                backgroundPositionY: t * layer.speed * 20 * u,
              }}
            />
          );
        if (layer.kind === "flash")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                background: color,
                opacity:
                  opacity *
                  Math.max(0, Math.sin(t * layer.speed * Math.PI * 2)) ** 12,
              }}
            />
          );
        if (layer.kind === "light-leak")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                background: `radial-gradient(ellipse at ${30 + Math.sin(t * layer.speed) * 65}% ${30 + Math.cos(t * layer.speed * 0.7) * 60}%,${color} 0,transparent ${65 * s}%)`,
                mixBlendMode: "screen",
              }}
            />
          );
        if (layer.kind === "rays")
          return (
            <div
              key={layer.id}
              style={{
                ...base,
                background: `repeating-conic-gradient(from ${t * layer.speed * 5}deg at 50% 0%,transparent 0 ${12 / s}deg,${color} ${13 / s}deg ${14 / s}deg,transparent ${15 / s}deg ${28 / s}deg)`,
                mixBlendMode: "screen",
              }}
            />
          );
        const count =
          layer.kind === "smoke"
            ? 12
            : layer.kind === "grain"
              ? 180
              : Math.round(30 + opacity * 100);
        return (
          <svg
            key={layer.id}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="100%"
            style={base}
          >
            {Array.from({ length: count }, (_, i) => {
              const seed = layer.seed * 313 + i * 7,
                r = hash(seed),
                z = hash(seed + 1),
                a = hash(seed + 2),
                size = (1 + a * 6) * s * u;
              let x = r * width,
                y =
                  ((z + t * layer.speed * 0.08) % 1.15) * height -
                  height * 0.08;
              if (
                ["dust", "fireflies", "bubbles", "bokeh", "smoke"].includes(
                  layer.kind,
                )
              ) {
                x += Math.sin(t * layer.speed * 0.4 + a * 20) * width * 0.06;
                y =
                  ((((z - t * layer.speed * 0.035) % 1.15) + 1.15) % 1.15) *
                    height -
                  height * 0.08;
              }
              switch (layer.kind) {
                case "grain":
                  return (
                    <circle
                      key={i}
                      cx={
                        hash(seed + Math.floor((t * fps * layer.speed) / 2)) *
                        width
                      }
                      cy={
                        hash(
                          seed + 15 + Math.floor((t * fps * layer.speed) / 2),
                        ) * height
                      }
                      r={size * 0.3}
                      fill={color}
                      opacity={0.2 + a * 0.5}
                    />
                  );
                case "rain":
                  return (
                    <line
                      key={i}
                      x1={x}
                      y1={(y * 4) % (height + 100)}
                      x2={x - size * 2}
                      y2={((y * 4) % (height + 100)) + size * 10}
                      stroke={color}
                      strokeWidth={Math.max(1, size * 0.25)}
                      opacity={0.3 + a * 0.5}
                    />
                  );
                case "confetti":
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={y}
                      width={size * 2}
                      height={size}
                      fill={color}
                      transform={`rotate(${t * layer.speed * 70 + i * 30} ${x} ${y})`}
                    />
                  );
                case "petals":
                  return (
                    <ellipse
                      key={i}
                      cx={x + Math.sin(t + a * 20) * size * 5}
                      cy={y}
                      rx={size * 1.5}
                      ry={size * 0.7}
                      fill={color}
                      transform={`rotate(${t * layer.speed * 40 + i * 30} ${x} ${y})`}
                    />
                  );
                case "bubbles":
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={size * 4}
                      stroke={color}
                      strokeWidth={u * 1.5}
                      fill="none"
                      opacity={0.3 + a * 0.5}
                    />
                  );
                case "bokeh":
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={size * 7}
                      fill={color}
                      opacity={0.08 + a * 0.2}
                      style={{ filter: `blur(${size}px)` }}
                    />
                  );
                case "smoke":
                  return (
                    <ellipse
                      key={i}
                      cx={x}
                      cy={y}
                      rx={width * 0.2 * s}
                      ry={height * 0.1 * s}
                      fill={color}
                      opacity={0.06 + a * 0.08}
                      style={{ filter: `blur(${width * 0.05}px)` }}
                    />
                  );
                case "speed-lines":
                  return (
                    <line
                      key={i}
                      x1={width * 0.5 + (r - 0.5) * width * 0.8}
                      y1={height * 0.5 + (z - 0.5) * height * 0.8}
                      x2={width * 0.5 + (r - 0.5) * width * 2}
                      y2={height * 0.5 + (z - 0.5) * height * 2}
                      stroke={color}
                      strokeWidth={size * 0.2}
                      opacity={0.3 + Math.sin(t * layer.speed * 15 + i) * 0.2}
                    />
                  );
                case "film-scratches":
                  return (
                    <line
                      key={i}
                      x1={x + Math.sin(t * fps * 0.1 + i) * size * 2}
                      x2={x + Math.sin(t * fps * 0.1 + i) * size * 2}
                      y1={y}
                      y2={y + height * 0.3}
                      stroke={color}
                      strokeWidth={size * 0.1}
                      opacity={
                        hash(i + Math.floor((t * fps) / 4)) > 0.7 ? 0.4 : 0
                      }
                    />
                  );
                case "stars":
                  return (
                    <polygon
                      key={i}
                      points={starPolygon()
                        .split(",")
                        .map((p) => p.split("%").join(""))
                        .join(" ")}
                      fill={color}
                      transform={`translate(${x - size} ${z * height - size}) scale(${size / 50})`}
                      opacity={
                        0.2 + 0.8 * Math.abs(Math.sin(t * layer.speed * 2 + i))
                      }
                    />
                  );
                default:
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={layer.kind === "fireflies" ? size * 0.7 : size * 0.45}
                      fill={color}
                      opacity={
                        layer.kind === "fireflies"
                          ? 0.3 + 0.7 * Math.abs(Math.sin(t * layer.speed + i))
                          : 0.3 + a * 0.6
                      }
                      style={
                        layer.kind === "fireflies"
                          ? {
                              filter: `drop-shadow(0 0 ${size * 3}px ${color})`,
                            }
                          : undefined
                      }
                    />
                  );
              }
            })}
          </svg>
        );
      })}
    </>
  );
}
