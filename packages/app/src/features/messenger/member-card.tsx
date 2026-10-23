import { conversationSchema } from "@lumolynk/contracts/collaboration";
import { Button, ErrorMessage, Popover, PopoverContent, PopoverTrigger } from "@lumolynk/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { api } from "../../lib/api";
import { messengerKey, messengerPath } from "./messenger-api";
import { MemberAvatar, usePresence } from "./presence";

export function useStartDirectMessage(workspaceId: string) {
  const client = useQueryClient(),
    navigate = useNavigate();
  return useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) =>
      api(messengerPath(workspaceId), conversationSchema, {
        method: "POST",
        body: { kind: "direct", name, memberIds: [userId] },
      }),
    onSuccess: async (item) => {
      await client.invalidateQueries({ queryKey: messengerKey(workspaceId) });
      await navigate({
        to: "/w/$workspaceId/messenger/$conversationId",
        params: { workspaceId, conversationId: item.id },
        hash: "",
      });
    },
  });
}
/** Only already-authorized public identity is shown; never email or HR records. */
export function MemberCard({
  workspaceId,
  userId,
  name,
  image,
  children,
  jobTitle,
  role,
  self = false,
}: {
  workspaceId: string;
  userId: string;
  name: string;
  image: string | null;
  children: ReactNode;
  jobTitle?: string | null;
  role?: string | null;
  self?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef(false),
    suppressFocus = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const direct = useStartDirectMessage(workspaceId),
    status = usePresence(userId);
  const trigger = useRef<HTMLButtonElement>(null),
    content = useRef<HTMLDivElement>(null),
    keyboardFocus = useRef(false);
  const enter = () => {
    clearTimeout(timer.current);
    if (!open) returnFocus.current = false;
    setOpen(true);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!trigger.current?.matches(":focus") && !content.current?.contains(document.activeElement))
        setOpen(false);
    }, 200);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={trigger}
          type="button"
          className="inline-flex max-w-full self-start items-center text-left font-semibold hover:text-primary"
          aria-label={`View ${name}'s profile`}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse" && window.matchMedia?.("(hover: hover)").matches) {
              clearTimeout(timer.current);
              timer.current = setTimeout(enter, 250);
            }
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") leave();
          }}
          onFocus={() => {
            if (!suppressFocus.current && trigger.current?.matches(":focus-visible")) enter();
          }}
          onKeyDown={(event) => {
            if (["Enter", " ", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              enter();
              if (content.current)
                (
                  content.current.querySelector<HTMLButtonElement>("button") ?? content.current
                ).focus();
              else keyboardFocus.current = true;
            }
          }}
          onClick={(event) => {
            event.preventDefault();
            enter();
          }}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        tabIndex={-1}
        aria-label={`${name} profile`}
        side="bottom"
        onInteractOutside={() => {
          returnFocus.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons =
            content.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
          const boundary = event.shiftKey ? buttons?.[0] : buttons?.[buttons.length - 1];
          if (buttons?.length && document.activeElement !== boundary) return;
          event.preventDefault();
          returnFocus.current = false;
          setOpen(false);
          const controls = [
            ...document.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
            ),
          ].filter(
            (node) =>
              !content.current?.contains(node) &&
              !node.hasAttribute("data-radix-focus-guard") &&
              (node.checkVisibility?.() ?? true),
          );
          const index = trigger.current ? controls.indexOf(trigger.current) : -1;
          const target = event.shiftKey
            ? trigger.current
            : (controls[index + 1] ?? trigger.current);
          if (target === trigger.current) {
            suppressFocus.current = true;
            requestAnimationFrame(() => {
              suppressFocus.current = false;
            });
          }
          target?.focus();
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (keyboardFocus.current && content.current) {
            keyboardFocus.current = false;
            (content.current.querySelector<HTMLButtonElement>("button") ?? content.current).focus();
          }
        }}
        onFocusCapture={() => {
          returnFocus.current = true;
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (returnFocus.current) {
            suppressFocus.current = true;
            trigger.current?.focus();
            requestAnimationFrame(() => {
              suppressFocus.current = false;
            });
          }
        }}
        onMouseEnter={() => clearTimeout(timer.current)}
        onMouseLeave={leave}
      >
        <div className="flex items-center gap-3">
          <MemberAvatar userId={userId} name={name} src={image ?? undefined} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate">{name}</h3>
            {(jobTitle || role) && (
              <p className="truncate text-xs">{[jobTitle, role].filter(Boolean).join(" · ")}</p>
            )}
            <p className="text-xs">
              {status === "online"
                ? "Online"
                : status === "dnd"
                  ? "Do Not Disturb"
                  : status === "offline"
                    ? "Offline"
                    : "Availability unavailable"}
            </p>
          </div>
        </div>
        {self ? (
          <p className="mt-3 text-xs">This is you</p>
        ) : (
          <Button
            size="sm"
            className="mt-3 w-full"
            disabled={direct.isPending}
            onClick={() => direct.mutate({ userId, name }, { onSuccess: () => setOpen(false) })}
          >
            Message
          </Button>
        )}
        <ErrorMessage error={direct.error} />
      </PopoverContent>
    </Popover>
  );
}
