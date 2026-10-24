import { memo, useLayoutEffect, useState } from "react";
export const BufferedTextarea = memo(function BufferedTextarea({
  id,
  text,
  label,
  onDraft,
  onFlush,
  onCursor,
}: {
  id: string;
  text: string;
  label: string;
  onDraft: (id: string, text: string) => void;
  onFlush: () => void;
  onCursor: (id: string, position: number) => void;
}) {
  const [value, setValue] = useState(text);
  useLayoutEffect(() => setValue(text), [text]);
  return (
    <textarea
      aria-label={label}
      rows={3}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        onDraft(id, next);
      }}
      onBlur={onFlush}
      onSelect={(e) => onCursor(id, e.currentTarget.selectionStart)}
    />
  );
});
