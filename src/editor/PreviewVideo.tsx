import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "../Video";
import { timeline, type Project } from "../model";
import { PreviewHealth } from "./preview-health";
import { lastAt } from "./performance";
import { imageResources } from "./image-resources";

export function PreviewVideo({
  project,
  previewQuality,
  playing = false,
}: {
  project: Project;
  previewQuality: "auto" | "light" | "full";
  playing?: boolean;
}) {
  const [light, setLight] = useState(false);
  const health = useRef(new PreviewHealth());
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const items = useMemo(() => timeline(project), [project]);
  const assetMap = useMemo(
    () => new Map(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  );
  const sceneIndex = lastAt(items, frame);
  const effective =
    previewQuality === "auto" ? (light ? "light" : "full") : previewQuality;
  useEffect(() => {
    health.current = new PreviewHealth();
  }, [playing, fps, previewQuality]);
  useEffect(() => {
    if (
      previewQuality !== "auto" ||
      !playing ||
      document.visibilityState !== "visible"
    )
      return;
    const mode = health.current.sample(frame, performance.now(), fps);
    if (mode) setLight(mode === "light");
  }, [frame, fps, playing, previewQuality]);
  useEffect(() => {
    const requests: { release: () => void }[] = [];
    // Debounce scrubbing and prewarm only two following scenes. These requests
    // share the foreground loader and are released when the playhead moves away.
    const timer = setTimeout(() => {
      for (let offset = 1; offset <= 2; offset++) {
        const asset = assetMap.get(items[sceneIndex + offset]?.scene.assetId ?? "");
        if (!asset) continue;
        const request = imageResources.acquire(asset.src, effective === "light" ? 960 : 1440, "next");
        requests.push(request);
        void request.promise.catch(() => {});
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      for (const request of requests) request.release();
    };
  }, [sceneIndex, assetMap, items, effective]);
  return useMemo(
    () => <Video project={project} previewQuality={effective} />,
    [project, effective],
  );
}
