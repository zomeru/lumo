import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "./utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border-border bg-surface text-foreground shadow-xs hover:bg-muted",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "border-destructive/20 bg-destructive-subtle text-destructive hover:bg-destructive/15",
        link: "border-transparent bg-transparent p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-control px-3.5",
        lg: "h-11 px-5",
        icon: "size-control p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = "button",
  onClickCapture,
  tabIndex,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  const Component = asChild ? Slot.Root : "button";
  const blocked = disabled || loading;
  return (
    <Component
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : blocked}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      tabIndex={asChild && blocked ? -1 : tabIndex}
      className={cn(buttonVariants({ variant, size }), className)}
      onClickCapture={(event) => {
        if (blocked) {
          event.preventDefault();
          event.stopPropagation();
        } else onClickCapture?.(event);
      }}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          {children}
        </>
      )}
    </Component>
  );
}
