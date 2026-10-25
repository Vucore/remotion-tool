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
  const [file, setFile] = useState<{
    name: string;
    cues: SubtitleCue[];
  } | null>(null);
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
    Record<string, { key: string; cues: SubtitleCue[] }>
  >({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [translating, setTranslating] = useState(false),
    [loadingLanguages, setLoadingLanguages] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  const cues = useMemo(
    () =>
      input === "project" ? projectSubtitles(project) : (file?.cues ?? []),
    [input, project, file],
  );
  const fingerprint = JSON.stringify({ cues, source });
  const selected = targets.filter((code) => code !== source);
  const readyLanguages = selected.filter(
    (code) => translations[code]?.key === fingerprint,
  );
  const previewTarget = readyLanguages.includes(previewLanguage)
    ? previewLanguage
    : readyLanguages[0];
  const translated = previewTarget ? translations[previewTarget].cues : null;
  const filteredLanguages = languages.filter(
    (l) =>
      l.code !== source &&
      `${l.name} ${l.code}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const names = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const name = input === "file" ? (file?.name ?? "phu-de") : project.name;
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
      setStatus(`Đã tải ${result.languages.length} ngôn ngữ từ Google.`);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Không tải được ngôn ngữ.");
    } finally {
      setLoadingLanguages(false);
      controller.current = null;
    }
  }
  async function translate() {
    setTranslating(true);
    setError("");
    setFailures({});
    const abort = new AbortController();
    controller.current = abort;
    let completed = 0;
    try {
      for (const [index, target] of selected.entries()) {
        if (abort.signal.aborted) break;
        if (translations[target]?.key === fingerprint) {
          completed++;
          continue;
        }
        let jobId = "",
          complete = false;
        const cancel = async () => {
          if (jobId)
            await fetch(`/api/subtitles/translate/${jobId}`, {
              method: "DELETE",
            }).catch(() => {});
        };
        try {
          setStatus(
            `${index + 1}/${selected.length} · ${names[target] ?? target}: đang chuẩn bị…`,
          );
          // Receive the job ID before honoring cancellation so no orphan job is left running.
          const response = await fetch("/api/subtitles/translate", {
            method: "POST",
            headers: {
              ...projectHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cues, source, target }),
          });
          let job = await response.json();
          if (!response.ok) throw Error(job.error);
          jobId = job.id;
          abort.signal.addEventListener("abort", cancel, { once: true });
          while (true) {
            if (abort.signal.aborted) throw Error("Đã dừng dịch.");
            setStatus(
              `${index + 1}/${selected.length} · ${names[target] ?? target}: ${job.message || "Đang dịch…"}`,
            );
            if (job.status === "done") {
              setTranslations((previous) => ({
                ...previous,
                [target]: { key: fingerprint, cues: job.result.cues },
              }));
              completed++;
              complete = true;
              break;
            }
            if (["error", "cancelled"].includes(job.status))
              throw Error(job.error || "Đã dừng dịch.");
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const poll = await fetch(`/api/subtitles/translate/${jobId}`, {
              signal: abort.signal,
            });
            job = await poll.json();
            if (!poll.ok) throw Error(job.error || "Mất kết nối tác vụ dịch.");
          }
        } catch (e) {
          if (!abort.signal.aborted)
            setFailures((previous) => ({
              ...previous,
              [target]: e instanceof Error ? e.message : "Không dịch được.",
            }));
        } finally {
          abort.signal.removeEventListener("abort", cancel);
          if (!complete) await cancel();
        }
      }
      setStatus(
        `${abort.signal.aborted ? "Đã dừng" : "Hoàn tất"} · ${completed}/${selected.length} ngôn ngữ sẵn sàng. Các bản đã dịch được giữ lại.`,
      );
    } finally {
      setTranslating(false);
      controller.current = null;
    }
  }
  function downloadSelected() {
    const files = readyLanguages.map((code) => ({
      name: subtitleFilename(
        name,
        bilingual ? source : code,
        bilingual ? code : undefined,
        names,
      ),
      text: toSrt(
        bilingual
          ? bilingualCues(cues, translations[code].cues)
          : translations[code].cues,
      ),
    }));
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
              {file ? "Thay file SRT" : "Chọn file SRT"}
            </button>
            <span>{file?.name ?? "UTF-8 · tối đa 2 MB"}</span>
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
                {translations[l.code]?.key === fingerprint
                  ? "Sẵn sàng"
                  : failures[l.code]
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
          Internet; nội dung phụ đề được gửi tới Google. Có thể bị giới hạn lượt
          dịch.
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
            disabled={!cues.length || busy || !selected.length}
            onClick={() => void translate()}
          >
            {`Dịch ${selected.length} ngôn ngữ`}
          </button>
        )}
        <button
          className="button"
          disabled={busy || !readyLanguages.length}
          onClick={downloadSelected}
        >
          <Icon name="download" /> Tải {readyLanguages.length} bản đã chọn
          (.zip)
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
      {selected.length > readyLanguages.length && readyLanguages.length > 0 && (
        <p className="dialog-help">
          ZIP chỉ chứa {readyLanguages.length}/{selected.length} bản đã chọn có
          bản dịch sẵn sàng.
        </p>
      )}
      {Object.entries(failures)
        .filter(([code]) => selected.includes(code))
        .map(([code, message]) => (
          <p className="dialog-error" role="alert" key={code}>
            {names[code] ?? code}: {message}
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
        onChange={(e) => {
          const next = e.target.files?.[0];
          e.target.value = "";
          if (!next) return;
          setError("");
          void (async () => {
            try {
              if (!/\.srt$/i.test(next.name) || next.size > 2_000_000)
                throw Error("Chọn SRT UTF-8, tối đa 2 MB.");
              const parsed = parseSrt(await next.text());
              setFile({ name: next.name, cues: parsed });
              setTranslations({});
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
