import { useRef, useState } from "react";
import type {
  ActorDefinition,
  ActorImportOptions,
  ActorSettings,
  RigLayer,
  RigPart,
} from "../actors/types";
import {
  ACTIONS,
  actorCapabilities,
  actorImages,
  defaultActorImport,
} from "../actors/types";
import { parseActorLibrary } from "../actors/schema";
import type { Project } from "../model";
import { cueStarts } from "../actors/plan";
import { Field, Numeric, Select } from "../panels/Controls";
import { Icon } from "../icons";
import { actorDescriptor } from "../actors/import";
import { AssetPreview } from "./AssetPreview";

export function ActorPanel({
  project,
  settings,
  disabled,
  onChange,
  onImport,
  onLibrary,
}: {
  project: Project;
  settings: ActorSettings;
  disabled: boolean;
  onChange: (settings: ActorSettings) => void;
  onImport: (
    files: File[],
    options: ActorImportOptions,
  ) => Promise<ActorDefinition[]>;
  onLibrary: (actors: ActorDefinition[]) => void;
}) {
  const [options, setOptions] = useState(defaultActorImport),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const [editActor, setEditActor] = useState(""),
    [editPart, setEditPart] = useState<RigPart>("head");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(1),
    [cueIndex, setCueIndex] = useState(1),
    [cueActor, setCueActor] = useState(""),
    [cueAction, setCueAction] = useState<keyof typeof ACTIONS>("jump");
  const imagesInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null);
  const actors = project.actors ?? [],
    locked = disabled || working;
  const selected = !settings.enabled
    ? []
    : settings.selected.length
      ? actors.filter((a) => settings.selected.includes(a.id))
      : actors;
  const active = actors.find((a) => a.id === editActor) ?? actors[0];
  const part = active?.kind === "rig" ? active.parts[editPart] : undefined;
  const sourceActor = actors.find((a) => a.id === cueActor) ?? actors[0];
  const capabilities = sourceActor
    ? actorCapabilities(sourceActor).filter(
        (k) => !["enter", "exit"].includes(k),
      )
    : [];
  const action = capabilities.includes(cueAction)
    ? cueAction
    : (capabilities[0] ?? "jump");
  const saveDescriptor = () => {
    if (!active) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(actorDescriptor(active), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "character.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const receive = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setWorking(true);
    setError("");
    try {
      const imported = await onImport(Array.from(files), options);
      onChange({
        ...settings,
        selected: settings.selected.length
          ? [...new Set([...settings.selected, ...imported.map((a) => a.id)])]
          : [],
      });
      setPreviewId(imported[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không nhập được nhân vật.");
    } finally {
      setWorking(false);
    }
  };
  const patchPart = (patch: Partial<RigLayer>) => {
    if (!active || active.kind !== "rig" || !part) return;
    try {
      onLibrary(
        parseActorLibrary(
          actors.map((a) =>
            a.id === active.id
              ? {
                  ...active,
                  parts: { ...active.parts, [editPart]: { ...part, ...patch } },
                }
              : a,
          ),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đổi được bố cục.");
    }
  };
  return (
    <section className="actor-panel" aria-label="Thư viện nhân vật và vật thể">
      <div className="actor-section-title">
        <h3>Nhân vật & vật thể</h3>
        <span>{actors.length}/20 bộ</span>
      </div>
      <p className="field-hint">
        Nhập một lần, xem động tác rồi đặt vào từng ảnh ở bảng Nhân vật & vật
        thể. Có thể dùng lại vị trí và chuyển động cho nhiều cảnh.
      </p>
      <fieldset disabled={locked}>
        <input
          ref={imagesInput}
          type="file"
          multiple
          hidden
          accept="image/png,image/webp,.png,.webp,.json"
          onChange={(e) => {
            void receive(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            void receive(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="auto-input-actions">
          <button
            type="button"
            className="button"
            onClick={() => imagesInput.current?.click()}
          >
            <Icon name="plus" size={15} />
            Thêm PNG / sprite
          </button>
          <button
            type="button"
            className="button"
            onClick={() => folderInput.current?.click()}
          >
            <Icon name="folder" size={15} />
            Thêm thư mục
          </button>
        </div>
        <details className="actor-import-options">
          <summary>Loại tài nguyên & cách chuẩn bị</summary>
          <Select
            label="Nhận dạng đầu vào"
            value={options.kind}
            options={{
              auto: "Tự nhận dạng",
              cutout: "PNG tách nền",
              rig: "Các bộ phận",
              sprite: "Sprite sheet / chuỗi frame",
            }}
            onChange={(kind) =>
              setOptions({
                ...options,
                kind: kind as ActorImportOptions["kind"],
              })
            }
          />
          <p className="field-hint">
            Bộ phận: head.png, body.png, arm_left.png… Sprite:
            idle_4x2_12fps.png hoặc thư mục idle/001.png, idle/002.png…
          </p>
          {options.kind === "sprite" && (
            <div className="actor-three">
              <Numeric
                label="Số cột"
                min={1}
                max={64}
                step={1}
                value={options.columns}
                onChange={(columns) => setOptions({ ...options, columns })}
              />
              <Numeric
                label="Số hàng"
                min={1}
                max={64}
                step={1}
                value={options.rows}
                onChange={(rows) => setOptions({ ...options, rows })}
              />
              <Numeric
                label="FPS động tác"
                min={1}
                max={60}
                step={1}
                value={options.fps}
                onChange={(fps) => setOptions({ ...options, fps })}
              />
            </div>
          )}
          {options.kind === "sprite" && (
            <Numeric
              label="Số frame sử dụng (0 = toàn bộ ô)"
              min={0}
              max={240}
              step={1}
              value={options.frameCount}
              onChange={(frameCount) => setOptions({ ...options, frameCount })}
            />
          )}
          <Field label="Tên bộ (tuỳ chọn)">
            <input
              value={options.name ?? ""}
              maxLength={200}
              onChange={(e) => setOptions({ ...options, name: e.target.value })}
              placeholder="Tự lấy từ tên file/thư mục"
            />
          </Field>
          {options.kind === "rig" && (
            <Select
              label="Cách xếp bộ phận"
              value={options.rigLayout}
              options={{
                auto: "Tự nhận dạng theo kích thước",
                canvas: "Các lớp đã khớp trên cùng canvas",
                humanoid: "Các phần cắt rời · xếp theo mẫu người",
              }}
              onChange={(rigLayout) =>
                setOptions({
                  ...options,
                  rigLayout: rigLayout as ActorImportOptions["rigLayout"],
                })
              }
            />
          )}
        </details>
        {actors.length > 0 && (
          <>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  onChange({ ...settings, enabled: e.target.checked })
                }
              />
              Tự thêm theo mẫu khi dựng (tuỳ chọn)
            </label>
            <ul className="actor-library">
              {actors.map((actor) => (
                <li key={actor.id}>
                  <label>
                    {settings.enabled && (
                      <input
                        type="checkbox"
                        checked={selected.some((s) => s.id === actor.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected.map((a) => a.id), actor.id]
                            : selected
                                .filter((a) => a.id !== actor.id)
                                .map((a) => a.id);
                          onChange({
                            ...settings,
                            enabled: next.length > 0,
                            selected: next.length ? [...new Set(next)] : [],
                          });
                        }}
                      />
                    )}
                    <span className="actor-thumb">
                      <img
                        src={
                          actor.kind === "rig"
                            ? actor.parts.head?.image.src
                            : actorImages(actor)[0]?.src
                        }
                        alt=""
                      />
                    </span>
                    <span>
                      <strong>{actor.name}</strong>
                      <small>
                        {
                          {
                            cutout: "PNG nguyên khối",
                            rig: "Bộ phận có khớp",
                            sprite: "Sprite dựng sẵn",
                          }[actor.kind]
                        }{" "}
                        · {actorCapabilities(actor).length} động tác
                      </small>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="button"
                    aria-pressed={previewId === actor.id}
                    onClick={() =>
                      setPreviewId(previewId === actor.id ? null : actor.id)
                    }
                  >
                    <Icon name="play" size={14} />
                    Xem động tác
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Bỏ bộ ${actor.name}`}
                    onClick={() => {
                      const remaining = actors.filter((a) => a.id !== actor.id);
                      onLibrary(remaining);
                      onChange({
                        ...settings,
                        enabled: remaining.length > 0 && settings.enabled,
                        selected: settings.selected.filter(
                          (id) => id !== actor.id,
                        ),
                        cues: settings.cues.filter((c) => c.actor !== actor.id),
                      });
                    }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              ))}
            </ul>
            {actors.find((a) => a.id === previewId) && (
              <AssetPreview
                key={previewId}
                actor={actors.find((a) => a.id === previewId)!}
                onClose={() => setPreviewId(null)}
              />
            )}
            {settings.enabled && (
              <>
                <Select
                  label="Mức cử động"
                  value={settings.behavior}
                  options={{
                    gentle: "Nhẹ nhàng · ít cử động",
                    story: "Kể chuyện · cử chỉ theo câu",
                    energetic: "Sinh động · nhiều cử động",
                  }}
                  onChange={(behavior) =>
                    onChange({
                      ...settings,
                      behavior: behavior as ActorSettings["behavior"],
                    })
                  }
                />
                <Select
                  label="Phân vai"
                  value={settings.cast}
                  options={{
                    rotate: "Luân phiên một nhân vật mỗi cảnh",
                    all: "Cùng xuất hiện (tối đa 4)",
                    first: "Một nhân vật xuyên suốt",
                  }}
                  onChange={(cast) =>
                    onChange({
                      ...settings,
                      cast: cast as ActorSettings["cast"],
                    })
                  }
                />
                <Select
                  label="Ai đang nói?"
                  value={settings.speaker}
                  options={{
                    narrator: "Người kể ngoài hình",
                    first: "Nhân vật đầu tiên",
                    rotate: "Luân phiên người nói",
                  }}
                  onChange={(speaker) =>
                    onChange({
                      ...settings,
                      speaker: speaker as ActorSettings["speaker"],
                    })
                  }
                />
                <details>
                  <summary>Bố cục & vào cảnh</summary>
                  <Select
                    label="Vị trí"
                    value={settings.layout}
                    options={{
                      auto: "Tự xếp, đổi bên theo cảnh",
                      left: "Bên trái",
                      right: "Bên phải",
                      center: "Chính giữa",
                    }}
                    onChange={(layout) =>
                      onChange({
                        ...settings,
                        layout: layout as ActorSettings["layout"],
                      })
                    }
                  />
                  <Select
                    label="Kích thước"
                    value={settings.size}
                    options={{ small: "Nhỏ", medium: "Vừa", large: "Lớn" }}
                    onChange={(size) =>
                      onChange({
                        ...settings,
                        size: size as ActorSettings["size"],
                      })
                    }
                  />
                  <Select
                    label="Xuất hiện"
                    value={settings.entrance}
                    options={{
                      slide: "Đi từ ngoài khung vào",
                      fade: "Hiện dần",
                      pop: "Bật lên",
                      none: "Có sẵn trong cảnh",
                    }}
                    onChange={(entrance) =>
                      onChange({
                        ...settings,
                        entrance: entrance as ActorSettings["entrance"],
                      })
                    }
                  />
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={settings.exit}
                      onChange={(e) =>
                        onChange({ ...settings, exit: e.target.checked })
                      }
                    />
                    Tự đi ra ở cuối cảnh
                  </label>
                </details>
                <details>
                  <summary>
                    Chỉ định động tác theo câu ({settings.cues.length})
                  </summary>
                  <p className="field-hint">
                    Tuỳ chọn. Giữ trống để tự chọn động tác. Nhân vật cần có
                    trong dàn cảnh; mốc câu lấy từ phụ đề đã căn.
                  </p>
                  <div className="auto-two">
                    <Numeric
                      label="Cảnh"
                      min={1}
                      max={300}
                      step={1}
                      value={sceneIndex}
                      onChange={setSceneIndex}
                    />
                    <Numeric
                      label="Câu / cụm phụ đề"
                      min={1}
                      max={300}
                      step={1}
                      value={cueIndex}
                      onChange={setCueIndex}
                    />
                  </div>
                  <Select
                    label="Nhân vật"
                    value={sourceActor?.id ?? ""}
                    options={Object.fromEntries(
                      actors.map((a) => [a.id, a.name]),
                    )}
                    onChange={setCueActor}
                  />
                  <Select
                    label="Động tác"
                    value={action}
                    options={Object.fromEntries(
                      capabilities.map((k) => [k, ACTIONS[k]]),
                    )}
                    onChange={(v) => setCueAction(v as keyof typeof ACTIONS)}
                  />
                  {project.scenes[sceneIndex - 1] && (
                    <p className="field-hint">
                      Bản dựng hiện tại có{" "}
                      {cueStarts(project.scenes[sceneIndex - 1]).length} mốc
                      trong cảnh này.
                    </p>
                  )}
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (!sourceActor) return;
                      onChange({
                        ...settings,
                        cues: [
                          ...settings.cues,
                          {
                            scene: sceneIndex,
                            cue: cueIndex,
                            actor: sourceActor.id,
                            action,
                          },
                        ],
                      });
                    }}
                  >
                    Thêm vào kịch bản
                  </button>
                  <ul className="actor-cue-list">
                    {settings.cues.map((cue, i) => (
                      <li key={`${i}-${cue.actor}`}>
                        <span>
                          Cảnh {cue.scene} · câu {cue.cue}:{" "}
                          {actors.find((a) => a.id === cue.actor)?.name ??
                            "Thiếu nhân vật"}{" "}
                          — {ACTIONS[cue.action]}
                        </span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Bỏ động tác"
                          onClick={() =>
                            onChange({
                              ...settings,
                              cues: settings.cues.filter(
                                (_, index) => index !== i,
                              ),
                            })
                          }
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
            {actors.some((a) => a.kind === "rig") && (
              <details>
                <summary>Chỉnh bố cục bộ phận (tuỳ chọn)</summary>
                <Select
                  label="Bộ nhân vật"
                  value={active?.id ?? ""}
                  options={Object.fromEntries(
                    actors.map((a) => [a.id, a.name]),
                  )}
                  onChange={setEditActor}
                />
                {active?.kind === "rig" && (
                  <>
                    <Select
                      label="Bộ phận"
                      value={editPart}
                      options={Object.fromEntries(
                        Object.keys(active.parts).map((k) => [k, k]),
                      )}
                      onChange={(v) => setEditPart(v as RigPart)}
                    />
                    {part && (
                      <div className="auto-two">
                        {(
                          [
                            "x",
                            "y",
                            "width",
                            "height",
                            "pivotX",
                            "pivotY",
                          ] as const
                        ).map((k) => (
                          <Numeric
                            key={k}
                            label={
                              {
                                x: "Ngang (%)",
                                y: "Dọc (%)",
                                width: "Rộng (%)",
                                height: "Cao (%)",
                                pivotX: "Khớp ngang (%)",
                                pivotY: "Khớp dọc (%)",
                              }[k]
                            }
                            min={k === "width" || k === "height" ? 0.1 : 0}
                            max={k === "width" || k === "height" ? 300 : 100}
                            step={1}
                            value={part[k]}
                            onChange={(v) => patchPart({ [k]: v })}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </details>
            )}
            <details>
              <summary>Lưu mô tả bộ để dùng lại</summary>
              <Select
                label="Bộ nhân vật"
                value={active?.id ?? ""}
                options={Object.fromEntries(actors.map((a) => [a.id, a.name]))}
                onChange={setEditActor}
              />
              <button type="button" className="button" onClick={saveDescriptor}>
                Tải mô tả bộ
              </button>
              <p className="field-hint">
                Đặt file character.json được tạo sẵn vào thư mục ảnh gốc của bộ
                này. Lần sau chỉ chọn thư mục; hàng/cột sprite và khớp đã chỉnh
                được nhận lại tự động.
              </p>
            </details>
          </>
        )}
      </fieldset>
      {working && <p role="status">Đang nhập ảnh/frame nhân vật…</p>}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </section>
  );
}
