import { useRef } from "react";

export function ConfirmAction({
  label,
  message,
  disabled,
  onConfirm,
}: {
  label: string;
  message: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="danger compact"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog ref={dialog} aria-label={label}>
        <h2>{label}?</h2>
        <p>{message}</p>
        <div className="actions">
          <button onClick={() => dialog.current?.close()}>Cancel</button>
          <button
            className="danger"
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            Confirm {label.toLowerCase()}
          </button>
        </div>
      </dialog>
    </>
  );
}
