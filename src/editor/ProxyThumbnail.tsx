import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { useImageResource } from "./useImageResource";

export function ProxyThumbnail({
  src,
  name,
  number,
  active,
  onSelect,
}: {
  src: string;
  name: string;
  number: number;
  active: boolean;
  onSelect: () => void;
}) {
  const container = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const image = useImageResource(src, 384, "thumbnail", visible);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <button
      ref={container}
      className={active ? "active" : ""}
      title={image.error ? "Tải lại ảnh " + name : name}
      aria-label={(image.error ? "Tải lại ảnh " : "Xem ảnh ") + name}
      onClick={() => (image.error ? image.retry() : onSelect())}
      aria-busy={visible && !image.src && !image.error}
    >
      <div className="proxy-thumbnail">
        {image.src ? (
          <img
            src={image.src}
            alt=""
            decoding="async"
            onError={image.onError}
          />
        ) : image.error ? (
          <span className="thumbnail-retry">
            <Icon name="image" /> Tải lại
          </span>
        ) : (
          <span className="thumbnail-placeholder">
            <Icon name="image" />
          </span>
        )}
      </div>
      <span>{name}</span>
      <small>{number}</small>
    </button>
  );
}
