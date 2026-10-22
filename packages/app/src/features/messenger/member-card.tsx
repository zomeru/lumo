import { conversationSchema } from "@lumo/contracts/collaboration";
import { Button, ErrorMessage, Popover, PopoverContent, PopoverTrigger } from "@lumo/ui";
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
  const trigger = useRef<HTMLButtonElement>(null);
  const enter = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!trigger.current?.matches(":focus")) setOpen(false);
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
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        onOpenAutoFocus={(e) => {
          returnFocus.current = false;
          e.preventDefault();
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
