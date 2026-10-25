import { Icon } from "../icons";

export function AnimationMode({
  type,
  mode,
  count,
  total,
  onMode,
  onAll,
  onShuffle,
}: {
  type: "motion" | "transition";
  mode: "auto" | "single" | "random";
  count: number;
  total: number;
  onMode: (mode: "auto" | "single" | "random") => void;
  onAll: () => void;
  onShuffle: () => void;
}) {
  return (
    <div className="animation-mode">
      <div
        className="animation-mode-buttons"
        role="group"
        aria-label={
          type === "motion" ? "Chế độ chuyển động" : "Chế độ chuyển cảnh"
        }
      >
        {(
          [
            ["auto", type === "motion" ? "Luân phiên" : "Tự động"],
            ["single", "Chọn một"],
            ["random", "Ngẫu nhiên"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={mode === id}
            onClick={() => {
              if (mode !== id) onMode(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "random" && (
        <>
          <div className="random-selection-actions">
            <span aria-live="polite">{count} kiểu đã chọn</span>
            <button
              type="button"
              className="text-button"
              disabled={count === total}
              onClick={onAll}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={
                type === "motion"
                  ? "Đảo lại chuyển động"
                  : "Đảo lại chuyển cảnh"
              }
              title="Đảo lại kết quả ngẫu nhiên"
              onClick={onShuffle}
            >
              <Icon name="shuffle" />
            </button>
          </div>
          <p className="control-hint">
            Đánh dấu các kiểu được dùng. Giữ ít nhất một kiểu.
          </p>
        </>
      )}
    </div>
  );
}
