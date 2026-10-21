import type { ComponentProps } from "react";

import { Button } from "./button";
import { cn } from "./utils";

/** Navigation between URL-backed section views; links can compose through asChild. */
export function ViewNavigation({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn("flex min-w-0 max-w-full gap-1 overflow-x-auto border-b", className)}
      {...props}
    />
  );
}
export function ViewNavigationItem({
  active,
  className,
  ...props
}: ComponentProps<typeof Button> & { active: boolean }) {
  return (
    <Button
      variant="ghost"
      aria-current={active ? "page" : undefined}
      className={cn(
        "h-10 shrink-0 rounded-none border-0 border-b-2 px-3.5 text-sm shadow-none",
        active
          ? "border-primary bg-accent/40 text-primary hover:bg-accent/60 hover:text-primary"
          : "border-transparent hover:border-border",
        className,
      )}
      {...props}
    />
  );
}
export function ViewTabs({
  tabs,
  value,
  onChange,
  label = "Section views",
}: {
  tabs: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <ViewNavigation aria-label={label} className="mb-5">
      {tabs.map((tab) => (
        <ViewNavigationItem key={tab} active={tab === value} onClick={() => onChange(tab)}>
          {tab}
        </ViewNavigationItem>
      ))}
    </ViewNavigation>
  );
}
export function FilterBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-5 flex min-w-0 flex-wrap items-end gap-3 [&>div]:min-w-40 [&>div]:flex-1",
        className,
      )}
      {...props}
    />
  );
}
