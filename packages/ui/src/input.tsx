import { Eye, EyeOff } from "lucide-react";
import { Slot } from "radix-ui";
import { useId, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./utils";

export const inputStyles =
  "h-control w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-colors hover:border-ring/70 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-muted/40 aria-invalid:border-destructive aria-invalid:outline-destructive";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputStyles, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputStyles, "min-h-24 resize-y py-2", className)} {...props} />;
}
export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0"
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function FormField({
  label,
  hint,
  error,
  id: providedId,
  children,
  className,
}: {
  label: ReactNode;
  hint?: string;
  error?: string;
  id?: string;
  children: ReactElement;
  className?: string;
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium leading-5">
        {label}
      </label>
      <Slot.Root id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        {children}
      </Slot.Root>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} role="alert" className="text-destructive">
          {error}
        </small>
      )}
    </div>
  );
}
export function Field({
  label,
  hint,
  error,
  className,
  id,
  type,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  return (
    <FormField label={label} hint={hint} error={error} id={id} className={className}>
      {type === "password" ? <PasswordInput {...props} /> : <Input type={type} {...props} />}
    </FormField>
  );
}
