import { useState } from "react";
import { Icon } from "../icons";
import {
  MOTIONS,
  TRANSITIONS,
  OVERLAYS,
  FONT_FAMILIES,
  EASINGS,
  TEXT_ANIMATIONS,
  TEXT_PRESETS,
} from "../catalog";
import { PresetDemo } from "./PresetDemo";
import { textTemplate } from "../text-template";
import {
  CaptionAdvancedSettings,
  MotionAdvanced,
  Choice,
} from "./AdvancedSettings";
import {
  effectiveOverlays,
  newStoryOverlay,
  type StoryOptions,
  type StoryCaption,
  type StoryOverlay,
} from "../auto/story";

export type SettingsTab = "motion" | "transition" | "overlay" | "caption";
const TABS = {
  motion: ["motion", "Chuyển động"],
  transition: ["transition", "Chuyển cảnh"],
  overlay: ["effect", "Lớp phủ"],
  caption: ["text", "Phụ đề"],
} as const;
const basicMotions = [
  "none",
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "float",
  "handheld",
];
const basicTransitions = [
  "none",
  "fade",
  "slide",
  "wipe",
  "push",
  "zoom",
  "blur",
  "fade-black",
];
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="quick-slider">
      <span>
        {label}
        <span className="slider-value">
          <input
            type="number"
            aria-label={label + " (giá trị)"}
            min={min}
            max={max}
            step={step}
            value={Number(value.toFixed(3))}
            onChange={(e) => {
              if (
                e.target.value !== "" &&
                Number.isFinite(e.target.valueAsNumber)
              )
                onChange(Math.max(min, Math.min(max, e.target.valueAsNumber)));
            }}
          />
          <small>{suffix}</small>
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
function OverlayMark({ kind }: { kind: keyof typeof OVERLAYS }) {
  if (
    [
      "vignette",
      "letterbox",
      "frame",
      "scanlines",
      "light-leak",
      "rays",
      "flash",
      "film-scratches",
      "speed-lines",
    ].includes(kind)
  )
    return <span className={"overlay-mark overlay-" + kind} />;
  return (
    <svg className="overlay-mark" viewBox="0 0 120 62" aria-hidden="true">
      {Array.from({ length: kind === "smoke" ? 6 : 18 }, (_, i) => {
        const x = (i * 41 + 9) % 120,
          y = (i * 23 + 7) % 62,
          r =
            kind === "bokeh"
              ? 8
              : kind === "bubbles"
                ? 6
                : kind === "smoke"
                  ? 22
                  : kind === "grain"
                    ? 1
                    : 2;
        if (kind === "rain")
          return (
            <path
              key={i}
              d={"M" + x + " " + y + "l-3 9"}
              stroke="#d7ecff"
              strokeWidth="1.4"
            />
          );
        if (kind === "stars")
          return (
            <path
              key={i}
              d={"M" + x + " " + (y - 3) + "l1 2 3 1-3 1-1 3-1-3-3-1 3-1Z"}
              fill="#ffe18a"
            />
          );
        if (kind === "confetti" || kind === "petals")
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width="5"
              height="2"
              rx={kind === "petals" ? 2 : 0}
              fill={i % 2 ? "#ffca8c" : "#f5e7ca"}
              transform={"rotate(" + i * 27 + " " + x + " " + y + ")"}
            />
          );
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill={kind === "bubbles" ? "none" : "#fff3bf"}
            stroke={kind === "bubbles" ? "#dbf3ff" : "none"}
            opacity={kind === "smoke" ? 0.16 : kind === "bokeh" ? 0.35 : 0.8}
          />
        );
      })}
    </svg>
  );
}
function Tile({
  label,
  id,
  type,
  selected,
  image,
  second,
  disabled,
  onClick,
}: {
  label: string;
  id: string;
  type: "motion" | "transition" | "overlay";
  selected: boolean;
  image?: string;
  second?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={"preset-tile" + (selected ? " selected" : "")}
      aria-pressed={selected}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={"preset-art " + type + "-" + id}>
        {image ? (
          <img src={image} alt="" />
        ) : (
          <span className="preset-placeholder" />
        )}
        {type === "overlay" ? (
          <OverlayMark kind={id as keyof typeof OVERLAYS} />
        ) : type === "transition" ? (
          <>
            <span className="transition-half">
              {second ? <img src={second} alt="" /> : <span />}
            </span>
            <Icon name="transition" />
          </>
        ) : (
          <Icon
            name={id === "auto" ? "effect" : id === "none" ? "image" : "motion"}
          />
        )}
      </span>
      <span className="preset-label">
        {label}
        {selected && <Icon name="check" />}
      </span>
    </button>
  );
}
export function QuickSettings({
  options,
  tab,
  onTab,
  onChange,
  busy,
  images,
  scope,
  onScope,
  sceneNumber,
  sceneLabel,
  hasOverride,
  overrideCount,
  onClearOverride,
  onClearAllOverrides,
}: {
  options: StoryOptions;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onChange: (patch: Partial<StoryOptions>) => void;
  busy: boolean;
  images: string[];
  scope: "all" | "scene";
  onScope: (scope: "all" | "scene") => void;
  sceneNumber: number;
  sceneLabel?: string;
  hasOverride: boolean;
  overrideCount: number;
  onClearOverride: () => void;
  onClearAllOverrides: () => void;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const layers = effectiveOverlays(options),
    c = options.caption;
  const caption = (patch: Partial<StoryCaption>) =>
    onChange({ caption: { ...c, ...patch } });
  const presetCaption = (id: StoryCaption["preset"]): StoryCaption => {
    const template = textTemplate(id);
    return {
      ...c,
      preset: id,
      advanced: {},
      transparent: false,
      color: template.color ?? "#ffffff",
      background:
        template.background && template.background !== "transparent"
          ? template.background
          : "#17382e",
      font: template.fontFamily ?? "Arial",
    };
  };
  const toggle = (kind: keyof typeof OVERLAYS) => {
    const next = layers.some((l) => l.kind === kind)
      ? layers.filter((l) => l.kind !== kind)
      : layers.length < 8
        ? [...layers, newStoryOverlay(kind)]
        : layers;
    onChange({ overlays: next, overlay: "none" });
    setActiveLayer(kind);
  };
  const patchLayer = (kind: string, patch: Partial<StoryOverlay>) =>
    onChange({
      overlays: layers.map((l) => (l.kind === kind ? { ...l, ...patch } : l)),
      overlay: "none",
    });
  const nature = [
    "dust",
    "snow",
    "rain",
    "stars",
    "fireflies",
    "confetti",
    "bubbles",
    "petals",
    "smoke",
  ];
  const lighting = ["bokeh", "light-leak", "rays", "flash", "vignette"];
  const allOverlays = Object.entries(OVERLAYS).filter(
    ([k, label]) =>
      (group === "all" ||
        (group === "nature"
          ? nature.includes(k)
          : group === "light"
            ? lighting.includes(k)
            : !nature.includes(k) && !lighting.includes(k))) &&
      label.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")),
  );
  const tile = (type: "motion" | "transition", id: string, label: string) => (
    <PresetDemo
      key={id}
      type={type}
      id={id}
      label={label}
      options={options}
      selected={options[type] === id}
      onClick={() =>
        onChange(
          type === "motion"
            ? { motion: id as StoryOptions["motion"] }
            : { transition: id as StoryOptions["transition"] },
        )
      }
    />
  );
  return (
    <aside className="quick-settings" aria-label="Thiết lập nhanh">
      <div className="panel-title">
        <h2>Thiết lập nhanh</h2>
        <select
          className="settings-scope"
          aria-label="Phạm vi thiết lập"
          value={scope}
          disabled={busy || !sceneNumber || tab === "overlay"}
          onChange={(e) => onScope(e.target.value as "all" | "scene")}
        >
          <option value="all">Toàn video</option>
          <option value="scene">Cảnh {sceneNumber || "đang xem"}</option>
        </select>
      </div>
      <div className="settings-tabs" role="tablist" aria-label="Nhóm thiết lập">
        {Object.entries(TABS).map(([key, [icon, label]]) => (
          <button
            key={key}
            role="tab"
            id={"tab-" + key}
            aria-controls={"settings-" + key}
            aria-selected={tab === key}
            onClick={() => onTab(key as SettingsTab)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </div>
      <fieldset
        key={tab}
        disabled={busy}
        className="settings-content"
        role="tabpanel"
        id={"settings-" + tab}
        aria-labelledby={"tab-" + tab}
      >
        {scope === "scene" && (
          <div className="scope-note">
            <span title={sceneLabel}>{sceneLabel}</span>
            {hasOverride && (
              <button className="text-button" onClick={onClearOverride}>
                Dùng chung
              </button>
            )}
          </div>
        )}
        {scope === "all" && tab !== "overlay" && overrideCount > 0 && (
          <div className="scope-note">
            <span>{overrideCount} cảnh có chỉnh riêng</span>
            <button className="text-button" onClick={onClearAllOverrides}>
              Bỏ chỉnh riêng
            </button>
          </div>
        )}
        {tab === "motion" && (
          <>
            <div className="preset-grid">
              {tile("motion", "auto", "Luân phiên tự động")}
              {Object.entries(MOTIONS)
                .filter(([id]) => basicMotions.includes(id))
                .map(([id, label]) => tile("motion", id, label))}
            </div>
            <Slider
              label="Mức chuyển động"
              value={options.motionAmount}
              min={0}
              max={100}
              suffix="%"
              onChange={(motionAmount) => onChange({ motionAmount })}
            />
            <details className="compact-details">
              <summary>
                Tất cả chuyển động · {Object.keys(MOTIONS).length}
              </summary>
              <div className="preset-grid">
                {Object.entries(MOTIONS)
                  .filter(([id]) => !basicMotions.includes(id))
                  .map(([id, label]) => tile("motion", id, label))}
              </div>
            </details>
            <div className="setting-row">
              <span>Khung ảnh</span>
              <select
                aria-label="Khung ảnh"
                value={options.fit}
                onChange={(e) =>
                  onChange({ fit: e.target.value as StoryOptions["fit"] })
                }
              >
                <option value="contain">Giữ trọn</option>
                <option value="cover">Lấp đầy</option>
              </select>
            </div>
            <Slider
              label={
                scope === "scene"
                  ? "Ảnh không voice (chung)"
                  : "Ảnh không voice"
              }
              value={options.seconds}
              min={1}
              max={300}
              step={0.5}
              suffix="s"
              onChange={(seconds) => onChange({ seconds })}
            />
            <MotionAdvanced
              options={options}
              images={images}
              onChange={onChange}
            />
          </>
        )}
        {tab === "transition" && (
          <>
            <div className="preset-grid">
              {tile("transition", "auto", "Tự động")}
              {Object.entries(TRANSITIONS)
                .filter(([id]) => basicTransitions.includes(id))
                .map(([id, label]) => tile("transition", id, label))}
            </div>
            <Slider
              label="Thời gian"
              value={options.transitionSeconds}
              min={0.1}
              max={2}
              step={0.05}
              suffix="s"
              onChange={(transitionSeconds) => onChange({ transitionSeconds })}
            />
            <div className="setting-row">
              <span>Hướng</span>
              <select
                aria-label="Hướng chuyển cảnh"
                value={options.transitionDirection}
                onChange={(e) =>
                  onChange({
                    transitionDirection: e.target
                      .value as StoryOptions["transitionDirection"],
                  })
                }
              >
                <option value="left">Trái</option>
                <option value="right">Phải</option>
                <option value="up">Lên</option>
                <option value="down">Xuống</option>
              </select>
            </div>
            <details className="compact-details">
              <summary>
                Tất cả chuyển cảnh · {Object.keys(TRANSITIONS).length}
              </summary>
              <div className="preset-grid">
                {Object.entries(TRANSITIONS)
                  .filter(([id]) => !basicTransitions.includes(id))
                  .map(([id, label]) => tile("transition", id, label))}
              </div>
            </details>
            <details className="compact-details">
              <summary>Nâng cao</summary>
              <Choice
                label="Đường cong chuyển cảnh"
                value={options.transitionEasing}
                choices={EASINGS}
                onChange={(v) =>
                  onChange({
                    transitionEasing: v as StoryOptions["transitionEasing"],
                  })
                }
              />
            </details>
          </>
        )}
        {tab === "overlay" && (
          <>
            <div className="layer-summary">
              <span>{layers.length}/8 lớp</span>
              {layers.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => onChange({ overlays: [], overlay: "none" })}
                >
                  Bỏ hết
                </button>
              )}
            </div>
            {!!layers.length && (
              <div className="active-layers">
                {layers.map((layer) => (
                  <div key={layer.kind}>
                    <button
                      className={activeLayer === layer.kind ? "active" : ""}
                      onClick={() =>
                        setActiveLayer(
                          activeLayer === layer.kind ? null : layer.kind,
                        )
                      }
                    >
                      <Icon name="effect" />
                      <span>{OVERLAYS[layer.kind]}</span>
                    </button>
                    <button
                      aria-label={"Bỏ lớp " + OVERLAYS[layer.kind]}
                      onClick={() => toggle(layer.kind)}
                    >
                      <Icon name="close" />
                    </button>
                    {activeLayer === layer.kind && (
                      <div className="layer-controls">
                        <Slider
                          label="Cường độ"
                          value={Math.round(layer.amount * 100)}
                          min={0}
                          max={100}
                          suffix="%"
                          onChange={(amount) =>
                            patchLayer(layer.kind, { amount: amount / 100 })
                          }
                        />
                        <details className="compact-details">
                          <summary>Màu và chuyển động</summary>
                          <label className="color-setting">
                            Màu
                            <input
                              aria-label={"Màu " + OVERLAYS[layer.kind]}
                              type="color"
                              value={layer.color}
                              onChange={(e) =>
                                patchLayer(layer.kind, {
                                  color: e.target.value,
                                })
                              }
                            />
                          </label>
                          <Slider
                            label="Tốc độ"
                            value={layer.speed}
                            min={0.1}
                            max={5}
                            step={0.1}
                            onChange={(speed) =>
                              patchLayer(layer.kind, { speed })
                            }
                          />
                          <Slider
                            label="Kích thước"
                            value={layer.size}
                            min={0.1}
                            max={5}
                            step={0.1}
                            onChange={(size) =>
                              patchLayer(layer.kind, { size })
                            }
                          />
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <input
              className="preset-search"
              aria-label="Tìm lớp phủ"
              placeholder="Tìm lớp phủ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-chips" aria-label="Lọc lớp phủ">
              {[
                ["all", "Tất cả"],
                ["nature", "Thiên nhiên"],
                ["light", "Ánh sáng"],
                ["film", "Khung phim"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={group === id}
                  onClick={() => setGroup(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="preset-grid">
              {allOverlays.map(([id, label]) => (
                <Tile
                  key={id}
                  type="overlay"
                  id={id}
                  label={label}
                  image="/samples/demo-a.svg"
                  selected={layers.some((l) => l.kind === id)}
                  disabled={
                    layers.length >= 8 && !layers.some((l) => l.kind === id)
                  }
                  onClick={() => toggle(id as keyof typeof OVERLAYS)}
                />
              ))}
            </div>
            {!allOverlays.length && (
              <p className="empty-small">Không tìm thấy lớp phủ.</p>
            )}
          </>
        )}
        {tab === "caption" && (
          <>
            <label className="toggle-line">
              <span>Hiện phụ đề</span>
              <input
                type="checkbox"
                checked={options.subtitles}
                onChange={(e) => onChange({ subtitles: e.target.checked })}
              />
            </label>
            <div className="preset-grid">
              {(
                [
                  ["boxed", "Nền tối"],
                  ["outline", "Viền chữ"],
                  ["highlight", "Nổi bật"],
                  ["plain", "Tối giản"],
                ] as const
              ).map(([id, label]) => (
                <PresetDemo
                  key={id}
                  id={id}
                  label={label}
                  type="caption"
                  options={{
                    ...options,
                    caption: presetCaption(id),
                  }}
                  selected={c.preset === id}
                  onClick={() => onChange({ caption: presetCaption(id) })}
                />
              ))}
            </div>
            <details className="compact-details">
              <summary>Thêm kiểu chữ</summary>
              <div className="preset-grid">
                {Object.entries(TEXT_PRESETS)
                  .filter(([id]) => !["outline", "highlight"].includes(id))
                  .map(([id, label]) => (
                    <PresetDemo
                      key={id}
                      id={id}
                      label={label}
                      type="caption"
                      options={{
                        ...options,
                        caption: presetCaption(id as StoryCaption["preset"]),
                      }}
                      selected={c.preset === id}
                      onClick={() =>
                        onChange({
                          caption: presetCaption(id as StoryCaption["preset"]),
                        })
                      }
                    />
                  ))}
              </div>
            </details>
            <Slider
              label="Cỡ chữ"
              value={c.size}
              min={8}
              max={400}
              suffix="px"
              onChange={(size) => caption({ size })}
            />
            <div className="setting-row">
              <span>Vị trí</span>
              <select
                aria-label="Vị trí phụ đề"
                value={c.position}
                onChange={(e) =>
                  caption({
                    position: e.target.value as StoryCaption["position"],
                    advanced: Object.fromEntries(
                      Object.entries(c.advanced).filter(([key]) => key !== "y"),
                    ),
                  })
                }
              >
                <option value="bottom">Dưới</option>
                <option value="middle">Giữa</option>
                <option value="top">Trên</option>
              </select>
            </div>
            <div className="color-pair">
              <label className="color-setting">
                Chữ
                <input
                  aria-label="Màu chữ phụ đề"
                  type="color"
                  value={c.color}
                  onChange={(e) => caption({ color: e.target.value })}
                />
              </label>
              <label className="color-setting">
                Nền
                <input
                  aria-label="Màu nền phụ đề"
                  type="color"
                  value={c.background}
                  onChange={(e) => caption({ background: e.target.value })}
                />
              </label>
            </div>
            <div className="setting-row">
              <span>Xuất hiện</span>
              <select
                aria-label="Animation phụ đề"
                value={c.animation}
                onChange={(e) =>
                  caption({
                    animation: e.target.value as StoryCaption["animation"],
                  })
                }
              >
                {Object.entries(TEXT_ANIMATIONS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <details className="compact-details">
              <summary>Font và độ dài câu</summary>
              <select
                aria-label="Font phụ đề"
                value={c.font}
                onChange={(e) => caption({ font: e.target.value })}
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
              <Slider
                label={
                  scope === "scene" ? "Ký tự / câu (chung)" : "Ký tự / câu"
                }
                value={c.maxChars}
                min={40}
                max={240}
                step={4}
                onChange={(maxChars) => caption({ maxChars })}
              />
            </details>
            <details className="compact-details">
              <summary>
                Xem animation chữ · {Object.keys(TEXT_ANIMATIONS).length}
              </summary>
              <div className="preset-grid">
                {Object.entries(TEXT_ANIMATIONS).map(([id, label]) => (
                  <PresetDemo
                    key={id}
                    id={id}
                    label={label}
                    type="caption"
                    options={{
                      ...options,
                      caption: {
                        ...c,
                        animation: id as StoryCaption["animation"],
                      },
                    }}
                    selected={c.animation === id}
                    onClick={() =>
                      caption({ animation: id as StoryCaption["animation"] })
                    }
                  />
                ))}
              </div>
            </details>
            <CaptionAdvancedSettings options={options} onChange={onChange} />
          </>
        )}
      </fieldset>
    </aside>
  );
}
