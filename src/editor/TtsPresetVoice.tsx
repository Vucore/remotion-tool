import { useEffect, useId, useRef, useState } from "react";
import type { TtsSettings } from "../auto/tts";

// Request the catalogue only when the user asks; this endpoint does not warm the GPU.
export function TtsPresetVoice({
  settings,
  value,
  onChange,
  disabled = false,
}: {
  settings: TtsSettings;
  value: string;
  onChange: (voice: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const abort = useRef<AbortController | null>(null);
  const [state, setState] = useState({
    url: "",
    loading: false,
    error: "",
    voices: [] as { id: string; name: string }[],
  });
  const url = settings.vieneu.baseUrl;
  useEffect(() => () => abort.current?.abort(), [url]);
  const current = state.url === url ? state : null;
  const load = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ url, loading: true, error: "", voices: [] });
    try {
      const response = await fetch("/api/tts/vieneu/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: url }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Chưa tải được danh sách giọng.");
      if (!controller.signal.aborted)
        setState({ url, loading: false, error: "", voices: data.voices });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({
          url,
          loading: false,
          voices: [],
          error:
            error instanceof Error
              ? error.message
              : "Chưa tải được danh sách giọng.",
        });
    }
  };
  return (
    <div className="tts-field">
      <label htmlFor={id}>Tên giọng trên server</label>
      <input
        id={id}
        disabled={disabled}
        list={`${id}-voices`}
        value={value}
        maxLength={200}
        placeholder={
          settings.provider === "vieneu"
            ? "Để trống: Hải Đăng"
            : "Để trống: giọng mặc định server"
        }
        onChange={(event) => onChange(event.target.value)}
      />
      {settings.provider === "vieneu" && (
        <>
          {current?.voices.length ? (
            <>
              <datalist id={`${id}-voices`}>
                {current.voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </datalist>
              <select
                aria-label="Chọn giọng VieNeu"
                value={
                  current.voices.some((voice) => voice.id === value)
                    ? value
                    : ""
                }
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.value) onChange(event.target.value);
                }}
              >
                <option value="">
                  Chọn trong {current.voices.length} giọng
                </option>
                {current.voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button
            type="button"
            className="button"
            disabled={disabled || current?.loading}
            onClick={() => void load()}
          >
            {current?.loading ? "Đang tải giọng…" : "Tải danh sách giọng"}
          </button>
          {current?.error && (
            <p className="dialog-error" role="alert">
              {current.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
