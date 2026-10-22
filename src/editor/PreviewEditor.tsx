import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Project, Scene } from "../model";
import type { ActorInstance } from "../actors/types";
type ObjectPosition = Pick<ActorInstance, "id" | "x" | "y" | "height">;
// The handles live outside the composition: they are never included in an export.
export function PreviewEditor({
  project,
  scene,
  textId,
  onSelectText,
  onSelectImage,
  onMove,
  enabled,
  objectId,
  objectsEnabled,
  objectDraft,
  onSelectObject,
  onObjectDrag,
  onObjectCommit,
  onObjectCancel,
  onObjectRemove,
}: {
  project: Project;
  scene: Scene;
  textId: string | null;
  onSelectText: (id: string) => void;
  onSelectImage: () => void;
  onMove: (patch: Partial<Scene>) => void;
  enabled: boolean;
  objectId: string | null;
  objectsEnabled: boolean;
  objectDraft: ObjectPosition | null;
  onSelectObject: (id: string) => void;
  onObjectDrag: (position: ObjectPosition) => void;
  onObjectCommit: (position: ObjectPosition) => void;
  onObjectCancel: () => void;
  onObjectRemove: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [imageMode, setImageMode] = useState(false);
  const objectGesture = useRef<{
    value: ObjectPosition;
    startX: number;
    startY: number;
    resize: boolean;
    width: number;
    height: number;
  } | null>(null);
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));
  const objectPosition = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const g = objectGesture.current;
    if (!g || !box.width || !box.height) return null;
    const dx = event.clientX - g.startX,
      dy = event.clientY - g.startY;
    if (g.resize) {
      const factor =
        1 +
        ((dx * g.width) / 2 - dy * g.height) /
          Math.max(1, (g.width * g.width) / 4 + g.height * g.height);
      return { ...g.value, height: clamp(g.value.height * factor, 0.1, 90) };
    }
    return {
      ...g.value,
      x: clamp(g.value.x + (dx / box.width) * 100, 0, 100),
      y: clamp(g.value.y + (dy / box.height) * 100, 0, 100),
    };
  };
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
      {!objectsEnabled && (
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
                Math.min(
                  100,
                  g.y + ((e.clientY - g.startY) / box.height) * 100,
                ),
              ),
            });
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
        />
      )}
      {!objectsEnabled &&
        scene.texts
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
      {objectsEnabled &&
        (scene.actors ?? []).map((object) => {
          const actor = project.actors?.find((a) => a.id === object.actorId);
          if (!actor) return null;
          const value = objectDraft?.id === object.id ? objectDraft : object;
          const h = (box.height * value.height) / 100,
            w = (h * actor.width) / actor.height;
          const begin = (
            event: ReactPointerEvent<HTMLButtonElement>,
            resize: boolean,
          ) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelectObject(object.id);
            objectGesture.current = {
              value: {
                id: object.id,
                x: object.x,
                y: object.y,
                height: object.height,
              },
              startX: event.clientX,
              startY: event.clientY,
              resize,
              width: w,
              height: h,
            };
          };
          const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
            const next = objectPosition(event);
            objectGesture.current = null;
            if (next) onObjectCommit(next);
            else onObjectCancel();
          };
          const events = {
            onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
              const next = objectPosition(event);
              if (next) onObjectDrag(next);
            },
            onPointerUp: finish,
            onPointerCancel: () => {
              objectGesture.current = null;
              onObjectCancel();
            },
            onLostPointerCapture: () => {
              if (objectGesture.current) {
                objectGesture.current = null;
                onObjectCancel();
              }
            },
          };
          return (
            <div
              key={object.id}
              className={`object-handle ${objectId === object.id ? "active" : ""}`}
              style={{
                left: `${value.x}%`,
                top: `${value.y}%`,
                width: w,
                height: h,
                zIndex: 100 + object.z,
              }}
            >
              <button
                type="button"
                className="object-drag-handle"
                aria-label={`Kéo ${actor.name}. Phím mũi tên để di chuyển; Delete để xoá lớp.`}
                onClick={() => onSelectObject(object.id)}
                onPointerDown={(e) => begin(e, false)}
                {...events}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  const step = e.shiftKey ? 5 : 1;
                  if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    onObjectRemove(object.id);
                  } else if (
                    [
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    onSelectObject(object.id);
                    onObjectCommit({
                      id: object.id,
                      height: object.height,
                      x: clamp(
                        object.x +
                          (e.key === "ArrowLeft"
                            ? -step
                            : e.key === "ArrowRight"
                              ? step
                              : 0),
                        0,
                        100,
                      ),
                      y: clamp(
                        object.y +
                          (e.key === "ArrowUp"
                            ? -step
                            : e.key === "ArrowDown"
                              ? step
                              : 0),
                        0,
                        100,
                      ),
                    });
                  }
                }}
              >
                <span>{actor.name}</span>
              </button>
              {objectId === object.id && (
                <button
                  type="button"
                  className="object-resize-handle"
                  aria-label={`Đổi kích thước ${actor.name}`}
                  title="Kéo để đổi kích thước"
                  onPointerDown={(e) => begin(e, true)}
                  {...events}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      onObjectCommit({
                        id: object.id,
                        x: object.x,
                        y: object.y,
                        height: clamp(
                          object.height + (e.key === "ArrowUp" ? 1 : -1),
                          0.1,
                          90,
                        ),
                      });
                    }
                  }}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}
