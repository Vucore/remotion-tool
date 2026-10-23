import { useState } from "react";
import { Icon } from "../icons";

export function StoryInput({
  title,
  icon,
  hint,
  summary,
  selected,
  busy,
  onChoose,
  onDrop,
  onClear,
}: {
  title: string;
  icon: string;
  hint: string;
  summary?: string;
  selected: boolean;
  busy: boolean;
  onChoose: () => void;
  onDrop: (files: File[]) => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={"input-upload" + (dragOver ? " is-dragging" : "")}
      role="group"
      aria-label={title}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!busy) onDrop(Array.from(e.dataTransfer.files));
      }}
    >
      <Icon name={icon} />
      <div className="input-upload-content">
        <strong>{title}</strong>
        {!selected && <p>{hint}</p>}
        {selected && summary && (
          <span className="input-file-summary" title={summary}>
            {summary}
          </span>
        )}
      </div>
      <div className="input-upload-actions">
        <button className="button" disabled={busy} onClick={onChoose}>
          {selected ? "Thay " : "Chọn "}
          {title === "Ảnh bối cảnh"
            ? "ảnh"
            : title === "Voice"
              ? "voice"
              : "TXT"}
        </button>
        {selected && (
          <button
            className="clear-input"
            disabled={busy}
            aria-label={"Bỏ " + title.toLowerCase() + " đã chọn"}
            title="Bỏ lựa chọn"
            onClick={onClear}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
    </div>
  );
}
