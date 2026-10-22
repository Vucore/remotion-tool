import { factories } from "./native.generated";
import { EFFECT_MAP, effectFields, type EffectSpec } from "./catalog";
import { clamp, ease } from "../animation";
export function validateNativeEffect(effect: EffectSpec) {
  const factory = factories[effect.kind];
  if (!factory) throw new Error("Hiệu ứng không được hỗ trợ.");
  factory(effect.params);
  for (const endpoint of ["from", "to"] as const) {
    const params = { ...effect.params };
    for (const [key, animation] of Object.entries(effect.automation))
      params[key] = animation[endpoint];
    factory(params);
  }
}
export function effectDescriptors(
  effects: EffectSpec[],
  time: number,
  duration: number,
) {
  return effects
    .filter(
      (effect) =>
        effect.enabled &&
        time >= effect.start &&
        time < Math.min(effect.end ?? duration, duration),
    )
    .map((effect) => {
      const params = { ...effect.params },
        fields = effectFields(EFFECT_MAP[effect.kind], params, true);
      const end = Math.min(effect.end ?? duration, duration),
        p = clamp(
          (time - effect.start + effect.offset) /
            Math.max(0.001, effect.span ?? end - effect.start),
        );
      for (const [key, animation] of Object.entries(effect.automation)) {
        const q = clamp(ease(animation.easing, p));
        const value = animation.from + (animation.to - animation.from) * q;
        params[key] = fields[key]?.integer ? Math.round(value) : value;
      }
      return factories[effect.kind](params);
    });
}
