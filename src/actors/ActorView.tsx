import { proxySource } from "../editor/performance";
import { usePreviewQuality } from "../preview-quality";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, type CSSProperties } from "react";
import type { Project, Scene } from "../model";
import {
  actorHash,
  type ActorDefinition,
  type ActorInstance,
  type RigLayer,
  type RigPart,
  type SpriteClip,
} from "./types";
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const smooth = (p: number) => 1 - Math.pow(1 - clamp(p), 3);

export function SceneActors({
  project,
  scene,
  placementMode = false,
}: {
  project: Project;
  scene: Scene;
  placementMode?: boolean;
}) {
  const actorMap = useMemo(
    () => new Map(project.actors?.map((actor) => [actor.id, actor]) ?? []),
    [project.actors],
  );
  const voiceMap = useMemo(
    () =>
      new Map(
        project.voiceover?.assets.map((voice) => [voice.id, voice]) ?? [],
      ),
    [project.voiceover?.assets],
  );
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const time = Math.min(
    Math.max(0, frame / fps),
    Math.max(0, scene.duration - 1 / fps),
  );
  const voice = voiceMap.get(scene.voice?.assetId ?? "");
  const envelope = voice?.envelope;
  const rawLevel =
    envelope && frame / fps < (voice?.duration ?? 0)
      ? (envelope.values[
          Math.min(
            envelope.values.length - 1,
            Math.floor(((frame / fps) * 1000) / envelope.stepMs),
          )
        ] ?? 0)
      : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {(scene.actors ?? []).map((instance) => {
        const actor = actorMap.get(instance.actorId);
        return actor ? (
          <ActorView
            key={instance.id}
            actor={actor}
            instance={
              placementMode
                ? { ...instance, from: 0, to: null, actions: [], intensity: 0 }
                : instance
            }
            time={placementMode ? 0 : time}
            level={!placementMode && instance.speaking ? rawLevel : 0}
            width={project.width}
            height={project.height}
          />
        ) : null;
      })}
    </AbsoluteFill>
  );
}
export function ActorView({
  actor,
  instance,
  time,
  level,
  width,
  height,
}: {
  actor: ActorDefinition;
  instance: ActorInstance;
  time: number;
  level: number;
  width: number;
  height: number;
}) {
  const light = usePreviewQuality() === "light";
  if (time < instance.from || time >= (instance.to ?? Infinity)) return null;
  const localTime = time - instance.from;
  const action = instance.actions.find((a) => time >= a.start && time < a.end);
  const p = action
    ? clamp((time - action.start) / (action.end - action.start))
    : 0;
  const pulse = Math.sin(p * Math.PI),
    strength = action?.intensity ?? instance.intensity;
  let x = 0,
    y = Math.sin(localTime * 2.1) * 1.5 * instance.intensity - level * 2,
    rotate = Math.sin(localTime * 1.7) * instance.intensity,
    scale = 1,
    opacity = instance.opacity;
  const h = (height * instance.height) / 100,
    w = (h * actor.width) / actor.height;
  if (action)
    switch (action.kind) {
      case "enter":
      case "exit": {
        const q = action.kind === "enter" ? smooth(p) : 1 - smooth(p);
        const style =
          action.kind === "enter" ? instance.entrance : instance.exitStyle;
        if (style === "slide")
          x = (instance.x > 50 ? 1 : -1) * (1 - q) * (width + w);
        if (style === "fade") opacity *= q;
        if (style === "pop") {
          scale = 0.25 + q * 0.75;
          opacity *= q;
        }
        break;
      }
      case "shake":
        x = Math.sin(p * Math.PI * 12) * pulse * 12 * strength;
        rotate += Math.sin(p * Math.PI * 10) * pulse * 6 * strength;
        break;
      case "jump":
        y -= Math.sin(p * Math.PI) * h * 0.18 * strength;
        scale += Math.sin(p * Math.PI * 2) * 0.06 * strength;
        break;
      case "spin":
        rotate += p * 360;
        break;
      case "float":
        y -= pulse * h * 0.1 * strength;
        break;
      case "move":
      case "walk":
      case "run":
        x += Math.sin(p * Math.PI * 2) * w * 0.18 * strength;
        y -= Math.abs(Math.sin(p * Math.PI * 8)) * 6 * pulse * strength;
        break;
      case "sway":
        rotate += Math.sin(p * Math.PI * 2) * 6 * strength;
        break;
      case "surprised":
        scale += pulse * 0.13 * strength;
        y -= pulse * 10;
        break;
      case "happy":
        y -= Math.abs(Math.sin(p * Math.PI * 3)) * 12 * pulse * strength;
        rotate += Math.sin(p * Math.PI * 4) * 4 * strength;
        break;
    }
  const wrapper: CSSProperties = {
    position: "absolute",
    left: `${instance.x}%`,
    top: `${instance.y}%`,
    width: w,
    height: h,
    zIndex: instance.z,
    opacity,
    filter:
      `${instance.shadow ? `drop-shadow(0 ${instance.shadow * 0.4}px ${instance.shadow}px #0008)` : ""} ${instance.glow ? `drop-shadow(0 0 ${instance.glow}px #fff)` : ""}`.trim() ||
      undefined,
    transformOrigin: "50% 100%",
    transform: `translate(-50%, -100%) translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`,
  };
  return (
    <div style={wrapper}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: instance.flip ? "scaleX(-1)" : undefined,
        }}
      >
        {actor.kind === "cutout" ? (
          <Img
            src={light ? proxySource(actor.image.src, 960) : actor.image.src}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : actor.kind === "rig" ? (
          <Rig
            actor={actor}
            time={localTime}
            level={level}
            kind={action?.kind}
            progress={p}
            intensity={strength}
          />
        ) : (
          <Sprite
            actor={actor}
            time={localTime}
            action={action?.kind}
            elapsed={action ? time - action.start : localTime}
            span={action ? action.end - action.start : undefined}
            talking={level > 0.08}
          />
        )}
      </div>
    </div>
  );
}
function Rig({
  actor,
  time,
  level,
  kind,
  progress,
  intensity,
}: {
  actor: Extract<ActorDefinition, { kind: "rig" }>;
  time: number;
  level: number;
  kind?: string;
  progress: number;
  intensity: number;
}) {
  const light = usePreviewQuality() === "light";
  const pulse = Math.sin(progress * Math.PI),
    parts = actor.parts;
  const blinking =
    (time + Number.parseInt(actorHash(actor.id).slice(-2), 16) / 100) % 3.7 >
    3.53;
  const head = parts.head!;
  const originX = head.x + (head.width * head.pivotX) / 100,
    originY = head.y + (head.height * head.pivotY) / 100;
  const headAngle =
    kind === "nod"
      ? Math.sin(progress * Math.PI * 4) * pulse * 12 * intensity
      : kind === "surprised"
        ? pulse * -9 * intensity
        : Math.sin(time * 1.9) * intensity;
  const face = new Set<RigPart>([
    "head",
    "eyesOpen",
    "eyesClosed",
    "mouthOpen",
    "mouthClosed",
  ]);
  const draw = (part: RigPart, layer: RigLayer, angle = 0) => (
    <Img
      key={part}
      src={light ? proxySource(layer.image.src, 384) : layer.image.src}
      style={{
        position: "absolute",
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.width}%`,
        height: `${layer.height}%`,
        objectFit: actor.layout === "canvas" ? "fill" : "contain",
        transformOrigin: `${layer.pivotX}% ${layer.pivotY}%`,
        transform: `rotate(${angle}deg)`,
        zIndex: layer.z,
      }}
    />
  );
  return (
    <AbsoluteFill>
      {(Object.entries(parts) as [RigPart, RigLayer][])
        .filter(([key]) => !face.has(key))
        .map(([part, layer]) => {
          let angle = 0;
          const arm = part === "armLeft" || part === "armRight",
            side = part === "armLeft" || part === "legLeft" ? 1 : -1;
          if (arm && kind === "wave")
            angle =
              side *
              (135 + Math.sin(progress * Math.PI * 8) * 18) *
              pulse *
              intensity;
          else if (arm && kind === "point")
            angle = side * 85 * pulse * intensity;
          else if (
            (arm || part.startsWith("leg")) &&
            (kind === "walk" || kind === "run")
          )
            angle =
              Math.sin(progress * Math.PI * (kind === "run" ? 12 : 8)) *
              side *
              (arm ? 22 : 30) *
              pulse *
              intensity;
          else if (arm) angle = Math.sin(time * 1.8) * side * intensity * 2;
          return draw(part, layer, angle);
        })}
      <AbsoluteFill
        style={{
          transformOrigin: `${originX}% ${originY}%`,
          transform: `rotate(${headAngle}deg)`,
          zIndex: 40,
        }}
      >
        {draw("head", head)}
        {parts.eyesOpen &&
          parts.eyesClosed &&
          (blinking
            ? draw("eyesClosed", parts.eyesClosed)
            : draw("eyesOpen", parts.eyesOpen))}
        {parts.mouthOpen &&
          parts.mouthClosed &&
          (level > 0.1
            ? draw("mouthOpen", parts.mouthOpen)
            : draw("mouthClosed", parts.mouthClosed))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
function Sprite({
  actor,
  time,
  action,
  elapsed,
  span,
  talking,
}: {
  actor: Extract<ActorDefinition, { kind: "sprite" }>;
  time: number;
  action?: string;
  elapsed: number;
  span?: number;
  talking: boolean;
}) {
  const active = action && actor.clips[action as keyof typeof actor.clips];
  const clip =
    active ||
    (talking ? actor.clips.talk : undefined) ||
    actor.clips.idle ||
    Object.values(actor.clips)[0]!;
  return (
    <SpriteFrame
      clip={clip}
      elapsed={active ? elapsed : time}
      span={active && !clip.loop ? span : undefined}
    />
  );
}
function SpriteFrame({
  clip,
  elapsed,
  span,
}: {
  clip: SpriteClip;
  elapsed: number;
  span?: number;
}) {
  const light = usePreviewQuality() === "light";
  const cursor = Math.max(
      0,
      Math.floor(span ? (elapsed / span) * clip.count : elapsed * clip.fps),
    ),
    index = clip.loop ? cursor % clip.count : Math.min(clip.count - 1, cursor);
  if (clip.images.length > 1)
    return (
      <Img
        src={
          light
            ? proxySource(clip.images[index].src, 960)
            : clip.images[index].src
        }
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  const column = index % clip.columns,
    row = Math.floor(index / clip.columns);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Img
        src={light ? proxySource(clip.images[0].src, 1440) : clip.images[0].src}
        style={{
          position: "absolute",
          maxWidth: "none",
          width: `${clip.columns * 100}%`,
          height: `${clip.rows * 100}%`,
          left: `${-column * 100}%`,
          top: `${-row * 100}%`,
        }}
      />
    </div>
  );
}
