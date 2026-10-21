import { X } from "lucide-react";
import { Dialog as Primitive, AlertDialog as Alert } from "radix-ui";
import type { ComponentProps } from "react";

import { Button } from "./button";
import { cn } from "./utils";

const overlayStyles = "fixed inset-0 z-50 bg-black/35 backdrop-blur-xs motion-safe:animate-enter";
const contentStyles =
  "fixed top-1/2 left-1/2 z-50 grid max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-xl border bg-elevated p-6 text-foreground shadow-xl";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={overlayStyles} />
      <Primitive.Content className={cn(contentStyles, className)} {...props}>
        {children}
        <Primitive.Close asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3"
            aria-label="Close dialog"
          >
            <X aria-hidden="true" />
          </Button>
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return (
    <Primitive.Title
      className={cn("pr-8 text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
export const AlertDialog = Alert.Root;
export const AlertDialogTrigger = Alert.Trigger;
export const AlertDialogCancel = Alert.Cancel;
export const AlertDialogAction = Alert.Action;
export function AlertDialogContent({ className, ...props }: ComponentProps<typeof Alert.Content>) {
  return (
    <Alert.Portal>
      <Alert.Overlay className={overlayStyles} />
      <Alert.Content className={cn(contentStyles, className)} {...props} />
    </Alert.Portal>
  );
}
export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof Alert.Title>) {
  return <Alert.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof Alert.Description>) {
  return (
    <Alert.Description
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
