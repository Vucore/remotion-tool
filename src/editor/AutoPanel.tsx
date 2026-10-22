import { useEffect, useRef, useState } from "react";
import {
  AUTO_TEMPLATES,
  defaultAutoConfig,
  parseAutoConfig,
  type AutoConfig,
} from "../auto/config";
import type { Asset, Project } from "../model";
import { Icon } from "../icons";
import { Field, Numeric, Select } from "../panels/Controls";

export function saveJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AutoPanel({
  project,
  uploading,
  busy,
  onImport,
  onBuild,
  onExample,
}: {
  project: Project;
  uploading: boolean;
  busy: boolean;
  onImport: (files: File[]) => Promise<Asset[]>;
  onBuild: (
    config: AutoConfig,
    exportNow: boolean,
    keep: boolean,
  ) => Promise<void>;
  onExample: () => void;
}) {
  const [config, setConfig] = useState(
    () => project.automation?.config ?? defaultAutoConfig(),
  );
  const [draft, setDraft] = useState(() => JSON.stringify(config, null, 2));
  const [configName, setConfigName] = useState("Config mặc định");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [keep, setKeep] = useState(true);
  const [over, setOver] = useState(false);
  const photos = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null),
    recipe = useRef<HTMLInputElement>(null),
    captions = useRef<HTMLInputElement>(null);
  const disabled = busy || uploading || working;
  const change = (next: AutoConfig) => {
    setConfig(next);
    setDraft(JSON.stringify(next, null, 2));
    setError("");
  };
  useEffect(() => {
    if (project.automation?.config) {
      setConfig(project.automation.config);
      setDraft(JSON.stringify(project.automation.config, null, 2));
    }
  }, [project.automation?.config]);
  async function jsonFile(file: File) {
    if (file.size > 16 * 1024 * 1024)
      throw Error(`${file.name}: JSON tối đa 16 MB.`);
    return JSON.parse(await file.text());
  }
  async function receive(files: File[]) {
    setWorking(true);
    setError("");
    try {
      let next = config;
      const jsons = files.filter((f) => /\.json$/i.test(f.name));
      const parsed = await Promise.all(
        jsons.map(async (file) => ({ file, data: await jsonFile(file) })),
      );
      const recipes = parsed.filter(
        (item) => item.data?.autoEditVersion !== undefined,
      );
      if (recipes.length > 1)
        throw Error("Chọn một file config cho mỗi lần dựng.");
      if (recipes[0]) {
        next = parseAutoConfig(recipes[0].data);
        setConfigName(recipes[0].file.name);
      }
      if (next.text.source === "file") {
        const expected = next.text.file.split(/[\\/]/).at(-1);
        const caption = parsed.find(
          (item) => item.file.name === expected && !recipes.includes(item),
        );
        if (caption)
          next = parseAutoConfig({
            ...next,
            text: { ...next.text, captions: caption.data },
          });
      }
      const images = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
      if (!images.length && !jsons.length)
        throw Error("Chọn bộ ảnh PNG/JPG/WebP hoặc file config JSON.");
      if (images.length) await onImport(images);
      change(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được đầu vào.");
    } finally {
      setWorking(false);
    }
  }
  async function build(exportNow: boolean) {
    setWorking(true);
    setError("");
    try {
      await onBuild(parseAutoConfig(config), exportNow, keep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không dựng được video.");
    } finally {
      setWorking(false);
    }
  }
  const readInput = (files: FileList | null) => {
    if (files?.length) void receive(Array.from(files));
  };
  return (
    <aside className="auto-panel" aria-label="Dựng tự động từ ảnh và config">
      <div className="panel-title">
        <h2>Dựng tự động</h2>
        <span className="count">{project.assets.length} ảnh</span>
      </div>
      <p className="panel-intro muted">
        Đưa bộ ảnh và config vào. Công cụ tự dựng toàn bộ và xuất MP4.
      </p>
      <fieldset disabled={disabled}>
        <input
          ref={photos}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/json,.json"
          multiple
          hidden
          onChange={(e) => {
            readInput(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folder}
          type="file"
          multiple
          hidden
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            readInput(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={recipe}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            readInput(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={captions}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              change(
                parseAutoConfig({
                  ...config,
                  text: { ...config.text, captions: await jsonFile(file) },
                }),
              );
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Nội dung chữ không hợp lệ.",
              );
            }
          }}
        />
        <button
          type="button"
          className={`auto-drop ${over ? "drag-over" : ""}`}
          onClick={() => photos.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled) void receive(Array.from(e.dataTransfer.files));
          }}
        >
          <Icon name="upload" size={24} />
          <strong>
            {uploading ? "Đang nhập ảnh…" : "Thả bộ ảnh + config"}
          </strong>
          <span>
            {project.assets.length
              ? "Nhập ảnh mới sẽ thay bộ ảnh · có thể hoàn tác"
              : "hoặc bấm để chọn nhiều file"}
          </span>
        </button>
        <div className="auto-input-actions">
          <button
            type="button"
            className="button"
            onClick={() => folder.current?.click()}
          >
            <Icon name="folder" size={16} />
            Chọn thư mục
          </button>
          <button
            type="button"
            className="button"
            onClick={() => recipe.current?.click()}
          >
            Nạp config
          </button>
        </div>
        {project.assets.length > 0 && (
          <div className="auto-asset-summary">
            <div>
              {project.assets.slice(0, 4).map((a) => (
                <img key={a.id} src={a.src} alt={a.name} />
              ))}
            </div>
            <span>
              {project.assets.length} ảnh trong thư viện · toàn bộ sẽ được dùng
            </span>
          </div>
        )}
        <p className="auto-config-name">
          <Icon name="settings" size={15} />
          {configName}
        </p>
        <Field label="Mẫu dựng">
          <select
            value={config.template}
            onChange={(e) =>
              change(
                parseAutoConfig({
                  autoEditVersion: 1,
                  template: e.target.value,
                  input: config.input,
                  output: config.output,
                  timing: config.timing,
                  text: config.text,
                  seed: config.seed,
                }),
              )
            }
          >
            {Object.entries(AUTO_TEMPLATES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="auto-two">
          <Select
            label="Tỷ lệ"
            value={config.output.ratio}
            options={{ "9:16": "9:16 · Dọc", "16:9": "16:9 · Ngang" }}
            onChange={(value) =>
              change({
                ...config,
                output: {
                  ...config.output,
                  ratio: value as AutoConfig["output"]["ratio"],
                },
              })
            }
          />
          <Numeric
            label={
              config.timing.mode === "total" ? "Tổng số giây" : "Giây mỗi ảnh"
            }
            min={0.5}
            max={config.timing.mode === "total" ? 3600 : 300}
            value={config.timing.seconds}
            step={0.5}
            onChange={(seconds) =>
              change({ ...config, timing: { ...config.timing, seconds } })
            }
          />
        </div>
        {config.text.source === "file" && (
          <div className="auto-caption-file">
            <span>
              {Object.keys(config.text.captions).length} mục chữ ·{" "}
              {config.text.file}
            </span>
            <button
              type="button"
              className="button"
              onClick={() => captions.current?.click()}
            >
              Nạp nội dung chữ
            </button>
          </div>
        )}
        {Boolean(project.automation?.locks.length) && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
            />
            Giữ {project.automation!.locks.length} cảnh đã chỉnh khi dựng lại
          </label>
        )}
        <div className="auto-build-actions">
          <button
            type="button"
            className="button primary full-width"
            disabled={!project.assets.length}
            onClick={() => void build(true)}
          >
            <Icon name="effect" />
            {working ? "Đang chuẩn bị…" : "Tạo và xuất MP4"}
          </button>
          <button
            type="button"
            className="button full-width"
            disabled={!project.assets.length}
            onClick={() => void build(false)}
          >
            Chỉ dựng để xem trước
          </button>
        </div>
        <div className="auto-input-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => saveJson("auto-edit.config.json", config)}
          >
            Lưu config dùng lại
          </button>
          <button type="button" className="text-button" onClick={onExample}>
            Dùng ảnh mẫu
          </button>
        </div>
        <details className="auto-advanced">
          <summary>Cấu hình nâng cao</summary>
          <Select
            label="Cách chia thời lượng"
            value={config.timing.mode}
            options={{
              "per-image": "Theo mỗi ảnh",
              total: "Theo tổng thời lượng",
            }}
            onChange={(mode) =>
              change({
                ...config,
                timing: {
                  ...config.timing,
                  mode: mode as AutoConfig["timing"]["mode"],
                },
              })
            }
          />
          {config.timing.mode === "total" && (
            <div className="auto-two">
              <Numeric
                label="Ít nhất (s/ảnh)"
                value={config.timing.minSeconds}
                min={0.5}
                max={300}
                onChange={(minSeconds) =>
                  change({
                    ...config,
                    timing: { ...config.timing, minSeconds },
                  })
                }
              />
              <Numeric
                label="Nhiều nhất (s/ảnh)"
                value={config.timing.maxSeconds}
                min={0.5}
                max={300}
                onChange={(maxSeconds) =>
                  change({
                    ...config,
                    timing: { ...config.timing, maxSeconds },
                  })
                }
              />
            </div>
          )}
          <Select
            label="Nguồn chữ"
            value={config.text.source}
            options={{
              none: "Không dùng chữ",
              filename: "Từ tên ảnh",
              static: "Nội dung chung",
              file: "Từ captions.json",
            }}
            onChange={(source) =>
              change({
                ...config,
                text: {
                  ...config.text,
                  source: source as AutoConfig["text"]["source"],
                },
              })
            }
          />
          {config.text.source === "static" && (
            <Field label="Nội dung chung">
              <textarea
                value={config.text.content}
                maxLength={2000}
                onChange={(e) =>
                  change({
                    ...config,
                    text: { ...config.text, content: e.target.value },
                  })
                }
              />
            </Field>
          )}
          <Select
            label="Khung ảnh"
            value={config.framing.fit}
            options={{ cover: "Lấp đầy", contain: "Giữ toàn ảnh" }}
            onChange={(fit) =>
              change({
                ...config,
                framing: {
                  ...config.framing,
                  fit: fit as AutoConfig["framing"]["fit"],
                },
              })
            }
          />
          <Select
            label="Sắp xếp ảnh"
            value={config.input.order}
            options={{
              natural: "Theo tên: 1, 2, 10",
              name: "Theo tên ký tự",
              input: "Theo thứ tự nhập",
            }}
            onChange={(order) =>
              change({
                ...config,
                input: {
                  ...config.input,
                  order: order as AutoConfig["input"]["order"],
                },
              })
            }
          />
          <Field label="JSON config">
            <textarea
              className="config-source"
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="button"
            onClick={() => {
              try {
                change(parseAutoConfig(JSON.parse(draft)));
                setConfigName("Config đã chỉnh");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "JSON sai định dạng.",
                );
              }
            }}
          >
            Áp dụng JSON
          </button>
        </details>
      </fieldset>
      {error && (
        <p role="alert" className="inline-error auto-error">
          {error}
        </p>
      )}
    </aside>
  );
}
