import { Check, ChevronRight } from "lucide-react";
import { DropdownMenu as Dropdown, ContextMenu as Context } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "./utils";

const contentStyles =
  "z-50 min-w-44 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border bg-elevated p-1 text-foreground shadow-lg motion-safe:animate-enter";
const itemStyles =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";
export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;
export const DropdownMenuGroup = Dropdown.Group;
export const DropdownMenuSub = Dropdown.Sub;
export function DropdownMenuContent({
  className,
  sideOffset = 5,
  ...props
}: ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          contentStyles,
          "max-h-(--radix-dropdown-menu-content-available-height)",
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  );
}
export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof Dropdown.Item> & { destructive?: boolean }) {
  return (
    <Dropdown.Item
      className={cn(
        itemStyles,
        destructive &&
          "text-destructive data-highlighted:bg-destructive-subtle data-highlighted:text-destructive",
        className,
      )}
      {...props}
    />
  );
}
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Dropdown.CheckboxItem>) {
  return (
    <Dropdown.CheckboxItem className={cn(itemStyles, "pl-8", className)} {...props}>
      <Dropdown.ItemIndicator className="absolute left-2">
        <Check aria-hidden="true" />
      </Dropdown.ItemIndicator>
      {children}
    </Dropdown.CheckboxItem>
  );
}
export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Dropdown.Label>) {
  return (
    <Dropdown.Label
      className={cn("px-2.5 py-2 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Dropdown.Separator>) {
  return <Dropdown.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Dropdown.SubTrigger>) {
  return (
    <Dropdown.SubTrigger className={cn(itemStyles, className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" aria-hidden="true" />
    </Dropdown.SubTrigger>
  );
}
export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof Dropdown.SubContent>) {
  return (
    <Dropdown.Portal>
      <Dropdown.SubContent
        className={cn(
          contentStyles,
          "max-h-(--radix-dropdown-menu-content-available-height)",
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  );
}

export const ContextMenu = Context.Root;
export const ContextMenuTrigger = Context.Trigger;
export const ContextMenuSub = Context.Sub;
export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof Context.Content>) {
  return (
    <Context.Portal>
      <Context.Content
        collisionPadding={12}
        className={cn(
          contentStyles,
          "max-h-(--radix-context-menu-content-available-height)",
          className,
        )}
        {...props}
      />
    </Context.Portal>
  );
}
export function ContextMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof Context.Item> & { destructive?: boolean }) {
  return (
    <Context.Item
      className={cn(
        itemStyles,
        destructive &&
          "text-destructive data-highlighted:bg-destructive-subtle data-highlighted:text-destructive",
        className,
      )}
      {...props}
    />
  );
}
export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Context.Separator>) {
  return <Context.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
export function ContextMenuLabel({ className, ...props }: ComponentProps<typeof Context.Label>) {
  return (
    <Context.Label
      className={cn("px-2.5 py-2 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
export function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Context.SubTrigger>) {
  return (
    <Context.SubTrigger className={cn(itemStyles, className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" aria-hidden="true" />
    </Context.SubTrigger>
  );
}
export function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof Context.SubContent>) {
  return (
    <Context.Portal>
      <Context.SubContent
        className={cn(
          contentStyles,
          "max-h-(--radix-context-menu-content-available-height)",
          className,
        )}
        {...props}
      />
    </Context.Portal>
  );
}
