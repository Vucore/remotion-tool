import {
  AbsoluteFill,
  CanvasImage,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Project, Scene, timeline } from "./model";
import {
  clamp,
  ease,
  imagePose,
  maskStyle,
  transitionStyle,
  outgoingTransitionStyle,
} from "./animation";
import { effectDescriptors } from "./effects/runtime";
import { AnimatedText } from "./TextRender";
import { Overlays } from "./Overlays";
import { FontLoader } from "./FontLoader";
import { useMemo } from "react";
import { Audio } from "@remotion/media";
import { SceneActors } from "./actors/ActorView";
const filterStyles = {
  none: "",
  warm: "sepia(.22) saturate(1.12)",
  cool: "sepia(.12) hue-rotate(160deg)",
  mono: "grayscale(1)",
  vintage: "sepia(.5) contrast(.9)",
};
const SceneView = ({
  scene,
  project,
  item,
  nextOverlap,
  placementMode,
}: {
  scene: Scene;
  project: Project;
  item: ReturnType<typeof timeline>[number];
  nextOverlap: number;
  placementMode?: boolean;
}) => {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const progress = item.overlap
    ? clamp(ease(item.easing, frame / item.overlap))
    : 1;
  const outgoing = nextOverlap
    ? clamp(
        ease(
          scene.transitionEasing,
          (frame - (item.visualDuration - nextOverlap)) / nextOverlap,
        ),
      )
    : 0;
  const pose = imagePose(scene, frame, fps, item.visualDuration);
  const effects = effectDescriptors(
    scene.effects,
    frame / fps,
    item.duration / fps,
  );
  const asset = project.assets.find((a) => a.id === scene.assetId);
  const imageStyle = {
    width: "100%",
    height: "100%",
    objectFit: scene.fit,
    objectPosition:
      scene.fit === "cover" ? `${scene.focusX}% ${scene.focusY}%` : "50% 50%",
    opacity: pose.opacity,
    transformOrigin: `${scene.focusX}% ${scene.focusY}%`,
    transform: `perspective(1400px) translate(${pose.x}%,${pose.y}%) rotate(${pose.rotate}deg) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) scale(${pose.scale}) scaleX(${scene.flip ? -1 : 1})`,
    filter: `brightness(${scene.brightness}%) contrast(${scene.contrast}%) saturate(${scene.saturation}%) ${filterStyles[scene.filter]}`,
  };
  const flashIn =
    item.incoming === "fade-black" || item.incoming === "fade-white";
  const flashOut =
    scene.transition === "fade-black" || scene.transition === "fade-white";
  return (
    <AbsoluteFill
      style={transitionStyle(item.incoming, progress, item.direction)}
    >
      <AbsoluteFill
        style={{
          backgroundColor: project.background,
          overflow: "hidden",
          ...outgoingTransitionStyle(
            scene.transition,
            outgoing,
            scene.transitionDirection,
          ),
        }}
      >
        <AbsoluteFill style={{ overflow: "hidden", ...maskStyle(scene.mask) }}>
          {asset &&
            (effects.length ? (
              <CanvasImage
                src={asset.src}
                width={project.width}
                height={project.height}
                fit={scene.fit}
                effects={effects}
                effectsOutputSize={{
                  width: project.width,
                  height: project.height,
                }}
                style={imageStyle}
              />
            ) : (
              <Img src={asset.src} style={imageStyle} />
            ))}
        </AbsoluteFill>
        <SceneActors
          project={project}
          scene={scene}
          placementMode={placementMode}
        />
        <Overlays layers={scene.overlays} sceneFrames={item.duration} />
        {scene.texts
          .filter((text) => !text.captions)
          .map((text) => (
            <AnimatedText
              key={text.id}
              text={text}
              sceneFrames={item.duration}
              width={project.width}
            />
          ))}
        {flashIn && progress < 1 && (
          <AbsoluteFill
            style={{
              background: item.incoming === "fade-black" ? "#000" : "#fff",
              opacity: 1 - clamp((progress - 0.5) * 2),
            }}
          />
        )}
        {flashOut && outgoing > 0 && (
          <AbsoluteFill
            style={{
              background: scene.transition === "fade-black" ? "#000" : "#fff",
              opacity: clamp(outgoing * 2),
            }}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const Video = ({
  project,
  placementMode = false,
}: {
  project: Project;
  placementMode?: boolean;
}) => {
  const usedFonts = useMemo(
    () =>
      project.fonts.filter((font) =>
        project.scenes.some((scene) =>
          scene.texts.some((text) => text.fontFamily === font.id),
        ),
      ),
    [project.fonts, project.scenes],
  );
  const items = timeline(project),
    { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{ background: project.background, overflow: "hidden" }}
    >
      <FontLoader fonts={usedFonts} />
      {items.map((item, index) => (
        <Sequence
          key={item.scene.id}
          from={item.from}
          durationInFrames={item.visualDuration}
          premountFor={fps}
        >
          <SceneView
            scene={item.scene}
            project={project}
            item={item}
            nextOverlap={items[index + 1]?.overlap ?? 0}
            placementMode={placementMode}
          />
        </Sequence>
      ))}
      {items.map((item) => {
        const voice = project.voiceover?.assets.find(
          (v) => v.id === item.scene.voice?.assetId,
        );
        return (
          <Sequence
            key={`voice-${item.scene.id}`}
            from={item.from}
            durationInFrames={item.duration}
            premountFor={fps}
          >
            {voice && (
              <Audio
                src={voice.src}
                durationInFrames={Math.ceil(voice.duration * fps)}
                premountFor={fps}
              />
            )}
            {item.scene.texts
              .filter((text) => text.captions)
              .map((text) => (
                <AnimatedText
                  key={text.id}
                  text={text}
                  sceneFrames={item.duration}
                  width={project.width}
                />
              ))}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
