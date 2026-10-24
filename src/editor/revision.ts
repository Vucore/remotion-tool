// Patches preserve JSON/structured-clone values, property deletion and array order.
// UI inputs are immutable, so unchanged references short-circuit without walking them.
export type RevisionPatch =
  | { type: "value"; value: unknown }
  | { type: "object"; set: [string, RevisionPatch][]; remove: string[] }
  | { type: "array"; length: number; set: [number, RevisionPatch][] }
  | {
      type: "keyed";
      key: "id" | "order";
      order: (string | number)[];
      set: [string | number, RevisionPatch][];
    };

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function arrayKey(
  before: unknown[],
  after: unknown[],
): "id" | "order" | undefined {
  for (const key of ["id", "order"] as const) {
    if (
      [before, after].every((items) => {
        const keys = items.map((item) =>
          record(item) ? item[key] : undefined,
        );
        return (
          keys.every(
            (value) => typeof value === "string" || typeof value === "number",
          ) && new Set(keys).size === keys.length
        );
      })
    )
      return key;
  }
}
export function revisionDiff(
  before: unknown,
  after: unknown,
): RevisionPatch | null {
  if (Object.is(before, after)) return null;
  if (Array.isArray(before) && Array.isArray(after)) {
    const key = arrayKey(before, after);
    if (key) {
      const previous = new Map(before.map((item) => [item[key], item]));
      const order = after.map((item) => item[key]);
      const set: [string | number, RevisionPatch][] = [];
      for (const item of after) {
        const patch = revisionDiff(previous.get(item[key]), item);
        if (patch) set.push([item[key], patch]);
      }
      if (
        !set.length &&
        before.length === order.length &&
        before.every((item, i) => item[key] === order[i])
      )
        return null;
      return { type: "keyed", key, order, set };
    }
    const set: [number, RevisionPatch][] = [];
    after.forEach((value, index) => {
      const patch = revisionDiff(before[index], value);
      if (patch || !(index in before))
        set.push([index, patch ?? { type: "value", value }]);
    });
    return set.length || before.length !== after.length
      ? { type: "array", length: after.length, set }
      : null;
  }
  if (record(before) && record(after)) {
    const remove = Object.keys(before).filter(
      (key) => !Object.hasOwn(after, key),
    );
    const set: [string, RevisionPatch][] = [];
    for (const key of Object.keys(after)) {
      const patch = revisionDiff(before[key], after[key]);
      if (patch || !Object.hasOwn(before, key))
        set.push([key, patch ?? { type: "value", value: after[key] }]);
    }
    return set.length || remove.length ? { type: "object", remove, set } : null;
  }
  return { type: "value", value: after };
}
export function applyRevision<T>(before: T, patch: RevisionPatch | null): T {
  if (!patch) return before;
  if (patch.type === "value") return patch.value as T;
  if (patch.type === "object") {
    const result = { ...(before as Record<string, unknown>) };
    for (const key of patch.remove) delete result[key];
    for (const [key, change] of patch.set) {
      Object.defineProperty(result, key, {
        value: applyRevision(result[key], change),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result as T;
  }
  const previous = before as unknown[];
  if (patch.type === "array") {
    const result = previous.slice(0, patch.length);
    result.length = patch.length;
    for (const [index, change] of patch.set)
      result[index] = applyRevision(previous[index], change);
    return result as T;
  }
  const indexed = new Map(
    previous.map((item) => [
      (item as Record<string, unknown>)[patch.key],
      item,
    ]),
  );
  for (const [key, change] of patch.set)
    indexed.set(key, applyRevision(indexed.get(key), change));
  return patch.order.map((key) => indexed.get(key)) as T;
}
