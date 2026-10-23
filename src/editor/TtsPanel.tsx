import { useId, useRef, useState } from "react";
import { Icon } from "../icons";
import { TTS_LANGUAGES } from "../auto/languages";
import { defaultTtsSettings, type TtsSettings } from "../auto/tts";
import type { VoiceAsset } from "../model";

const parameterHelp: Record<string, { value: number; text: string }> = {
  temperature: {
    value: 0.8,
    text: "Thấp: ít biến thiên hơn. Cao: đa dạng ngữ điệu hơn nhưng dễ thiếu ổn định. Nếu phát âm lạ, thử giảm từng 0,1.",
  },
  repetition_penalty: {
    value: 1.2,
    text: "1: không phạt lặp. Tăng nhẹ khi giọng lặp âm/từ; quá cao có thể bỏ âm hoặc méo lời.",
  },
  top_p: {
    value: 0.95,
    text: "Giữ nhóm lựa chọn có tổng xác suất tới ngưỡng này. Thấp: ít đa dạng; gần 1: nhiều lựa chọn hơn. Nên giữ mặc định trước.",
  },
  top_k: {
    value: 1000,
    text: "Số lựa chọn âm thanh được giữ mỗi bước. Thấp: hạn chế biến thiên; cao: đa dạng hơn. Không phải tốc độ đọc hay chất lượng bitrate.",
  },
  exaggeration: {
    value: 0.5,
    text: "Tăng để biểu cảm mạnh hơn; giảm để kể bình tĩnh. Giá trị cao có thể làm nhịp và cách phát âm kém tự nhiên.",
  },
  cfg_weight: {
    value: 0.5,
    text: "Mức điều kiện hóa giọng theo model. Thấp: tự do hơn; cao: bám điều kiện giọng hơn. Nếu giọng mẫu nói nhanh, thử khoảng 0,3 để cải thiện nhịp đọc. Không phải phần trăm giống giọng mẫu.",
  },
  min_p: {
    value: 0.05,
    text: "Lọc các lựa chọn có xác suất quá thấp so với lựa chọn tốt nhất. 0: tắt bộ lọc; tăng: ít lựa chọn hơn. Nên giữ 0,05 nếu chưa cần tinh chỉnh.",
  },
};

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
  const helpId = useId();
  const help = parameterHelp[name];
  return (
    <label className="tts-number" title={name}>
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        aria-describedby={helpId}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          if (e.target.value !== "") onChange(Number(e.target.value));
        }}
      />
      <small id={helpId} className="tts-parameter-help">
        {min}–{max} · Mặc định {help.value}. {help.text}
      </small>
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
  hideVoiceSource = false,
  hideResults = false,
}: {
  hideVoiceSource?: boolean;
  hideResults?: boolean;
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
      {!hideVoiceSource && (
        <>
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
        </>
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
        <p className="tts-note">
          Bắt đầu bằng mặc định. Mỗi lần đổi một thông số rồi tạo và nghe lại
          voice; kết quả còn tùy văn bản và giọng mẫu.
        </p>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => {
            const d = defaultTtsSettings();
            onChange({
              temperature: d.temperature,
              repetitionPenalty: d.repetitionPenalty,
              topP: d.topP,
              seed: d.seed,
              topK: d.topK,
              normLoudness: d.normLoudness,
              exaggeration: d.exaggeration,
              cfgWeight: d.cfgWeight,
              minP: d.minP,
            });
          }}
        >
          Khôi phục thông số mặc định
        </button>
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
            aria-describedby="tts-seed-help"
            value={s.seed ?? ""}
            onChange={(e) =>
              onChange({
                seed: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <p id="tts-seed-help" className="tts-note">
          Số nguyên 0–2147483647. Cùng seed và thiết lập giúp giảm khác biệt
          giữa các lần tạo; không đảm bảo âm thanh giống tuyệt đối. Seed lớn hơn
          không làm giọng hay hơn.
        </p>
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
            <p className="tts-note">
              Mặc định bật: cân bằng mức âm lượng đầu ra; không phải nút tăng
              tốc hay đổi ngữ điệu.
            </p>
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
              label="Mức bám điều kiện giọng"
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
      {!hideResults && (
        <>
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
              <a
                className="tts-download"
                href={voice.src}
                download={voice.name}
              >
                Tải {s.outputFormat.toUpperCase()}
                <Icon name="download" />
              </a>
            </details>
          )}
        </>
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
