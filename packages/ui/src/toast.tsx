import { X } from "lucide-react";
import { Toast as Primitive } from "radix-ui";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./utils";

export function Toast({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        "relative grid gap-1 rounded-lg border bg-elevated p-4 pr-12 text-foreground shadow-lg data-[state=open]:animate-enter data-[swipe=end]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}
export function ToastTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("text-sm font-semibold", className)} {...props} />;
}
export function ToastDescription({
  className,
  ...props
}: ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description className={cn("text-xs text-muted-foreground", className)} {...props} />
  );
}
export const ToastAction = Primitive.Action;
export const ToastClose = Primitive.Close;
type Notification = { title: string; description?: string };
const ToastContext = createContext<((notification: Notification) => void) | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<(Notification & { id: string })[]>([]);
  const notify = (notification: Notification) =>
    setNotifications((current) => [
      ...current.slice(-2),
      { ...notification, id: crypto.randomUUID() },
    ]);
  return (
    <ToastContext value={notify}>
      <Primitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            onOpenChange={(open) => {
              if (!open)
                setNotifications((current) =>
                  current.filter((item) => item.id !== notification.id),
                );
            }}
          >
            <ToastTitle>{notification.title}</ToastTitle>
            {notification.description && (
              <ToastDescription>{notification.description}</ToastDescription>
            )}
            <ToastClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2"
                aria-label="Dismiss notification"
              >
                <X aria-hidden="true" />
              </Button>
            </ToastClose>
          </Toast>
        ))}
        <Primitive.Viewport className="fixed right-4 bottom-4 z-[100] flex w-88 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </Primitive.Provider>
    </ToastContext>
  );
}
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast requires ToastProvider");
  return notify;
}
