import { useState } from "react";
import { id, type Project, type Scene } from "../model";
import {
  ACTIONS,
  actorCapabilities,
  type ActorInstance,
} from "../actors/types";
import {
  fitObject,
  newObject,
  setObjectMotion,
  type ObjectMotion,
} from "../actors/timing";
import { Field, Numeric, Select } from "../panels/Controls";
import { AssetPreview } from "./AssetPreview";
import { Icon } from "../icons";

export function SceneObjectsPanel({
  project,
  scene,
  objectId,
  onSelect,
  onChange,
  onAll,
  onLibrary,
  onPlay,
}: {
  project: Project;
  scene: Scene;
  objectId: string | null;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<Scene>) => void;
  onAll: (object: ActorInstance) => void;
  onLibrary: () => void;
  onPlay: () => void;
}) {
  const [assetId, setAssetId] = useState(""),
    [preview, setPreview] = useState(false);
  const assets = project.actors ?? [],
    objects = scene.actors ?? [];
  const object = objects.find((i) => i.id === objectId) ?? objects[0];
  const actor = assets.find((a) => a.id === object?.actorId);
  const asset = assets.find((a) => a.id === assetId) ?? actor ?? assets[0];
  const update = (next: ActorInstance[]) =>
    onChange({ actors: next, actorsEdited: true });
  const patch = (fields: Partial<ActorInstance>) => {
    if (object)
      update(
        objects.map((i) =>
          i.id === object.id
            ? fitObject({ ...i, ...fields, manual: true }, scene.duration)
            : i,
        ),
      );
  };
  const add = (motion: ObjectMotion = "none") => {
    if (!asset || objects.length >= 4) return;
    const next = setObjectMotion(
      {
        ...newObject(asset, id(), project.width, project.height),
        z: objects.length,
      },
      motion,
      scene.duration,
    );
    update([...objects, next]);
    onSelect(next.id);
  };
  const main = object?.actions.find(
    (a) => a.kind !== "enter" && a.kind !== "exit",
  );
  const capabilities = actor
    ? actorCapabilities(actor).filter((k) => !["enter", "exit"].includes(k))
    : [];
  return (
    <div className="scene-object-editor">
      <div className="object-library-column">
        <Field label="Tài nguyên">
          <select
            value={asset?.id ?? ""}
            onChange={(e) => setAssetId(e.target.value)}
          >
            {!assets.length && <option value="">Chưa có tài nguyên</option>}
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="row-buttons">
          <button
            type="button"
            className="button primary"
            disabled={!asset || objects.length >= 4}
            onClick={() => add()}
          >
            <Icon name="plus" size={15} />
            Thêm vào ảnh này
          </button>
          <button
            type="button"
            className="button"
            disabled={!asset}
            onClick={() => setPreview(!preview)}
          >
            Xem động tác
          </button>
        </div>
        <button type="button" className="text-button" onClick={onLibrary}>
          Nhập PNG, bộ phận hoặc sprite
        </button>
        <div className="object-layer-list" aria-label="Vật thể trong cảnh">
          {objects.map((i) => (
            <button
              type="button"
              className="button"
              key={i.id}
              aria-pressed={object?.id === i.id}
              onClick={() => {
                onSelect(i.id);
                setAssetId(i.actorId);
              }}
            >
              {assets.find((a) => a.id === i.actorId)?.name ??
                "Thiếu tài nguyên"}
              {i.manual ? " · đã đặt" : " · từ mẫu"}
            </button>
          ))}
        </div>
        <p className="field-hint">
          Tối đa 4 lớp đối tượng. Kéo trực tiếp trên khung xem trước; kéo nút
          góc để đổi kích thước.
        </p>
      </div>
      {object && actor ? (
        <div className="object-properties">
          <div className="object-heading">
            <strong>{actor.name}</strong>
            <button type="button" className="button" onClick={onPlay}>
              <Icon name="play" size={14} />
              Xem trong cảnh
            </button>
          </div>
          <p className="field-hint">
            Khi tạm dừng ở bảng này, đối tượng đứng tại vị trí đặt. Nhấn Phát để
            xem chuyển động thật.
          </p>
          <div className="quick-fields">
            <Numeric
              label="Ngang (%)"
              min={0}
              max={100}
              step={1}
              value={object.x}
              onChange={(x) => patch({ x })}
            />
            <Numeric
              label="Chân / đáy (%)"
              min={0}
              max={100}
              step={1}
              value={object.y}
              onChange={(y) => patch({ y })}
            />
            <Numeric
              label="Chiều cao (%)"
              min={0.1}
              max={90}
              step={1}
              value={object.height}
              onChange={(height) => patch({ height })}
            />
            <button
              type="button"
              className="button"
              aria-pressed={object.flip}
              onClick={() => patch({ flip: !object.flip })}
            >
              Lật ngang
            </button>
          </div>
          <div className="quick-fields">
            <Select
              label="Vào cảnh"
              value={
                object.actions.some((a) => a.kind === "enter")
                  ? object.entrance
                  : "none"
              }
              options={{
                none: "Có sẵn",
                slide: "Trượt vào",
                fade: "Hiện dần",
                pop: "Bật lên",
              }}
              onChange={(style) => {
                if (style === "none")
                  patch({
                    entrance: "none",
                    actions: object.actions.filter((a) => a.kind !== "enter"),
                  });
                else
                  update(
                    objects.map((i) =>
                      i.id === object.id
                        ? setObjectMotion(
                            i,
                            `enter-${style}` as ObjectMotion,
                            scene.duration,
                          )
                        : i,
                    ),
                  );
              }}
            />
            <Select
              label="Ra cảnh"
              value={
                object.actions.some((a) => a.kind === "exit")
                  ? object.exitStyle
                  : "none"
              }
              options={{
                none: "Giữ lại",
                slide: "Trượt ra",
                fade: "Mờ đi",
                pop: "Thu nhỏ",
              }}
              onChange={(style) => {
                if (style === "none")
                  patch({
                    exitStyle: "none",
                    actions: object.actions.filter((a) => a.kind !== "exit"),
                  });
                else
                  update(
                    objects.map((i) =>
                      i.id === object.id
                        ? setObjectMotion(
                            i,
                            `exit-${style}` as ObjectMotion,
                            scene.duration,
                          )
                        : i,
                    ),
                  );
              }}
            />
            <Select
              label="Cử động chính"
              value={main?.kind ?? "none"}
              options={{
                none: "Không thêm",
                ...Object.fromEntries(capabilities.map((k) => [k, ACTIONS[k]])),
              }}
              onChange={(kind) => {
                if (kind === "none")
                  patch({
                    actions: object.actions.filter(
                      (a) => a.kind === "enter" || a.kind === "exit",
                    ),
                  });
                else
                  update(
                    objects.map((i) =>
                      i.id === object.id
                        ? setObjectMotion(
                            i,
                            kind as ObjectMotion,
                            scene.duration,
                          )
                        : i,
                    ),
                  );
              }}
            />
          </div>
          <details>
            <summary>Thời gian, lớp & hiệu ứng vật thể</summary>
            <div className="quick-fields">
              <Numeric
                label="Xuất hiện từ (s)"
                min={0}
                max={Math.max(0, scene.duration - 0.05)}
                step={0.1}
                value={object.from}
                onChange={(from) => patch({ from })}
              />
              <Numeric
                label="Hiển thị đến (s)"
                min={object.from + 0.05}
                max={scene.duration}
                step={0.1}
                value={object.to ?? scene.duration}
                onChange={(to) => patch({ to })}
              />
              <Numeric
                label="Độ rõ (%)"
                min={0}
                max={100}
                step={5}
                value={object.opacity * 100}
                onChange={(opacity) => patch({ opacity: opacity / 100 })}
              />
              <Numeric
                label="Thứ tự lớp"
                min={0}
                max={100}
                step={1}
                value={object.z}
                onChange={(z) => patch({ z })}
              />
              <Numeric
                label="Bóng"
                min={0}
                max={50}
                step={1}
                value={object.shadow}
                onChange={(shadow) => patch({ shadow })}
              />
              <Numeric
                label="Phát sáng"
                min={0}
                max={50}
                step={1}
                value={object.glow}
                onChange={(glow) => patch({ glow })}
              />
              <Numeric
                label="Cường độ chờ"
                min={0}
                max={2}
                step={0.1}
                value={object.intensity}
                onChange={(intensity) => patch({ intensity })}
              />
            </div>
            {main && (
              <div className="quick-fields">
                <Numeric
                  label="Bắt đầu cử động (s)"
                  min={object.from}
                  max={object.to ?? scene.duration}
                  step={0.1}
                  value={main.start}
                  onChange={(start) =>
                    patch({
                      actions: object.actions.map((a) =>
                        a === main ? { ...a, start } : a,
                      ),
                    })
                  }
                />
                <Numeric
                  label="Kết thúc cử động (s)"
                  min={main.start + 0.05}
                  max={object.to ?? scene.duration}
                  step={0.1}
                  value={main.end}
                  onChange={(end) =>
                    patch({
                      actions: object.actions.map((a) =>
                        a === main ? { ...a, end } : a,
                      ),
                    })
                  }
                />
                <Numeric
                  label="Cường độ cử động"
                  min={0}
                  max={2}
                  step={0.1}
                  value={main.intensity}
                  onChange={(intensity) =>
                    patch({
                      actions: object.actions.map((a) =>
                        a === main ? { ...a, intensity } : a,
                      ),
                    })
                  }
                />
              </div>
            )}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={object.speaking}
                onChange={(e) => patch({ speaking: e.target.checked })}
              />
              Cử động theo voice cảnh (miệng cần bộ phận/clip talk)
            </label>
          </details>
          <div className="row-buttons">
            <button
              type="button"
              className="button"
              onClick={() => onAll(object)}
            >
              Dùng vị trí & chuyển động này cho mọi cảnh
            </button>
            <button
              type="button"
              className="button"
              disabled={objects.length >= 4}
              onClick={() => {
                const clone = {
                  ...structuredClone(object),
                  id: id(),
                  x: Math.min(100, object.x + 8),
                  z: Math.min(100, object.z + 1),
                  manual: true,
                };
                update([...objects, clone]);
                onSelect(clone.id);
              }}
            >
              <Icon name="copy" size={14} />
              Nhân bản
            </button>
            <button
              type="button"
              className="button"
              onClick={() => update(objects.filter((i) => i.id !== object.id))}
            >
              <Icon name="trash" size={14} />
              Xoá lớp
            </button>
          </div>
        </div>
      ) : (
        <p className="object-empty">
          Chọn tài nguyên rồi thêm vào ảnh này. Vị trí và động tác thuộc riêng
          cảnh; có thể dùng lại cho các cảnh khác khi cần.
        </p>
      )}
      {preview && asset && (
        <AssetPreview
          key={asset.id}
          actor={asset}
          onClose={() => setPreview(false)}
          onApply={(motion) => {
            if (object && object.actorId === asset.id)
              update(
                objects.map((i) =>
                  i.id === object.id
                    ? setObjectMotion(i, motion, scene.duration)
                    : i,
                ),
              );
            else add(motion);
          }}
        />
      )}
    </div>
  );
}
