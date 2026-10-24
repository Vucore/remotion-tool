import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Entry<T> = { key: string; value: T; estimate: number };
export function VirtualList<T>({
  entries,
  renderItem,
  label,
}: {
  entries: Entry<T>[];
  renderItem: (value: T) => ReactNode;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const heights = useRef(new Map<string, number>());
  const [revision, setRevision] = useState(0),
    [viewport, setViewport] = useState({ start: 0, height: 650 });
  const [focused, setFocused] = useState<string | null>(null);
  const layout = useMemo(() => {
    let offset = 0;
    const items = entries.map((entry) => {
      const top = offset;
      offset += heights.current.get(entry.key) ?? entry.estimate;
      return { ...entry, top, end: offset };
    });
    return { items, height: offset };
    // ResizeObserver changes invalidate offsets stored in the measurement map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, revision]);
  useLayoutEffect(() => {
    const list = root.current,
      scroller = list?.closest(".editor-dialog-body");
    if (!list || !scroller) return;
    let raf = 0;
    const update = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const start =
          scroller.getBoundingClientRect().top -
          list.getBoundingClientRect().top;
        setViewport((old) =>
          Math.abs(old.start - start) < 1 &&
          old.height === scroller.clientHeight
            ? old
            : { start, height: scroller.clientHeight },
        );
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    observer.observe(list);
    scroller.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", update);
      cancelAnimationFrame(raf);
    };
  }, []);
  useLayoutEffect(() => {
    const list = root.current;
    if (!list) return;
    let raf = 0;
    const observer = new ResizeObserver((events) => {
      let changed = false;
      for (const event of events) {
        const key = (event.target as HTMLElement).dataset.virtualKey!;
        const height = Math.max(
          1,
          event.borderBoxSize[0]?.blockSize ?? event.contentRect.height,
        );
        if (Math.abs((heights.current.get(key) ?? 0) - height) > 0.5) {
          heights.current.set(key, height);
          changed = true;
        }
      }
      if (changed && !raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setRevision((n) => n + 1);
        });
    });
    for (const node of list.querySelectorAll("[data-virtual-key]"))
      observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [layout, viewport, focused]);
  const start = viewport.start - 450,
    end = viewport.start + viewport.height + 450;
  return (
    <div
      ref={root}
      className="narration-virtual-list"
      role="group"
      aria-label={label}
      style={{ position: "relative", height: layout.height }}
      onFocusCapture={(e) =>
        setFocused(
          (e.target as HTMLElement).closest<HTMLElement>("[data-virtual-key]")
            ?.dataset.virtualKey ?? null,
        )
      }
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setFocused(null);
      }}
    >
      {layout.items
        .filter(
          (item) =>
            (item.end >= start && item.top <= end) || item.key === focused,
        )
        .map((item) => (
          <div
            key={item.key}
            data-virtual-key={item.key}
            style={{
              position: "absolute",
              top: item.top,
              left: 0,
              right: 0,
              display: "flow-root",
            }}
          >
            {renderItem(item.value)}
          </div>
        ))}
    </div>
  );
}
