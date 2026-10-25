export type RandomSelection<T extends string> = { presets: T[]; seed: number };

export function parseRandomSelection<T extends string>(
  input: unknown,
  fallback: RandomSelection<T>,
  catalog: Record<T, string>,
  label: string,
): RandomSelection<T> {
  const value = input === undefined ? fallback : input;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(`${label}: thiết lập ngẫu nhiên không hợp lệ.`);
  const { presets, seed } = value as RandomSelection<T>;
  const keys = Object.keys(catalog) as T[];
  if (
    Object.keys(value).some((key) => !["presets", "seed"].includes(key)) ||
    !Array.isArray(presets) ||
    !presets.length ||
    presets.length > keys.length ||
    new Set(presets).size !== presets.length ||
    presets.some((preset) => !keys.includes(preset)) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 99999
  )
    throw Error(
      `${label}: chọn ít nhất một kiểu hợp lệ, mã ngẫu nhiên từ 0–99999.`,
    );
  // Selection order is not meaningful. Keep the same result when users select
  // the same set of animations in a different order.
  return { presets: keys.filter((key) => presets.includes(key)), seed };
}
