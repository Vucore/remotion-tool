import {
  MOTIONS,
  TRANSITIONS,
  TEXT_ANIMATIONS,
  FONT_FAMILIES,
} from "../catalog";
import { makeText, type Project, type Scene, type TextLayer } from "../model";
import { Icon } from "../icons";
import { Field, Numeric, Slider, Select } from "../panels/Controls";
import { useState, type DragEvent } from "react";
const draggablePreset = (patch: Partial<Scene>) => ({
  draggable: true,
  onDragStart: (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(
      "application/x-khung-preset",
      JSON.stringify(patch),
    );
    event.dataTransfer.effectAllowed = "copy";
  },
  title: "Bấm để áp dụng, hoặc kéo thả vào một cảnh",
});
export type QuickKind =
  | "image"
  | "duration"
  | "motion"
  | "transition"
  | "effect"
  | "text";
const labels: Record<QuickKind, string> = {
  image: "Ảnh",
  duration: "Thời lượng",
  motion: "Chuyển động",
  transition: "Chuyển cảnh",
  effect: "Hiệu ứng",
  text: "Chữ",
};
const motions = [
  "none",
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "float",
] as const;
const transitions = ["none", "fade", "slide", "wipe", "zoom", "blur"] as const;
export function QuickPanel({
  scene,
  project,
  kind,
  textId,
  onTextId,
  onKind,
  onChange,
  onAll,
  onAdvanced,
  onPreviewText,
  onSaveConfig,
}: {
  scene: Scene;
  project: Project;
  kind: QuickKind | null;
  textId: string | null;
  onTextId: (id: string) => void;
  onKind: (kind: QuickKind | null) => void;
  onChange: (patch: Partial<Scene>) => void;
  onAll: (patch: Partial<Scene>) => void;
  onAdvanced: (panel: "image" | "text" | "effects") => void;
  onPreviewText: (text: TextLayer) => void;
  onSaveConfig: () => void;
}) {
  const [all, setAll] = useState(false);
  const text = scene.texts.find((t) => t.id === textId) ?? scene.texts[0];
  const apply = (patch: Partial<Scene>) =>
    all && kind !== "text" ? onAll(patch) : onChange(patch);
  const patchText = (patch: Partial<TextLayer>) => {
    if (text)
      onChange({
        texts: scene.texts.map((t) =>
          t.id === text.id ? { ...t, ...patch } : t,
        ),
      });
  };
  const chooseText = (next: TextLayer) => {
    onTextId(next.id);
    onPreviewText(next);
  };
  const addText = () => {
    const next = makeText();
    onChange({ texts: [...scene.texts, next] });
    chooseText(next);
  };
  return (
    <div className="quick-editor">
      <div className="quick-toolbar" aria-label="Chỉnh nhanh cảnh đang chọn">
        <span className="quick-scene-name">
          Cảnh {project.scenes.findIndex((s) => s.id === scene.id) + 1}
        </span>
        {(
          [
            "image",
            "duration",
            "motion",
            "transition",
            "text",
            "effect",
          ] as const
        ).map((key) => (
          <button
            type="button"
            className="button"
            key={key}
            aria-pressed={kind === key}
            disabled={
              key === "transition" && project.scenes.at(-1)?.id === scene.id
            }
            onClick={() => onKind(kind === key ? null : key)}
          >
            <Icon
              size={15}
              name={
                {
                  image: "image",
                  duration: "clock",
                  motion: "motion",
                  transition: "transition",
                  text: "text",
                  effect: "effect",
                }[key]
              }
            />
            {key === "duration"
              ? `${Number(scene.duration.toFixed(2))}s`
              : labels[key]}
          </button>
        ))}
        <button
          type="button"
          className="button"
          onClick={onSaveConfig}
          title="Dùng thiết lập cảnh cho cả bộ ảnh; chữ hiện tại được dùng chung"
        >
          <Icon name="save" size={15} />
          Lưu mẫu config
        </button>
        <button
          type="button"
          className="button quick-advanced"
          onClick={() =>
            onAdvanced(
              kind === "text"
                ? "text"
                : kind === "image" || kind === "duration"
                  ? "image"
                  : "effects",
            )
          }
        >
          <Icon name="settings" size={15} />
          Nâng cao
        </button>
      </div>
      {kind && (
        <section
          className="quick-content"
          aria-label={`Chỉnh nhanh ${labels[kind].toLowerCase()}`}
        >
          <div className="quick-content-heading">
            <strong>{labels[kind]}</strong>
            {kind !== "text" && (
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) => setAll(e.target.checked)}
                />
                Áp dụng cho mọi cảnh
              </label>
            )}
            <button
              type="button"
              className="button icon-button"
              aria-label="Đóng chỉnh nhanh"
              onClick={() => onKind(null)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          {kind === "image" && (
            <div className="quick-fields">
              <Select
                label="Khung ảnh"
                value={scene.fit}
                options={{ cover: "Lấp đầy", contain: "Giữ toàn ảnh" }}
                onChange={(fit) => apply({ fit: fit as Scene["fit"] })}
              />
              <Numeric
                label="Phóng to (%)"
                min={10}
                max={500}
                value={scene.scale * 100}
                step={1}
                onChange={(scale) => apply({ scale: scale / 100 })}
              />
              <button
                type="button"
                className="button"
                onClick={() => apply({ flip: !scene.flip })}
              >
                <Icon name="flip" />
                Lật ngang
              </button>
              <button
                type="button"
                className="button"
                onClick={() =>
                  apply({ x: 0, y: 0, scale: 1, rotate: 0, flip: false })
                }
              >
                Đặt lại vị trí
              </button>
            </div>
          )}
          {kind === "duration" && (
            <div className="quick-fields">
              <Numeric
                label="Hiển thị cảnh (giây)"
                value={scene.duration}
                min={0.5}
                max={300}
                step={0.1}
                onChange={(duration) =>
                  apply({ duration, motionDuration: null, motionOffset: 0 })
                }
              />
              <span className="quick-hint">
                Có thể kéo mép phải của cảnh. Chuyển cảnh dùng phần chồng lấn.
              </span>
            </div>
          )}
          {kind === "motion" && (
            <>
              <div className="quick-presets">
                {motions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="quick-preset"
                    aria-pressed={scene.motion === value}
                    {...draggablePreset({
                      motion: value,
                      motionOffset: 0,
                      motionDuration: null,
                    })}
                    onClick={() =>
                      apply({
                        motion: value,
                        motionOffset: 0,
                        motionDuration: null,
                      })
                    }
                  >
                    <span
                      className={`preset-motion preset-${value}`}
                      aria-hidden="true"
                    >
                      <Icon name="image" size={22} />
                    </span>
                    {MOTIONS[value]}
                  </button>
                ))}
              </div>
              <div className="quick-fields">
                <Slider
                  label="Mức chuyển động"
                  value={scene.motionAmount}
                  min={0}
                  max={50}
                  onChange={(motionAmount) => apply({ motionAmount })}
                />
                <details>
                  <summary>
                    Toàn bộ {Object.keys(MOTIONS).length} chuyển động
                  </summary>
                  <Select
                    label="Chuyển động ảnh"
                    value={scene.motion}
                    options={MOTIONS}
                    onChange={(motion) =>
                      apply({
                        motion: motion as Scene["motion"],
                        motionOffset: 0,
                        motionDuration: null,
                      })
                    }
                  />
                </details>
              </div>
            </>
          )}
          {kind === "transition" && (
            <>
              <div className="quick-presets">
                {transitions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="quick-preset"
                    aria-pressed={scene.transition === value}
                    {...draggablePreset({ transition: value })}
                    onClick={() => apply({ transition: value })}
                  >
                    <span
                      className={`preset-transition preset-${value}`}
                      aria-hidden="true"
                    >
                      <span />
                      <span />
                    </span>
                    {TRANSITIONS[value]}
                  </button>
                ))}
              </div>
              <div className="quick-fields">
                <Numeric
                  label="Chồng lấn (giây)"
                  value={scene.transitionDuration}
                  min={0.1}
                  max={2}
                  step={0.1}
                  onChange={(transitionDuration) =>
                    apply({ transitionDuration })
                  }
                />
                <Select
                  label="Hướng"
                  value={scene.transitionDirection}
                  options={{
                    left: "Trái",
                    right: "Phải",
                    up: "Lên",
                    down: "Xuống",
                  }}
                  onChange={(transitionDirection) =>
                    apply({
                      transitionDirection:
                        transitionDirection as Scene["transitionDirection"],
                    })
                  }
                />
                <details>
                  <summary>
                    Toàn bộ {Object.keys(TRANSITIONS).length} chuyển cảnh
                  </summary>
                  <Select
                    label="Kiểu chuyển cảnh"
                    value={scene.transition}
                    options={TRANSITIONS}
                    onChange={(transition) =>
                      apply({ transition: transition as Scene["transition"] })
                    }
                  />
                </details>
              </div>
              <p className="quick-hint">
                Nối cảnh đang chọn với cảnh ngay sau. Cảnh cuối không có đoạn
                nối.
              </p>
            </>
          )}
          {kind === "effect" && (
            <>
              <div className="quick-presets">
                {Object.entries({
                  none: "Nguyên bản",
                  warm: "Ấm",
                  cool: "Lạnh",
                  mono: "Đen trắng",
                  vintage: "Cổ điển",
                }).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className="quick-preset"
                    aria-pressed={scene.filter === value}
                    {...draggablePreset({ filter: value as Scene["filter"] })}
                    onClick={() => apply({ filter: value as Scene["filter"] })}
                  >
                    <span
                      className={`preset-color preset-color-${value}`}
                      aria-hidden="true"
                    />
                    {label}
                  </button>
                ))}
              </div>
              <div className="quick-fields">
                <Slider
                  label="Độ sáng"
                  value={scene.brightness}
                  min={0}
                  max={200}
                  onChange={(brightness) => apply({ brightness })}
                />
                <Slider
                  label="Màu sắc"
                  value={scene.saturation}
                  min={0}
                  max={200}
                  onChange={(saturation) => apply({ saturation })}
                />
                <button
                  type="button"
                  className="button"
                  onClick={() => onAdvanced("effects")}
                >
                  Thư viện đầy đủ
                  {scene.effects.length + scene.overlays.length > 0
                    ? ` · ${scene.effects.length + scene.overlays.length} lớp đang dùng`
                    : ""}
                  <Icon name="next" size={14} />
                </button>
              </div>
            </>
          )}
          {kind === "text" && (
            <>
              <div className="quick-text-layers">
                {scene.texts.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className="button"
                    aria-pressed={text?.id === t.id}
                    onClick={() => chooseText(t)}
                  >
                    {t.text.slice(0, 24) || "Chữ trống"}
                  </button>
                ))}
                <button
                  type="button"
                  className="button"
                  disabled={scene.texts.length >= 30}
                  onClick={addText}
                >
                  <Icon name="plus" size={15} />
                  Thêm chữ
                </button>
              </div>
              {text && (
                <>
                  <div className="quick-text-main">
                    <Field label="Nội dung">
                      <textarea
                        aria-label="Nội dung chữ"
                        value={text.text}
                        maxLength={2000}
                        onChange={(e) => patchText({ text: e.target.value })}
                      />
                    </Field>
                    <div className="quick-fields">
                      <Select
                        label="Font"
                        value={text.fontFamily}
                        options={Object.fromEntries([
                          ...FONT_FAMILIES.map((f) => [f, f]),
                          ...project.fonts.map((f) => [f.id, f.name]),
                        ])}
                        onChange={(fontFamily) => patchText({ fontFamily })}
                      />
                      <Numeric
                        label="Cỡ chữ"
                        value={text.size}
                        min={8}
                        max={400}
                        step={1}
                        onChange={(size) => patchText({ size })}
                      />
                      <Field label="Màu">
                        <input
                          type="color"
                          value={text.color}
                          onChange={(e) => patchText({ color: e.target.value })}
                        />
                      </Field>
                      <Select
                        label="Căn lề"
                        value={text.align}
                        options={{
                          left: "Trái",
                          center: "Giữa",
                          right: "Phải",
                        }}
                        onChange={(align) =>
                          patchText({ align: align as TextLayer["align"] })
                        }
                      />
                    </div>
                  </div>
                  <div className="quick-fields">
                    <Select
                      label="Xuất hiện"
                      value={text.animationIn}
                      options={Object.fromEntries(
                        Object.entries(TEXT_ANIMATIONS).filter(
                          ([k]) =>
                            [
                              "none",
                              "fade",
                              "slide-up",
                              "pop",
                              "typewriter",
                            ].includes(k) || k === text.animationIn,
                        ),
                      )}
                      onChange={(animationIn) =>
                        patchText({
                          animationIn: animationIn as TextLayer["animationIn"],
                        })
                      }
                    />
                    <Numeric
                      label="Bắt đầu (s)"
                      value={text.start}
                      min={0}
                      max={Math.max(0, scene.duration - 0.05)}
                      onChange={(start) =>
                        patchText({
                          start,
                          end:
                            text.end !== null
                              ? Math.max(start, text.end)
                              : null,
                          offset: 0,
                          span: null,
                        })
                      }
                    />
                    <Numeric
                      label="Kết thúc (s)"
                      value={text.end ?? scene.duration}
                      min={Math.min(text.start, scene.duration)}
                      max={scene.duration}
                      onChange={(end) =>
                        patchText({ end, offset: 0, span: null })
                      }
                    />
                    <button
                      type="button"
                      className="button"
                      onClick={() => onPreviewText(text)}
                    >
                      <Icon name="play" size={15} />
                      Xem chữ
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        onChange({
                          texts: scene.texts.filter((t) => t.id !== text.id),
                        })
                      }
                    >
                      <Icon name="trash" size={15} />
                      Xoá lớp
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
