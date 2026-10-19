import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Avatar as Primitive, Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        secondary: "border-border bg-muted/50 text-muted-foreground",
        primary: "border-primary/15 bg-accent text-accent-foreground",
        success: "border-success/15 bg-success-subtle text-success",
        destructive: "border-destructive/20 bg-destructive-subtle text-destructive",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);
export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export function Card({
  className,
  asChild,
  ...props
}: ComponentProps<"section"> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "section";
  return (
    <Component
      className={cn("min-w-0 rounded-lg border bg-surface p-5 shadow-xs sm:p-6", className)}
      {...props}
    />
  );
}
export function Avatar({
  name,
  src,
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Primitive.Root> & {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <Primitive.Root
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full border border-primary/15 bg-accent text-xs font-semibold text-accent-foreground",
        {
          "size-7 text-[10px]": size === "sm",
          "size-9": size === "md",
          "size-12 text-base": size === "lg",
        },
        className,
      )}
      {...props}
    >
      {src && <Primitive.Image src={src} alt="" className="size-full object-cover" />}
      <Primitive.Fallback className="flex size-full items-center justify-center">
        {initials || "?"}
      </Primitive.Fallback>
    </Primitive.Root>
  );
}
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
export function Spinner({
  className,
  label = "Loading",
  ...props
}: ComponentProps<"output"> & { label?: string }) {
  return (
    <output className={cn("inline-flex items-center justify-center", className)} {...props}>
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </output>
  );
}
export function Progress({ className, max = 100, ...props }: ComponentProps<"progress">) {
  return (
    <progress
      max={max}
      className={cn(
        "h-1.5 w-full appearance-none overflow-hidden rounded-full border-0 bg-muted text-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary",
        className,
      )}
      {...props}
    />
  );
}
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <table className={cn("w-full caption-bottom text-left text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b bg-muted/40 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y", className)} {...props} />;
}
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/40 data-[selected=true]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th className={cn("h-10 px-4 text-left font-medium whitespace-nowrap", className)} {...props} />
  );
}
export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}
export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption
      className={cn("px-4 py-3 text-left text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
