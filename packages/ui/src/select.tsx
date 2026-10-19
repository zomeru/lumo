import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as Primitive } from "radix-ui";
import { useId, useState, type ComponentProps } from "react";

import { inputStyles } from "./input";
import { cn } from "./utils";

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;
export function SelectTrigger({
  className,
  children,
  size = "md",
  ...props
}: ComponentProps<typeof Primitive.Trigger> & { size?: "sm" | "md" }) {
  return (
    <Primitive.Trigger
      className={cn(
        inputStyles,
        "flex items-center justify-between gap-3 text-left data-placeholder:text-muted-foreground [&>span:first-child]:truncate",
        size === "sm" && "h-8 px-2.5 text-xs",
        className,
      )}
      {...props}
    >
      {children}
      <Primitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
}
export function SelectContent({
  children,
  className,
  position = "popper",
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        position={position}
        sideOffset={5}
        collisionPadding={12}
        className={cn(
          "z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg border bg-elevated p-1 text-foreground shadow-lg motion-safe:animate-enter",
          className,
        )}
        {...props}
      >
        <Primitive.ScrollUpButton className="flex justify-center py-1">
          <ChevronUp className="size-4" aria-hidden="true" />
        </Primitive.ScrollUpButton>
        <Primitive.Viewport>{children}</Primitive.Viewport>
        <Primitive.ScrollDownButton className="flex justify-center py-1">
          <ChevronDown className="size-4" aria-hidden="true" />
        </Primitive.ScrollDownButton>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "relative flex min-h-8 cursor-default items-center rounded-sm py-1.5 pr-8 pl-2.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="absolute right-2">
        <Check className="size-4" aria-hidden="true" />
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}
export type SelectOption = { value: string; label: string; disabled?: boolean };
export function SelectField({
  label,
  hint,
  error,
  options,
  id: providedId,
  className,
  placeholder = "Choose an option",
  size,
  value,
  defaultValue,
  onValueChange,
  ...props
}: ComponentProps<typeof Primitive.Root> & {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  size?: "sm" | "md";
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const emptyOption = `${id}-empty-option`;
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium leading-5">
        {label}
      </label>
      <Select
        value={value ?? internalValue}
        onValueChange={(nextValue) => {
          const next = nextValue === emptyOption ? "" : nextValue;
          setInternalValue(next);
          onValueChange?.(next);
        }}
        {...props}
      >
        <SelectTrigger
          id={id}
          size={size}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value || emptyOption}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small role="alert" id={`${id}-error`} className="text-destructive">
          {error}
        </small>
      )}
    </div>
  );
}
