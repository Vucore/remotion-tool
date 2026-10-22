import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUTO_TEMPLATES,
  defaultAutoConfig,
  parseAutoConfig,
  type AutoConfig,
} from "../auto/config";
import type { Project } from "../model";
import { Icon } from "../icons";
import { Field, Numeric, Select } from "../panels/Controls";
import { pairNarration } from "../auto/narration";
import { isActorPath } from "../actors/import";
import type { ActorDefinition, ActorImportOptions } from "../actors/types";
import { ActorPanel } from "./ActorPanel";
import { TEXT_PRESETS } from "../catalog";

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
  onImportActors,
  onActorLibrary,
  onConfig,
  onEditObjects,
}: {
  project: Project;
  uploading: boolean;
  busy: boolean;
  onImport: (files: File[], config: AutoConfig) => Promise<AutoConfig>;
  onBuild: (
    config: AutoConfig,
    exportNow: boolean,
    keep: boolean,
    signal: AbortSignal,
    onProgress: (message: string) => void,
  ) => Promise<void>;
  onExample: () => void;
  onImportActors: (
    files: File[],
    options: ActorImportOptions,
    config: AutoConfig,
  ) => Promise<ActorDefinition[]>;
  onActorLibrary: (actors: ActorDefinition[]) => void;
  onConfig: (config: AutoConfig) => void;
  onEditObjects: () => void;
}) {
  const [config, setConfig] = useState(
    () => project.automation?.config ?? defaultAutoConfig(),
  );
  const [draft, setDraft] = useState(() => JSON.stringify(config, null, 2));
  const [configName, setConfigName] = useState("Mẫu kể chuyện của tôi");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const buildController = useRef<AbortController | null>(null);
  const [keep, setKeep] = useState(true);
  const [over, setOver] = useState(false);
  const photos = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null),
    recipe = useRef<HTMLInputElement>(null),
    captions = useRef<HTMLInputElement>(null);
  const disabled = busy || uploading || working;
  const chosenActors = config.characters.selected.length
    ? (project.actors ?? []).filter((a) =>
        config.characters.selected.includes(a.id),
      )
    : (project.actors ?? []);
  const actorError =
    config.characters.enabled && !chosenActors.length
      ? "Thêm bộ nhân vật hoặc tắt tự thêm nhân vật."
      : config.characters.enabled &&
          config.characters.cast === "all" &&
          chosenActors.length > 4
        ? "Chọn tối đa 4 nhân vật cùng xuất hiện hoặc dùng luân phiên."
        : "";
  const pairing = useMemo(() => {
    if (!config.narration.enabled) return { pairs: [], error: "" };
    try {
      if (!project.voiceover)
        throw Error("Thêm WAV và một file TXT đánh số mục 1., 2., 3.…");
      return {
        pairs: pairNarration(project.assets, project.voiceover),
        error: "",
      };
    } catch (error) {
      return {
        pairs: [],
        error:
          error instanceof Error ? error.message : "Chưa đủ đầu vào voice.",
      };
    }
  }, [config.narration.enabled, project.assets, project.voiceover]);
  useEffect(() => () => buildController.current?.abort(), []);
  const change = (next: AutoConfig) => {
    setConfig(next);
    setDraft(JSON.stringify(next, null, 2));
    setError("");
    onConfig(next);
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
        (item) =>
          item.data?.autoEditVersion !== undefined ||
          item.data?.presetVersion === 1,
      );
      if (recipes.length > 1)
        throw Error("Chọn một mẫu dựng cho mỗi lần nhập.");
      if (recipes[0]) {
        const recipe = recipes[0].data;
        next = parseAutoConfig(
          recipe.presetVersion === 1 ? recipe.config : recipe,
        );
        setConfigName(
          typeof recipe.name === "string"
            ? recipe.name.slice(0, 100)
            : recipes[0].file.name.replace(/\.(khung-preset\.)?json$/i, ""),
        );
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
      const voices = files.filter(
        (f) =>
          /\.wav$/i.test(f.name) &&
          !isActorPath(f.webkitRelativePath || f.name),
      );
      const texts = files.filter(
        (f) =>
          /\.txt$/i.test(f.name) &&
          !isActorPath(f.webkitRelativePath || f.name),
      );
      if (!images.length && !jsons.length && !voices.length && !texts.length)
        throw Error("Chọn ảnh PNG/JPG/WebP, WAV, một TXT hoặc config JSON.");
      if (voices.length || texts.length)
        next = {
          ...next,
          narration: {
            ...next.narration,
            enabled: true,
            ...(texts[0] ? { script: `./${texts[0].name}` } : {}),
          },
        };
      if (images.length || voices.length || texts.length)
        next = await onImport(files, next);
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
    const controller = new AbortController();
    buildController.current = controller;
    setProgress("Đang chuẩn bị bản dựng…");
    try {
      await onBuild(
        parseAutoConfig(config),
        exportNow,
        keep,
        controller.signal,
        setProgress,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không dựng được video.");
    } finally {
      setWorking(false);
      buildController.current = null;
      setProgress("");
    }
  }
  const readInput = (files: FileList | null) => {
    if (files?.length) void receive(Array.from(files));
  };
  return (
    <aside
      className="auto-panel"
      aria-label="Dựng tự động từ ảnh, voice và kịch bản"
    >
      <div className="panel-title">
        <h2>Dựng tự động</h2>
        <span className="count">{project.assets.length} ảnh</span>
      </div>
      <p className="panel-intro muted">
        Chọn bộ đầu vào và mẫu dựng. Công cụ tự khớp ảnh, voice, phụ đề và xuất
        video. Đặt nhân vật, vật thể theo từng ảnh khi cần.
      </p>
      <fieldset disabled={disabled}>
        <input
          ref={photos}
          type="file"
          accept="image/png,image/jpeg,image/webp,audio/wav,.wav,text/plain,.txt,application/json,.json"
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
            {uploading ? "Đang nhập đầu vào…" : "Thả ảnh + WAV + TXT"}
          </strong>
          <span>
            {project.assets.length
              ? "Có thể bổ sung từng loại file hoặc thư mục nhân vật"
              : "Chọn cả bộ cùng lúc · không cần file config"}
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
            Mở mẫu đã lưu
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
        {config.narration.enabled && (
          <section
            className="auto-voice-summary"
            aria-label="Ghép ảnh và voice"
          >
            <strong>
              {project.voiceover?.assets.length ?? 0} WAV ·{" "}
              {project.voiceover?.scriptName || "Chưa có TXT"}
            </strong>
            {pairing.error ? (
              <p className="inline-error">{pairing.error}</p>
            ) : (
              <>
                <p>
                  {pairing.pairs.length} cảnh đã khớp · thời lượng theo voice
                </p>
                <details>
                  <summary>Xem các cặp ảnh, voice và lời đọc</summary>
                  <ol className="auto-voice-pairs">
                    {pairing.pairs.map((pair) => (
                      <li key={pair.order}>
                        <strong>
                          {String(pair.order).padStart(2, "0")} ·{" "}
                          {pair.voice.duration.toLocaleString("vi-VN", {
                            maximumFractionDigits: 2,
                          })}
                          s
                        </strong>
                        <span>
                          {pair.image.name} · {pair.voice.name}
                        </span>
                        <p>{pair.text}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              </>
            )}
          </section>
        )}
        <details className="auto-input-help">
          <summary>Cách đặt tên và viết TXT</summary>
          <p>
            Ảnh 01.jpg đi với 01.wav và mục 1 trong TXT. Tiếp theo là 02.jpg,
            02.wav và mục 2. Mỗi mục bắt đầu ở đầu dòng.
          </p>
          <pre>
            {
              "1. Lời đọc của voice đầu tiên.\nMột câu tiếp theo.\n\n2. Lời đọc của voice thứ hai."
            }
          </pre>
          <p>
            Giữ nguyên lời trong WAV. Câu dài được chia thành cụm dễ đọc và tự
            căn theo tiếng nói. Có thể chỉ nhập ảnh để dựng video không voice.
          </p>
        </details>
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
                  narration: config.narration,
                  characters: config.characters,
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
          {!config.narration.enabled && (
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
          )}
        </div>
        <details className="auto-style-options">
          <summary>Chữ, màu & chuyển cảnh</summary>
          <Select
            label="Kiểu chữ / phụ đề"
            value={config.text.preset}
            options={TEXT_PRESETS}
            onChange={(preset) =>
              change({
                ...config,
                text: {
                  ...config.text,
                  preset: preset as AutoConfig["text"]["preset"],
                  style: {},
                },
              })
            }
          />
          <Select
            label="Tông màu ảnh"
            value={config.look.preset}
            options={{
              natural: "Tự nhiên",
              warm: "Ấm",
              cool: "Lạnh",
              mono: "Đen trắng",
              vintage: "Hoài cổ",
            }}
            onChange={(preset) =>
              change({
                ...config,
                look: {
                  ...config.look,
                  preset: preset as AutoConfig["look"]["preset"],
                },
              })
            }
          />
          <Select
            label="Chuyển cảnh"
            value={config.transition.preset}
            options={{
              none: "Cắt thẳng",
              fade: "Hoà tan nhẹ",
              push: "Đẩy ngang",
              wipe: "Quét",
              ...(!["none", "fade", "push", "wipe"].includes(
                config.transition.preset,
              )
                ? { [config.transition.preset]: "Chuyển cảnh từ mẫu đã lưu" }
                : {}),
            }}
            onChange={(preset) =>
              change({
                ...config,
                transition: {
                  ...config.transition,
                  preset: preset as AutoConfig["transition"]["preset"],
                },
              })
            }
          />
        </details>
        <ActorPanel
          project={project}
          settings={config.characters}
          disabled={disabled}
          onChange={(characters) => change({ ...config, characters })}
          onImport={(files, options) => onImportActors(files, options, config)}
          onLibrary={onActorLibrary}
        />
        {project.scenes.length > 0 && (
          <button
            type="button"
            className="button"
            disabled={disabled}
            onClick={onEditObjects}
          >
            <Icon name="motion" size={15} />
            Đặt nhân vật / vật thể vào ảnh
          </button>
        )}
        {config.narration.enabled && (
          <p className="muted">
            Voice nối tiếp · phụ đề từng câu · chuyển cảnh giữ trọn lời đọc.
          </p>
        )}
        {!config.narration.enabled && config.text.source === "file" && (
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
            disabled={
              !project.assets.length ||
              Boolean(pairing.error) ||
              Boolean(actorError)
            }
            onClick={() => void build(true)}
          >
            <Icon name="effect" />
            {working ? "Đang chuẩn bị…" : "Tạo và xuất MP4"}
          </button>
          <button
            type="button"
            className="button full-width"
            disabled={
              !project.assets.length ||
              Boolean(pairing.error) ||
              Boolean(actorError)
            }
            onClick={() => void build(false)}
          >
            Chỉ dựng để xem trước
          </button>
        </div>
        <div className="auto-input-actions">
          <button
            type="button"
            className="text-button"
            onClick={() =>
              saveJson(
                `${configName.replace(/[\\/:*?"<>|]/g, "-") || "mau-dung"}.khung-preset.json`,
                { presetVersion: 1, name: configName, config },
              )
            }
          >
            Lưu mẫu dựng này
          </button>
          <button type="button" className="text-button" onClick={onExample}>
            Dùng ảnh mẫu
          </button>
        </div>
        <details className="auto-advanced">
          <summary>Thiết lập bổ sung</summary>
          <Field label="Tên mẫu để dùng lại">
            <input
              value={configName}
              maxLength={100}
              onChange={(e) => setConfigName(e.target.value)}
            />
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={config.narration.enabled}
              onChange={(e) =>
                change({
                  ...config,
                  narration: { ...config.narration, enabled: e.target.checked },
                })
              }
            />
            Dựng theo WAV và TXT
          </label>
          {config.narration.enabled && (
            <>
              <Select
                label="Ngôn ngữ voice"
                value={config.narration.language}
                options={{ vi: "Tiếng Việt", en: "Tiếng Anh" }}
                onChange={(language) =>
                  change({
                    ...config,
                    narration: {
                      ...config.narration,
                      language: language as "vi" | "en",
                    },
                  })
                }
              />
              <Numeric
                label="Độ dài cụm phụ đề tối đa"
                min={40}
                max={240}
                step={1}
                value={config.narration.maxChars}
                onChange={(maxChars) =>
                  change({
                    ...config,
                    narration: { ...config.narration, maxChars },
                  })
                }
              />
            </>
          )}
          {!config.narration.enabled && (
            <>
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
            </>
          )}
          <details className="auto-technical">
            <summary>Dành cho kỹ thuật · JSON</summary>
            <Field label="Cấu hình nội bộ">
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
                  setConfigName("Mẫu tuỳ chỉnh");
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
        </details>
      </fieldset>
      {progress && (
        <div className="auto-build-progress" role="status" aria-live="polite">
          <p>{progress}</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              buildController.current?.abort();
              setProgress("Đang hủy…");
            }}
          >
            Hủy dựng
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="inline-error auto-error">
          {error}
        </p>
      )}
      {actorError && (
        <p role="alert" className="inline-error auto-error">
          {actorError}
        </p>
      )}
    </aside>
  );
}
