import { useLayoutEffect, type ComponentProps } from "react";
import { AbsoluteFill, CanvasImage, Img, useBufferState } from "remotion";
import { useImageResource } from "./useImageResource";

type Props = Omit<ComponentProps<typeof CanvasImage>, "src" | "onError"> & {
  src: string;
  size: number;
  active: boolean;
};

// Used only by the editor. Export continues to load the selected master directly.
export function PreviewImage({ src, size, active, ...props }: Props) {
  const image = useImageResource(src, size, active ? "preview" : "next");
  const { delayPlayback } = useBufferState();
  useLayoutEffect(() => {
    if (!active || image.src || image.error) return;
    return delayPlayback().unblock;
  }, [active, image.src, image.error, delayPlayback]);
  if (image.src) {
    return props.effects?.length ? (
      <CanvasImage
        {...props}
        src={image.src}
        pauseWhenLoading
        maxRetries={0}
        onError={image.onError}
      />
    ) : (
      <Img
        src={image.src}
        style={props.style}
        pauseWhenLoading
        maxRetries={0}
        onImageError={image.onError}
      />
    );
  }
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        background: "#25332e",
        fontSize: 30,
        gap: 16,
      }}
    >
      {image.error ? (
        <>
          <span>Không tải được ảnh</span>
          <button
            type="button"
            style={{ font: "inherit", padding: "12px 24px", cursor: "pointer" }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              image.retry();
            }}
          >
            Tải lại ảnh
          </button>
        </>
      ) : (
        <span role="status">Đang tải ảnh…</span>
      )}
    </AbsoluteFill>
  );
}
