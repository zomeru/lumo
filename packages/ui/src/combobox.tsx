import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "./button";
import { Checkbox } from "./controls";
import { Input, inputStyles } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import type { SelectOption } from "./select";
import { cn } from "./utils";

export function Combobox({
  options,
  value,
  defaultValue = "",
  onValueChange,
  label,
  name,
  disabled,
  required,
  error,
  placeholder = "Choose an option",
  className,
}: {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  label: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const id = useId();
  const [missing, setMissing] = useState(false);
  const message = error ?? (missing ? "Choose an option." : undefined);
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium leading-5">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Select-only combobox trigger; cmdk owns the editable input.
            role="combobox"
            aria-controls={open ? `${id}-popup` : undefined}
            aria-expanded={open}
            aria-required={required}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? `${id}-error` : undefined}
            disabled={disabled}
            className={cn(
              inputStyles,
              "justify-between text-left font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {options.find((option) => option.value === selected)?.label ?? placeholder}
            </span>
            <ChevronsUpDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={`${id}-popup`}
          className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
          aria-label={label}
        >
          <Command loop label={`Search ${label.toLowerCase()}`}>
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <Command.Input
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder="Search…"
                className="h-10 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <Command.List className="max-h-[min(15rem,calc(var(--radix-popover-content-available-height)-3rem))] overflow-y-auto scrollbar-stable p-1">
              <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
                No options found.
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  disabled={option.disabled}
                  className="flex cursor-default items-center justify-between rounded-sm px-2.5 py-2 text-sm data-[disabled=true]:opacity-40 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  onSelect={() => {
                    setMissing(false);
                    setInternal(option.value);
                    onValueChange?.(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                  {selected === option.value && <Check className="size-4" aria-hidden="true" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
      {(name || required) && (
        <input
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={selected}
          required={required}
          disabled={disabled}
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            setMissing(true);
            setOpen(true);
          }}
        />
      )}
      {message && (
        <small id={`${id}-error`} role="alert" className="text-destructive">
          {message}
        </small>
      )}
    </div>
  );
}

export function MultiSelectField({
  options,
  label,
  name,
  value,
  defaultValue = [],
  onValueChange,
  disabled,
  className,
}: {
  options: readonly SelectOption[];
  label: string;
  name?: string;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue),
    [query, setQuery] = useState("");
  const selected = value ?? internal;
  const id = useId();
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium leading-5">
        {label}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            disabled={disabled}
            className={cn(inputStyles, "justify-between font-normal")}
          >
            <span className="truncate">
              {selected.length ? `${selected.length} selected` : "Choose people…"}
            </span>
            <ChevronsUpDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) overflow-hidden"
          aria-label={label}
        >
          <Input
            type="search"
            aria-label={`Search ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a person…"
          />
          <fieldset className="mt-3 grid max-h-[min(14rem,calc(var(--radix-popover-content-available-height)-5rem))] gap-1 overflow-y-auto scrollbar-stable">
            <legend className="sr-only">{label}</legend>
            {filtered.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  disabled={option.disabled || disabled}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value);
                    setInternal(next);
                    onValueChange?.(next);
                  }}
                />
                {option.label}
              </label>
            ))}
            {!filtered.length && <p className="py-4 text-center">No people found.</p>}
          </fieldset>
        </PopoverContent>
      </Popover>
      {name &&
        selected.map((item) => (
          <input key={item} type="hidden" name={name} value={item} disabled={disabled} />
        ))}
    </div>
  );
}
