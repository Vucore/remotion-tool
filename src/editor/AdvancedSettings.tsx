import type { ReactNode } from "react";
import { EASINGS, MASKS, TEXT_ANIMATIONS, TEXT_LOOPS } from "../catalog";
import { makeText } from "../model";
import {
  captionStyle,
  type StoryOptions,
  type StoryImage,
  type CaptionAdvanced,
} from "../auto/story";
import { Icon } from "../icons";

export function Choice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(choices).map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="setting-row number-field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        value={Number(value.toFixed(3))}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber))
            onChange(Math.min(max, Math.max(min, e.target.valueAsNumber)));
        }}
      />
    </label>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-line">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="compact-details advanced-group">
      <summary>{label}</summary>
      {children}
    </details>
  );
}
export function MotionAdvanced({
  options: o,
  images,
  onChange,
}: {
  options: StoryOptions;
  images: string[];
  onChange: (v: Partial<StoryOptions>) => void;
}) {
  const image = o.image;
  const patch = (v: Partial<StoryImage>) =>
    onChange({ image: { ...image, ...v } });
  const number = (
    key: keyof StoryImage,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={image[key] as number}
      min={min}
      max={max}
      step={step}
      onChange={(v) => patch({ [key]: v })}
    />
  );
  return (
    <>
      <Group label="Tốc độ và thời gian">
        {number("motionSpeed", "Tốc độ ảnh", 0.1, 5, 0.1)}
        <Choice
          label="Đường cong ảnh"
          value={image.motionEasing}
          choices={EASINGS}
          onChange={(v) =>
            patch({ motionEasing: v as StoryImage["motionEasing"] })
          }
        />
        {number("motionStart", "Bắt đầu sau (s)", 0, 300, 0.1)}
        <Toggle
          label="Chạy hết cảnh"
          value={image.motionDuration === null}
          onChange={(v) => patch({ motionDuration: v ? null : 3 })}
        />
        {image.motionDuration !== null && (
          <NumberField
            label="Độ dài chuyển động (s)"
            value={image.motionDuration}
            min={0.05}
            max={3600}
            step={0.1}
            onChange={(v) => patch({ motionDuration: v })}
          />
        )}
        {number("motionOffset", "Lệch pha (s)", 0, 3600, 0.1)}
      </Group>
      <Group label="Tâm zoom và khung ảnh">
        <button
          className="focus-picker"
          aria-label="Chọn tâm zoom trên ảnh"
          title="Bấm để đặt tâm zoom"
          onClick={(e) => {
            if (e.detail === 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            patch({
              focusX: Math.round(((e.clientX - r.left) / r.width) * 100),
              focusY: Math.round(((e.clientY - r.top) / r.height) * 100),
            });
          }}
          onKeyDown={(e) => {
            const d = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            }[e.key];
            if (d) {
              e.preventDefault();
              patch({
                focusX: Math.max(0, Math.min(100, image.focusX + d[0])),
                focusY: Math.max(0, Math.min(100, image.focusY + d[1])),
              });
            }
          }}
        >
          <img src={images[0] || "/samples/coast.svg"} alt="" />
          <span style={{ left: `${image.focusX}%`, top: `${image.focusY}%` }} />
        </button>
        <div className="paired-settings">
          {number("focusX", "Tâm ngang (%)", 0, 100)}
          {number("focusY", "Tâm dọc (%)", 0, 100)}
        </div>
        {number("x", "Dịch ngang (%)", -100, 100)}
        {number("y", "Dịch dọc (%)", -100, 100)}
        {number("scale", "Tỷ lệ ảnh", 0.1, 5, 0.05)}
        {number("rotate", "Xoay ảnh (°)", -180, 180)}
        {number("opacity", "Độ hiện ảnh", 0, 1, 0.05)}
        <Toggle
          label="Lật ảnh ngang"
          value={image.flip}
          onChange={(v) => patch({ flip: v })}
        />
        <Choice
          label="Mặt nạ ảnh"
          value={image.mask}
          choices={MASKS}
          onChange={(v) => patch({ mask: v as StoryImage["mask"] })}
        />
      </Group>
      <Group label={"Đường đi tùy chỉnh · " + image.keyframes.length}>
        <p className="control-hint">
          Mốc tính bằng giây trong mỗi cảnh, kết hợp với chuyển động đã chọn.
        </p>
        {image.keyframes.map((key, index) => (
          <details className="keyframe-row" key={index}>
            <summary>
              Mốc {index + 1} · {key.time}s
            </summary>
            {(
              [
                ["time", "Thời điểm (s)", 0, 3600, 0.1],
                ["x", "Ngang (%)", -100, 100],
                ["y", "Dọc (%)", -100, 100],
                ["scale", "Tỷ lệ", 0.1, 5, 0.05],
                ["rotate", "Góc (°)", -180, 180],
                ["opacity", "Độ hiện", 0, 1, 0.05],
              ] as const
            ).map(([field, label, min, max, step]) => (
              <NumberField
                key={field}
                label={label}
                value={key[field]}
                min={min}
                max={max}
                step={step}
                onChange={(v) =>
                  patch({
                    keyframes: image.keyframes.map((k, i) =>
                      i === index ? { ...k, [field]: v } : k,
                    ),
                  })
                }
              />
            ))}
            <button
              className="text-button"
              onClick={() =>
                patch({
                  keyframes: image.keyframes.filter((_, i) => i !== index),
                })
              }
            >
              Bỏ mốc
            </button>
          </details>
        ))}
        <div className="inline-actions">
          <button
            className="button"
            disabled={image.keyframes.length >= 100}
            onClick={() => {
              const last = image.keyframes.at(-1);
              patch({
                keyframes: [
                  ...image.keyframes,
                  {
                    time: last ? Math.min(3600, last.time + 1) : 0,
                    x: image.x,
                    y: image.y,
                    scale: image.scale,
                    rotate: image.rotate,
                    opacity: image.opacity,
                  },
                ],
              });
            }}
          >
            <Icon name="plus" />
            Thêm mốc
          </button>
          {!!image.keyframes.length && (
            <button
              className="text-button"
              onClick={() => patch({ keyframes: [] })}
            >
              Bỏ đường đi
            </button>
          )}
        </div>
      </Group>
    </>
  );
}

export function CaptionAdvancedSettings({
  options: o,
  onChange,
}: {
  options: StoryOptions;
  onChange: (v: Partial<StoryOptions>) => void;
}) {
  const text = { ...makeText(), ...captionStyle(o) };
  const patch = (v: CaptionAdvanced) =>
    onChange({
      caption: { ...o.caption, advanced: { ...o.caption.advanced, ...v } },
    });
  const n = (
    key: keyof CaptionAdvanced,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={text[key] as number}
      min={min}
      max={max}
      step={step}
      onChange={(v) => patch({ [key]: v })}
    />
  );
  const choice = (
    key: keyof CaptionAdvanced,
    label: string,
    choices: Record<string, string>,
  ) => (
    <Choice
      label={label}
      value={String(text[key])}
      choices={choices}
      onChange={(v) => patch({ [key]: v } as CaptionAdvanced)}
    />
  );
  const color = (
    key: "strokeColor" | "shadowColor" | "gradientColor",
    label: string,
  ) => (
    <label className="color-setting">
      {label}
      <input
        type="color"
        aria-label={label}
        value={text[key]}
        onChange={(e) => patch({ [key]: e.target.value })}
      />
    </label>
  );
  return (
    <>
      <Toggle
        label="Nền trong suốt"
        value={o.caption.transparent}
        onChange={(transparent) =>
          onChange({ caption: { ...o.caption, transparent } })
        }
      />
      <Group label="Animation và thời gian">
        {choice("animationOut", "Biến mất", TEXT_ANIMATIONS)}
        {n("inDuration", "Thời gian vào (s)", 0.05, 10, 0.05)}
        {n("outDuration", "Thời gian ra (s)", 0.05, 10, 0.05)}
        {choice("easing", "Đường cong chữ", EASINGS)}
        {n("stagger", "Trễ từng từ/ký tự (s)", 0, 0.5, 0.01)}
        {choice("loop", "Chuyển động lặp", TEXT_LOOPS)}
        {n("loopSpeed", "Tốc độ lặp", 0.1, 5, 0.1)}
      </Group>
      <Group label="Bố cục và kiểu chữ">
        {n("x", "Ngang chữ (%)", 0, 100)}
        {n("y", "Dọc chữ (%)", 0, 100)}
        {n("width", "Độ rộng chữ (%)", 5, 100)}
        {choice("align", "Căn chữ", {
          left: "Trái",
          center: "Giữa",
          right: "Phải",
        })}
        {n("weight", "Độ đậm", 100, 900, 100)}
        <Toggle
          label="Chữ nghiêng"
          value={text.italic}
          onChange={(v) => patch({ italic: v })}
        />
        {choice("decoration", "Trang trí chữ", {
          none: "Không",
          underline: "Gạch dưới",
          "line-through": "Gạch ngang",
          overline: "Gạch trên",
        })}
        {choice("casing", "Hoa / thường", {
          none: "Giữ nguyên",
          uppercase: "CHỮ HOA",
          lowercase: "chữ thường",
          capitalize: "Viết Hoa Đầu",
        })}
        {choice("writing", "Hướng chữ", {
          "horizontal-tb": "Ngang",
          "vertical-rl": "Dọc phải",
          "vertical-lr": "Dọc trái",
        })}
        {n("letterSpacing", "Giãn ký tự (px)", -20, 80, 0.5)}
        {n("lineHeight", "Giãn dòng", 0.5, 3, 0.05)}
        {n("padding", "Đệm nền (px)", 0, 100)}
        {n("radius", "Bo nền (px)", 0, 100)}
        {n("opacity", "Độ hiện chữ", 0, 1, 0.05)}
        {n("rotate", "Xoay chữ (°)", -360, 360)}
        {n("scale", "Tỷ lệ chữ", 0.1, 5, 0.05)}
        {n("skew", "Xiên chữ (°)", -60, 60)}
        {choice("shape", "Đường chữ", {
          normal: "Thẳng",
          "arc-up": "Cong lên",
          "arc-down": "Cong xuống",
        })}
        {text.shape !== "normal" && n("arc", "Độ cong", 5, 100)}
      </Group>
      <Group label="Viền, bóng và màu chuyển">
        {choice("fill", "Tô chữ", {
          solid: "Một màu",
          gradient: "Chuyển màu",
          outline: "Rỗng viền",
        })}
        {text.fill === "gradient" && (
          <>
            {color("gradientColor", "Màu thứ hai")}
            {n("gradientAngle", "Góc màu (°)", 0, 360)}
          </>
        )}
        {n("stroke", "Viền (px)", 0, 20)}
        {color("strokeColor", "Màu viền")}
        {n("shadow", "Độ mờ bóng (px)", 0, 100)}
        {color("shadowColor", "Màu bóng")}
        {n("shadowX", "Bóng ngang (px)", -100, 100)}
        {n("shadowY", "Bóng dọc (px)", -100, 100)}
        {n("glow", "Phát sáng (px)", 0, 100)}
        {n("depth", "Độ nổi", 0, 30)}
      </Group>
      {Object.keys(o.caption.advanced).length > 0 && (
        <button
          className="text-button"
          onClick={() => onChange({ caption: { ...o.caption, advanced: {} } })}
        >
          Đặt lại nâng cao
        </button>
      )}
    </>
  );
}
