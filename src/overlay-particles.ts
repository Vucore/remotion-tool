import { hash, starPolygon } from "./animation";
import type { OverlaySpec } from "./model";
export const overlayStarPoints = starPolygon()
  .split(",")
  .map((p) => p.split("%").join(""))
  .join(" ");
const cache = new WeakMap<
  OverlaySpec,
  { key: string; full: Particle[]; light: Particle[] }
>();
type Particle = { i: number; seed: number; r: number; z: number; a: number };
export function overlayParticles(layer: OverlaySpec, light = false) {
  const key = `${layer.seed}:${layer.kind}:${layer.amount}`;
  let value = cache.get(layer);
  if (value?.key !== key) {
    const count =
      layer.kind === "smoke"
        ? 12
        : layer.kind === "grain"
          ? 180
          : Math.round(30 + layer.amount * 100);
    const full = Array.from({ length: count }, (_, i) => {
      const seed = layer.seed * 313 + i * 7;
      return { i, seed, r: hash(seed), z: hash(seed + 1), a: hash(seed + 2) };
    });
    value = { key, full, light: full.filter((p) => p.i % 2 === 0) };
    cache.set(layer, value);
  }
  return light ? value.light : value.full;
}
