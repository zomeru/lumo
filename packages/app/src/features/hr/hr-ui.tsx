import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorMessage,
} from "@lumo/ui";
import type { ReactNode, FormEvent } from "react";
export function HrTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (tab: string) => void;
}) {
  return (
    <nav aria-label="Section views" className="mb-5 flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => (
        <Button
          key={tab}
          variant="ghost"
          aria-current={tab === value ? "page" : undefined}
          className={
            tab === value
              ? "rounded-b-none border-b-2 border-primary text-primary"
              : "rounded-b-none text-muted-foreground"
          }
          onClick={() => onChange(tab)}
        >
          {tab}
        </Button>
      ))}
    </nav>
  );
}
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
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  busy: boolean;
  error: unknown;
  label?: string;
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
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : label}
      </Button>
    </form>
  );
}
export const formString = (data: FormData, name: string) =>
  typeof data.get(name) === "string" ? (data.get(name) as string) : "";
