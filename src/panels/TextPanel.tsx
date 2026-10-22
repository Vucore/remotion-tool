import { textTemplate } from "../text-template";
import { useEffect, useRef, useState } from "react";
import {
  TEXT_PRESETS,
  TEXT_ANIMATIONS,
  TEXT_LOOPS,
  EASINGS,
  FONT_FAMILIES,
} from "../catalog";
import {
  id,
  makeText,
  type TextLayer,
  type Scene,
  type Project,
  type FontAsset,
} from "../model";
import {
  Action,
  Field,
  Numeric,
  Slider,
  Select,
  Check,
  Color,
  Group,
} from "./Controls";
export function TextPanel({
  scene,
  project,
  onChange,
  onFonts,
  onMessage,
  onPreview,
  activeId,
}: {
  scene: Scene;
  project: Project;
  onChange: (patch: Partial<Scene>) => void;
  onFonts: (fonts: FontAsset[]) => void;
  onMessage: (m: string) => void;
  onPreview: (time: number) => void;
  activeId?: string;
}) {
  const [active, setActive] = useState(scene.texts[0]?.id ?? "");
  useEffect(() => {
    if (activeId && scene.texts.some((t) => t.id === activeId))
      setActive(activeId);
  }, [activeId, scene.texts]);
  const [preset, setPreset] = useState("basic");
  const [fontBusy, setFontBusy] = useState(false);
  const fontInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!scene.texts.some((t) => t.id === active))
      setActive(scene.texts[0]?.id ?? "");
  }, [active, scene.texts]);
  const text = scene.texts.find((t) => t.id === active);
  const patch = (change: Partial<TextLayer>) =>
    onChange({
      texts: scene.texts.map((t) =>
        t.id === active
          ? {
              ...t,
              ...change,
              ...("start" in change || "end" in change
                ? { offset: 0, span: null }
                : {}),
            }
          : t,
      ),
    });
  const move = (direction: number) => {
    const texts = [...scene.texts],
      index = texts.findIndex((t) => t.id === active);
    if (index + direction < 0 || index + direction >= texts.length) return;
    [texts[index], texts[index + direction]] = [
      texts[index + direction],
      texts[index],
    ];
    onChange({ texts });
  };
  async function importFont(file?: File) {
    if (!file) return;
    setFontBusy(true);
    try {
      if (project.fonts.length >= 30) throw new Error("Tối đa 30 font.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Font tối đa 5 MB.");
      const response = await fetch(
        `/api/fonts?name=${encodeURIComponent(file.name)}`,
        { method: "POST", body: file },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onFonts([...project.fonts, result]);
      if (text) patch({ fontFamily: result.id });
      onMessage(`Đã thêm font ${result.name}.`);
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "Không nhập được font.",
      );
    } finally {
      setFontBusy(false);
    }
  }
  const animations =
    text?.shape === "normal"
      ? TEXT_ANIMATIONS
      : Object.fromEntries(
          Object.entries(TEXT_ANIMATIONS).filter(
            ([key]) =>
              !key.startsWith("letter") &&
              !key.startsWith("word") &&
              !key.startsWith("typewriter"),
          ),
        );
  return (
    <>
      <section className="control-section">
        <h3>
          Chữ trên ảnh <span>{scene.texts.length}/30</span>
        </h3>
        <Select
          label="Mẫu chữ"
          value={preset}
          options={TEXT_PRESETS}
          onChange={setPreset}
        />
        <div className="row-buttons">
          <button
            type="button"
            className="button primary"
            disabled={scene.texts.length >= 30}
            onClick={() => {
              const next = {
                ...makeText(),
                ...textTemplate(preset),
                name: `Chữ ${scene.texts.length + 1}`,
              };
              onChange({ texts: [...scene.texts, next] });
              setActive(next.id);
            }}
          >
            Thêm chữ
          </button>
          <button
            className="text-button"
            disabled={!text}
            onClick={() => patch(textTemplate(preset))}
          >
            Áp mẫu vào lớp
          </button>
        </div>
      </section>
      <div className="text-layer-list">
        {scene.texts.map((t, index) => (
          <div
            key={t.id}
            className={`text-layer-row ${active === t.id ? "active" : ""}`}
          >
            <button onClick={() => setActive(t.id)}>
              <b>{index + 1}</b>
              <span>{t.name || t.text || "Chữ trống"}</span>
            </button>
            <Action
              icon={t.visible ? "check" : "close"}
              label={t.visible ? "Ẩn lớp chữ" : "Hiện lớp chữ"}
              onClick={() =>
                onChange({
                  texts: scene.texts.map((layer) =>
                    layer.id === t.id
                      ? { ...layer, visible: !layer.visible }
                      : layer,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      {text && (
        <>
          <div className="layer-actions">
            <Action
              icon="back"
              label="Đưa chữ xuống dưới"
              disabled={scene.texts[0].id === active}
              onClick={() => move(-1)}
            />
            <Action
              icon="next"
              label="Đưa chữ lên trên"
              disabled={scene.texts.at(-1)?.id === active}
              onClick={() => move(1)}
            />
            <Action
              icon="copy"
              label="Nhân bản lớp chữ"
              disabled={scene.texts.length >= 30}
              onClick={() => {
                const next = {
                  ...text,
                  id: id(),
                  name: `${text.name} (bản sao)`,
                };
                onChange({ texts: [...scene.texts, next] });
                setActive(next.id);
              }}
            />
            <Action
              icon="trash"
              label="Xoá lớp chữ"
              onClick={() =>
                onChange({ texts: scene.texts.filter((t) => t.id !== active) })
              }
            />
          </div>
          <Group title="Nội dung & font" open>
            <Field label="Tên lớp">
              <input
                value={text.name}
                maxLength={100}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field
              label={
                text.captions
                  ? `${text.captions.length} câu từ TXT`
                  : "Nội dung"
              }
            >
              <textarea
                rows={3}
                maxLength={2000}
                value={
                  text.captions
                    ? text.captions.map((c) => c.text).join("\n")
                    : text.text
                }
                readOnly={Boolean(text.captions)}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </Field>
            {text.captions && (
              <p className="field-hint">
                Nội dung và mốc câu được căn theo WAV. Sửa TXT rồi dựng lại để
                cập nhật; các thiết lập kiểu chữ áp dụng cho mọi câu.
              </p>
            )}
            <Select
              label="Font chữ"
              value={text.fontFamily}
              options={Object.fromEntries([
                ...FONT_FAMILIES.map((f) => [f, f]),
                ...project.fonts.map((f) => [f.id, f.name]),
              ])}
              onChange={(fontFamily) => patch({ fontFamily })}
            />
            <input
              ref={fontInput}
              hidden
              type="file"
              accept=".woff2,.woff,.ttf,.otf"
              onChange={(e) => {
                void importFont(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              className="button full-width"
              disabled={fontBusy}
              onClick={() => fontInput.current?.click()}
            >
              {fontBusy ? "Đang nhập font…" : "Thêm font từ máy"}
            </button>
            <p className="field-hint">
              WOFF/WOFF2/TTF/OTF · tối đa 5 MB. Font hệ thống phụ thuộc máy;
              font nhập sẽ dùng chung cho preview và MP4.
            </p>
            <Slider
              label="Cỡ chữ"
              value={text.size}
              min={8}
              max={400}
              onChange={(size) => patch({ size })}
            />
            <Select
              label="Độ đậm"
              value={String(text.weight)}
              options={Object.fromEntries(
                [100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [
                  String(n),
                  String(n),
                ]),
              )}
              onChange={(value) =>
                patch({ weight: Number(value), bold: Number(value) >= 600 })
              }
            />
            <div className="two-columns">
              <Check
                label="Nghiêng"
                checked={text.italic}
                onChange={(italic) => patch({ italic })}
              />
              <Check
                label="Hiện lớp"
                checked={text.visible}
                onChange={(visible) => patch({ visible })}
              />
            </div>
            <Select
              label="Trang trí"
              value={text.decoration}
              options={{
                none: "Không",
                underline: "Gạch chân",
                "line-through": "Gạch ngang",
                overline: "Gạch trên",
              }}
              onChange={(decoration) =>
                patch({ decoration: decoration as TextLayer["decoration"] })
              }
            />
            <Select
              label="Chữ hoa / thường"
              value={text.casing}
              options={{
                none: "Giữ nguyên",
                uppercase: "CHỮ HOA",
                lowercase: "chữ thường",
                capitalize: "Hoa Đầu Từ",
              }}
              onChange={(casing) =>
                patch({ casing: casing as TextLayer["casing"] })
              }
            />
          </Group>
          <Group title="Màu sắc & trang trí">
            <Select
              label="Kiểu tô chữ"
              value={text.fill}
              options={{
                solid: "Một màu",
                gradient: "Chuyển sắc",
                outline: "Chữ rỗng",
              }}
              onChange={(fill) =>
                patch({
                  fill: fill as TextLayer["fill"],
                  ...(fill === "outline" && text.stroke === 0
                    ? { stroke: 2 }
                    : {}),
                })
              }
            />
            <Color
              label="Màu chữ"
              value={text.color}
              onChange={(color) => patch({ color })}
            />
            {text.fill === "gradient" && (
              <>
                <Color
                  label="Màu chuyển tới"
                  value={text.gradientColor}
                  onChange={(gradientColor) => patch({ gradientColor })}
                />
                <Slider
                  label="Góc gradient"
                  value={text.gradientAngle}
                  min={0}
                  max={360}
                  onChange={(gradientAngle) => patch({ gradientAngle })}
                />
              </>
            )}
            <Color
              label="Nền chữ"
              value={text.background}
              transparent
              onChange={(background) => patch({ background })}
            />
            <div className="two-columns">
              <Numeric
                label="Đệm nền"
                min={0}
                max={100}
                step={1}
                value={text.padding}
                onChange={(padding) => patch({ padding })}
              />
              <Numeric
                label="Bo góc"
                min={0}
                max={100}
                step={1}
                value={text.radius}
                onChange={(radius) => patch({ radius })}
              />
            </div>
            <Slider
              label="Viền chữ"
              value={text.stroke}
              min={0}
              max={20}
              step={0.5}
              onChange={(stroke) => patch({ stroke })}
            />
            <Color
              label="Màu viền"
              value={text.strokeColor}
              onChange={(strokeColor) => patch({ strokeColor })}
            />
            <Slider
              label="Bóng mềm"
              value={text.shadow}
              min={0}
              max={100}
              onChange={(shadow) => patch({ shadow })}
            />
            <Color
              label="Màu bóng / khối"
              value={text.shadowColor}
              onChange={(shadowColor) => patch({ shadowColor })}
            />
            <div className="two-columns">
              <Numeric
                label="Bóng ngang"
                value={text.shadowX}
                min={-100}
                max={100}
                onChange={(shadowX) => patch({ shadowX })}
              />
              <Numeric
                label="Bóng dọc"
                value={text.shadowY}
                min={-100}
                max={100}
                onChange={(shadowY) => patch({ shadowY })}
              />
            </div>
            <Slider
              label="Phát sáng"
              value={text.glow}
              min={0}
              max={100}
              onChange={(glow) => patch({ glow })}
            />
            <Slider
              label="Độ dày khối giả 3D"
              value={text.depth}
              min={0}
              max={30}
              onChange={(depth) => patch({ depth })}
            />
            <Slider
              label="Độ hiện"
              value={text.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(opacity) => patch({ opacity })}
            />
          </Group>
          <Group title="Vị trí & bố cục">
            <div className="two-columns">
              <Numeric
                label="Ngang (%)"
                value={text.x}
                min={0}
                max={100}
                onChange={(x) => patch({ x })}
              />
              <Numeric
                label="Dọc (%)"
                value={text.y}
                min={0}
                max={100}
                onChange={(y) => patch({ y })}
              />
            </div>
            <Select
              label="Căn chữ"
              value={text.align}
              options={{ left: "Trái", center: "Giữa", right: "Phải" }}
              onChange={(align) =>
                patch({ align: align as TextLayer["align"] })
              }
            />
            <Slider
              label="Chiều rộng tối đa (%)"
              value={text.width}
              min={5}
              max={100}
              onChange={(width) => patch({ width })}
            />
            <Slider
              label="Giãn ký tự"
              value={text.letterSpacing}
              min={-20}
              max={80}
              step={0.5}
              onChange={(letterSpacing) => patch({ letterSpacing })}
            />
            <Slider
              label="Giãn dòng"
              value={text.lineHeight}
              min={0.5}
              max={3}
              step={0.05}
              onChange={(lineHeight) => patch({ lineHeight })}
            />
            <Slider
              label="Xoay chữ"
              value={text.rotate}
              min={-360}
              max={360}
              onChange={(rotate) => patch({ rotate })}
            />
            <Slider
              label="Tỷ lệ chữ"
              value={text.scale}
              min={0.1}
              max={5}
              step={0.05}
              onChange={(scale) => patch({ scale })}
            />
            <Slider
              label="Nghiêng khung"
              value={text.skew}
              min={-60}
              max={60}
              onChange={(skew) => patch({ skew })}
            />
            <Select
              label="Hướng viết"
              value={text.writing}
              options={{
                "horizontal-tb": "Ngang",
                "vertical-rl": "Dọc phải → trái",
                "vertical-lr": "Dọc trái → phải",
              }}
              onChange={(writing) =>
                patch({ writing: writing as TextLayer["writing"] })
              }
            />
            <Select
              label="Đường chữ"
              value={text.shape}
              options={{
                normal: "Thẳng",
                "arc-up": "Cong lên",
                "arc-down": "Cong xuống",
              }}
              onChange={(shape) =>
                patch({
                  shape: shape as TextLayer["shape"],
                  ...(shape !== "normal"
                    ? {
                        animationIn: "fade",
                        animationOut: "fade",
                        loop: "none",
                        writing: "horizontal-tb",
                      }
                    : {}),
                })
              }
            />
            {text.shape !== "normal" && (
              <>
                <Slider
                  label="Độ cong"
                  value={text.arc}
                  min={5}
                  max={100}
                  onChange={(arc) => patch({ arc })}
                />
                <p className="field-hint">
                  Chữ cong hiển thị trên một đường SVG; animation áp dụng cho
                  toàn đường chữ.
                </p>
              </>
            )}
          </Group>
          <Group title="Thời gian & chuyển động" open>
            {!text.captions && (
              <>
                <div className="two-columns">
                  <Numeric
                    label="Bắt đầu (s)"
                    value={text.start}
                    min={0}
                    max={scene.duration}
                    onChange={(start) =>
                      patch({
                        start,
                        end:
                          text.end !== null ? Math.max(text.end, start) : null,
                      })
                    }
                  />
                  <Numeric
                    label="Kết thúc (s)"
                    value={text.end ?? scene.duration}
                    min={text.start}
                    max={Math.max(text.start, scene.duration)}
                    onChange={(end) => patch({ end })}
                  />
                </div>
                <Check
                  label="Giữ đến cuối cảnh"
                  checked={text.end === null}
                  onChange={(checked) =>
                    patch({ end: checked ? null : scene.duration })
                  }
                />
              </>
            )}
            <Select
              label="Chữ vào"
              value={text.animationIn}
              options={animations}
              onChange={(animationIn) =>
                patch({ animationIn: animationIn as TextLayer["animationIn"] })
              }
            />
            <Numeric
              label="Thời gian vào (s)"
              value={text.inDuration}
              min={0.05}
              max={10}
              step={0.05}
              onChange={(inDuration) => patch({ inDuration })}
            />
            <Select
              label="Chữ ra"
              value={text.animationOut}
              options={animations}
              onChange={(animationOut) =>
                patch({
                  animationOut: animationOut as TextLayer["animationOut"],
                })
              }
            />
            <Numeric
              label="Thời gian ra (s)"
              value={text.outDuration}
              min={0.05}
              max={10}
              step={0.05}
              onChange={(outDuration) => patch({ outDuration })}
            />
            <Numeric
              label="Độ trễ ký tự / từ (s)"
              value={text.stagger}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(stagger) => patch({ stagger })}
            />
            <Select
              label="Nhịp chuyển động"
              value={text.easing}
              options={EASINGS}
              onChange={(easing) =>
                patch({ easing: easing as TextLayer["easing"] })
              }
            />
            <Select
              label="Chuyển động lặp"
              value={text.loop}
              options={TEXT_LOOPS}
              onChange={(loop) => patch({ loop: loop as TextLayer["loop"] })}
            />
            <Slider
              label="Tốc độ lặp"
              value={text.loopSpeed}
              min={0.1}
              max={5}
              step={0.1}
              onChange={(loopSpeed) => patch({ loopSpeed })}
            />
            <button
              className="button full-width"
              onClick={() => onPreview(text.start)}
            >
              Xem từ đầu chữ
            </button>
            <p className="field-hint">
              Khi cảnh quá ngắn, thời gian vào/ra và độ trễ được tự giới hạn để
              chữ vẫn đọc được.
            </p>
          </Group>
          <Group title="Số đếm động">
            <Check
              label="Đổi nội dung thành số đếm"
              checked={text.counter}
              onChange={(counter) => patch({ counter })}
            />
            {text.counter && (
              <>
                <div className="two-columns">
                  <Numeric
                    label="Từ số"
                    value={text.countFrom}
                    min={-1e9}
                    max={1e9}
                    onChange={(countFrom) => patch({ countFrom })}
                  />
                  <Numeric
                    label="Đến số"
                    value={text.countTo}
                    min={-1e9}
                    max={1e9}
                    onChange={(countTo) => patch({ countTo })}
                  />
                </div>
                <Numeric
                  label="Số lẻ thập phân"
                  value={text.decimals}
                  min={0}
                  max={5}
                  step={1}
                  onChange={(decimals) => patch({ decimals })}
                />
                <Field label="Tiền tố">
                  <input
                    value={text.prefix}
                    maxLength={100}
                    onChange={(e) => patch({ prefix: e.target.value })}
                  />
                </Field>
                <Field label="Hậu tố">
                  <input
                    value={text.suffix}
                    maxLength={100}
                    onChange={(e) => patch({ suffix: e.target.value })}
                  />
                </Field>
              </>
            )}
          </Group>
        </>
      )}
    </>
  );
}
