import type { Conversation } from "@lumo/contracts/collaboration";
import { messengerSearchSchema } from "@lumo/contracts/messenger";
import { Badge, Button, EmptyState, ErrorMessage, Field, Loading, cn } from "@lumo/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Hash, Lock, MessageSquare, Plus, Search, Settings, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { api, command } from "../../lib/api";
import { MessageStream } from "./message-stream";
import {
  conversationQuery,
  conversationsQuery,
  messengerKey,
  messengerPath,
} from "./messenger-api";
import {
  ChannelBrowser,
  ConversationSettings,
  CreateConversationDialog,
} from "./messenger-dialogs";
import { useMessengerRealtime } from "./messenger-notifications";

const LegacyConversationView = lazy(async () => ({
  default: (await import("./legacy-conversation")).LegacyConversationView,
}));
export function MessengerPage({
  workspaceId,
  conversationId,
}: {
  workspaceId: string;
  conversationId?: string;
}) {
  const [creating, setCreating] = useState<"channel" | "dm" | null>(null),
    [browse, setBrowse] = useState(false),
    [members, setMembers] = useState<string[]>([]),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState(""),
    [unread, setUnread] = useState<Record<string, number>>({});
  const { status: state, typing, sendTyping } = useMessengerRealtime();
  const conversations = useQuery(conversationsQuery(workspaceId, offset, filter));
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
          <Button className="mt-2 w-full" size="sm" variant="ghost" onClick={() => setBrowse(true)}>
            <Search aria-hidden="true" />
            Browse channels
          </Button>
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
                      <ConversationRow
                        key={item.id}
                        workspaceId={workspaceId}
                        item={item}
                        providerUnread={
                          item.providerGroupId ? (unread[item.providerGroupId] ?? 0) : 0
                        }
                      />
                    ))}
                  {kind === "channel" && (
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
            <p className="p-2 text-sm">Browse channels or start a conversation.</p>
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
          onUnread={setUnread}
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
      {browse && <ChannelBrowser workspaceId={workspaceId} onClose={() => setBrowse(false)} />}
    </section>
  );
}
function ConversationRow({
  workspaceId,
  item,
  providerUnread,
}: {
  workspaceId: string;
  item: Conversation;
  providerUnread: number;
}) {
  const count =
      item.notifications === "muted"
        ? 0
        : item.notifications === "mentions"
          ? item.mentions
          : item.unread + providerUnread,
    Icon = item.kind === "channel" ? (item.visibility === "private" ? Lock : Hash) : MessageSquare;
  return (
    <Link
      className="mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
      to="/w/$workspaceId/messenger/$conversationId"
      params={{ workspaceId, conversationId: item.id }}
      hash=""
      resetScroll={false}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {item.name}
          {item.archivedAt ? " · Archived" : ""}
        </span>
        {item.lastMessage && (
          <span className="block truncate text-xs text-muted-foreground">{item.lastMessage}</span>
        )}
      </span>
      {count > 0 && (
        <Badge aria-label={`${count} unread messages`}>{count > 99 ? "99+" : count}</Badge>
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
  onUnread,
}: {
  workspaceId: string;
  conversationId: string;
  onTyping: () => void;
  typing: boolean;
  onNewGroup: (ids: string[]) => void;
  onUnread: (counts: Record<string, number>) => void;
}) {
  const item = useQuery(conversationQuery(workspaceId, conversationId)),
    client = useQueryClient(),
    [settings, setSettings] = useState(false),
    [thread, setThread] = useState<string | null>(null),
    [pinned, setPinned] = useState(false),
    [search, setSearch] = useState(false);
  const hash = useRouterState({ select: (s) => s.location.hash }),
    around = /^[0-9a-f-]{36}$/.test(hash) ? hash : undefined;
  const join = useMutation({
    mutationFn: () => command(`${messengerPath(workspaceId, conversationId)}/join`),
    onSuccess: () => client.invalidateQueries({ queryKey: messengerKey(workspaceId) }),
  });
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
        {!conversation.providerGroupId && (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={pinned}
            onClick={() => setPinned(!pinned)}
          >
            Pinned
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Conversation settings"
          onClick={() => setSettings(true)}
        >
          <Settings aria-hidden="true" />
        </Button>
      </header>
      {search && <MessageSearch workspaceId={workspaceId} onClose={() => setSearch(false)} />}
      <ErrorMessage error={join.error} />
      {!conversation.joined && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-accent/40 px-4 py-3 text-sm">
          <p>You can read this public channel. Join to participate.</p>
          <Button
            variant="primary"
            disabled={join.isPending || Boolean(conversation.archivedAt)}
            onClick={() => join.mutate()}
          >
            Join channel
          </Button>
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
        {conversation.providerGroupId ? (
          <Suspense fallback={<Loading />}>
            <LegacyConversationView
              workspaceId={workspaceId}
              conversationId={conversationId}
              onUnread={onUnread}
            />
          </Suspense>
        ) : (
          <>
            <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", thread && "hidden xl:flex")}>
              <MessageStream
                key={`${conversationId}:${around ?? ""}:${pinned}`}
                workspaceId={workspaceId}
                conversationId={conversationId}
                canPost={canPost}
                lastReadSequence={conversation.lastReadSequence}
                around={around}
                pinned={pinned}
                onReply={setThread}
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
                    onClick={() => setThread(null)}
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
                  onReply={setThread}
                  onTyping={onTyping}
                />
              </aside>
            )}
          </>
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
