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
    [target, setTarget] = useState(defaultLanguage === "en" ? "vi" : "en");
  const [languages, setLanguages] = useState(
    Object.entries(SUBTITLE_LANGUAGES).map(([code, info]) => ({
      code,
      name: info.name as string,
    })),
  );
  const [translation, setTranslation] = useState<{
    key: string;
    cues: SubtitleCue[];
  } | null>(null);
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
  const fingerprint = JSON.stringify({ cues, source, target });
  const translated = translation?.key === fingerprint ? translation.cues : null;
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
    if (translated) {
      setStatus("Bản dịch đã sẵn sàng, có thể tải SRT bản dịch hoặc song ngữ.");
      return;
    }
    setTranslating(true);
    setError("");
    setStatus("Đang chuẩn bị dịch…");
    const abort = new AbortController();
    controller.current = abort;
    let jobId = "",
      complete = false;
    const cancel = async () => {
      if (jobId)
        await fetch(`/api/subtitles/translate/${jobId}`, {
          method: "DELETE",
        }).catch(() => {});
    };
    try {
      const response = await fetch("/api/subtitles/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cues, source, target }),
      });
      let job = await response.json();
      if (!response.ok) throw Error(job.error);
      jobId = job.id;
      abort.signal.addEventListener("abort", cancel, { once: true });
      while (true) {
        if (abort.signal.aborted) throw Error("Đã dừng dịch phụ đề.");
        setStatus(job.message || "Đang dịch…");
        if (job.status === "done") {
          setTranslation({ key: fingerprint, cues: job.result.cues });
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
      setError(
        abort.signal.aborted
          ? "Đã dừng dịch phụ đề."
          : e instanceof Error
            ? e.message
            : "Không dịch được phụ đề.",
      );
    } finally {
      abort.signal.removeEventListener("abort", cancel);
      if (!complete) await cancel();
      setTranslating(false);
      controller.current = null;
    }
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
          <label>
            Dịch sang
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </label>
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
            disabled={!cues.length || busy || source === target}
            onClick={() => void translate()}
          >
            {translated ? "Dùng lại bản dịch" : "Dịch phụ đề"}
          </button>
        )}
        {translated && (
          <>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                download(
                  subtitleFilename(name, target, undefined, names),
                  translated,
                )
              }
            >
              SRT bản dịch
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                download(
                  subtitleFilename(name, source, target, names),
                  bilingualCues(cues, translated),
                )
              }
            >
              SRT song ngữ
            </button>
          </>
        )}
      </div>
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
              setTranslation(null);
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
