import { Video } from "@remotion/media";
import { colorKey } from "@remotion/effects/color-key";
import { Sequence, useVideoConfig } from "remotion";
import { videoOverlayKeyParams, type VideoOverlay } from "./video-overlays";

export function VideoOverlays({ layers = [] }: { layers?: VideoOverlay[] }) {
  const { fps, width } = useVideoConfig();
  return layers.map((layer) => (
    <Sequence
      key={layer.id}
      from={Math.round(layer.start * fps)}
      durationInFrames={Math.max(1, Math.round(layer.duration * fps))}
      layout="none"
    >
      <div
        style={{
          position: "absolute",
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          width: `${layer.width}%`,
          aspectRatio: `${layer.sourceWidth} / ${layer.sourceHeight}`,
          transform: "translate(-50%, -50%)",
          opacity: layer.opacity,
          pointerEvents: "none",
        }}
      >
        <Video
          src={layer.src}
          disallowFallbackToOffthreadVideo={layer.chromaKey}
          trimBefore={Math.round(layer.trimStart * fps)}
          muted={layer.muted}
          durationInFrames={Math.max(1, Math.round(layer.duration * fps))}
          objectFit="contain"
          style={{ width: "100%", height: "100%" }}
          effects={
            layer.chromaKey ? [colorKey(videoOverlayKeyParams(layer))] : []
          }
          effectsOutputSize={{
            width: Math.max(
              2,
              Math.min(
                layer.sourceWidth,
                Math.round((width * layer.width) / 100),
              ),
            ),
            height: Math.max(
              2,
              Math.min(
                layer.sourceHeight,
                Math.round(
                  (((width * layer.width) / 100) * layer.sourceHeight) /
                    layer.sourceWidth,
                ),
              ),
            ),
          }}
        />
      </div>
    </Sequence>
  ));
}
