import { Popover as Primitive, Tooltip as Tip } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./utils";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverClose = Primitive.Close;
export function PopoverContent({
  className,
  align = "start",
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          "z-50 max-h-(--radix-popover-content-available-height) w-72 overflow-y-auto max-w-[calc(100vw-1.5rem)] rounded-lg border bg-elevated p-3 text-foreground shadow-lg outline-none motion-safe:animate-enter",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
export const TooltipProvider = Tip.Provider;
export function Tooltip({
  children,
  content,
  ...props
}: ComponentProps<typeof Tip.Root> & { content: ReactNode }) {
  return (
    <Tip.Root {...props}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-64 rounded-md border bg-elevated px-3 py-2 text-xs text-foreground shadow-md motion-safe:animate-enter"
        >
          {content}
          <Tip.Arrow className="fill-elevated" />
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}
