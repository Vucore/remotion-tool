import { useEffect, useMemo, useRef, useState } from "react";
import {
  SUBTITLE_LANGUAGES,
  bilingualCues,
  parseSrt,
  projectSubtitles,
  srtTimestamp,
  subtitleFilename,
  toSrt,
  type SubtitleCue,
} from "../auto/subtitles";
import type { Project } from "../model";
import { Icon } from "../icons";
import { subtitleZip } from "../auto/subtitle-zip";
import { projectHeaders } from "./workspace-storage";
import { translateSubtitleDocument } from "./subtitle-client";

type SubtitleFile = {
  id: string;
  name: string;
  cues: SubtitleCue[];
  size?: number;
};
const taskId = (document: SubtitleFile, target: string) =>
  `${document.id}:${target}`;

function download(name: string, cues: SubtitleCue[]) {
  const url = URL.createObjectURL(
    new Blob([toSrt(cues)], { type: "application/x-subrip;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SubtitlePanel({
  project,
  estimated,
  defaultLanguage,
  onAlign,
  canAlign,
  busy: editorBusy,
}: {
  project: Project;
  estimated: boolean;
  defaultLanguage: string;
  onAlign: () => void;
  canAlign: boolean;
  busy: boolean;
}) {
  const [input, setInput] = useState<"project" | "file">("project");
  const [files, setFiles] = useState<SubtitleFile[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const file = files.find((item) => item.id === activeFile) ?? files[0];
  const [source, setSource] = useState(defaultLanguage),
    [targets, setTargets] = useState<string[]>([
      defaultLanguage === "en" ? "vi" : "en",
    ]);
  const [search, setSearch] = useState("");
  const [previewLanguage, setPreviewLanguage] = useState("");
  const [bilingual, setBilingual] = useState(false);
  const [languages, setLanguages] = useState(
    Object.entries(SUBTITLE_LANGUAGES).map(([code, info]) => ({
      code,
      name: info.name as string,
    })),
  );
  const [translations, setTranslations] = useState<
    Record<
      string,
      { key: string; cues: SubtitleCue[]; untranslatedCount?: number }
    >
  >({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [translating, setTranslating] = useState(false),
    [loadingLanguages, setLoadingLanguages] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  const documents = useMemo(
    () =>
      input === "project"
        ? [
            {
              id: "project",
              name: project.name,
              cues: projectSubtitles(project),
            },
          ]
        : files,
    [input, project, files],
  );
  const activeDocument = input === "project" ? documents[0] : file;
  const cues = activeDocument?.cues ?? [];
  const fingerprint = JSON.stringify({ cues, source });
  const selected = targets.filter((code) => code !== source);
  const readyLanguages = selected.filter(
    (code) =>
      activeDocument &&
      translations[taskId(activeDocument, code)]?.key === fingerprint,
  );
  const tasks = useMemo(
    () =>
      documents.flatMap((document) => {
        const key = JSON.stringify({ cues: document.cues, source });
        return targets
          .filter((target) => target !== source)
          .map((target) => ({
            document,
            target,
            id: taskId(document, target),
            key,
          }));
      }),
    [documents, source, targets],
  );
  const readyTasks = tasks.filter(
    (task) => translations[task.id]?.key === task.key,
  );
  const previewTarget = readyLanguages.includes(previewLanguage)
    ? previewLanguage
    : readyLanguages[0];
  const translated =
    previewTarget && activeDocument
      ? translations[taskId(activeDocument, previewTarget)].cues
      : null;
  const filteredLanguages = languages.filter(
    (l) =>
      l.code !== source &&
      `${l.name} ${l.code}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const names = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const name = activeDocument?.name ?? "phu-de";
  const busy = editorBusy || translating || loadingLanguages;
  useEffect(() => () => controller.current?.abort(), []);
  async function loadLanguages() {
    setLoadingLanguages(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/subtitles/languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: abort.signal,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setLanguages(
        result.languages.map((l: { code: string; name: string }) => ({
          ...l,
          name:
            SUBTITLE_LANGUAGES[l.code as keyof typeof SUBTITLE_LANGUAGES]
              ?.name ?? l.name,
        })),
      );
      setStatus(
        `Đã tải ${result.languages.length} ngôn ngữ hỗ trợ từ thư viện dịch.`,
      );
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Không tải được ngôn ngữ.");
    } finally {
      setLoadingLanguages(false);
      controller.current = null;
    }
  }
  async function translate() {
    if (tasks.length > 1000) {
      setError(
        "Tối đa 1.000 bản dịch mỗi lượt. Giảm số file hoặc ngôn ngữ đã chọn.",
      );
      return;
    }
    setTranslating(true);
    setError("");
    setFailures({});
    const abort = new AbortController();
    controller.current = abort;
    let completed = 0,
      untranslated = 0,
      stoppedByProvider = false;
    try {
      for (const [index, task] of tasks.entries()) {
        const { document, target, id, key } = task;
        if (abort.signal.aborted) break;
        if (
          translations[id]?.key === key &&
          !translations[id]?.untranslatedCount
        ) {
          completed++;
          continue;
        }
        try {
          let retained = 0;
          const result = await translateSubtitleDocument(
            { cues: document.cues, source, target },
            {
              signal: abort.signal,
              headers: projectHeaders(),
              onUntranslated: (indices) => {
                untranslated += indices.length;
                retained = indices.length;
              },
              onUpdate: (job) =>
                setStatus(
                  `${index + 1}/${tasks.length} · ${document.name} → ${names[target] ?? target}: ${job.message || "Đang chuẩn bị…"}${job.retryAt ? ` · Thử lại lúc ${new Date(job.retryAt).toLocaleTimeString()}` : ""}`,
                ),
            },
          );
          setTranslations((previous) => ({
            ...previous,
            [id]: { key, cues: result, untranslatedCount: retained },
          }));
          completed++;
        } catch (e) {
          if (!abort.signal.aborted)
            setFailures((previous) => ({
              ...previous,
              [id]: e instanceof Error ? e.message : "Không dịch được.",
            }));
          if (
            [
              "RATE_LIMIT",
              "BUSY",
              "SETUP",
              "NETWORK",
              "PROVIDER_RESPONSE",
            ].includes((e as { code?: string }).code ?? "")
          ) {
            stoppedByProvider = true;
            setError(
              "Đã tạm dừng hàng đợi. Các câu thành công được giữ trong cache; bấm Dịch tiếp sau để tiếp tục.",
            );
            break;
          }
        }
      }
      setStatus(
        `${abort.signal.aborted || stoppedByProvider ? "Đã tạm dừng" : completed === tasks.length ? "Hoàn tất" : "Còn bản chưa dịch thành công"} · ${completed}/${tasks.length} bản dịch sẵn sàng.${untranslated ? ` Có ${untranslated} câu chưa dịch, được giữ nguyên bản gốc trong file xuất.` : " Các bản đã dịch được giữ lại."}`,
      );
    } finally {
      setTranslating(false);
      controller.current = null;
    }
  }
  function downloadSelected() {
    const used = new Set<string>();
    const files = readyTasks.map(({ document, target: code, id }, index) => {
      let filename = subtitleFilename(
        document.name,
        bilingual ? source : code,
        bilingual ? code : undefined,
        names,
      );
      while (used.has(filename)) filename = `${index + 1}_${filename}`;
      used.add(filename);
      return {
        name: filename,
        text: toSrt(
          bilingual
            ? bilingualCues(document.cues, translations[id].cues)
            : translations[id].cues,
        ),
      };
    });
    const url = URL.createObjectURL(
      new Blob([subtitleZip(files)], { type: "application/zip" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = subtitleFilename(name, source).replace(
      /\.srt$/,
      bilingual ? "_songngu.zip" : "_bandich.zip",
    );
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="subtitle-panel">
      <fieldset disabled={busy}>
        <div
          className="voice-source-switch"
          role="group"
          aria-label="Nguồn phụ đề"
        >
          <button
            aria-pressed={input === "project"}
            onClick={() => setInput("project")}
          >
            Từ bản dựng
          </button>
          <button
            aria-pressed={input === "file"}
            onClick={() => setInput("file")}
          >
            Nhập SRT có sẵn
          </button>
        </div>
        {input === "file" ? (
          <div className="subtitle-import">
            <button
              className="button"
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="folder" />
              {files.length ? "Thêm SRT" : "Chọn nhiều file SRT"}
            </button>
            <span>
              {files.length
                ? `${files.length} file · dịch cùng ngôn ngữ gốc đã chọn`
                : "UTF-8 · tối đa 2 MB/file · tối đa 50 file"}
            </span>
            {!!files.length && (
              <>
                <label>
                  File xem trước
                  <select
                    value={file?.id}
                    onChange={(e) => setActiveFile(e.target.value)}
                  >
                    {files.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.cues.length} câu
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button"
                  onClick={() => {
                    setFiles([]);
                    setTranslations({});
                    setFailures({});
                  }}
                >
                  Bỏ các file
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="subtitle-source-state">
            <span>
              {cues.length
                ? `${cues.length} câu · ${estimated ? "Mốc ước tính" : "Mốc đã dựng"}`
                : "Chưa có phụ đề trong bản dựng"}
            </span>
            {estimated && canAlign && (
              <button className="button" onClick={onAlign}>
                Căn theo voice
              </button>
            )}
          </div>
        )}
        {input === "project" && estimated && (
          <p className="dialog-help">
            SRT hiện dùng thời gian ước tính. Căn theo voice để khớp lời đọc
            trước khi xuất.
          </p>
        )}
        <div className="subtitle-languages">
          <label>
            Ngôn ngữ gốc
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="auto">Tự nhận diện</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="subtitle-target-heading">
          <strong>Dịch sang · {selected.length} đã chọn</strong>
          <button className="button" onClick={() => setTargets([])}>
            Bỏ chọn
          </button>
        </div>
        <input
          className="subtitle-search"
          aria-label="Tìm ngôn ngữ dịch"
          placeholder="Tìm ngôn ngữ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div
          className="subtitle-targets"
          role="group"
          aria-label="Ngôn ngữ cần dịch"
        >
          {filteredLanguages.map((l) => (
            <label key={l.code} className="subtitle-target">
              <input
                type="checkbox"
                checked={selected.includes(l.code)}
                onChange={(e) =>
                  setTargets((previous) =>
                    e.target.checked
                      ? [...previous, l.code]
                      : previous.filter((code) => code !== l.code),
                  )
                }
              />
              <span>
                {l.name} <small>({l.code})</small>
              </span>
              <small>
                {activeDocument &&
                translations[taskId(activeDocument, l.code)]?.key ===
                  fingerprint
                  ? translations[taskId(activeDocument, l.code)]
                      .untranslatedCount
                    ? `Còn ${translations[taskId(activeDocument, l.code)].untranslatedCount} câu gốc`
                    : "Sẵn sàng"
                  : activeDocument && failures[taskId(activeDocument, l.code)]
                    ? "Lỗi"
                    : ""}
              </small>
            </label>
          ))}
          {!filteredLanguages.length && (
            <p className="dialog-help">Không tìm thấy ngôn ngữ.</p>
          )}
        </div>
        <p className="dialog-help">
          Google Translate miễn phí qua deep-translator · không cần API key. Cần
          Internet; nội dung phụ đề được gửi tới Google theo từng batch tối đa
          3.000 ký tự, nghỉ 0,5 giây giữa các batch, tự thử lại 3 lần (2s, 4s,
          6s) và fallback dịch từng câu nếu lệch dòng; các câu dịch thành công
          được lưu vào cache. Giữ nguyên số câu và timestamp; nên rà lại nghĩa,
          tên riêng và thuật ngữ.
        </p>
        <button className="button" onClick={() => void loadLanguages()}>
          Tải đầy đủ ngôn ngữ
        </button>
      </fieldset>
      <div className="subtitle-actions">
        <button
          className="button"
          disabled={!cues.length || busy}
          onClick={() =>
            download(subtitleFilename(name, source, undefined, names), cues)
          }
        >
          <Icon name="download" />
          SRT gốc
        </button>
        {translating ? (
          <button
            className="button"
            onClick={() => controller.current?.abort()}
          >
            Dừng dịch
          </button>
        ) : (
          <button
            className="button primary"
            disabled={
              !documents.length ||
              documents.some((item) => !item.cues.length) ||
              busy ||
              !selected.length
            }
            onClick={() => void translate()}
          >
            {`${readyTasks.length || Object.keys(failures).length ? "Dịch tiếp" : "Dịch"} ${documents.length} ${input === "file" ? "file" : "bản"} × ${selected.length} ngôn ngữ`}
          </button>
        )}
        <button
          className="button"
          disabled={busy || !readyTasks.length}
          onClick={downloadSelected}
        >
          <Icon name="download" /> Tải {readyTasks.length} bản đã chọn (.zip)
        </button>
      </div>
      <label className="subtitle-bilingual">
        <input
          type="checkbox"
          checked={bilingual}
          disabled={busy}
          onChange={(e) => setBilingual(e.target.checked)}
        />{" "}
        Song ngữ: lời gốc + bản dịch trong mỗi file
      </label>
      {tasks.length > readyTasks.length && readyTasks.length > 0 && (
        <p className="dialog-help">
          ZIP chứa {readyTasks.length}/{tasks.length} bản đã dịch đầy đủ. Các
          bản còn thiếu câu hoặc chưa dịch không được đưa vào ZIP.
        </p>
      )}
      {tasks
        .filter((task) => failures[task.id])
        .map(({ id, document, target }) => (
          <p className="dialog-error" role="alert" key={id}>
            {document.name} → {names[target] ?? target}: {failures[id]}
          </p>
        ))}
      {readyLanguages.length > 0 && (
        <label className="subtitle-preview-language">
          Xem trước bản dịch
          <select
            value={previewTarget}
            onChange={(e) => setPreviewLanguage(e.target.value)}
          >
            {readyLanguages.map((code) => (
              <option key={code} value={code}>
                {names[code] ?? code}
              </option>
            ))}
          </select>
        </label>
      )}
      {status && (
        <p className="dialog-help" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="subtitle-preview" aria-label="Xem trước nội dung SRT">
        {cues.slice(0, 100).map((cue, index) => (
          <div className="subtitle-preview-row" key={index}>
            <span>
              {index + 1}
              <small>
                {srtTimestamp(cue.startMs)} → {srtTimestamp(cue.endMs)}
              </small>
            </span>
            <p>
              {cue.text}
              {translated && (
                <span className="subtitle-translated">
                  {translated[index].text}
                </span>
              )}
            </p>
          </div>
        ))}
        {cues.length > 100 && (
          <p className="dialog-help">
            Xem trước 100 câu đầu; file tải về chứa đủ {cues.length} câu.
          </p>
        )}
      </div>
      <input
        type="file"
        hidden
        ref={fileInput}
        accept=".srt"
        multiple
        onChange={(e) => {
          const incoming = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!incoming.length) return;
          setError("");
          void (async () => {
            try {
              if (files.length + incoming.length > 50)
                throw Error("Tối đa 50 file SRT mỗi lượt.");
              if (
                incoming.reduce((sum, next) => sum + next.size, 0) +
                  files.reduce((sum, next) => sum + (next.size ?? 0), 0) >
                10_000_000
              )
                throw Error(
                  "Tổng các SRT tối đa 10 MB mỗi lượt. Hãy chia thành các nhóm nhỏ hơn.",
                );
              const added: SubtitleFile[] = [];
              for (const next of incoming) {
                if (!/\.srt$/i.test(next.name) || next.size > 2_000_000)
                  throw Error(
                    `${next.name}: chọn SRT UTF-8, tối đa 2 MB/file.`,
                  );
                added.push({
                  id: crypto.randomUUID(),
                  name: next.name,
                  size: next.size,
                  cues: parseSrt(await next.text()),
                });
              }
              setFiles((previous) => [...previous, ...added]);
              setActiveFile(added[0].id);
              setFailures({});
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Không đọc được SRT.",
              );
            }
          })();
        }}
      />
    </div>
  );
}
