import { membersSchema } from "@lumo/contracts";
import type { Conversation } from "@lumo/contracts/collaboration";
import { messengerSearchSchema } from "@lumo/contracts/messenger";
import { canCreateChannel } from "@lumo/contracts/permissions";
import { formatDateTime } from "@lumo/shared/date-time";
import { Badge, Button, EmptyState, ErrorMessage, Field, Loading, cn } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Hash, Lock, MessageSquare, Plus, Search, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppAvatar } from "../../components/app-avatar";
import { api, workspaceQuery, sessionQuery } from "../../lib/api";
import { useStartDirectMessage } from "./member-card";
import { MessageStream } from "./message-stream";
import { conversationQuery, conversationsQuery, messengerKey } from "./messenger-api";
import { ConversationSettings, CreateConversationDialog } from "./messenger-dialogs";
import { useMessengerRealtime } from "./messenger-notifications";
import { PresencePreference, MemberAvatar } from "./presence";

export function MessengerPage({
  workspaceId,
  conversationId,
}: {
  workspaceId: string;
  conversationId?: string;
}) {
  const [creating, setCreating] = useState<"channel" | "dm" | null>(null),
    [members, setMembers] = useState<string[]>([]),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState("");
  const { status: state, typing, sendTyping } = useMessengerRealtime();
  const session = useQuery(sessionQuery());
  const suggestions = useQuery({
    queryKey: ["workspace", workspaceId, "suggested-contacts", filter],
    queryFn: ({ signal }) =>
      api(
        `/workspaces/${workspaceId}/members?limit=11&q=${encodeURIComponent(filter)}`,
        membersSchema,
        { signal },
      ),
  });
  const direct = useStartDirectMessage(workspaceId);
  const conversations = useQuery(conversationsQuery(workspaceId, offset, filter));
  const workspace = useQuery(workspaceQuery(workspaceId));
  const canCreate = workspace.data ? canCreateChannel(workspace.data.role) : false;
  const items = conversations.data?.conversations ?? [];
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-surface"
      aria-label="Workspace messenger"
    >
      <aside
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col border-r bg-sidebar/40 md:w-60 xl:w-72",
          conversationId && "hidden md:flex",
        )}
        aria-label="Messenger sidebar"
      >
        <header className="flex items-center gap-2 border-b p-4">
          <MessageSquare className="size-5 text-primary" aria-hidden="true" />
          <h1 className="flex-1 text-lg font-semibold">Messenger</h1>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Compose direct message"
            onClick={() => {
              setMembers([]);
              setCreating("dm");
            }}
          >
            <Plus aria-hidden="true" />
          </Button>
        </header>
        <div className="border-b p-3">
          <Field
            label="Find conversations"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setOffset(0);
            }}
            maxLength={100}
          />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Conversations">
          <ErrorMessage error={conversations.error} />
          {conversations.isPending ? (
            <Loading />
          ) : (
            <>
              {(["channel", "dm"] as const).map((kind) => (
                <details key={kind} open className="mb-4">
                  <summary className="cursor-pointer px-2 py-2 text-xs font-semibold text-muted-foreground">
                    {kind === "channel" ? "Channels" : "Direct messages"}
                  </summary>
                  {items
                    .filter((item) => (item.kind === "channel") === (kind === "channel"))
                    .map((item) => (
                      <ConversationRow key={item.id} workspaceId={workspaceId} item={item} />
                    ))}
                  {kind === "channel" && canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-full justify-start"
                      onClick={() => setCreating("channel")}
                    >
                      <Plus aria-hidden="true" />
                      Create channel
                    </Button>
                  )}
                  {kind === "dm" && (
                    <>
                      {(suggestions.data?.members ?? [])
                        .filter(
                          (person) =>
                            person.userId !== session.data?.user.id &&
                            !items.some(
                              (item) =>
                                item.kind === "direct" && item.memberIds.includes(person.userId),
                            ),
                        )
                        .slice(0, 10)
                        .map((person) => (
                          <Button
                            key={person.userId}
                            variant="ghost"
                            className="my-0.5 w-full justify-start px-2"
                            disabled={direct.isPending}
                            onClick={() =>
                              direct.mutate({ userId: person.userId, name: person.name })
                            }
                          >
                            <MemberAvatar
                              userId={person.userId}
                              name={person.name}
                              src={person.image ?? undefined}
                              size="sm"
                            />
                            <span className="truncate text-foreground">{person.name}</span>
                          </Button>
                        ))}
                      <ErrorMessage error={direct.error} />
                    </>
                  )}
                  {kind === "dm" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-full justify-start"
                      onClick={() => {
                        setMembers([]);
                        setCreating("dm");
                      }}
                    >
                      <Plus aria-hidden="true" />
                      New conversation
                    </Button>
                  )}
                </details>
              ))}
            </>
          )}
          {conversations.data?.conversations.length === 0 && (
            <p className="p-2 text-sm">No matching conversations.</p>
          )}
          <div className="flex gap-2">
            {offset > 0 && (
              <Button size="sm" onClick={() => setOffset(Math.max(0, offset - 50))}>
                Previous
              </Button>
            )}
            {conversations.data?.nextOffset != null && (
              <Button size="sm" onClick={() => setOffset(conversations.data!.nextOffset!)}>
                Next
              </Button>
            )}
          </div>
        </nav>
        <PresencePreference />
        <output
          aria-live="polite"
          className="shrink-0 border-t px-4 py-3 text-xs text-muted-foreground"
        >
          {state}
        </output>
      </aside>
      {conversationId ? (
        <ActiveConversation
          key={conversationId}
          workspaceId={workspaceId}
          conversationId={conversationId}
          onTyping={() => sendTyping(conversationId)}
          typing={typing?.id === conversationId}
          onNewGroup={(ids) => {
            setMembers(ids);
            setCreating("dm");
          }}
        />
      ) : (
        <div className="hidden min-h-0 min-w-0 flex-1 items-center justify-center md:flex">
          <EmptyState title="Start a conversation" icon={<MessageSquare aria-hidden="true" />}>
            Choose a channel or start a direct message with your team.
          </EmptyState>
        </div>
      )}
      {creating && (
        <CreateConversationDialog
          workspaceId={workspaceId}
          channel={creating === "channel"}
          initialMembers={members}
          onClose={() => setCreating(null)}
        />
      )}
    </section>
  );
}
function ConversationRow({ workspaceId, item }: { workspaceId: string; item: Conversation }) {
  const count =
      item.notifications === "muted"
        ? 0
        : item.notifications === "mentions"
          ? item.mentions
          : item.unread,
    Icon = item.kind === "channel" ? (item.visibility === "private" ? Lock : Hash) : MessageSquare;
  return (
    <Link
      className="mb-1 flex items-center gap-2 rounded-md border-l-2 border-transparent aria-[current=page]:border-primary px-2 py-2 text-sm hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
      to="/w/$workspaceId/messenger/$conversationId"
      params={{ workspaceId, conversationId: item.id }}
      hash=""
      resetScroll={false}
    >
      {item.kind === "channel" ? (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <span className="flex shrink-0 -space-x-3" aria-hidden="true">
          {item.participants.length ? (
            item.participants.map((person) => (
              <MemberAvatar
                userId={person.userId}
                key={person.userId}
                name={person.name}
                src={person.image ?? undefined}
                className="size-7 border-2 border-sidebar"
              />
            ))
          ) : (
            <AppAvatar name={item.name} className="size-7" />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {item.name}
          {item.archivedAt ? " · Archived" : ""}
        </span>
        {item.lastMessage && item.kind !== "channel" && (
          <span className="block truncate text-xs text-muted-foreground">{item.lastMessage}</span>
        )}
        {item.lastActivityAt && (
          <time
            className="sr-only"
            dateTime={item.lastActivityAt}
            title={formatDateTime(item.lastActivityAt)}
          >
            {formatDateTime(item.lastActivityAt)}
          </time>
        )}
      </span>
      {count > 0 && (
        <Badge variant="primary" aria-label={`${count} unread messages`}>
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Link>
  );
}
function ActiveConversation({
  workspaceId,
  conversationId,
  onTyping,
  typing,
  onNewGroup,
}: {
  workspaceId: string;
  conversationId: string;
  onTyping: () => void;
  typing: boolean;
  onNewGroup: (ids: string[]) => void;
}) {
  const navigate = useNavigate();
  const item = useQuery(conversationQuery(workspaceId, conversationId)),
    [settings, setSettings] = useState(false),
    [thread, setThread] = useState<string | null>(null),
    [view, setView] = useState<"messages" | "pinned" | "files">("messages"),
    [search, setSearch] = useState(false);
  const threadTrigger = useRef<HTMLElement | null>(null),
    closeThread = useRef<HTMLButtonElement>(null);
  const openThread = (id: string) => {
    threadTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setThread(id);
  };
  useEffect(() => {
    if (thread) closeThread.current?.focus();
  }, [thread]);
  const hash = useRouterState({ select: (s) => s.location.hash }),
    around = /^[0-9a-f-]{36}$/.test(hash) ? hash : undefined;
  if (item.isError)
    return (
      <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <h2>Conversation unavailable</h2>
        <ErrorMessage error={item.error} />
        <Button asChild>
          <Link to="/w/$workspaceId/messenger" params={{ workspaceId }}>
            Back to conversations
          </Link>
        </Button>
      </section>
    );
  if (!item.data) return <Loading />;
  const conversation = item.data,
    canPost = conversation.joined && !conversation.archivedAt;
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label={conversation.name}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-5">
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="md:hidden"
          aria-label="Back to conversations"
        >
          <Link to="/w/$workspaceId/messenger" params={{ workspaceId }}>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">
            {conversation.kind === "channel"
              ? conversation.visibility === "private"
                ? "🔒 "
                : "# "
              : ""}
            {conversation.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.description ||
              (conversation.kind === "channel"
                ? `${conversation.visibility} channel`
                : "Private direct conversation")}
            {` · ${conversation.memberCount} members`}
            {conversation.archivedAt ? " · Archived" : ""}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Search messages"
          onClick={() => setSearch(!search)}
        >
          <Search aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={view === "pinned"}
          onClick={() => {
            setThread(null);
            setView(view === "pinned" ? "messages" : "pinned");
          }}
        >
          Pinned
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={view === "files"}
          onClick={() => {
            setThread(null);
            setView(view === "files" ? "messages" : "files");
          }}
        >
          Files
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Conversation settings"
          onClick={() => setSettings(true)}
        >
          <Settings aria-hidden="true" />
        </Button>
      </header>
      {search && (
        <MessageSearch
          workspaceId={workspaceId}
          onClose={() => {
            setSearch(false);
            setThread(null);
            setView("messages");
          }}
        />
      )}
      {view !== "messages" && (
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
          <Button size="sm" onClick={() => setView("messages")}>
            <ArrowLeft aria-hidden="true" />
            Back to messages
          </Button>
          <span className="text-xs text-muted-foreground">
            {view === "pinned" ? "Pinned messages" : "Shared files"}
          </span>
        </div>
      )}
      {around && (
        <div className="border-b p-2 text-center text-xs">
          <Button asChild size="sm">
            <Link
              to="/w/$workspaceId/messenger/$conversationId"
              params={{ workspaceId, conversationId }}
              hash=""
            >
              Return to latest messages
            </Link>
          </Button>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", thread && "hidden xl:flex")}>
          <MessageStream
            key={`${conversationId}:${around ?? ""}:${view}`}
            workspaceId={workspaceId}
            conversationId={conversationId}
            canPost={canPost}
            lastReadSequence={conversation.lastReadSequence}
            around={around}
            pinned={view === "pinned"}
            files={view === "files"}
            onJump={(message) => {
              setView("messages");
              setThread(message.parentId);
              void navigate({
                to: "/w/$workspaceId/messenger/$conversationId",
                params: { workspaceId, conversationId },
                hash: message.parentId ?? message.id,
                resetScroll: false,
              });
            }}
            onReply={openThread}
            onTyping={onTyping}
          />
        </div>
        {thread && (
          <aside
            className="flex min-h-0 min-w-0 flex-1 flex-col border-l xl:max-w-md"
            aria-label="Thread"
          >
            <header className="flex shrink-0 items-center justify-between border-b px-4 py-2">
              <h3 className="text-sm font-semibold">Thread</h3>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close thread"
                ref={closeThread}
                title="Back to conversation"
                onClick={() => {
                  setThread(null);
                  requestAnimationFrame(() => threadTrigger.current?.focus());
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </header>
            <MessageStream
              key={thread}
              workspaceId={workspaceId}
              conversationId={conversationId}
              parentId={thread}
              canPost={canPost}
              lastReadSequence={conversation.lastReadSequence}
              onReply={openThread}
              onTyping={onTyping}
            />
          </aside>
        )}
      </div>
      {typing && (
        <output aria-live="polite" className="border-t px-4 py-1 text-xs text-muted-foreground">
          Someone is typing…
        </output>
      )}
      {settings && (
        <ConversationSettings
          workspaceId={workspaceId}
          item={conversation}
          onClose={() => setSettings(false)}
          onNewGroup={(ids) => {
            setSettings(false);
            onNewGroup(ids);
          }}
        />
      )}
    </section>
  );
}
function MessageSearch({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [q, setQ] = useState(""),
    [term, setTerm] = useState(""),
    [before, setBefore] = useState<number | undefined>();
  const results = useQuery({
    queryKey: [...messengerKey(workspaceId), "search", term, before],
    queryFn: ({ signal }) =>
      api(
        `/workspaces/${workspaceId}/messenger/search?${new URLSearchParams({ q: term, ...(before ? { before: String(before) } : {}) })}`,
        messengerSearchSchema,
        { signal },
      ),
    enabled: term.length >= 2,
  });
  return (
    <section
      className="max-h-[45%] shrink-0 overflow-y-auto border-b bg-muted/20 p-3"
      aria-label="Message search"
    >
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q);
          setBefore(undefined);
        }}
      >
        <div className="min-w-0 flex-1">
          <Field
            label="Search workspace messages"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            minLength={2}
            maxLength={200}
          />
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
        <Button size="icon" variant="ghost" aria-label="Close search" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </form>
      <ErrorMessage error={results.error} />
      <ul className="mt-2 grid gap-2">
        {results.data?.results.map((result) => (
          <li className="rounded-md border bg-surface p-2" key={result.id}>
            <Link
              onClick={onClose}
              to="/w/$workspaceId/messenger/$conversationId"
              params={{ workspaceId, conversationId: result.conversationId }}
              hash={result.parentId ?? result.id}
              className="block text-sm"
            >
              <strong>
                {result.conversationName} · {result.senderName}
              </strong>
              <p className="line-clamp-2 wrap-anywhere">{result.body}</p>
            </Link>
          </li>
        ))}
      </ul>
      {results.data?.results.length === 0 && <p className="py-3 text-sm">No matching messages.</p>}
      {results.data?.nextBefore != null && (
        <Button size="sm" onClick={() => setBefore(results.data!.nextBefore!)}>
          More results
        </Button>
      )}
      {before && (
        <Button size="sm" onClick={() => setBefore(undefined)}>
          First results
        </Button>
      )}
    </section>
  );
}
