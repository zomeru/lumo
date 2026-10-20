import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./utils";

export { cn } from "./utils";
export { Button, buttonVariants } from "./button";
export { Input, PasswordInput, Textarea, FormField, Field } from "./input";
export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectField,
  type SelectOption,
} from "./select";
export { Combobox, MultiSelectField } from "./combobox";
export * from "./dialog";
export * from "./popover";
export * from "./menu";
export * from "./controls";
export * from "./display";
export { ThemeProvider, ThemeMenu, initializeTheme } from "./theme";
export {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  ToastProvider,
  useToast,
} from "./toast";

const logoUrl = new URL("./assets/lumo-logo.png", import.meta.url).href;

export function Brand({
  compact = false,
  className,
  ...props
}: ComponentProps<"a"> & { compact?: boolean }) {
  const content = (
    <>
      <img src={logoUrl} alt="" aria-hidden="true" className="size-8 shrink-0 rounded-lg" />
      <span className="text-lg font-semibold tracking-tight">
        lumo<span className="text-primary">.</span>
        {!compact && <small className="font-normal tracking-normal">Everything, connected.</small>}
      </span>
    </>
  );
  return (
    <a
      href="/"
      aria-label="Lumo home"
      className={cn("inline-flex items-center gap-2.5 text-foreground", className)}
      {...props}
    >
      {content}
    </a>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div
      className="my-3 flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive"
      role="alert"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 wrap-anywhere">
        {error instanceof Error ? error.message : "Something went wrong. Please try again."}
      </span>
    </div>
  ) : null;
}
export function Notice({ className, ...props }: ComponentProps<"output">) {
  return (
    <output
      className={cn(
        "my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function Loading({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <output className="flex items-center justify-center gap-2.5 px-4 py-12 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </output>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
  actions,
  icon,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="mb-2 block text-xs font-medium text-muted-foreground">{eyebrow}</span>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {icon}
          {title}
        </h1>
        {children && <p className="mt-2 max-w-2xl">{children}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
export function EmptyState({
  title,
  children,
  icon,
  className,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-surface px-5 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      )}
      <h2 className="text-sm">{title}</h2>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
