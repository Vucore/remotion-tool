import { useEffect, useRef, useState } from "react";
import type { Project, Scene } from "../model";
// The handles live outside the composition: they are never included in an export.
export function PreviewEditor({
  project,
  scene,
  textId,
  onSelectText,
  onSelectImage,
  onMove,
  enabled,
}: {
  project: Project;
  scene: Scene;
  textId: string | null;
  onSelectText: (id: string) => void;
  onSelectImage: () => void;
  onMove: (patch: Partial<Scene>) => void;
  enabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [imageMode, setImageMode] = useState(false);
  const gesture = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    id: string | null;
  } | null>(null);
  useEffect(() => {
    const element = host.current?.parentElement;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect,
        aspect = project.width / project.height;
      const w = Math.min(width, height * aspect);
      setBox({ width: w, height: w / aspect });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [project.width, project.height]);
  useEffect(() => {
    setImageMode(false);
  }, [scene.id]);
  if (!enabled) return null;
  return (
    <div
      ref={host}
      className="preview-handles"
      style={{ width: box.width, height: box.height }}
    >
      <button
        type="button"
        className={`image-handle ${imageMode ? "active" : ""}`}
        aria-label="Kéo để đổi vị trí ảnh; chọn để chỉnh ảnh"
        onClick={() => {
          setImageMode(true);
          onSelectImage();
        }}
        onPointerDown={(e) => {
          if (!imageMode) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            x: scene.x,
            y: scene.y,
            startX: e.clientX,
            startY: e.clientY,
            id: null,
          };
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.id !== null) return;
          gesture.current = null;
          onMove({
            x: Math.max(
              -100,
              Math.min(100, g.x + ((e.clientX - g.startX) / box.width) * 100),
            ),
            y: Math.max(
              -100,
              Math.min(100, g.y + ((e.clientY - g.startY) / box.height) * 100),
            ),
          });
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
      />
      {scene.texts
        .filter((t) => t.visible)
        .map((text) => (
          <button
            key={text.id}
            type="button"
            className={`text-handle ${textId === text.id ? "active" : ""}`}
            style={{
              left: `${text.x}%`,
              top: `${text.y}%`,
              width: `${text.width}%`,
              height: Math.max(
                30,
                ((text.size * box.width) / 1080) * text.lineHeight +
                  (text.padding * 2 * box.width) / 1080,
              ),
            }}
            aria-label={`Chọn và kéo chữ: ${text.text.slice(0, 60)}`}
            onClick={() => {
              setImageMode(false);
              onSelectText(text.id);
            }}
            onDoubleClick={() => onSelectText(text.id)}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setImageMode(false);
              e.currentTarget.setPointerCapture(e.pointerId);
              gesture.current = {
                x: text.x,
                y: text.y,
                startX: e.clientX,
                startY: e.clientY,
                id: text.id,
              };
            }}
            onPointerMove={(e) => {
              const g = gesture.current;
              if (!g || g.id !== text.id) return;
              e.currentTarget.style.left = `${Math.max(0, Math.min(100, g.x + ((e.clientX - g.startX) / box.width) * 100))}%`;
              e.currentTarget.style.top = `${Math.max(0, Math.min(100, g.y + ((e.clientY - g.startY) / box.height) * 100))}%`;
            }}
            onPointerUp={(e) => {
              const g = gesture.current;
              if (!g || g.id !== text.id) return;
              gesture.current = null;
              onMove({
                texts: scene.texts.map((t) =>
                  t.id === text.id
                    ? {
                        ...t,
                        x: Math.max(
                          0,
                          Math.min(
                            100,
                            g.x + ((e.clientX - g.startX) / box.width) * 100,
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            100,
                            g.y + ((e.clientY - g.startY) / box.height) * 100,
                          ),
                        ),
                      }
                    : t,
                ),
              });
            }}
            onPointerCancel={() => {
              gesture.current = null;
            }}
          >
            <span>Chữ</span>
          </button>
        ))}
    </div>
  );
}
