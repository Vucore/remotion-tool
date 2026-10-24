import { proxySource } from "./performance";
import {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type RefObject,
} from "react";
import {
  narrationDocument,
  NarrationDraft,
  type NarrationRow,
} from "./narration-document";
import { VirtualList } from "./VirtualList";
import { BufferedTextarea } from "./BufferedTextarea";
import { parseScript } from "../auto/narration";
import {
  normalizedSpeech,
  type SceneDialogue,
  type TtsSettings,
  type TtsSpeaker,
} from "../auto/tts";
import type { Asset, VoiceAsset } from "../model";
import { TtsPanel } from "./TtsPanel";
import { Icon } from "../icons";

type Row = NarrationRow;
function readRows(script: string, settings: TtsSettings) {
  try {
    return parseScript(script).flatMap((section) => {
      const scene = settings.dialogue.find(
        (item) => item.order === section.order,
      );
      const valid =
        scene &&
        normalizedSpeech(scene.turns.map((turn) => turn.text).join("\n")) ===
          normalizedSpeech(section.text);
      return (
        valid ? scene.turns : [{ text: section.text, speakerId: "default" }]
      ).map((turn) => ({
        ...turn,
        order: section.order,
        id: crypto.randomUUID(),
      }));
    });
  } catch {
    return [];
  }
}
export function NarrationPanel({
  script,
  settings,
  images,
  voices,
  busy,
  ready,
  canGenerate,
  onChange,
  onDocument,
  onReference,
  onGenerate,
  onImportScript,
  onUploadVoices,
  flushRef,
}: {
  script: string;
  settings: TtsSettings;
  images: Asset[];
  voices: VoiceAsset[];
  busy: boolean;
  ready: boolean;
  canGenerate: boolean;
  onChange: (patch: Partial<TtsSettings>) => void;
  onDocument: (script: string, dialogue: SceneDialogue[]) => void;
  onReference: (file: File, speakerId: string) => void;
  onGenerate: () => void;
  onImportScript: () => void;
  onUploadVoices: () => void;
  flushRef?: RefObject<(() => void) | null>;
}) {
  const [rows, setRows] = useState<Row[]>(() => readRows(script, settings));
  const [selected, setSelected] = useState<string[]>([]);
  const [speakerId, setSpeakerId] = useState("default");
  const [editingSpeaker, setEditingSpeaker] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [raw, setRaw] = useState(!rows.length);
  const [rawText, setRawText] = useState(script);
  const [localError, setLocalError] = useState("");
  const reference = useRef<HTMLInputElement>(null);
  const grouped = useMemo(() => {
    const map = new Map<number, Row[]>();
    const speakers = new Map<string, number>();
    for (const row of rows) {
      let scene = map.get(row.order);
      if (!scene) {
        scene = [];
        map.set(row.order, scene);
      }
      scene.push(row);
      speakers.set(row.speakerId, (speakers.get(row.speakerId) ?? 0) + 1);
    }
    return { scenes: map, speakers };
  }, [rows]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const staleAssignments = useMemo(
    () =>
      settings.dialogue.some(
        (scene) =>
          normalizedSpeech(scene.turns.map((turn) => turn.text).join("\n")) !==
          normalizedSpeech(
            (grouped.scenes.get(scene.order) ?? [])
              .map((row) => row.text)
              .join("\n"),
          ),
      ),
    [settings.dialogue, grouped],
  );
  const active = settings.speakers.find((speaker) => speaker.id === speakerId);
  const speaker = active ?? {
    id: "default",
    name: "Người kể chuyện",
    voiceMode: settings.voiceMode,
    voice: settings.voice,
    reference: settings.reference,
  };
  const choices = useMemo(
    () => [{ id: "default", name: "Người kể chuyện" }, ...settings.speakers],
    [settings.speakers],
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedSet.has(row.id)),
    [rows, selectedSet],
  );
  const sceneOrders = useMemo(() => [...grouped.scenes.keys()], [grouped]);
  const audio = voices.find((voice) => voice.id === voiceId) ?? voices[0];
  const rowsRef = useRef(rows),
    documentRef = useRef(onDocument),
    generateRef = useRef(onGenerate);
  rowsRef.current = rows;
  documentRef.current = onDocument;
  generateRef.current = onGenerate;
  const latestScript = useRef(script);
  const draft = useRef<NarrationDraft | null>(null);
  if (!draft.current)
    draft.current = new NarrationDraft(
      () => rowsRef.current,
      (next) => {
        rowsRef.current = next;
        setRows(next);
        const document = narrationDocument(next);
        latestScript.current = document.text;
        documentRef.current(document.text, document.dialogue);
      },
    );
  const buffered = draft.current;
  const onDraft = useCallback(
    (id: string, text: string) => buffered.set(id, text),
    [buffered],
  );
  const cursors = useRef<Record<string, number>>({});
  const onCursor = useCallback((id: string, position: number) => {
    cursors.current[id] = position;
  }, []);
  useEffect(() => {
    if (flushRef) flushRef.current = buffered.flush;
    const flush = () => {
      if (document.visibilityState === "hidden") buffered.flush();
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      buffered.flush();
      if (flushRef) flushRef.current = null;
      document.removeEventListener("visibilitychange", flush);
    };
  }, [buffered, flushRef]);
  function commit(next: Row[]) {
    buffered.commit(next);
  }
  function patchSpeaker(patch: Partial<TtsSpeaker>) {
    if (speakerId === "default") onChange(patch);
    else
      onChange({
        speakers: settings.speakers.map((item) =>
          item.id === speakerId ? { ...item, ...patch } : item,
        ),
      });
  }
  function split(row: Row, position: number) {
    buffered.flush();
    const current = rowsRef.current;
    row = current.find((item) => item.id === row.id) ?? row;
    if (rows.filter((item) => item.order === row.order).length >= 100) {
      setLocalError("Mỗi cảnh tối đa 100 lượt nói.");
      return;
    }
    const left = row.text.slice(0, position).trim(),
      right = row.text.slice(position).trim();
    if (!left || !right) {
      setLocalError("Đặt con trỏ giữa đoạn lời để tách thành hai lượt nói.");
      return;
    }
    commit(
      current.flatMap((item) =>
        item.id === row.id
          ? [
              { ...item, text: left },
              { ...item, id: crypto.randomUUID(), text: right },
            ]
          : [item],
      ),
    );
    setLocalError("");
  }
  const imageMap = useMemo(
    () =>
      new Map(
        images.map((image) => [Number(image.name.match(/\d+/)?.[0]), image]),
      ),
    [images],
  );
  type Item =
    | { kind: "header"; order: number }
    | { kind: "add"; order: number }
    | { kind: "turn"; order: number; row: Row; index: number };
  const listItems = useMemo(
    () =>
      sceneOrders.flatMap((order) => [
        {
          key: `header:${order}`,
          value: { kind: "header", order } as Item,
          estimate: 64,
        },
        ...grouped.scenes.get(order)!.map((row, index) => ({
          key: row.id,
          value: { kind: "turn", order, row, index } as Item,
          estimate: 205,
        })),
        {
          key: `add:${order}`,
          value: { kind: "add", order } as Item,
          estimate: 70,
        },
      ]),
    [sceneOrders, grouped],
  );
  return (
    <div className="narration-panel">
      <fieldset disabled={busy}>
        {staleAssignments && (
          <div className="dialog-error" role="alert">
            TXT đã thay đổi; phân vai cũ không còn khớp. Các lượt bên dưới đang
            dùng giọng mặc định.
            <button className="button" onClick={() => commit(rows)}>
              Áp dụng phân vai đang hiển thị
            </button>
          </div>
        )}
        <div className="narration-topbar">
          <div
            className="voice-source-switch"
            role="group"
            aria-label="Nguồn giọng đọc"
          >
            <button
              aria-pressed={settings.enabled}
              onClick={() => onChange({ enabled: true })}
            >
              Tạo giọng từ lời đọc
            </button>
            <button
              aria-pressed={!settings.enabled}
              onClick={() => onChange({ enabled: false })}
            >
              Dùng WAV / MP3
            </button>
          </div>
          <button
            className="button"
            onClick={() => {
              buffered.flush();
              onImportScript();
            }}
          >
            <Icon name="folder" />
            Nhập TXT
          </button>
        </div>
        {!settings.enabled && (
          <div className="narration-upload">
            <button
              className="button"
              onClick={() => {
                buffered.flush();
                onUploadVoices();
              }}
            >
              Chọn WAV / MP3
            </button>
            <span>
              {voices.length} file · ghép theo số cảnh. Phân vai chỉ áp dụng khi
              tạo giọng từ lời đọc.
            </span>
          </div>
        )}
        {settings.enabled && (
          <p className="dialog-help">
            Một cảnh có thể có nhiều lượt nói. Chọn lượt nói rồi gán người nói,
            hoặc đổi giọng ngay trên từng lượt. Model hiện chưa hỗ trợ tiếng
            Việt.
          </p>
        )}
        <div
          className={
            "narration-layout" + (!settings.enabled ? " is-upload" : "")
          }
        >
          {settings.enabled && (
            <section
              className="narration-speakers"
              aria-label="Thư viện người nói"
            >
              <div className="narration-section-heading">
                <h3>Người nói</h3>
                <button
                  className="button"
                  disabled={settings.speakers.length >= 50}
                  onClick={() => {
                    const id = crypto.randomUUID();
                    onChange({
                      speakers: [
                        ...settings.speakers,
                        {
                          id,
                          name: `Người nói ${settings.speakers.length + 1}`,
                          voiceMode: "preset",
                          voice: "",
                          reference: null,
                        },
                      ],
                    });
                    setSpeakerId(id);
                    setEditingSpeaker(true);
                  }}
                >
                  <Icon name="plus" />
                  Thêm
                </button>
              </div>
              <div
                className="narration-speaker-list"
                role="group"
                aria-label="Chọn người nói để chỉnh hoặc gán"
              >
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    aria-pressed={speakerId === choice.id}
                    onClick={() => {
                      setSpeakerId(choice.id);
                      setEditingSpeaker(false);
                    }}
                  >
                    <Icon name="voice" />
                    <span>{choice.name || "Chưa đặt tên"}</span>
                    <small>{grouped.speakers.get(choice.id) ?? 0} lượt</small>
                  </button>
                ))}
              </div>
              <details
                className="compact-details"
                open={editingSpeaker}
                onToggle={(e) => setEditingSpeaker(e.currentTarget.open)}
              >
                <summary>
                  Thiết lập giọng · {speaker.name || "Chưa đặt tên"}
                </summary>
                <div className="narration-speaker-editor">
                  {active ? (
                    <label>
                      Tên người nói
                      <input
                        value={speaker.name}
                        maxLength={100}
                        onChange={(e) => patchSpeaker({ name: e.target.value })}
                      />
                    </label>
                  ) : (
                    <strong>Người kể chuyện · mặc định</strong>
                  )}
                  <label>
                    Nguồn giọng
                    <select
                      value={speaker.voiceMode}
                      onChange={(e) =>
                        patchSpeaker({
                          voiceMode: e.target.value as "preset" | "reference",
                        })
                      }
                    >
                      <option value="preset">Giọng có sẵn trên server</option>
                      <option value="reference">Clone từ file mẫu</option>
                    </select>
                  </label>
                  {speaker.voiceMode === "preset" ? (
                    <label>
                      Tên giọng trên server
                      <input
                        value={speaker.voice}
                        maxLength={200}
                        placeholder="Để trống: giọng mặc định server"
                        onChange={(e) =>
                          patchSpeaker({ voice: e.target.value })
                        }
                      />
                    </label>
                  ) : (
                    <>
                      <button
                        className="button"
                        onClick={() => reference.current?.click()}
                      >
                        {speaker.reference
                          ? "Thay file clone"
                          : "Chọn file clone"}
                      </button>
                      <p className="dialog-help">
                        {speaker.reference?.name ??
                          "WAV/MP3, tối đa 25 MB. Nên chọn 5–15 giây rõ tiếng."}
                      </p>
                      {speaker.reference && (
                        <audio
                          controls
                          preload="none"
                          src={speaker.reference.src}
                          aria-label={`Nghe giọng mẫu ${speaker.name}`}
                        />
                      )}
                    </>
                  )}
                  {active && (
                    <button
                      className="button"
                      onClick={() => {
                        buffered.flush();
                        const next = rowsRef.current.map((row) =>
                          row.speakerId === speakerId
                            ? { ...row, speakerId: "default" }
                            : row,
                        );
                        // Apply profile removal and reassign its turns atomically through the parent.
                        const remaining = settings.speakers.filter(
                          (item) => item.id !== speakerId,
                        );
                        const dialogue = sceneOrders.map((order) => ({
                          order,
                          turns: next
                            .filter((row) => row.order === order)
                            .map(({ text, speakerId }) => ({
                              text,
                              speakerId,
                            })),
                        }));
                        setRows(next);
                        onChange({ speakers: remaining, dialogue });
                        setSpeakerId("default");
                      }}
                    >
                      Xóa người nói · gán lượt về mặc định
                    </button>
                  )}
                </div>
              </details>
              <button
                className="button primary"
                disabled={!selectedRows.length}
                onClick={() =>
                  commit(
                    rows.map((row) =>
                      selectedSet.has(row.id) ? { ...row, speakerId } : row,
                    ),
                  )
                }
              >
                Gán cho {selectedRows.length} lượt đã chọn
              </button>
            </section>
          )}
          <section className="narration-script" aria-label="Lời đọc theo cảnh">
            <div className="narration-section-heading">
              <h3>Lời đọc</h3>
              <button
                className="button"
                onClick={() => {
                  if (raw) {
                    try {
                      parseScript(rawText);
                      const next = readRows(rawText, {
                        ...settings,
                        dialogue: [],
                      });
                      rowsRef.current = next;
                      setRows(next);
                      latestScript.current = rawText;
                      setSelected([]);
                      onDocument(rawText, []);
                      setRaw(false);
                      setLocalError("");
                    } catch (e) {
                      setLocalError(
                        e instanceof Error ? e.message : "TXT không hợp lệ.",
                      );
                    }
                  } else {
                    buffered.flush();
                    setRawText(latestScript.current);
                    setRaw(true);
                  }
                }}
              >
                {raw ? "Áp dụng TXT" : "Sửa TXT toàn bộ"}
              </button>
            </div>
            {raw ? (
              <>
                <p className="dialog-help">
                  Thay đổi chỉ lưu khi bấm Áp dụng TXT. Dán hoặc nhập lời theo
                  mục 1., 2., 3.… Áp dụng TXT sẽ đặt lại phân vai về Người kể
                  chuyện.
                </p>
                <textarea
                  className="script-dialog-input"
                  aria-label="Lời đọc TXT"
                  rows={12}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <button
                  className="button"
                  onClick={() => {
                    setRaw(false);
                    setLocalError("");
                  }}
                >
                  Hủy sửa TXT
                </button>
              </>
            ) : (
              <>
                <div className="narration-selection">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        rows.length > 0 && selectedRows.length === rows.length
                      }
                      ref={(node) => {
                        if (node)
                          node.indeterminate =
                            selectedRows.length > 0 &&
                            selectedRows.length < rows.length;
                      }}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? rows.map((row) => row.id) : [],
                        )
                      }
                    />
                    Chọn tất cả ({rows.length})
                  </label>
                  <button
                    className="button"
                    disabled={!selectedRows.length}
                    onClick={() => setSelected([])}
                  >
                    Bỏ chọn
                  </button>
                  <span>{selectedRows.length} đã chọn</span>
                  {settings.enabled && (
                    <>
                      <select
                        aria-label="Giọng gán hàng loạt"
                        value={speakerId}
                        onChange={(e) => setSpeakerId(e.target.value)}
                      >
                        {choices.map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {choice.name || "Chưa đặt tên"}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button"
                        disabled={!selectedRows.length}
                        onClick={() =>
                          commit(
                            rows.map((row) =>
                              selectedSet.has(row.id)
                                ? { ...row, speakerId }
                                : row,
                            ),
                          )
                        }
                      >
                        Gán giọng
                      </button>
                    </>
                  )}
                </div>
                {!rows.length && (
                  <p className="dialog-help">
                    Nhập TXT hoặc bấm Sửa TXT toàn bộ để bắt đầu.
                  </p>
                )}
                <VirtualList
                  entries={listItems}
                  label="Các lượt nói"
                  renderItem={(item) => {
                    const order = item.order,
                      scene = grouped.scenes.get(order)!;
                    if (item.kind === "header") {
                      const image = imageMap.get(order);
                      return (
                        <div
                          className="narration-scene-heading"
                          style={{ paddingTop: 18 }}
                        >
                          {image && (
                            <img
                              src={proxySource(image.src, 384)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`Chọn cả cảnh ${order}`}
                              checked={scene.every((row) =>
                                selectedSet.has(row.id),
                              )}
                              onChange={(e) =>
                                setSelected((previous) =>
                                  e.target.checked
                                    ? [
                                        ...new Set([
                                          ...previous,
                                          ...scene.map((row) => row.id),
                                        ]),
                                      ]
                                    : previous.filter(
                                        (id) =>
                                          !scene.some((row) => row.id === id),
                                      ),
                                )
                              }
                            />
                            Cảnh {order}
                          </label>
                          <small>{scene.length} lượt nói</small>
                        </div>
                      );
                    }
                    if (item.kind === "add")
                      return (
                        <div style={{ paddingBottom: 26 }}>
                          <button
                            className="button"
                            disabled={scene.length >= 100}
                            onClick={() => {
                              const last = rows.reduce(
                                (last, row, index) =>
                                  row.order === order ? index : last,
                                -1,
                              );
                              const next = [...rows];
                              next.splice(last + 1, 0, {
                                id: crypto.randomUUID(),
                                order,
                                text: "",
                                speakerId,
                              });
                              commit(next);
                            }}
                          >
                            Thêm lượt nói
                          </button>
                        </div>
                      );
                    const { row, index } = item;
                    return (
                      <div
                        className="narration-turn"
                        data-selected={selectedSet.has(row.id)}
                      >
                        <div className="narration-turn-heading">
                          <input
                            type="checkbox"
                            aria-label={`Chọn cảnh ${order} lượt ${index + 1}`}
                            checked={selectedSet.has(row.id)}
                            onChange={(e) =>
                              setSelected((previous) =>
                                e.target.checked
                                  ? [...previous, row.id]
                                  : previous.filter((id) => id !== row.id),
                              )
                            }
                          />
                          <span>Lượt {index + 1}</span>
                          {settings.enabled && (
                            <select
                              aria-label={`Người nói cảnh ${order} lượt ${index + 1}`}
                              value={row.speakerId}
                              onChange={(e) =>
                                commit(
                                  rows.map((item) =>
                                    item.id === row.id
                                      ? { ...item, speakerId: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {choices.map((choice) => (
                                <option value={choice.id} key={choice.id}>
                                  {choice.name || "Chưa đặt tên"}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <BufferedTextarea
                          id={row.id}
                          text={row.text}
                          label={`Lời cảnh ${order} lượt ${index + 1}`}
                          onDraft={onDraft}
                          onFlush={buffered.flush}
                          onCursor={onCursor}
                        />
                        <div className="narration-turn-actions">
                          <button
                            className="button"
                            onClick={() =>
                              split(row, cursors.current[row.id] ?? 0)
                            }
                          >
                            Tách tại con trỏ
                          </button>
                          <button
                            className="button"
                            disabled={scene.length <= 1}
                            onClick={() => {
                              commit(rows.filter((item) => item.id !== row.id));
                              setSelected((previous) =>
                                previous.filter((id) => id !== row.id),
                              );
                            }}
                          >
                            Xóa lượt
                          </button>
                        </div>
                      </div>
                    );
                  }}
                />
              </>
            )}
          </section>
        </div>
        {localError && (
          <p className="dialog-error" role="alert">
            {localError}
          </p>
        )}
        {settings.enabled && (
          <details className="compact-details narration-settings">
            <summary>
              Thiết lập TTS ·{" "}
              {settings.model === "turbo"
                ? "Turbo · en"
                : `Multilingual · ${settings.languageId}`}{" "}
              · {settings.outputFormat.toUpperCase()}
            </summary>
            <TtsPanel
              settings={settings}
              busy={busy}
              ready={ready}
              voices={voices}
              canGenerate={canGenerate && !raw && !staleAssignments}
              onChange={onChange}
              onReference={(file) => onReference(file, "default")}
              onGenerate={onGenerate}
              hideVoiceSource
              hideResults
            />
          </details>
        )}
        <div className="narration-bottom">
          <span>
            {ready
              ? `${voices.length} cảnh đã có voice`
              : "Đổi lời hoặc phân vai sẽ cần cập nhật voice và căn lại phụ đề."}
          </span>
          {settings.enabled && (
            <button
              className="button primary"
              disabled={
                !canGenerate || raw || staleAssignments || ready || !rows.length
              }
              onClick={() => {
                buffered.flush();
                setTimeout(() => generateRef.current(), 0);
              }}
            >
              <Icon name="voice" />
              {ready ? "Voice đã cập nhật" : "Tạo / cập nhật voice"}
            </button>
          )}
        </div>
        {audio && (!settings.enabled || ready) && (
          <details className="compact-details">
            <summary>Nghe và tải voice theo cảnh</summary>
            <select
              aria-label="Chọn cảnh nghe voice"
              value={audio.id}
              onChange={(e) => setVoiceId(e.target.value)}
            >
              {voices.map((voice, index) => (
                <option key={voice.id} value={voice.id}>
                  Cảnh {index + 1} · {voice.duration.toFixed(1)}s
                </option>
              ))}
            </select>
            <audio
              key={audio.src}
              src={audio.src}
              controls
              preload="none"
              aria-label="Nghe voice đã ghép"
            />
            <a className="tts-download" href={audio.src} download={audio.name}>
              Tải voice cảnh này
              <Icon name="download" />
            </a>
          </details>
        )}
      </fieldset>
      <input
        ref={reference}
        type="file"
        accept=".wav,.mp3,audio/wav,audio/mpeg"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onReference(file, speakerId);
        }}
      />
    </div>
  );
}
