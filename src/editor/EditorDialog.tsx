import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../icons";

export function EditorDialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    else if (!open && element?.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={"editor-dialog" + (wide ? " is-wide" : "")}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng cửa sổ"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {open && <div className="editor-dialog-body">{children}</div>}
      <footer>
        <button type="button" className="button" onClick={onClose}>
          Xong
        </button>
      </footer>
    </dialog>
  );
}
