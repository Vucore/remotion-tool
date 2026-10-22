import { useState } from "react";
import { Player } from "@remotion/player";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ActorView } from "../actors/ActorView";
import {
  ACTIONS,
  actorCapabilities,
  type ActorDefinition,
} from "../actors/types";
import {
  newObject,
  setObjectMotion,
  OBJECT_MOTIONS,
  type ObjectMotion,
} from "../actors/timing";
import { Field } from "../panels/Controls";
import { Icon } from "../icons";

type DemoMotion = ObjectMotion | "idle" | "talk";
function Demo({
  actor,
  motion,
}: {
  actor: ActorDefinition;
  motion: DemoMotion;
}) {
  const frame = useCurrentFrame(),
    { fps, width, height, durationInFrames } = useVideoConfig();
  const duration = durationInFrames / fps,
    time = frame / fps;
  let instance = newObject(actor, "demo", width, height);
  instance.y = 92;
  instance.height = Math.min(72, (80 * actor.height) / actor.width);
  instance.intensity = motion === "idle" ? 0.4 : 0;
  if (motion !== "idle" && motion !== "talk")
    instance = setObjectMotion(instance, motion, duration);
  if (
    motion !== "idle" &&
    motion !== "talk" &&
    !motion.startsWith("enter-") &&
    !motion.startsWith("exit-")
  )
    instance.actions = instance.actions.map((a) => ({
      ...a,
      start: 0.35,
      end: duration - 0.35,
    }));
  const level =
    motion === "talk"
      ? Math.max(0, Math.sin(time * 14) * 0.5 + Math.sin(time * 8) * 0.25)
      : 0;
  return (
    <AbsoluteFill style={{ background: "#eaf0e9" }}>
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          bottom: "8%",
          height: 1,
          background: "#bdc9bf",
        }}
      />
      <ActorView
        actor={actor}
        instance={instance}
        time={time}
        level={level}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  );
}
export function AssetPreview({
  actor,
  onClose,
  onApply,
}: {
  actor: ActorDefinition;
  onClose?: () => void;
  onApply?: (motion: ObjectMotion) => void;
}) {
  const [motion, setMotion] = useState<DemoMotion>("idle");
  const canTalk =
    actor.kind === "rig"
      ? Boolean(actor.parts.mouthOpen)
      : actor.kind === "sprite" && Boolean(actor.clips.talk);
  const options = {
    idle: "Trạng thái chờ",
    ...OBJECT_MOTIONS,
    ...Object.fromEntries(
      actorCapabilities(actor)
        .filter((k) => !["enter", "exit"].includes(k))
        .map((k) => [k, ACTIONS[k]]),
    ),
    ...(canTalk ? { talk: "Nói · nhịp minh hoạ" } : {}),
  };
  const clip =
    actor.kind === "sprite"
      ? actor.clips[motion as keyof typeof actor.clips]
      : undefined;
  const seconds = Math.max(3, clip ? clip.count / clip.fps + 0.7 : 3);
  return (
    <section
      className="asset-animation-preview"
      aria-label={`Xem động tác ${actor.name}`}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="actor-section-title">
        <strong>{actor.name} · xem động tác</strong>
        {onClose && (
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng xem động tác"
            onClick={onClose}
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>
      <Field label="Động tác muốn xem">
        <select
          value={motion}
          onChange={(e) => setMotion(e.target.value as DemoMotion)}
        >
          {Object.entries(options).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Player
        key={`${actor.id}:${motion}`}
        component={Demo}
        inputProps={{ actor, motion }}
        durationInFrames={Math.ceil(seconds * 30)}
        compositionWidth={480}
        compositionHeight={480}
        fps={30}
        controls
        loop
        autoPlay
        showVolumeControls={false}
        showPlaybackRateControl={[0.5, 1, 1.5, 2]}
        spaceKeyToPlayOrPause={false}
        style={{
          width: "100%",
          aspectRatio: "1",
          maxWidth: 300,
          marginInline: "auto",
        }}
        errorFallback={({ error }) => (
          <p role="alert">Không xem được tài nguyên: {error.message}</p>
        )}
      />
      {clip && (
        <p className="field-hint">
          Clip gốc: {clip.count} frame · {clip.fps} fps ·{" "}
          {(clip.count / clip.fps).toFixed(2)}s.
        </p>
      )}
      <p className="field-hint">
        Bản xem thử độc lập.{" "}
        {motion === "talk"
          ? "Miệng dùng nhịp minh hoạ; trong video sẽ dùng năng lượng WAV."
          : "Chuyển động chỉ áp dụng vào cảnh khi bạn chọn dùng."}
      </p>
      {onApply && motion !== "idle" && motion !== "talk" && (
        <button
          type="button"
          className="button primary"
          onClick={() => onApply(motion)}
        >
          Dùng động tác này trong cảnh
        </button>
      )}
    </section>
  );
}
