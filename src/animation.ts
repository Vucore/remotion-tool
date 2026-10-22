import { Easing } from "remotion";
import type { CSSProperties } from "react";
import type { EasingName } from "./catalog";
import type { Scene, Transition } from "./model";
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));
export function ease(name: EasingName, progress: number) {
  const t = clamp(progress);
  switch (name) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return 1 - (1 - t) ** 2;
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case "cubic":
      return t * t * (3 - 2 * t);
    case "expo":
      return t === 1 ? 1 : 1 - 2 ** (-10 * t);
    case "back":
      return Easing.back(1.5)(t);
    case "elastic":
      return Easing.elastic(1)(t);
    case "bounce":
      return Easing.bounce(t);
    case "steps":
      return Math.floor(t * 8) / 8;
    default:
      return t;
  }
}
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export function imagePose(
  scene: Scene,
  frame: number,
  fps: number,
  frames: number,
) {
  const t = frame / fps + scene.motionOffset,
    p = ease(
      scene.motionEasing,
      t / Math.max(1 / fps, (scene.motionDuration ?? frames / fps) - 1 / fps),
    ),
    a = scene.motionAmount,
    w = t * scene.motionSpeed * Math.PI * 2;
  let x = scene.x,
    y = scene.y,
    scale = scene.scale,
    rotate = scene.rotate,
    opacity = scene.opacity,
    rx = 0,
    ry = 0;
  if (scene.keyframes.length) {
    const keys = [...scene.keyframes].sort((a, b) => a.time - b.time);
    if (keys[0].time > 0)
      keys.unshift({ time: 0, x, y, scale, rotate, opacity });
    const left = [...keys].reverse().find((k) => k.time <= t) ?? keys[0];
    const right = keys.find((k) => k.time > t) ?? left;
    const q =
      right === left
        ? 0
        : ease(scene.motionEasing, (t - left.time) / (right.time - left.time));
    const v = (key: "x" | "y" | "scale" | "rotate" | "opacity") =>
      left[key] + (right[key] - left[key]) * q;
    x = v("x");
    y = v("y");
    scale = v("scale");
    rotate = v("rotate");
    opacity = v("opacity");
  }
  switch (scene.motion) {
    case "zoom-in":
      scale *= 1 + (p * a) / 100;
      break;
    case "zoom-out":
      scale *= 1 + ((1 - p) * a) / 100;
      break;
    case "pan-left":
    case "pan-right":
      scale *= 1 + a / 100;
      x += (scene.motion === "pan-left" ? 1 : -1) * (0.5 - p) * a * 0.65;
      break;
    case "pan-up":
    case "pan-down":
      scale *= 1 + a / 100;
      y += (scene.motion === "pan-up" ? 1 : -1) * (0.5 - p) * a * 0.65;
      break;
    case "diagonal-in":
    case "diagonal-out":
      scale *= 1 + a / 100;
      x += (0.5 - p) * a * 0.5;
      y += (scene.motion === "diagonal-in" ? 1 : -1) * (0.5 - p) * a * 0.5;
      break;
    case "float":
      y += Math.sin(w * 0.4) * a * 0.12;
      break;
    case "pulse":
      scale *= 1 + ((Math.sin(w) * 0.5 + 0.5) * a) / 100;
      break;
    case "zoom-pulse":
      scale *= 1 + ((Math.sin(w * 0.4) * 0.5 + 0.5) * a) / 100;
      break;
    case "shake":
      x += Math.sin(w * 7) * a * 0.08;
      y += Math.cos(w * 9) * a * 0.06;
      break;
    case "handheld":
      scale *= 1 + a / 200;
      x += Math.sin(w * 0.6) * a * 0.1;
      y += Math.sin(w * 0.83) * a * 0.08;
      rotate += Math.sin(w * 0.45) * a * 0.06;
      break;
    case "sway":
      rotate += Math.sin(w * 0.4) * a * 0.4;
      break;
    case "bounce":
      y -= Math.abs(Math.sin(w * 0.5)) * a * 0.3;
      break;
    case "spin":
      rotate += p * 360 * scene.motionSpeed;
      break;
    case "orbit":
      x += Math.cos(w * 0.3) * a * 0.2;
      y += Math.sin(w * 0.3) * a * 0.2;
      break;
    case "flip-x":
      ry = p * 360 * scene.motionSpeed;
      break;
    case "flip-y":
      rx = p * 360 * scene.motionSpeed;
      break;
    case "rotate-in":
      rotate += (1 - p) * a * 2;
      scale *= 1 + (p * a) / 100;
      break;
    case "rotate-out":
      rotate -= p * a * 2;
      scale *= 1 + ((1 - p) * a) / 100;
      break;
    case "slide-up":
      y -= p * a;
      break;
    case "slide-down":
      y += p * a;
      break;
  }
  return { x, y, scale, rotate, opacity: clamp(opacity), rx, ry };
}
export const starPolygon = (points = 5, scale = 1, inner = 0.44) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const theta = -Math.PI / 2 + (i * Math.PI) / points,
      r = (i % 2 ? inner : 1) * 50 * scale;
    return `${50 + Math.cos(theta) * r}% ${50 + Math.sin(theta) * r}%`;
  }).join(",");
export const heartPolygon = (scale = 1) =>
  Array.from({ length: 64 }, (_, i) => {
    const t = (i / 63) * Math.PI * 2;
    return `${50 + Math.sin(t) ** 3 * 45 * scale}% ${50 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 2.7 * scale}%`;
  }).join(",");
export function maskStyle(mask: Scene["mask"]): CSSProperties {
  switch (mask) {
    case "circle":
      return { clipPath: "circle(45% at 50% 50%)" };
    case "ellipse":
      return { clipPath: "ellipse(48% 40% at 50% 50%)" };
    case "rounded":
      return { borderRadius: "8%" };
    case "diamond":
      return { clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" };
    case "hexagon":
      return {
        clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)",
      };
    case "triangle":
      return { clipPath: "polygon(50% 0,100% 100%,0 100%)" };
    case "star":
      return { clipPath: `polygon(${starPolygon()})` };
    case "heart":
      return { clipPath: `polygon(${heartPolygon()})` };
    default:
      return {};
  }
}
function tileMask(p: number, checker: boolean) {
  let rects = "";
  for (let i = 0; i < 96; i++) {
    const x = i % 12,
      y = Math.floor(i / 12),
      q = checker
        ? clamp(p * 2 - ((x + y) % 2))
        : clamp((p - hash(i) * 0.7) / 0.3);
    rects += `<rect x="${(x * 100) / 12}" y="${y * 12.5}" width="${(100 / 12) * q}" height="${12.5 * q}" fill="white"/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${rects}</svg>`)}")`;
}
export function transitionStyle(
  type: Transition,
  progress: number,
  direction: Scene["transitionDirection"],
): CSSProperties {
  const p = clamp(progress),
    s = 1 - p,
    horizontal = direction === "left" || direction === "right",
    sign = direction === "right" || direction === "down" ? -1 : 1;
  if (p >= 1 || type === "none") return {};
  switch (type) {
    case "fade":
      return { opacity: p };
    case "slide":
    case "push":
      return {
        transform: `translate${horizontal ? "X" : "Y"}(${s * 100 * sign}%)`,
      };
    case "wipe":
      return {
        clipPath:
          direction === "right"
            ? `inset(0 0 0 ${s * 100}%)`
            : direction === "up"
              ? `inset(0 0 ${s * 100}% 0)`
              : direction === "down"
                ? `inset(${s * 100}% 0 0 0)`
                : `inset(0 ${s * 100}% 0 0)`,
      };
    case "iris":
      return { clipPath: `circle(${p * 75}% at 50% 50%)` };
    case "iris-close":
      return {
        maskImage: `radial-gradient(circle,transparent ${s * 100}%,#000 ${s * 100 + 0.1}%)`,
      };
    case "clock": {
      const points = ["50% 50%", "50% 0%"];
      for (let a = 0; a <= p * Math.PI * 2; a += Math.PI / 40)
        points.push(`${50 + Math.sin(a) * 72}% ${50 - Math.cos(a) * 72}%`);
      points.push(
        `${50 + Math.sin(p * Math.PI * 2) * 72}% ${50 - Math.cos(p * Math.PI * 2) * 72}%`,
      );
      return { clipPath: `polygon(${points.join(",")})` };
    }
    case "flip":
      return {
        transform: `perspective(1400px) rotateY(${s * -90}deg)`,
        opacity: p,
      };
    case "flip-vertical":
      return {
        transform: `perspective(1400px) rotateX(${s * 90}deg)`,
        opacity: p,
      };
    case "zoom":
      return { transform: `scale(${1 + s})`, opacity: p };
    case "zoom-out":
      return { transform: `scale(${0.1 + p * 0.9})`, opacity: p };
    case "blur":
      return { filter: `blur(${s * 35}px)`, opacity: p };
    case "zoom-blur":
      return {
        transform: `scale(${1 + s * 0.5})`,
        filter: `blur(${s * 25}px)`,
        opacity: p,
      };
    case "spin":
      return {
        transform: `rotate(${s * -180}deg) scale(${0.1 + p * 0.9})`,
        opacity: p,
      };
    case "fade-black":
    case "fade-white":
      return { opacity: p < 0.5 ? 0 : 1 };
    case "film-burn":
      return {
        opacity: p,
        filter: `sepia(${s}) brightness(${1 + s * 4}) saturate(${1 + s * 2})`,
      };
    case "blinds":
      return {
        maskImage: `repeating-linear-gradient(${horizontal ? "90deg" : "0deg"},#000 0 ${p * 10}%,transparent ${p * 10}% 10%)`,
      };
    case "checker":
      return { maskImage: tileMask(p, true), maskSize: "100% 100%" };
    case "pixel":
      return { maskImage: tileMask(p, false), maskSize: "100% 100%" };
    case "diamond":
      return {
        clipPath: `polygon(50% ${50 - p * 100}%,${50 + p * 100}% 50%,50% ${50 + p * 100}%,${50 - p * 100}% 50%)`,
      };
    case "heart":
      return { clipPath: `polygon(${heartPolygon(p * 3)})` };
    case "split-horizontal":
      return { clipPath: `inset(${s * 50}% 0 ${s * 50}% 0)` };
    case "split-vertical":
      return { clipPath: `inset(0 ${s * 50}% 0 ${s * 50}%)` };
    case "glitch":
      return {
        opacity: p,
        transform: `translateX(${Math.sin(p * 90) * s * 6}%) skewX(${Math.sin(p * 60) * s * 10}deg)`,
        filter: `hue-rotate(${s * 180}deg)`,
      };
    case "ripple":
      return {
        opacity: p,
        transform: `scale(${1 + Math.sin(p * 16) * s * 0.12})`,
        filter: `blur(${s * 5}px)`,
      };
    case "slide-rotate":
      return {
        opacity: p,
        transform: `translateX(${s * 100 * sign}%) rotate(${s * -15 * sign}deg)`,
      };
    default:
      return {};
  }
}
