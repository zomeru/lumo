import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorMessage,
} from "@lumolynk/ui";
import type { ReactNode, FormEvent } from "react";
export function HrDialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Changes apply to this workspace.</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function HrForm({
  children,
  onSubmit,
  busy,
  error,
  label = "Save",
  readOnly = false,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  busy: boolean;
  error: unknown;
  label?: string;
  readOnly?: boolean;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      {children}
      <ErrorMessage error={error} />
      {!readOnly && (
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : label}
        </Button>
      )}
    </form>
  );
}
export const formString = (data: FormData, name: string) =>
  typeof data.get(name) === "string" ? (data.get(name) as string) : "";

export function saveCsv(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
