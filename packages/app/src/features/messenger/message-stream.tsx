import {
  messengerMessageSchema,
  messengerMessagesSchema,
  type MessengerMessage,
} from "@lumo/contracts/messenger";
import { formatDate } from "@lumo/shared/date-time";
import {
  Button,
  ErrorMessage,
  Loading,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@lumo/ui";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Paperclip, Send, X } from "lucide-react";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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
import { MentionInput } from "./mention-input";
import {
  decodeMentionBody,
  encodeMentionDraft,
  updateMentionDraft,
  type MentionDraft,
} from "./mention-text";
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
  const [draft, setDraft] = useState<MentionDraft>({ text: "", mentions: [] });
  const text = draft.text;
  const [validation, setValidation] = useState<Error | null>(null);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const controller = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const selection = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (selection.current !== null && textarea.current) {
      const caret = selection.current;
      selection.current = null;
      textarea.current.focus();
      textarea.current.setSelectionRange(caret, caret);
    }
  }, [draft]);
  useEffect(() => () => controller.current?.abort(), []);
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
        const encoded = encodeMentionDraft(draft);
        if (encoded.body.length > 4000 || encoded.mentionIds.length > 20) {
          setValidation(new Error("Shorten this message or use fewer mentions before sending."));
          return;
        }
        setValidation(null);
        onSend({
          nonce: crypto.randomUUID(),
          ...encoded,
          attachmentIds: files.map((f) => f.id),
        });
        setDraft({ text: "", mentions: [] });
        setFiles([]);
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Message
      </label>
      <MentionInput
        workspaceId={workspaceId}
        conversationId={conversationId}
        draft={draft}
        onDraft={setDraft}
        inputRef={textarea}
        onTyping={onTyping}
        onSubmit={() => textarea.current?.form?.requestSubmit()}
        id={inputId}
        disabled={disabled}
        maxLength={4000}
        placeholder="Message your team · @ to mention"
        className="max-h-40 min-h-16 resize-y border-0 shadow-none"
      />
      <ErrorMessage error={validation} />
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
      <div className="flex flex-wrap items-center gap-2">
        <EmojiPopover
          label="Emoji"
          returnFocus={() => textarea.current?.focus()}
          disabled={disabled}
          onPick={(emoji) => {
            const input = textarea.current,
              start = input?.selectionStart ?? text.length,
              end = input?.selectionEnd ?? text.length;
            const next = text.slice(0, start) + emoji + text.slice(end);
            if (next.length > 4000) {
              setValidation(new Error("This emoji would exceed the message length limit."));
              return;
            }
            selection.current = start + emoji.length;
            setDraft(updateMentionDraft(draft, next));
            onTyping();
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || upload.isPending || files.length >= 5}
          onClick={() => attachmentInput.current?.click()}
        >
          <Paperclip aria-hidden="true" />
          {upload.isPending ? "Uploading…" : "Attach file"}
        </Button>
        <input
          ref={attachmentInput}
          type="file"
          aria-label="Attach file"
          className="sr-only"
          tabIndex={-1}
          accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
          disabled={disabled || upload.isPending || files.length >= 5}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
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
    [editDraft, setEditDraft] = useState<MentionDraft>({ text: "", mentions: [] }),
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
        (list.current?.checkVisibility?.() ?? true) &&
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
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) mark();
          })
        : undefined;
    if (list.current) observer?.observe(list.current);
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("focus", mark);
    return () => {
      observer?.disconnect();
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
      {parentId && query.data && (
        <section
          aria-label="Original message"
          className="max-h-[40%] shrink-0 overflow-y-auto border-b bg-muted/20"
        >
          <h4 className="px-4 pt-2 text-xs font-medium text-muted-foreground">Original message</h4>
          {query.data.pages[0]?.parent ? (
            <ol>
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
            </ol>
          ) : (
            <p className="px-4 py-2 text-xs">Original message unavailable.</p>
          )}
          <p className="px-4 py-1 text-xs">Replies</p>
        </section>
      )}
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
                <li
                  className={`${parentId ? "" : "sticky top-0 z-10 "}bg-surface/95 py-2 text-center text-xs text-muted-foreground`}
                >
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
                  setEditDraft(decodeMentionBody(message.body));
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
                <p className="whitespace-pre-wrap wrap-anywhere">
                  {decodeMentionBody(draft.body).text || "Attachment"}
                </p>
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
                  body: editing.deleting ? {} : encodeMentionDraft(editDraft),
                });
              }}
            >
              {!editing.deleting && (
                <MentionInput
                  workspaceId={workspaceId}
                  conversationId={conversationId}
                  draft={editDraft}
                  onDraft={setEditDraft}
                  aria-label="Edit message body"
                  required
                  maxLength={4000}
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
