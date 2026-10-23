import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Asset } from "../model";
import {
  defaultImageProcessing,
  pixelRegion,
  type ImageProcessingSettings,
} from "../auto/image-processing";
import { Icon } from "../icons";
export type ImageRuntimeStatus = {
  python: boolean;
  missing: string[];
  lama: boolean;
  upscale2: boolean;
  upscale4: boolean;
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function ImageProcessingPanel({
  assets,
  settings,
  busy,
  progress,
  preview,
  onChange,
  onRun,
  onRestore,
  onCancel,
}: {
  assets: Asset[];
  settings: ImageProcessingSettings;
  busy: boolean;
  progress: string;
  preview: { id: string; src: string; key: string } | null;
  onChange: (settings: ImageProcessingSettings) => void;
  onRun: (assetId?: string) => void;
  onRestore: () => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(assets[0]?.id ?? "");
  const [showResult, setShowResult] = useState(false);
  const [status, setStatus] = useState<ImageRuntimeStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: "draw" | "move" | "resize";
    x: number;
    y: number;
    region: ImageProcessingSettings["region"];
  } | null>(null);
  const asset = assets.find((asset) => asset.id === selected) ?? assets[0];
  const source = asset?.original ?? asset;
  const result =
    preview?.id === asset?.id && preview.key === JSON.stringify(settings)
      ? preview
      : null;
  const output = showResult && result;
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/images/status", { signal: abort.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error);
        setStatus(body);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setStatusError(error.message);
      });
    return () => abort.abort();
  }, []);
  const disabled = busy || !asset;
  const runtimeReady =
    status &&
    status.python &&
    !status.missing.length &&
    (!settings.removeLogo || status.lama) &&
    (!settings.upscale ||
      (settings.scale === 2 ? status.upscale2 : status.upscale4));
  const region = source
    ? pixelRegion(settings.region, source.width, source.height)
    : null;
  const padded = source
    ? pixelRegion(
        settings.region,
        source.width,
        source.height,
        settings.padding,
      )
    : null;
  function patch(patch: Partial<ImageProcessingSettings>) {
    onChange({ ...settings, ...patch });
    setShowResult(false);
  }
  function updateRegion(next: Partial<ImageProcessingSettings["region"]>) {
    const region = { ...settings.region, ...next };
    region.width = clamp(region.width, 0.001, 1);
    region.height = clamp(region.height, 0.001, 1);
    region.x = clamp(region.x, 0, 1 - region.width);
    region.y = clamp(region.y, 0, 1 - region.height);
    patch({ region });
  }
  function point(event: PointerEvent) {
    const bounds = stage.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  }
  function start(event: PointerEvent, mode: "draw" | "move" | "resize") {
    if (disabled || output || !settings.removeLogo) return;
    event.preventDefault();
    event.stopPropagation();
    const p = point(event);
    drag.current = { ...p, mode, region: { ...settings.region } };
    stage.current?.setPointerCapture(event.pointerId);
  }
  const percent = (value: number) => Math.round(value * 10000) / 100;
  return (
    <div className="image-processing-panel">
      <fieldset disabled={busy}>
        <div className="image-processing-toggles">
          <label>
            <input
              type="checkbox"
              checked={settings.removeLogo}
              onChange={(e) => patch({ removeLogo: e.target.checked })}
            />
            Xóa logo · LaMa
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.upscale}
              onChange={(e) => patch({ upscale: e.target.checked })}
            />
            Tăng độ phân giải · Real-ESRGAN
          </label>
        </div>
        <p className="dialog-help">
          Xóa logo trước, upscale sau. Vùng chọn dùng cùng tỷ lệ trên tất cả
          ảnh. Ảnh gốc luôn được giữ lại.
        </p>
        <div className="image-processing-layout">
          <section aria-label="Chọn vùng xóa logo">
            <label className="image-processing-image-select">
              Ảnh kiểm tra
              <select
                value={asset?.id ?? ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setShowResult(false);
                }}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="image-processing-view-switch"
              role="group"
              aria-label="So sánh ảnh"
            >
              <button
                className="button"
                aria-pressed={!output}
                onClick={() => setShowResult(false)}
              >
                Ảnh gốc / vùng xóa
              </button>
              <button
                className="button"
                aria-pressed={Boolean(output)}
                disabled={!result}
                onClick={() => setShowResult(true)}
              >
                Kết quả xem thử
              </button>
            </div>
            {source ? (
              <div
                className="image-region-stage"
                ref={stage}
                style={{
                  width: Math.min(560, (320 * source.width) / source.height),
                  maxWidth: "100%",
                  aspectRatio: `${source.width}/${source.height}`,
                }}
                onPointerDown={(e) => start(e, "draw")}
                onPointerMove={(event) => {
                  const current = drag.current;
                  if (!current) return;
                  const p = point(event),
                    r = current.region;
                  if (current.mode === "move")
                    updateRegion({
                      x: r.x + p.x - current.x,
                      y: r.y + p.y - current.y,
                    });
                  else if (current.mode === "resize")
                    updateRegion({
                      width: clamp(r.width + p.x - current.x, 0.001, 1 - r.x),
                      height: clamp(r.height + p.y - current.y, 0.001, 1 - r.y),
                    });
                  else if (
                    Math.abs(p.x - current.x) > 0.002 &&
                    Math.abs(p.y - current.y) > 0.002
                  )
                    updateRegion({
                      x: Math.min(current.x, p.x),
                      y: Math.min(current.y, p.y),
                      width: Math.abs(p.x - current.x),
                      height: Math.abs(p.y - current.y),
                    });
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
              >
                <img
                  src={output ? output.src : source.src}
                  alt={
                    output
                      ? "Ảnh sau xử lý xem thử"
                      : "Ảnh gốc để chọn vùng logo"
                  }
                  draggable={false}
                />
                {settings.removeLogo && !output && (
                  <>
                    {padded && (
                      <div
                        className="image-region-padding"
                        style={{
                          left: `${(padded.x / source.width) * 100}%`,
                          top: `${(padded.y / source.height) * 100}%`,
                          width: `${(padded.width / source.width) * 100}%`,
                          height: `${(padded.height / source.height) * 100}%`,
                        }}
                      />
                    )}
                    <div
                      role="slider"
                      tabIndex={disabled ? -1 : 0}
                      aria-label="Vùng xóa logo: kéo để di chuyển, dùng phím mũi tên để tinh chỉnh"
                      aria-valuetext={
                        region
                          ? `X ${region.x}, Y ${region.y}, rộng ${region.width}, cao ${region.height} pixel`
                          : ""
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent(settings.region.x)}
                      className="image-region-box"
                      style={{
                        left: `${settings.region.x * 100}%`,
                        top: `${settings.region.y * 100}%`,
                        width: `${settings.region.width * 100}%`,
                        height: `${settings.region.height * 100}%`,
                      }}
                      onPointerDown={(e) => start(e, "move")}
                      onKeyDown={(e) => {
                        if (disabled) return;
                        const step = e.shiftKey ? 0.01 : 0.001;
                        const d = {
                          ArrowLeft: { x: settings.region.x - step },
                          ArrowRight: { x: settings.region.x + step },
                          ArrowUp: { y: settings.region.y - step },
                          ArrowDown: { y: settings.region.y + step },
                        }[e.key];
                        if (d) {
                          e.preventDefault();
                          updateRegion(d);
                        }
                      }}
                    >
                      <span
                        className="image-region-handle"
                        onPointerDown={(e) => start(e, "resize")}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="dialog-help">Thêm ảnh trước khi xử lý.</p>
            )}
            <p className="dialog-help">
              Kéo trên ảnh để vẽ vùng mới. Kéo khung để di chuyển; kéo góc dưới
              phải để đổi kích thước. Viền đứt là vùng mở rộng (padding).
            </p>
            {source && region && (
              <p className="image-region-readout">
                Ảnh gốc {source.width} × {source.height} px · X {region.x} · Y{" "}
                {region.y} · Rộng {region.width} · Cao {region.height} px
              </p>
            )}
          </section>
          <section
            className="image-processing-settings"
            aria-label="Thông số xử lý ảnh"
          >
            {settings.removeLogo && (
              <>
                <h3>Vùng logo</h3>
                <div className="image-region-fields">
                  {[
                    {
                      label: "Rộng logo (%)",
                      value: settings.region.width,
                      onChange: (v: number) =>
                        updateRegion({
                          width: v,
                          x:
                            settings.region.x +
                            settings.region.width -
                            clamp(v, 0.001, 1),
                        }),
                    },
                    {
                      label: "Cao logo (%)",
                      value: settings.region.height,
                      onChange: (v: number) =>
                        updateRegion({
                          height: v,
                          y:
                            settings.region.y +
                            settings.region.height -
                            clamp(v, 0.001, 1),
                        }),
                    },
                    {
                      label: "Cách mép phải (%)",
                      value: 1 - settings.region.x - settings.region.width,
                      onChange: (v: number) =>
                        updateRegion({ x: 1 - settings.region.width - v }),
                    },
                    {
                      label: "Cách mép dưới (%)",
                      value: 1 - settings.region.y - settings.region.height,
                      onChange: (v: number) =>
                        updateRegion({ y: 1 - settings.region.height - v }),
                    },
                  ].map((field) => (
                    <label key={field.label}>
                      {field.label}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={percent(field.value)}
                        onChange={(e) => {
                          if (e.target.value !== "")
                            field.onChange(Number(e.target.value) / 100);
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="button"
                  onClick={() =>
                    patch({ region: defaultImageProcessing().region })
                  }
                >
                  Đặt lại vùng góc dưới phải
                </button>
                <details className="compact-details">
                  <summary>Viền xóa và vùng ngữ cảnh</summary>
                  {(
                    [
                      {
                        key: "padding",
                        label: "Mở rộng vùng xóa",
                        max: 64,
                        hint: "Pixel ở ảnh gốc. Tăng để phủ hết viền logo; vùng bên ngoài viền đứt được giữ nguyên.",
                      },
                      {
                        key: "feather",
                        label: "Làm mềm viền",
                        max: 32,
                        hint: "Pixel làm mềm bên trong vùng xóa. 0 là viền sắc; tăng nhẹ nếu mép ghép bị rõ.",
                      },
                      {
                        key: "context",
                        label: "Ngữ cảnh quanh logo",
                        max: 256,
                        hint: "Pixel ảnh xung quanh đưa vào LaMa. Tăng khi nền cần nhiều chi tiết để khôi phục.",
                      },
                    ] as const
                  ).map((field) => (
                    <label key={field.key}>
                      {field.label} (px)
                      <input
                        type="number"
                        min={field.key === "context" ? 16 : 0}
                        max={field.max}
                        step={1}
                        value={settings[field.key]}
                        onChange={(e) => {
                          if (e.target.value !== "")
                            patch({
                              [field.key]: clamp(
                                Math.round(Number(e.target.value)),
                                field.key === "context" ? 16 : 0,
                                field.max,
                              ),
                            });
                        }}
                      />
                      <small>{field.hint}</small>
                    </label>
                  ))}
                </details>
              </>
            )}
            {settings.upscale && (
              <>
                <h3>Upscale</h3>
                <label>
                  Hệ số
                  <select
                    value={settings.scale}
                    onChange={(e) =>
                      patch({ scale: Number(e.target.value) as 2 | 4 })
                    }
                  >
                    <option value={2}>2× · gấp đôi mỗi chiều</option>
                    <option value={4}>4× · gấp bốn mỗi chiều</option>
                  </select>
                </label>
                {source && (
                  <p className="dialog-help">
                    Kết quả: {source.width * settings.scale} ×{" "}
                    {source.height * settings.scale} px. Xuất ảnh PNG giữ alpha.
                  </p>
                )}
                <details className="compact-details">
                  <summary>Thiết bị và bộ nhớ</summary>
                  <label>
                    Thiết bị
                    <select
                      value={settings.device}
                      onChange={(e) =>
                        patch({
                          device: e.target
                            .value as ImageProcessingSettings["device"],
                        })
                      }
                    >
                      <option value="auto">Tự động · CUDA → MPS → CPU</option>
                      <option value="mps">MPS · Apple Silicon</option>
                      <option value="cuda">CUDA · NVIDIA</option>
                      <option value="cpu">CPU</option>
                    </select>
                  </label>
                  <label>
                    Tile (px)
                    <select
                      value={settings.tile}
                      onChange={(e) => patch({ tile: Number(e.target.value) })}
                    >
                      {[64, 128, 256, 512].map((tile) => (
                        <option key={tile} value={tile}>
                          {tile}
                        </option>
                      ))}
                    </select>
                    <small>Tile nhỏ dùng ít bộ nhớ hơn, thường chậm hơn.</small>
                  </label>
                </details>
              </>
            )}
            <label className="image-auto-import">
              <input
                type="checkbox"
                checked={settings.autoOnImport}
                onChange={(e) => patch({ autoOnImport: e.target.checked })}
              />
              Tự xử lý ảnh nhập mới bằng cấu hình này
            </label>
          </section>
        </div>
        {!status && (
          <p className="dialog-help" role="status">
            {statusError || "Đang kiểm tra môi trường ảnh…"}
          </p>
        )}
        {status && !runtimeReady && (
          <div className="image-runtime-help">
            <strong>Chuẩn bị một lần trên máy</strong>
            {(!status.python || status.missing.length > 0) && (
              <p>
                Thiếu {status.missing.join(", ")}. Chạy <code>uv sync</code>{" "}
                trong dự án.
              </p>
            )}
            {settings.removeLogo && !status.lama && (
              <p>
                Đặt model ở <code>.cache/models/lama/lama_fp32.onnx</code>.
              </p>
            )}
            {settings.upscale &&
              !(settings.scale === 2 ? status.upscale2 : status.upscale4) && (
                <p>
                  Tải trọng số upscale:{" "}
                  <code>npm run setup:images -- --scale {settings.scale}</code>
                </p>
              )}
            <small>
              Cài/tải xong, đóng và mở lại cửa sổ để kiểm tra. Không cần API
              key.
            </small>
          </div>
        )}
        <div className="image-processing-actions">
          <button
            className="button"
            disabled={
              disabled ||
              !runtimeReady ||
              (!settings.removeLogo && !settings.upscale)
            }
            onClick={() => onRun(asset?.id)}
          >
            Xem thử ảnh này
          </button>
          <button
            className="button primary"
            disabled={
              disabled ||
              !runtimeReady ||
              (!settings.removeLogo && !settings.upscale)
            }
            onClick={() => onRun()}
          >
            <Icon name="image" />
            Xử lý toàn bộ {assets.length} ảnh
          </button>
          <button
            className="button"
            disabled={busy || !assets.some((asset) => asset.original)}
            onClick={onRestore}
          >
            Khôi phục tất cả ảnh gốc
          </button>
        </div>
      </fieldset>
      {busy && (
        <div className="image-processing-actions">
          <p role="status">{progress}</p>
          <button className="button" onClick={onCancel}>
            Dừng xử lý
          </button>
        </div>
      )}
      {result && !showResult && (
        <p className="dialog-help" role="status">
          Đã có kết quả xem thử. Bấm Kết quả xem thử để so sánh; ảnh dự án chưa
          thay đổi.
        </p>
      )}
    </div>
  );
}
