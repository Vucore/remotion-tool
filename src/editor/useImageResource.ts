import { useCallback, useEffect, useState } from "react";
import { imageResources } from "./image-resources";

export function useImageResource(
  src: string,
  size: number,
  priority: "preview" | "next" | "thumbnail",
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const key = `${src}:${size}:${attempt}`;
  const [result, setResult] = useState({ key: "", src: "", error: false });
  const cached = imageResources.peek(src, size);
  const current = result.key === key ? result : null;
  const resolved = cached ?? current?.src ?? "";
  useEffect(() => {
    if (!enabled) return;
    const request = imageResources.acquire(src, size, priority);
    let cancelled = false;
    void request.promise.then(
      (url) => {
        if (!cancelled) setResult({ key, src: url, error: false });
      },
      () => {
        if (!cancelled) setResult({ key, src: "", error: true });
      },
    );
    return () => {
      cancelled = true;
      request.release();
    };
  }, [src, size, priority, enabled, key]);

  const retry = useCallback(
    (useOriginal = false) => {
      imageResources.invalidate(src, size, useOriginal);
      setAttempt((value) => value + 1);
    },
    [src, size],
  );
  const onError = useCallback(() => {
    if (resolved && resolved !== src) retry(true);
    else {
      imageResources.invalidate(src, size);
      setResult({ key, src: "", error: true });
    }
  }, [src, size, resolved, key, retry]);
  return { src: resolved, error: current?.error ?? false, retry, onError };
}
