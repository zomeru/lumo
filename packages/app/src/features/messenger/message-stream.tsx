import {
  messengerMessageSchema,
  messengerMessagesSchema,
  messengerMembersSchema,
  type MessengerMessage,
} from "@lumo/contracts/messenger";
import { formatDate } from "@lumo/shared/date-time";
import {
  Button,
  Textarea,
  ErrorMessage,
  Loading,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Checkbox,
} from "@lumo/ui";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Send, X } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState } from "react";

import { api, command, sessionQuery } from "../../lib/api";
import { messengerKey, messengerPath } from "./messenger-api";

type Draft = {
  nonce: string;
  body: string;
  mentionIds: string[];
  attachmentIds: string[];
  failed: boolean;
};
import { EmojiPopover } from "./emoji-popover";
import { MessageItem } from "./message-item";
import { uploadAttachment } from "./messenger-files";
function MessageComposer({
  workspaceId,
  conversationId,
  onSend,
  onTyping,
  disabled = false,
}: {
  workspaceId: string;
  conversationId: string;
  onSend: (draft: Omit<Draft, "failed">) => void;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [text, setText] = useState(""),
    [mentionIds, setMentionIds] = useState<string[]>([]),
    [mentionOpen, setMentionOpen] = useState(false),
    [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const controller = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const members = useQuery({
    queryKey: [...messengerKey(workspaceId), "mention-members", conversationId],
    queryFn: ({ signal }) =>
      api(`${messengerPath(workspaceId, conversationId)}/members`, messengerMembersSchema, {
        signal,
      }),
    enabled: mentionOpen,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      controller.current = new AbortController();
      return uploadAttachment(workspaceId, conversationId, file, controller.current.signal);
    },
    onSuccess: (file) => setFiles((current) => [...current, file]),
  });
  return (
    <form
      className="m-3 shrink-0 space-y-2 rounded-lg border border-input/70 bg-surface p-2.5 sm:m-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled || upload.isPending || (!text.trim() && !files.length)) return;
        onSend({
          nonce: crypto.randomUUID(),
          body: text.trim(),
          mentionIds,
          attachmentIds: files.map((f) => f.id),
        });
        setText("");
        setFiles([]);
        setMentionIds([]);
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Message
      </label>
      <Textarea
        id={inputId}
        ref={textarea}
        value={text}
        disabled={disabled}
        maxLength={4000}
        placeholder="Write a message…"
        className="max-h-40 min-h-16 resize-y border-0 shadow-none"
        onChange={(e) => {
          setText(e.target.value);
          onTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <ErrorMessage error={upload.error} />
      {files.map((file) => (
        <span className="mr-2 inline-flex items-center gap-1 text-xs" key={file.id}>
          {file.name}
          <Button
            size="icon"
            aria-label={`Remove ${file.name}`}
            onClick={() => setFiles((current) => current.filter((f) => f.id !== file.id))}
          >
            <X aria-hidden="true" />
          </Button>
        </span>
      ))}
      {mentionOpen && (
        <fieldset className="max-h-28 overflow-y-auto rounded-md border p-2">
          <legend className="text-xs">Mention members</legend>
          {members.data?.members.map((member) => (
            <label className="mr-3 inline-flex items-center gap-2 text-xs" key={member.userId}>
              <Checkbox
                checked={mentionIds.includes(member.userId)}
                onCheckedChange={(checked) =>
                  setMentionIds((current) =>
                    checked
                      ? [...current, member.userId]
                      : current.filter((id) => id !== member.userId),
                  )
                }
              />
              {member.name}
            </label>
          ))}
          <ErrorMessage error={members.error} />
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <EmojiPopover
          label="Emoji"
          disabled={disabled}
          onPick={(emoji) => {
            const input = textarea.current,
              start = input?.selectionStart ?? text.length,
              end = input?.selectionEnd ?? text.length;
            const next = text.slice(0, start) + emoji + text.slice(end);
            if (next.length > 4000) return;
            setText(next);
            onTyping();
            requestAnimationFrame(() => {
              input?.focus();
              input?.setSelectionRange(start + emoji.length, start + emoji.length);
            });
          }}
        />
        <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs">
          {upload.isPending ? "Uploading…" : "Attach file"}
          <input
            type="file"
            aria-label="Attach file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
            disabled={disabled || upload.isPending || files.length >= 5}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
        </label>
        <Button
          size="sm"
          disabled={disabled}
          aria-pressed={mentionOpen}
          onClick={() => setMentionOpen(!mentionOpen)}
        >
          Mention{mentionIds.length ? ` (${mentionIds.length})` : ""}
        </Button>
        <small className="ml-auto hidden sm:block">
          Enter to send · Shift+Enter for a new line
        </small>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={disabled || upload.isPending || (!text.trim() && !files.length)}
        >
          <Send aria-hidden="true" />
          Send message
        </Button>
      </div>
    </form>
  );
}
export function MessageStream({
  workspaceId,
  conversationId,
  canPost,
  parentId,
  around,
  pinned = false,
  files = false,
  lastReadSequence = 0,
  onReply,
  onTyping,
  onJump,
}: {
  workspaceId: string;
  conversationId: string;
  canPost: boolean;
  parentId?: string;
  around?: string;
  pinned?: boolean;
  files?: boolean;
  lastReadSequence?: number;
  onJump?: (message: MessengerMessage) => void;
  onReply: (id: string) => void;
  onTyping: () => void;
}) {
  const client = useQueryClient(),
    session = useQuery(sessionQuery()),
    [pending, setPending] = useState<Draft[]>([]),
    [editing, setEditing] = useState<{ message: MessengerMessage; deleting: boolean } | null>(null),
    [editText, setEditText] = useState(""),
    [atBottom, setAtBottom] = useState(true),
    [error, setError] = useState<unknown>(null);
  const [initialRead] = useState(lastReadSequence);
  const list = useRef<HTMLOListElement>(null),
    read = useRef<string | undefined>(undefined);
  const query = useInfiniteQuery({
    queryKey: [
      ...messengerKey(workspaceId),
      "messages",
      conversationId,
      parentId,
      around,
      pinned,
      files,
    ],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam, signal }) =>
      api(
        `${messengerPath(workspaceId, conversationId)}/messages?${new URLSearchParams({ ...(pageParam ? { before: String(pageParam) } : {}), ...(parentId ? { parentId } : {}), ...(around && !pageParam ? { around } : {}), ...(pinned ? { pinned: "true" } : {}), ...(files ? { files: "true" } : {}) })}`,
        messengerMessagesSchema,
        { signal },
      ),
    getNextPageParam: (page) => page.nextBefore ?? undefined,
    retry: false,
  });
  const messages = [
      ...new Map(
        (query.data?.pages.flatMap((page) => page.messages) ?? []).map((message) => [
          message.id,
          message,
        ]),
      ).values(),
    ].sort((a, b) => a.sequence - b.sequence),
    last = messages.at(-1);
  const invalidate = () => client.invalidateQueries({ queryKey: messengerKey(workspaceId) });
  const send = async (draft: Draft) => {
    setError(null);
    setPending((current) =>
      current.map((d) => (d.nonce === draft.nonce ? { ...d, failed: false } : d)),
    );
    try {
      await api(`${messengerPath(workspaceId, conversationId)}/messages`, messengerMessageSchema, {
        method: "POST",
        body: {
          nonce: draft.nonce,
          body: draft.body,
          mentionIds: draft.mentionIds,
          attachmentIds: draft.attachmentIds,
          ...(parentId ? { parentId } : {}),
        },
      });
      await invalidate();
      setPending((current) => current.filter((d) => d.nonce !== draft.nonce));
    } catch (cause) {
      setPending((current) =>
        current.map((d) => (d.nonce === draft.nonce ? { ...d, failed: true } : d)),
      );
      setError(cause);
    }
  };
  const mutation = useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: "edit" | "delete" | "reaction" | "pin";
      body: unknown;
    }) =>
      command(
        `/workspaces/${workspaceId}/messages/${id}${action === "reaction" || action === "pin" ? `/${action}` : ""}`,
        action === "edit" ? "PATCH" : action === "delete" ? "DELETE" : "POST",
        body,
      ),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    },
  });
  const lastId = last?.id;
  useEffect(() => {
    if (!around && atBottom && list.current) list.current.scrollTop = list.current.scrollHeight;
    const mark = () => {
      if (
        !pinned &&
        !files &&
        !around &&
        atBottom &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        lastId &&
        read.current !== lastId
      ) {
        read.current = lastId;
        void command(`${messengerPath(workspaceId, conversationId)}/cursor`, "POST", {
          messageId: lastId,
        }).then(
          () =>
            client.invalidateQueries({ queryKey: [...messengerKey(workspaceId), "conversations"] }),
          () => {
            read.current = undefined;
          },
        );
      }
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("focus", mark);
    return () => {
      document.removeEventListener("visibilitychange", mark);
      window.removeEventListener("focus", mark);
    };
  }, [workspaceId, conversationId, lastId, atBottom, around, pinned, files, client]);
  useEffect(() => {
    if (around && query.data)
      document.getElementById(`message-${around}`)?.scrollIntoView({ block: "center" });
  }, [around, query.data]);
  if (query.isError)
    return (
      <div className="p-4">
        <ErrorMessage error={query.error} />
      </div>
    );
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ErrorMessage error={error ?? mutation.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        <ol
          ref={list}
          aria-label={parentId ? "Thread messages" : "Messages"}
          aria-live="polite"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
          }}
        >
          {parentId && query.data?.pages[0]?.parent && (
            <>
              <li className="px-4 pt-3 text-xs font-medium text-muted-foreground">
                Original message
              </li>
              <MessageItem
                message={query.data.pages[0].parent}
                context
                own={query.data.pages[0].parent.senderId === session.data?.user.id}
                canPost={false}
                onReply={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onAction={() => {}}
              />
              <li className="border-y px-4 py-2 text-xs text-muted-foreground">Replies</li>
            </>
          )}
          {query.hasNextPage && (
            <li className="p-3 text-center">
              <Button
                disabled={query.isFetchingNextPage}
                onClick={() => {
                  const node = list.current,
                    previous = node?.scrollHeight ?? 0;
                  setAtBottom(false);
                  void query.fetchNextPage().then(() =>
                    requestAnimationFrame(() => {
                      if (node) node.scrollTop = node.scrollHeight - previous;
                    }),
                  );
                }}
              >
                Load older messages
              </Button>
            </li>
          )}
          {messages.length === 0 && (
            <li className="px-6 py-16 text-center text-sm text-muted-foreground">
              {files
                ? "No shared files."
                : pinned
                  ? "No pinned messages."
                  : parentId
                    ? "No replies yet."
                    : "No messages yet. Say hello."}
            </li>
          )}
          {messages.map((message, index) => (
            <Fragment key={message.id}>
              {(index === 0 ||
                new Date(messages[index - 1]!.createdAt).toDateString() !==
                  new Date(message.createdAt).toDateString()) && (
                <li className="sticky top-0 z-10 bg-surface/95 py-2 text-center text-xs text-muted-foreground">
                  {formatDate(message.createdAt)}
                </li>
              )}
              {index ===
                messages.findIndex(
                  (m) => m.sequence > initialRead && m.senderId !== session.data?.user.id,
                ) && (
                <li className="border-y border-primary/30 py-1 text-center text-xs text-primary">
                  New messages
                </li>
              )}
              <MessageItem
                message={message}
                highlighted={message.id === around}
                grouped={Boolean(
                  index > 0 &&
                  !message.deletedAt &&
                  !messages[index - 1]!.deletedAt &&
                  messages[index - 1]!.senderId === message.senderId &&
                  messages[index - 1]!.parentId === message.parentId &&
                  new Date(message.createdAt).toDateString() ===
                    new Date(messages[index - 1]!.createdAt).toDateString() &&
                  new Date(message.createdAt).getTime() -
                    new Date(messages[index - 1]!.createdAt).getTime() <
                    300000 &&
                  !(messages[index - 1]!.sequence <= initialRead && message.sequence > initialRead),
                )}
                own={message.senderId === session.data?.user.id}
                canPost={canPost}
                busy={mutation.isPending}
                onJump={(pinned || files) && onJump ? () => onJump(message) : undefined}
                onReply={() => onReply(message.id)}
                onEdit={() => {
                  setEditing({ message, deleting: false });
                  setEditText(message.body);
                }}
                onDelete={() => setEditing({ message, deleting: true })}
                onAction={(action, body) => mutation.mutate({ id: message.id, action, body })}
              />
            </Fragment>
          ))}
          {pending
            .filter((d) => !messages.some((m) => m.nonce === d.nonce))
            .map((draft) => (
              <li key={draft.nonce} className="border-b px-4 py-3 text-sm">
                <p className="whitespace-pre-wrap wrap-anywhere">{draft.body || "Attachment"}</p>
                {draft.failed ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      void send(draft);
                    }}
                  >
                    Retry message
                  </Button>
                ) : (
                  <small>Sending…</small>
                )}
              </li>
            ))}
        </ol>
      )}
      {!atBottom && (
        <Button
          className="absolute right-4 bottom-44 shadow"
          size="sm"
          onClick={() => {
            setAtBottom(true);
            if (list.current)
              list.current.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
          }}
        >
          <ArrowDown aria-hidden="true" />
          Latest messages
        </Button>
      )}
      {canPost && !pinned && !files && (
        <MessageComposer
          workspaceId={workspaceId}
          conversationId={conversationId}
          onTyping={onTyping}
          onSend={(value) => {
            const draft = { ...value, failed: false };
            setPending((current) => [...current, draft]);
            setAtBottom(true);
            void send(draft);
          }}
        />
      )}
      {editing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{editing.deleting ? "Delete message" : "Edit message"}</DialogTitle>
            <DialogDescription>
              {editing.deleting
                ? "The message body and attachments will no longer be available. Replies remain in the thread."
                : "Update your message in this conversation."}
            </DialogDescription>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({
                  id: editing.message.id,
                  action: editing.deleting ? "delete" : "edit",
                  body: editing.deleting ? {} : { body: editText },
                });
              }}
            >
              {!editing.deleting && (
                <Textarea
                  aria-label="Edit message body"
                  required
                  maxLength={4000}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              )}
              <ErrorMessage error={mutation.error} />
              <Button type="submit" variant="primary" disabled={mutation.isPending}>
                {editing.deleting ? "Delete message" : "Save message"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
