import type { MessengerMessage } from "@lumo/contracts/messenger";
import { formatTime } from "@lumo/shared/date-time";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorMessage,
  cn,
} from "@lumo/ui";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, MoreHorizontal, Pin } from "lucide-react";
import { Fragment } from "react";

import { EmojiPopover } from "./emoji-popover";
import { MemberCard } from "./member-card";
import { decodeMentionBody } from "./mention-text";
import { downloadAttachment } from "./messenger-files";
import { MemberAvatar as AppAvatar } from "./presence";

export function MessageItem({
  message,
  canPost,
  highlighted,
  grouped,
  own,
  context = false,
  busy = false,
  onReply,
  onEdit,
  onDelete,
  onAction,
  onJump,
}: {
  message: MessengerMessage;
  canPost: boolean;
  highlighted?: boolean;
  grouped?: boolean;
  own: boolean;
  context?: boolean;
  busy?: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAction: (action: "reaction" | "pin", body: unknown) => void;
  onJump?: () => void;
}) {
  return (
    <li
      id={context ? undefined : `message-${message.id}`}
      data-message-id={message.id}
      data-highlighted={highlighted || undefined}
      data-grouped={grouped || undefined}
      tabIndex={-1}
      className={cn(
        "group relative flex min-w-0 gap-3 px-4 py-2.5 hover:bg-muted/50 focus-within:bg-muted/50 data-[grouped=true]:py-1 data-[highlighted=true]:bg-accent",
        message.pinnedAt && "border-l-2 border-warning-border bg-warning-subtle/50",
      )}
    >
      {grouped ? (
        <span className="w-9 shrink-0" aria-hidden="true" />
      ) : (
        <MemberCard
          workspaceId={message.workspaceId}
          userId={message.senderId}
          name={message.senderName}
          image={message.senderImage}
          jobTitle={message.senderJobTitle}
          role={message.senderRole}
          self={own}
        >
          <AppAvatar
            userId={message.senderId}
            name={message.senderName}
            src={message.senderImage ?? undefined}
          />
        </MemberCard>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 flex-wrap items-baseline gap-x-2 pr-8">
          <strong className={grouped ? "sr-only" : "text-sm"}>
            {grouped ? (
              message.senderName
            ) : (
              <MemberCard
                workspaceId={message.workspaceId}
                userId={message.senderId}
                name={message.senderName}
                image={message.senderImage}
                jobTitle={message.senderJobTitle}
                role={message.senderRole}
                self={own}
              >
                {message.senderName}
              </MemberCard>
            )}
          </strong>
          <time
            className="text-xs text-muted-foreground"
            dateTime={message.createdAt}
            title={new Date(message.createdAt).toLocaleString()}
          >
            {formatTime(message.createdAt)}
          </time>
          {message.editedAt && !message.deletedAt && <small>edited</small>}
          {message.pinnedAt && (
            <Badge variant="warning">
              <Pin className="size-3" aria-hidden="true" />
              Pinned
            </Badge>
          )}
        </div>
        <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-foreground">
          {message.deletedAt ? (
            "Message deleted"
          ) : (
            <MessageBody body={message.body} mentionIds={message.mentionIds} />
          )}
        </p>
        {message.mentionIds.length > 0 && (
          <span className="sr-only">{message.mentionIds.length} member mentions</span>
        )}
        {message.attachments.map((file) => (
          <AttachmentDownload
            key={file.id}
            workspaceId={message.workspaceId}
            id={file.id}
            name={file.name}
          />
        ))}
        {(message.reactions.length > 0 || (!message.parentId && message.replies > 0) || onJump) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {message.reactions.map((r) => (
              <Button
                key={r.emoji}
                size="sm"
                className="h-7 rounded-full"
                aria-pressed={r.mine}
                disabled={!canPost || busy || !!message.deletedAt}
                onClick={() => onAction("reaction", { emoji: r.emoji, active: !r.mine })}
              >
                {r.emoji} {r.count}
              </Button>
            ))}
            {!message.parentId && !context && message.replies > 0 && (
              <Button size="sm" variant="ghost" onClick={onReply} className="gap-2 text-primary">
                <span className="flex -space-x-1.5" aria-hidden="true">
                  {message.replyParticipants.map((p) => (
                    <AppAvatar
                      key={p.userId}
                      userId={p.userId}
                      name={p.name}
                      src={p.image ?? undefined}
                      size="sm"
                      className="size-5 border-2 border-surface"
                      title={p.name}
                    />
                  ))}
                </span>
                <span>
                  {message.replies} {message.replies === 1 ? "reply" : "replies"}
                </span>
                {message.replyParticipants.length > 0 && (
                  <span className="sr-only">
                    {" "}
                    · {message.replyParticipants.map((p) => p.name).join(", ")}
                  </span>
                )}
              </Button>
            )}
            {onJump && (
              <Button size="sm" variant="link" onClick={onJump}>
                View in conversation
              </Button>
            )}
          </div>
        )}
      </div>
      {!context && (
        <div
          className="message-toolbar absolute top-0 right-2 z-10 flex items-center rounded-md border bg-elevated shadow-sm"
          aria-label="Message toolbar"
        >
          {canPost && !message.deletedAt && (
            <div className="contextual-action">
              <EmojiPopover
                label="Add reaction"
                disabled={busy}
                onPick={(emoji) =>
                  onAction("reaction", {
                    emoji,
                    active: !message.reactions.some((r) => r.emoji === emoji && r.mine),
                  })
                }
              />
            </div>
          )}
          {!message.parentId && (
            <Button
              size="icon"
              variant="ghost"
              className="contextual-action"
              aria-label="Reply in thread"
              title="Reply in thread"
              onClick={onReply}
            >
              <MessageSquare aria-hidden="true" />
            </Button>
          )}
          {canPost && !message.deletedAt && (
            <Button
              size="icon"
              variant="ghost"
              className="contextual-action"
              disabled={busy}
              aria-label={message.pinnedAt ? "Unpin" : "Pin"}
              title={message.pinnedAt ? "Unpin" : "Pin"}
              onClick={() => onAction("pin", { active: !message.pinnedAt })}
            >
              <Pin aria-hidden="true" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="More message actions"
                title="More message actions"
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!message.parentId && (
                <DropdownMenuItem onSelect={onReply}>Reply in thread</DropdownMenuItem>
              )}
              {canPost && !message.deletedAt && (
                <DropdownMenuItem
                  disabled={busy}
                  onSelect={() => onAction("pin", { active: !message.pinnedAt })}
                >
                  {message.pinnedAt ? "Unpin" : "Pin"}
                </DropdownMenuItem>
              )}
              {own && canPost && !message.deletedAt && (
                <>
                  <DropdownMenuItem onSelect={onEdit}>Edit message</DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={onDelete}>
                    Delete message
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
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

function MessageBody({ body, mentionIds }: { body: string; mentionIds: string[] }) {
  const draft = decodeMentionBody(body);
  return (
    <>
      {draft.mentions.map((mention, index) => (
        <Fragment key={mention.start}>
          {draft.text.slice(draft.mentions[index - 1]?.end ?? 0, mention.start)}
          {mentionIds.includes(mention.userId) ? (
            <mark className="rounded-sm bg-accent px-0.5 text-accent-foreground">
              {draft.text.slice(mention.start, mention.end)}
            </mark>
          ) : (
            draft.text.slice(mention.start, mention.end)
          )}
        </Fragment>
      ))}
      {draft.text.slice(draft.mentions.at(-1)?.end ?? 0)}
    </>
  );
}
