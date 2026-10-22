import { useState } from "react";
import { MOTIONS, TRANSITIONS, EASINGS, MASKS, OVERLAYS } from "../catalog";
import {
  id,
  parseEffects,
  type Scene,
  type OverlaySpec,
  type ImageKeyframe,
} from "../model";
import {
  NATIVE_EFFECTS,
  EFFECT_MAP,
  effectFields,
  effectGroup,
  effectName,
  makeEffect,
  type EffectSpec,
  type FieldSchema,
  type Value,
} from "../effects/catalog";
import { validateNativeEffect } from "../effects/runtime";
import {
  Action,
  Field,
  Numeric,
  NumberInput,
  Slider,
  Select,
  Check,
  Color,
  Group,
} from "./Controls";
const labelMap: Record<string, string> = {
  amount: "Mức độ",
  radius: "Bán kính",
  strength: "Cường độ",
  color: "Màu",
  colors: "Bảng màu",
  progress: "Tiến trình",
  seed: "Hạt giống",
  rotation: "Góc xoay",
  angle: "Góc",
  opacity: "Độ hiện",
  size: "Kích thước",
  scale: "Tỷ lệ",
  horizontal: "Theo ngang",
  vertical: "Theo dọc",
  center: "Tâm",
  topLeft: "Góc trên trái",
  topRight: "Góc trên phải",
  bottomLeft: "Góc dưới trái",
  bottomRight: "Góc dưới phải",
  offsetX: "Dịch ngang",
  offsetY: "Dịch dọc",
  x: "Ngang (px)",
  y: "Dọc (px)",
  u: "Ngang (UV)",
  v: "Dọc (UV)",
  width: "Chiều rộng",
  height: "Chiều cao",
  blur: "Độ mờ",
  blurRadius: "Bán kính mờ",
  feather: "Mềm mép",
  roundness: "Bo tròn",
  gap: "Khoảng cách",
  thickness: "Độ dày",
  direction: "Hướng",
  origin: "Gốc",
  rays: "Số tia",
  smoothness: "Độ mịn",
  startColor: "Màu đầu",
  endColor: "Màu cuối",
  lineColor: "Màu nét",
  backgroundColor: "Màu nền",
  lineWidth: "Độ dày nét",
  gridSize: "Cỡ lưới",
  cellSize: "Cỡ ô",
  grainSize: "Cỡ hạt",
  maskToSourceAlpha: "Giữ theo vùng trong suốt",
  wrap: "Lặp biên",
  frequency: "Tần số",
  amplitude: "Biên độ",
  wavelength: "Bước sóng",
  content: "Nội dung LUT .cube",
  dotColor: "Màu chấm",
  dotSize: "Cỡ chấm",
  dotSpacing: "Khoảng chấm",
  colorMode: "Chế độ màu",
  shape: "Hình dạng",
  invert: "Đảo",
  passes: "Số lượt",
  start: "Điểm đầu",
  end: "Điểm cuối",
};
function Param({
  name,
  field,
  value,
  onChange,
}: {
  name: string;
  field: FieldSchema;
  value: Value;
  onChange: (v: Value) => void;
}) {
  const label = labelMap[name] ?? field.description ?? name;
  if (field.type === "boolean")
    return <Check label={label} checked={Boolean(value)} onChange={onChange} />;
  if (field.type === "number" || field.type === "rotation-degrees")
    return (
      <Numeric
        label={label}
        value={Number(value ?? 0)}
        min={field.min ?? -100000}
        max={field.max ?? 100000}
        step={field.integer ? 1 : (field.step ?? 0.1)}
        onChange={onChange}
      />
    );
  if (field.type === "enum")
    return (
      <Select
        label={label}
        value={String(value ?? field.default)}
        options={Object.fromEntries(
          Object.keys(field.variants ?? {}).map((v) => [v, v]),
        )}
        onChange={onChange}
      />
    );
  if (field.type === "color")
    return (
      <Field label={label}>
        <div className="color-control">
          <input
            aria-label={label}
            type="color"
            value={
              /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#000000"
            }
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            aria-label={`${label} mã màu`}
            key={String(value)}
            defaultValue={String(value)}
            maxLength={100}
            onBlur={(e) => {
              if (e.target.value !== String(value)) onChange(e.target.value);
            }}
          />
        </div>
      </Field>
    );
  if (field.type === "uv-coordinate")
    return (
      <div className="coordinate-field">
        <span>{label}</span>
        <div className="two-columns">
          {((value as number[]) ?? [0, 0]).map((n, index) => (
            <NumberInput
              key={index}
              label={`${label} ${index === 0 ? "U" : "V"}`}
              value={n}
              min={field.min ?? -100}
              max={field.max ?? 100}
              step={field.step ?? 0.01}
              onChange={(v) => {
                const next = [...(value as number[])];
                next[index] = v;
                onChange(next);
              }}
            />
          ))}
        </div>
      </div>
    );
  if (field.type === "array") {
    const array = value as (number | string)[];
    return (
      <div className="array-field">
        <span>{label}</span>
        {array.map((item, index) => (
          <div className="array-item" key={index}>
            <Param
              name={`${name} ${index + 1}`}
              field={field.item!}
              value={item}
              onChange={(v) =>
                onChange(array.map((p, i) => (i === index ? v : p)) as Value)
              }
            />
            <Action
              icon="trash"
              label="Bỏ giá trị"
              disabled={array.length <= (field.minLength ?? 0)}
              onClick={() =>
                onChange(array.filter((_, i) => i !== index) as Value)
              }
            />
          </div>
        ))}
        <button
          className="text-button"
          disabled={array.length >= Math.min(64, field.maxLength ?? 64)}
          onClick={() =>
            onChange([...array, field.newItemDefault ?? "#ffffff"] as Value)
          }
        >
          Thêm giá trị
        </button>
      </div>
    );
  }
  if (field.type === "string")
    return (
      <Field label={label}>
        <textarea
          key={String(value).slice(0, 100) + String(value).length}
          defaultValue={String(value)}
          rows={5}
          maxLength={2 * 1024 * 1024}
          onBlur={(e) => {
            if (e.target.value !== String(value)) onChange(e.target.value);
          }}
        />
        <input
          aria-label="Nhập file LUT cube"
          type="file"
          accept=".cube"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && file.size <= 2 * 1024 * 1024)
              onChange(await file.text());
            e.target.value = "";
          }}
        />
        <small className="field-hint">
          LUT .cube tối đa 2 MB; nội dung được lưu trong dự án.
        </small>
      </Field>
    );
  return null;
}
function EffectCard({
  effect,
  index,
  count,
  duration,
  onChange,
  onRemove,
  onMove,
  onCopy,
}: {
  effect: EffectSpec;
  index: number;
  count: number;
  duration: number;
  onChange: (effect: EffectSpec) => void;
  onRemove: () => void;
  onMove: (d: number) => void;
  onCopy: () => void;
}) {
  const [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const entry = EFFECT_MAP[effect.kind],
    fields = effectFields(entry, effect.params);
  function edit(next: EffectSpec) {
    if (next.start !== effect.start || next.end !== effect.end)
      next = { ...next, offset: 0, span: null };
    try {
      const parsed = parseEffects([next])[0];
      validateNativeEffect(parsed);
      onChange(parsed);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tham số không hợp lệ.");
      setRevision((r) => r + 1);
    }
  }
  return (
    <details className="effect-card" open={index === count - 1}>
      <summary>
        <span className="effect-order">{index + 1}</span>
        <span>
          {effectName(effect.kind)}
          <small>
            {entry.backend === "2d"
              ? "Canvas 2D"
              : entry.backend === "webgpu"
                ? "WebGPU"
                : "WebGL2"}
          </small>
        </span>
        <input
          aria-label={`Bật ${effectName(effect.kind)}`}
          type="checkbox"
          checked={effect.enabled}
          onChange={(e) => edit({ ...effect, enabled: e.target.checked })}
        />
      </summary>
      <div className="effect-card-body">
        <div className="layer-actions">
          <Action
            icon="back"
            label="Đưa hiệu ứng lên trước"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          />
          <Action
            icon="next"
            label="Đưa hiệu ứng xuống sau"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          />
          <Action
            icon="copy"
            label="Nhân bản hiệu ứng"
            disabled={count >= 24}
            onClick={onCopy}
          />
          <Action icon="trash" label="Xoá hiệu ứng" onClick={onRemove} />
        </div>
        {error && (
          <p role="alert" className="inline-error">
            Chưa áp dụng: {error}
          </p>
        )}
        <fieldset disabled={!effect.enabled} key={revision}>
          <div className="two-columns">
            <Numeric
              label="Từ giây"
              value={effect.start}
              min={0}
              max={duration}
              onChange={(start) =>
                edit({
                  ...effect,
                  start,
                  end: effect.end === null ? null : Math.max(start, effect.end),
                })
              }
            />
            <Numeric
              label="Đến giây"
              value={effect.end ?? duration}
              min={effect.start}
              max={Math.max(duration, effect.start)}
              onChange={(end) => edit({ ...effect, end })}
            />
          </div>
          <Check
            label="Đến cuối cảnh"
            checked={effect.end === null}
            onChange={(checked) =>
              edit({
                ...effect,
                end: checked ? null : Math.max(duration, effect.start),
              })
            }
          />
          <div className="effect-parameters">
            {Object.entries(fields).map(([key, field]) => (
              <div key={key} className="effect-parameter">
                <Param
                  name={key}
                  field={field}
                  value={
                    effect.params[key] ?? entry.defaults[key] ?? field.default!
                  }
                  onChange={(value) =>
                    edit({
                      ...effect,
                      params: { ...effect.params, [key]: value },
                    })
                  }
                />
                {["number", "rotation-degrees"].includes(field.type) && (
                  <>
                    <Check
                      label={`Chuyển động · ${labelMap[key] ?? field.description ?? key}`}
                      checked={Boolean(effect.automation[key])}
                      onChange={(checked) => {
                        const automation = { ...effect.automation };
                        if (checked)
                          automation[key] = {
                            from: Number(effect.params[key]),
                            to: Number(effect.params[key]),
                            easing: "linear",
                          };
                        else delete automation[key];
                        edit({ ...effect, automation });
                      }}
                    />
                    {effect.automation[key] && (
                      <div className="automation-fields">
                        <div className="two-columns">
                          <Numeric
                            label="Giá trị đầu"
                            value={effect.automation[key].from}
                            min={field.min ?? -100000}
                            max={field.max ?? 100000}
                            step={field.integer ? 1 : (field.step ?? 0.1)}
                            onChange={(from) =>
                              edit({
                                ...effect,
                                automation: {
                                  ...effect.automation,
                                  [key]: { ...effect.automation[key], from },
                                },
                              })
                            }
                          />
                          <Numeric
                            label="Giá trị cuối"
                            value={effect.automation[key].to}
                            min={field.min ?? -100000}
                            max={field.max ?? 100000}
                            step={field.integer ? 1 : (field.step ?? 0.1)}
                            onChange={(to) =>
                              edit({
                                ...effect,
                                automation: {
                                  ...effect.automation,
                                  [key]: { ...effect.automation[key], to },
                                },
                              })
                            }
                          />
                        </div>
                        <Select
                          label="Nhịp tham số"
                          value={effect.automation[key].easing}
                          options={EASINGS}
                          onChange={(easing) =>
                            edit({
                              ...effect,
                              automation: {
                                ...effect.automation,
                                [key]: {
                                  ...effect.automation[key],
                                  easing: easing as Scene["motionEasing"],
                                },
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </fieldset>
        <div className="effect-bottom">
          <button
            className="text-button"
            onClick={() => {
              const fresh = makeEffect(effect.kind);
              edit({
                ...effect,
                params: fresh.params,
                automation: fresh.automation,
              });
            }}
          >
            Đặt lại tham số
          </button>
          {entry.documentationLink && (
            <a href={entry.documentationLink} target="_blank" rel="noreferrer">
              Tài liệu gốc
            </a>
          )}
        </div>
      </div>
    </details>
  );
}
export function EffectsPanel({
  scene,
  onChange,
  localTime,
}: {
  scene: Scene;
  onChange: (patch: Partial<Scene>) => void;
  localTime: number;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("all"),
    [chosen, setChosen] = useState("blur");
  const [overlay, setOverlay] = useState<OverlaySpec["kind"]>("dust");
  const normalized = (s: string) =>
    s
      .toLocaleLowerCase("vi")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  const filtered = NATIVE_EFFECTS.filter(
    (e) =>
      (group === "all" || effectGroup(e.kind) === group) &&
      normalized(`${effectName(e.kind)} ${e.kind}`).includes(normalized(query)),
  );
  const candidate =
    filtered.find((e) => e.kind === chosen)?.kind ?? filtered[0]?.kind;
  const entry = candidate ? EFFECT_MAP[candidate] : null;
  const gpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;
  const editEffect = (index: number, effect: EffectSpec) =>
    onChange({
      effects: scene.effects.map((e, i) => (i === index ? effect : e)),
    });
  const editOverlay = (index: number, patch: Partial<OverlaySpec>) =>
    onChange({
      overlays: scene.overlays.map((o, i) =>
        i === index
          ? {
              ...o,
              ...patch,
              ...("start" in patch || "end" in patch ? { offset: 0 } : {}),
            }
          : o,
      ),
    });
  const editKey = (index: number, patch: Partial<ImageKeyframe>) =>
    onChange({
      keyframes: scene.keyframes
        .map((k, i) => (i === index ? { ...k, ...patch } : k))
        .filter(
          (key, i) =>
            i === index || patch.time === undefined || key.time !== patch.time,
        )
        .sort((a, b) => a.time - b.time),
    });
  return (
    <>
      <Group title="Chuyển động ảnh" open>
        <Select
          label="Kiểu chuyển động"
          value={scene.motion}
          options={MOTIONS}
          onChange={(motion) => onChange({ motion: motion as Scene["motion"] })}
        />
        <Slider
          label="Mức chuyển động"
          value={scene.motionAmount}
          min={0}
          max={100}
          onChange={(motionAmount) => onChange({ motionAmount })}
        />
        <Slider
          label="Tốc độ chuyển động"
          value={scene.motionSpeed}
          min={0.1}
          max={5}
          step={0.1}
          onChange={(motionSpeed) => onChange({ motionSpeed })}
        />
        <Select
          label="Nhịp ảnh"
          value={scene.motionEasing}
          options={EASINGS}
          onChange={(motionEasing) =>
            onChange({ motionEasing: motionEasing as Scene["motionEasing"] })
          }
        />
        <Select
          label="Mặt nạ ảnh"
          value={scene.mask}
          options={MASKS}
          onChange={(mask) => onChange({ mask: mask as Scene["mask"] })}
        />
        <Slider
          label="Độ hiện ảnh"
          value={scene.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(opacity) => onChange({ opacity })}
        />
      </Group>
      <Group title="Chuyển cảnh" open>
        <Select
          label="Kiểu chuyển cảnh"
          value={scene.transition}
          options={TRANSITIONS}
          onChange={(transition) =>
            onChange({ transition: transition as Scene["transition"] })
          }
        />
        {scene.transition !== "none" && (
          <>
            <Select
              label="Hướng chuyển cảnh"
              value={scene.transitionDirection}
              options={{
                left: "Trái",
                right: "Phải",
                up: "Lên",
                down: "Xuống",
              }}
              onChange={(transitionDirection) =>
                onChange({
                  transitionDirection:
                    transitionDirection as Scene["transitionDirection"],
                })
              }
            />
            <Numeric
              label="Thời gian nối (s)"
              value={scene.transitionDuration}
              min={0.1}
              max={2}
              step={0.1}
              onChange={(transitionDuration) =>
                onChange({ transitionDuration })
              }
            />
            <Select
              label="Nhịp chuyển cảnh"
              value={scene.transitionEasing}
              options={EASINGS}
              onChange={(transitionEasing) =>
                onChange({
                  transitionEasing:
                    transitionEasing as Scene["transitionEasing"],
                })
              }
            />
          </>
        )}
        <p className="field-hint">
          Nối sang cảnh tiếp theo; thời gian nối không vượt một nửa mỗi cảnh.
          Hướng áp dụng cho các kiểu trượt, đẩy, quét và rèm.
        </p>
      </Group>
      <Group title="Màu cơ bản">
        <Select
          label="Bộ lọc"
          value={scene.filter}
          options={{
            none: "Nguyên bản",
            warm: "Ấm áp",
            cool: "Mát dịu",
            mono: "Đen trắng",
            vintage: "Hoài cổ",
          }}
          onChange={(filter) => onChange({ filter: filter as Scene["filter"] })}
        />
        <Slider
          label="Độ sáng"
          value={scene.brightness}
          min={0}
          max={200}
          onChange={(brightness) => onChange({ brightness })}
        />
        <Slider
          label="Tương phản"
          value={scene.contrast}
          min={0}
          max={200}
          onChange={(contrast) => onChange({ contrast })}
        />
        <Slider
          label="Bão hoà"
          value={scene.saturation}
          min={0}
          max={200}
          onChange={(saturation) => onChange({ saturation })}
        />
        <button
          className="text-button"
          onClick={() =>
            onChange({
              filter: "none",
              brightness: 100,
              contrast: 100,
              saturation: 100,
            })
          }
        >
          Đặt lại màu cơ bản
        </button>
      </Group>
      <Group
        title={`Thư viện Remotion · ${NATIVE_EFFECTS.length} hiệu ứng`}
        open
      >
        <Field label="Tìm hiệu ứng">
          <input
            placeholder="Tên tiếng Việt hoặc tên API…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Select
          label="Nhóm hiệu ứng"
          value={group}
          options={{
            all: "Tất cả",
            ...Object.fromEntries(
              [...new Set(NATIVE_EFFECTS.map((e) => effectGroup(e.kind)))].map(
                (g) => [g, g],
              ),
            ),
          }}
          onChange={setGroup}
        />
        {candidate ? (
          <>
            <Select
              label={`Hiệu ứng (${filtered.length})`}
              value={candidate}
              options={Object.fromEntries(
                filtered.map((e) => [
                  e.kind,
                  `${effectName(e.kind)} · ${e.kind}`,
                ]),
              )}
              onChange={setChosen}
            />
            <button
              className="button primary full-width"
              disabled={
                scene.effects.length >= 24 ||
                (entry?.backend === "webgpu" && !gpuAvailable)
              }
              onClick={() =>
                onChange({ effects: [...scene.effects, makeEffect(candidate)] })
              }
            >
              Thêm hiệu ứng
            </button>
            <p className="field-hint">
              {entry?.backend === "webgpu"
                ? "Cần WebGPU và driver tương thích ở cả preview lẫn renderer."
                : "Hiệu ứng gốc áp dụng lên ảnh. Thứ tự từ trên xuống là thứ tự xử lý."}
            </p>
            {entry?.backend === "webgpu" && !gpuAvailable && (
              <p className="inline-error">
                Trình duyệt hiện tại chưa cung cấp WebGPU.
              </p>
            )}
          </>
        ) : (
          <p className="field-hint">Không có hiệu ứng khớp tìm kiếm.</p>
        )}
        <p className="field-hint">
          {scene.effects.length}/24 hiệu ứng trong cảnh. Các hiệu ứng có
          progress được thêm với chuyển động 0 → 1.
        </p>
        {scene.effects.map((effect, index) => (
          <EffectCard
            key={effect.id}
            effect={effect}
            index={index}
            count={scene.effects.length}
            duration={scene.duration}
            onChange={(value) => editEffect(index, value)}
            onRemove={() =>
              onChange({ effects: scene.effects.filter((_, i) => i !== index) })
            }
            onCopy={() =>
              onChange({
                effects: [
                  ...scene.effects,
                  { ...structuredClone(effect), id: id() },
                ],
              })
            }
            onMove={(direction) => {
              const effects = [...scene.effects];
              [effects[index], effects[index + direction]] = [
                effects[index + direction],
                effects[index],
              ];
              onChange({ effects });
            }}
          />
        ))}
      </Group>
      <Group title={`Lớp phủ · ${Object.keys(OVERLAYS).length} kiểu`}>
        <Select
          label="Lớp phủ mới"
          value={overlay}
          options={OVERLAYS}
          onChange={(v) => setOverlay(v as OverlaySpec["kind"])}
        />
        <button
          className="button full-width"
          disabled={scene.overlays.length >= 8}
          onClick={() =>
            onChange({
              overlays: [
                ...scene.overlays,
                {
                  id: id(),
                  kind: overlay,
                  enabled: true,
                  amount: 0.45,
                  color:
                    overlay === "vignette" || overlay === "letterbox"
                      ? "#000000"
                      : "#fff0bf",
                  speed: 1,
                  size: 1,
                  seed: 0,
                  offset: 0,
                  start: 0,
                  end: null,
                },
              ],
            })
          }
        >
          Thêm lớp phủ
        </button>
        {scene.overlays.map((o, index) => (
          <details className="effect-card" key={o.id}>
            <summary>
              <span>{OVERLAYS[o.kind]}</span>
              <input
                aria-label={`Bật lớp phủ ${OVERLAYS[o.kind]}`}
                type="checkbox"
                checked={o.enabled}
                onChange={(e) =>
                  editOverlay(index, { enabled: e.target.checked })
                }
              />
            </summary>
            <div className="effect-card-body">
              <div className="layer-actions">
                <Action
                  icon="back"
                  label="Đưa lớp phủ xuống"
                  disabled={index === 0}
                  onClick={() => {
                    const layers = [...scene.overlays];
                    [layers[index], layers[index - 1]] = [
                      layers[index - 1],
                      layers[index],
                    ];
                    onChange({ overlays: layers });
                  }}
                />
                <Action
                  icon="next"
                  label="Đưa lớp phủ lên"
                  disabled={index === scene.overlays.length - 1}
                  onClick={() => {
                    const layers = [...scene.overlays];
                    [layers[index], layers[index + 1]] = [
                      layers[index + 1],
                      layers[index],
                    ];
                    onChange({ overlays: layers });
                  }}
                />
                <Action
                  icon="trash"
                  label="Xoá lớp phủ"
                  onClick={() =>
                    onChange({
                      overlays: scene.overlays.filter((_, i) => i !== index),
                    })
                  }
                />
              </div>
              <Color
                label="Màu lớp phủ"
                value={o.color}
                onChange={(color) => editOverlay(index, { color })}
              />
              <Slider
                label="Mức độ lớp phủ"
                value={o.amount}
                min={0}
                max={1}
                step={0.01}
                onChange={(amount) => editOverlay(index, { amount })}
              />
              {!["vignette", "frame", "letterbox"].includes(o.kind) && (
                <Slider
                  label="Tốc độ lớp phủ"
                  value={o.speed}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onChange={(speed) => editOverlay(index, { speed })}
                />
              )}
              {o.kind !== "flash" && (
                <Slider
                  label="Cỡ lớp phủ"
                  value={o.size}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onChange={(size) => editOverlay(index, { size })}
                />
              )}
              {![
                "vignette",
                "frame",
                "letterbox",
                "light-leak",
                "rays",
                "scanlines",
                "flash",
              ].includes(o.kind) && (
                <Numeric
                  label="Hạt giống ngẫu nhiên"
                  value={o.seed}
                  min={0}
                  max={99999}
                  step={1}
                  onChange={(seed) => editOverlay(index, { seed })}
                />
              )}
              <div className="two-columns">
                <Numeric
                  label="Bắt đầu lớp phủ (s)"
                  value={o.start}
                  min={0}
                  max={scene.duration}
                  onChange={(start) =>
                    editOverlay(index, {
                      start,
                      end: o.end === null ? null : Math.max(start, o.end),
                    })
                  }
                />
                <Numeric
                  label="Kết thúc lớp phủ (s)"
                  value={o.end ?? scene.duration}
                  min={o.start}
                  max={Math.max(o.start, scene.duration)}
                  onChange={(end) => editOverlay(index, { end })}
                />
              </div>
              <Check
                label="Lớp phủ đến cuối cảnh"
                checked={o.end === null}
                onChange={(checked) =>
                  editOverlay(index, {
                    end: checked ? null : Math.max(o.start, scene.duration),
                  })
                }
              />
            </div>
          </details>
        ))}
      </Group>
      <Group title="Keyframe vị trí ảnh">
        <p className="field-hint">
          Đặt giá trị ảnh ở tab Ảnh rồi ghi tại vạch phát. Có thể sửa từng mốc
          bên dưới. Keyframe được nội suy và kết hợp với preset chuyển động.
          {scene.motionOffset > 0 &&
            ` Cảnh này bắt đầu ở ${scene.motionOffset.toFixed(2)}s của chuyển động gốc; các mốc giữ thời gian gốc để không bị nhảy khi chia cảnh.`}
        </p>
        <button
          className="button full-width"
          disabled={scene.keyframes.length >= 100}
          onClick={() => {
            const time = Math.max(
                0,
                Math.min(scene.duration, Number(localTime.toFixed(3))),
              ),
              key = {
                time: time + scene.motionOffset,
                x: scene.x,
                y: scene.y,
                scale: scene.scale,
                rotate: scene.rotate,
                opacity: scene.opacity,
              };
            onChange({
              keyframes: [
                ...scene.keyframes.filter(
                  (k) => Math.abs(k.time - key.time) > 0.001,
                ),
                key,
              ].sort((a, b) => a.time - b.time),
            });
          }}
        >
          Ghi keyframe · {Math.max(0, localTime).toFixed(2)}s
        </button>
        {scene.keyframes.map((key, index) => (
          <details className="effect-card" key={index}>
            <summary>
              <span>
                Mốc {index + 1} · {key.time.toFixed(2)}s
              </span>
            </summary>
            <div className="effect-card-body">
              <Numeric
                label="Thời điểm mốc (s)"
                value={key.time}
                min={0}
                max={3600}
                step={0.01}
                onChange={(time) => editKey(index, { time })}
              />
              <div className="two-columns">
                <Numeric
                  label="Ngang mốc (%)"
                  value={key.x}
                  min={-100}
                  max={100}
                  onChange={(x) => editKey(index, { x })}
                />
                <Numeric
                  label="Dọc mốc (%)"
                  value={key.y}
                  min={-100}
                  max={100}
                  onChange={(y) => editKey(index, { y })}
                />
                <Numeric
                  label="Tỷ lệ mốc"
                  value={key.scale}
                  min={0.1}
                  max={5}
                  step={0.01}
                  onChange={(scale) => editKey(index, { scale })}
                />
                <Numeric
                  label="Xoay mốc"
                  value={key.rotate}
                  min={-360}
                  max={360}
                  onChange={(rotate) => editKey(index, { rotate })}
                />
              </div>
              <Slider
                label="Độ hiện mốc"
                value={key.opacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(opacity) => editKey(index, { opacity })}
              />
              <button
                className="text-button"
                onClick={() =>
                  onChange({
                    keyframes: scene.keyframes.filter((_, i) => i !== index),
                  })
                }
              >
                Xoá mốc
              </button>
            </div>
          </details>
        ))}
      </Group>
    </>
  );
}
