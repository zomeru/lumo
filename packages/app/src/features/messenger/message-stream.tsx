import {
  messengerMessageSchema,
  messengerMessagesSchema,
  messengerMembersSchema,
  type MessengerMessage,
} from "@lumo/contracts/messenger";
import { formatDate, formatTime } from "@lumo/shared/date-time";
import {
  Button,
  Textarea,
  ErrorMessage,
  Badge,
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

import { AppAvatar } from "../../components/app-avatar";
import { api, command, sessionQuery } from "../../lib/api";
import { messengerKey, messengerPath } from "./messenger-api";

const reactions = ["👍", "❤️", "😂", "🎉", "👀", "✅"];
type Draft = {
  nonce: string;
  body: string;
  mentionIds: string[];
  attachmentIds: string[];
  failed: boolean;
};
function MessageItem({
  message,
  canPost,
  highlighted,
  own,
  onReply,
  onEdit,
  onDelete,
  onAction,
}: {
  message: MessengerMessage;
  canPost: boolean;
  highlighted?: boolean;
  own: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAction: (action: "reaction" | "pin", body: unknown) => void;
}) {
  return (
    <li
      id={`message-${message.id}`}
      data-message-id={message.id}
      data-highlighted={highlighted || undefined}
      tabIndex={-1}
      className="group data-[highlighted=true]:bg-accent/70 flex min-w-0 gap-3 border-b border-border/30 px-4 py-3 hover:bg-muted/30"
    >
      <AppAvatar name={message.senderName} src={message.senderImage ?? undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <strong className="text-sm">{message.senderName}</strong>
          <time
            className="text-xs text-muted-foreground"
            dateTime={message.createdAt}
            title={new Date(message.createdAt).toLocaleString()}
          >
            {formatTime(message.createdAt)}
          </time>
          {message.editedAt && !message.deletedAt && <small>edited</small>}
          {message.pinnedAt && <Badge>Pinned</Badge>}
        </div>
        <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed">
          {message.deletedAt ? "Message deleted" : message.body}
        </p>
        {message.mentionIds.length > 0 && (
          <p className="text-xs text-primary">
            {message.mentionIds.length} member mention{message.mentionIds.length === 1 ? "" : "s"}
          </p>
        )}
        {message.attachments.map((file) => (
          <AttachmentDownload
            key={file.id}
            workspaceId={message.workspaceId}
            id={file.id}
            name={file.name}
          />
        ))}
        <div className="mt-2 flex flex-wrap gap-1">
          {message.reactions.map((r) => (
            <Button
              key={r.emoji}
              size="sm"
              aria-pressed={r.mine}
              disabled={!canPost}
              onClick={() => onAction("reaction", { emoji: r.emoji, active: !r.mine })}
            >
              {r.emoji} {r.count}
            </Button>
          ))}
          {!message.parentId && (
            <Button size="sm" variant="ghost" onClick={onReply}>
              {message.replies
                ? `${message.replies} ${message.replies === 1 ? "reply" : "replies"}`
                : "Reply in thread"}
            </Button>
          )}
          {canPost && !message.deletedAt && (
            <details className="relative">
              <summary className="cursor-pointer rounded-md px-2 py-1 text-xs hover:bg-muted">
                Message actions
              </summary>
              <fieldset
                className="my-1 flex flex-wrap gap-1 rounded-md border bg-surface p-2"
                aria-label="Message actions"
              >
                {reactions.map((emoji) => (
                  <Button
                    size="sm"
                    key={emoji}
                    aria-label={`React ${emoji}`}
                    onClick={() =>
                      onAction("reaction", {
                        emoji,
                        active: !message.reactions.some((r) => r.emoji === emoji && r.mine),
                      })
                    }
                  >
                    {emoji}
                  </Button>
                ))}
                <Button size="sm" onClick={() => onAction("pin", { active: !message.pinnedAt })}>
                  {message.pinnedAt ? "Unpin" : "Pin"}
                </Button>
                {own && (
                  <>
                    <Button size="sm" onClick={onEdit}>
                      Edit message
                    </Button>
                    <Button size="sm" onClick={onDelete}>
                      Delete message
                    </Button>
                  </>
                )}
              </fieldset>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
// Download is authorized again when clicked, including after channel membership changes.
function AttachmentDownload({
  workspaceId,
  id,
  name,
}: {
  workspaceId: string;
  id: string;
  name: string;
}) {
  const download = useMutation({ mutationFn: () => downloadAttachment(workspaceId, id) });
  return (
    <div className="mt-2">
      <Button size="sm" disabled={download.isPending} onClick={() => download.mutate()}>
        {name} · Download
      </Button>
      <small>Unscanned file</small>
      <ErrorMessage error={download.error} />
    </div>
  );
}
import { downloadAttachment, uploadAttachment } from "./messenger-files";
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
      className="shrink-0 space-y-2 border-t bg-surface p-3 sm:p-4"
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
        value={text}
        disabled={disabled}
        maxLength={4000}
        placeholder="Write a message…"
        className="max-h-40 min-h-20 resize-y"
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
  lastReadSequence = 0,
  onReply,
  onTyping,
}: {
  workspaceId: string;
  conversationId: string;
  canPost: boolean;
  parentId?: string;
  around?: string;
  pinned?: boolean;
  lastReadSequence?: number;
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
    queryKey: [...messengerKey(workspaceId), "messages", conversationId, parentId, around, pinned],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam, signal }) =>
      api(
        `${messengerPath(workspaceId, conversationId)}/messages?${new URLSearchParams({ ...(pageParam ? { before: String(pageParam) } : {}), ...(parentId ? { parentId } : {}), ...(around && !pageParam ? { around } : {}), ...(pinned ? { pinned: "true" } : {}) })}`,
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
  }, [workspaceId, conversationId, lastId, atBottom, around, pinned, client]);
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
              {pinned
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
                own={message.senderId === session.data?.user.id}
                canPost={canPost}
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
      {canPost && !pinned && (
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
