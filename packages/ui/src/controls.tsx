import { Check, Circle } from "lucide-react";
import {
  Checkbox as CheckPrimitive,
  RadioGroup as Radio,
  Switch as SwitchPrimitive,
  Tabs as TabsPrimitive,
  Separator as SeparatorPrimitive,
  ScrollArea as Scroll,
} from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "./utils";

const controlStates =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";
export function Checkbox({ className, ...props }: ComponentProps<typeof CheckPrimitive.Root>) {
  return (
    <CheckPrimitive.Root
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-surface text-primary-foreground transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        controlStates,
        className,
      )}
      {...props}
    >
      <CheckPrimitive.Indicator>
        <Check className="size-3" aria-hidden="true" />
      </CheckPrimitive.Indicator>
    </CheckPrimitive.Root>
  );
}
export function RadioGroup({ className, ...props }: ComponentProps<typeof Radio.Root>) {
  return <Radio.Root className={cn("grid gap-3", className)} {...props} />;
}
export function RadioGroupItem({ className, ...props }: ComponentProps<typeof Radio.Item>) {
  return (
    <Radio.Item
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-surface text-primary data-[state=checked]:border-primary",
        controlStates,
        className,
      )}
      {...props}
    >
      <Radio.Indicator>
        <Circle className="size-2 fill-current" aria-hidden="true" />
      </Radio.Indicator>
    </Radio.Item>
  );
}
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-muted p-0.5 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        controlStates,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-3.5 rounded-full bg-surface shadow-xs transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-xs",
        controlStates,
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-5 outline-none focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}
export function ScrollArea({ className, children, ...props }: ComponentProps<typeof Scroll.Root>) {
  return (
    <Scroll.Root className={cn("relative overflow-hidden", className)} {...props}>
      <Scroll.Viewport className="size-full rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        {children}
      </Scroll.Viewport>
      <Scroll.Scrollbar orientation="vertical" className="flex w-2.5 touch-none p-0.5 select-none">
        <Scroll.Thumb className="relative flex-1 rounded-full bg-muted-foreground/35" />
      </Scroll.Scrollbar>
      <Scroll.Scrollbar
        orientation="horizontal"
        className="flex h-2.5 touch-none flex-col p-0.5 select-none"
      >
        <Scroll.Thumb className="relative flex-1 rounded-full bg-muted-foreground/35" />
      </Scroll.Scrollbar>
      <Scroll.Corner />
    </Scroll.Root>
  );
}
