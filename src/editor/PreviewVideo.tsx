import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "../Video";
import { timeline, type Project } from "../model";
import { PreviewHealth } from "./preview-health";
import { lastAt, proxySource } from "./performance";

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
    const images: HTMLImageElement[] = [];
    // Debounce scrubbing, prewarm only the next scene, and never preload an entire project.
    const timer = setTimeout(() => {
      const asset = assetMap.get(items[sceneIndex + 1]?.scene.assetId ?? "");
      if (!asset || !asset.src.startsWith("/media/")) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.src = proxySource(asset.src, effective === "light" ? 960 : 1440);
      images.push(image);
      void image.decode().catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      for (const image of images) image.src = "";
    };
  }, [sceneIndex, assetMap, items, effective]);
  return useMemo(
    () => <Video project={project} previewQuality={effective} />,
    [project, effective],
  );
}
