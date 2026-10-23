import { useRef, useState } from "react";
import { Icon } from "../icons";
import { TTS_LANGUAGES } from "../auto/languages";
import type { TtsSettings } from "../auto/tts";
import type { VoiceAsset } from "../model";

function NumberSetting({
  label,
  name,
  value,
  min,
  max,
  step = 0.05,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="tts-number" title={name}>
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          if (e.target.value !== "") onChange(Number(e.target.value));
        }}
      />
    </label>
  );
}

export function TtsPanel({
  settings,
  busy,
  ready,
  voices,
  canGenerate,
  onChange,
  onReference,
  onGenerate,
}: {
  settings: TtsSettings;
  busy: boolean;
  ready: boolean;
  voices: VoiceAsset[];
  canGenerate: boolean;
  onChange: (patch: Partial<TtsSettings>) => void;
  onReference: (file: File) => void;
  onGenerate: () => void;
}) {
  const referenceInput = useRef<HTMLInputElement>(null);
  const [listenId, setListenId] = useState("");
  const voice = voices.find((v) => v.id === listenId) ?? voices[0];
  const s = settings;
  return (
    <div className="tts-panel">
      <div className="tts-heading">
        <Icon name="voice" />
        <strong>Chatterbox TTS</strong>
      </div>
      <label className="tts-field">
        <span>Model</span>
        <select
          value={s.model}
          onChange={(e) =>
            onChange({ model: e.target.value as TtsSettings["model"] })
          }
        >
          <option value="turbo">Turbo · Tiếng Anh</option>
          <option value="multilingual">Multilingual · 23 ngôn ngữ</option>
        </select>
      </label>
      {s.model === "multilingual" && (
        <label className="tts-field">
          <span>Ngôn ngữ lời đọc</span>
          <select
            value={s.languageId}
            onChange={(e) =>
              onChange({
                languageId: e.target.value as TtsSettings["languageId"],
              })
            }
          >
            {Object.entries(TTS_LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="tts-note">API hiện chưa hỗ trợ tiếng Việt.</p>
      <div className="tts-field">
        <span>Giọng đọc</span>
        <div
          className="voice-source-switch"
          role="group"
          aria-label="Nguồn giọng TTS"
        >
          <button
            type="button"
            aria-pressed={s.voiceMode === "preset"}
            onClick={() => onChange({ voiceMode: "preset" })}
          >
            Preset
          </button>
          <button
            type="button"
            aria-pressed={s.voiceMode === "reference"}
            onClick={() => onChange({ voiceMode: "reference" })}
          >
            Giọng mẫu
          </button>
        </div>
      </div>
      {s.voiceMode === "preset" ? (
        <label className="tts-field">
          <span>Tên giọng trên server</span>
          <input
            value={s.voice}
            maxLength={200}
            placeholder="Để trống: giọng mặc định"
            onChange={(e) => onChange({ voice: e.target.value })}
          />
        </label>
      ) : (
        <div className="tts-reference">
          <button
            type="button"
            className="button"
            onClick={() => referenceInput.current?.click()}
          >
            <Icon name="plus" />
            {s.reference ? "Thay giọng mẫu" : "Chọn giọng mẫu"}
          </button>
          {s.reference && (
            <div className="tts-reference-name">
              <span title={s.reference.name}>{s.reference.name}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Bỏ giọng mẫu"
                onClick={() => onChange({ reference: null })}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          <p className="tts-note">WAV/MP3 · Nên dùng 5–15 giây rõ tiếng.</p>
        </div>
      )}
      <div className="tts-field">
        <span>File voice tạo ra</span>
        <div
          className="voice-source-switch"
          role="group"
          aria-label="Định dạng voice TTS"
        >
          {(["wav", "mp3"] as const).map((format) => (
            <button
              key={format}
              type="button"
              aria-pressed={s.outputFormat === format}
              onClick={() => onChange({ outputFormat: format })}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <details className="compact-details tts-advanced">
        <summary>Thông số giọng đọc</summary>
        <NumberSetting
          label="Độ ngẫu nhiên"
          name="temperature"
          value={s.temperature}
          min={0.05}
          max={2}
          onChange={(temperature) => onChange({ temperature })}
        />
        <NumberSetting
          label="Chống lặp"
          name="repetition_penalty"
          value={s.repetitionPenalty}
          min={1}
          max={3}
          onChange={(repetitionPenalty) => onChange({ repetitionPenalty })}
        />
        <NumberSetting
          label="Top P"
          name="top_p"
          value={s.topP}
          min={0}
          max={1}
          onChange={(topP) => onChange({ topP })}
        />
        <label className="tts-number" title="seed">
          <span>Seed · để trống = ngẫu nhiên</span>
          <input
            type="number"
            min={0}
            max={2147483647}
            step={1}
            value={s.seed ?? ""}
            onChange={(e) =>
              onChange({
                seed: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
        {s.model === "turbo" ? (
          <>
            <NumberSetting
              label="Top K"
              name="top_k"
              value={s.topK}
              min={1}
              max={1000000}
              step={1}
              onChange={(topK) => onChange({ topK })}
            />
            <label className="toggle-line">
              <span>Cân bằng âm lượng</span>
              <input
                type="checkbox"
                checked={s.normLoudness}
                onChange={(e) => onChange({ normLoudness: e.target.checked })}
              />
            </label>
          </>
        ) : (
          <>
            <NumberSetting
              label="Độ biểu cảm"
              name="exaggeration"
              value={s.exaggeration}
              min={0}
              max={2}
              onChange={(exaggeration) => onChange({ exaggeration })}
            />
            <NumberSetting
              label="Bám giọng mẫu"
              name="cfg_weight"
              value={s.cfgWeight}
              min={0}
              max={1}
              onChange={(cfgWeight) => onChange({ cfgWeight })}
            />
            <NumberSetting
              label="Min P"
              name="min_p"
              value={s.minP}
              min={0}
              max={1}
              onChange={(minP) => onChange({ minP })}
            />
          </>
        )}
      </details>
      <details className="compact-details tts-connection">
        <summary>Kết nối API</summary>
        <label className="tts-field">
          <span>URL ứng dụng Modal</span>
          <input
            type="url"
            value={s.baseUrl}
            spellCheck={false}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
          />
        </label>
      </details>
      <div className="tts-generate">
        <button
          type="button"
          className="button"
          disabled={busy || !canGenerate || ready}
          onClick={onGenerate}
        >
          <Icon name={ready ? "check" : "voice"} />
          {ready
            ? `${voices.length} voice sẵn sàng`
            : voices.length
              ? "Cập nhật voice"
              : "Tạo voice"}
        </button>
        <p className="tts-note">Xuất video cũng tự tạo voice khi cần.</p>
      </div>
      {ready && voice && (
        <details className="compact-details">
          <summary>Nghe và tải voice</summary>
          <label className="tts-field">
            <span>Chọn cảnh</span>
            <select
              value={voice.id}
              onChange={(e) => setListenId(e.target.value)}
            >
              {voices.map((v, index) => (
                <option key={v.id} value={v.id}>
                  Cảnh {index + 1} · {v.duration.toFixed(1)}s
                </option>
              ))}
            </select>
          </label>
          <audio
            key={voice.src}
            src={voice.src}
            controls
            preload="none"
            aria-label="Nghe voice đã tạo"
          />
          <a className="tts-download" href={voice.src} download={voice.name}>
            Tải {s.outputFormat.toUpperCase()}
            <Icon name="download" />
          </a>
        </details>
      )}
      <input
        ref={referenceInput}
        type="file"
        hidden
        accept=".wav,.mp3,audio/wav,audio/mpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onReference(file);
        }}
      />
    </div>
  );
}
