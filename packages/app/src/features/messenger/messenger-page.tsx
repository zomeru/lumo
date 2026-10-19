import { conversationSchema, conversationsSchema } from "@lumo/contracts/collaboration";
import { chatIdentity, type ChatMessage } from "@lumo/shared";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorMessage,
  Field,
  FormField,
  Loading,
  PageHeading,
  SelectField,
  Textarea,
} from "@lumo/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "@tanstack/react-router";
import { MessageSquare, Plus, RefreshCw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, command, membersQuery, sessionQuery } from "../../lib/api";
import { connectChat } from "./chat";
export function MessengerPage({
  workspaceId,
  conversationId,
}: {
  workspaceId: string;
  conversationId?: string;
}) {
  const client = useQueryClient(),
    navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [offset, setOffset] = useState(0),
    [q, setQ] = useState("");
  const conversations = useQuery({
    queryKey: ["workspace", workspaceId, "conversations", offset],
    queryFn: ({ signal }) =>
      api(`/workspaces/${workspaceId}/conversations?offset=${offset}`, conversationsSchema, {
        signal,
      }),
    refetchInterval: 15000,
  });
  const people = useQuery(membersQuery(workspaceId, q)),
    session = useQuery(sessionQuery());
  const create = useMutation({
    mutationFn: (body: { kind: string; name: string; memberIds: string[] }) =>
      api(`/workspaces/${workspaceId}/conversations`, conversationSchema, { method: "POST", body }),
    onSuccess: async (value) => {
      setCreating(false);
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "conversations"] });
      await navigate({
        to: "/w/$workspaceId/messenger/$conversationId",
        params: { workspaceId, conversationId: value.id },
      });
    },
  });
  return (
    <>
      <PageHeading eyebrow="Communicate" title="Messenger">
        Private conversations with the people in this workspace.
      </PageHeading>
      <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
          <aside className="grid gap-4 xl:sticky xl:top-6">
            <h2>Conversations</h2>
            <ErrorMessage error={conversations.error} />
            {conversations.isPending ? (
              <Loading />
            ) : conversations.data?.conversations.length ? (
              conversations.data.conversations.map((item) => (
                <Link
                  className="block rounded-md border border-transparent px-3 py-3 text-sm font-medium transition-colors hover:bg-muted aria-[current=page]:border-primary/15 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
                  key={item.id}
                  to="/w/$workspaceId/messenger/$conversationId"
                  params={{ workspaceId, conversationId: item.id }}
                >
                  {item.name}{" "}
                  {item.providerGroupId && (unread[item.providerGroupId] ?? 0) > 0 && (
                    <Badge>{unread[item.providerGroupId]} unread</Badge>
                  )}
                  <small>{item.kind === "direct" ? "Direct message" : "Private group"}</small>
                </Link>
              ))
            ) : (
              <p>No conversations yet.</p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {offset > 0 && (
                <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
              )}
              {conversations.data?.nextOffset != null && (
                <Button onClick={() => setOffset(conversations.data!.nextOffset!)}>Next</Button>
              )}
            </div>
            <Dialog open={creating} onOpenChange={setCreating}>
              <DialogTrigger asChild>
                <Button className="w-full" variant="primary">
                  <Plus aria-hidden="true" />
                  New conversation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>New conversation</DialogTitle>
                <DialogDescription>
                  Choose the people and give your conversation a name.
                </DialogDescription>
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = new FormData(event.currentTarget);
                    create.mutate({
                      kind: body.get("kind") as string,
                      name: body.get("name") as string,
                      memberIds: body.getAll("memberIds") as string[],
                    });
                  }}
                >
                  <Field label="Conversation name" name="name" required maxLength={100} />
                  <SelectField
                    label="Type"
                    name="kind"
                    options={[
                      { value: "direct", label: "Direct message" },
                      { value: "group", label: "Private group" },
                    ]}
                  />
                  <Field
                    label="Find members"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    maxLength={100}
                  />
                  <fieldset className="grid max-h-52 gap-1 overflow-y-auto scrollbar-stable rounded-md border p-3">
                    <legend className="px-1 text-xs font-medium">Participants</legend>
                    {people.data?.members
                      .filter((person) => person.userId !== session.data?.user.id)
                      .map((person) => (
                        <label
                          htmlFor={`participant-${person.userId}`}
                          className="flex cursor-pointer items-center gap-3 py-2 text-sm"
                          key={person.userId}
                        >
                          <Checkbox
                            id={`participant-${person.userId}`}
                            name="memberIds"
                            value={person.userId}
                          />
                          {person.name}
                        </label>
                      ))}
                  </fieldset>
                  <ErrorMessage error={people.error ?? create.error} />
                  <Button type="submit" disabled={create.isPending}>
                    Create conversation
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </aside>
        </Card>
        {conversationId ? (
          <ConversationView
            key={conversationId}
            workspaceId={workspaceId}
            conversationId={conversationId}
            onUnread={setUnread}
          />
        ) : (
          <EmptyState
            title="Start a conversation"
            icon={<MessageSquare aria-hidden="true" />}
            className="min-h-[420px]"
          >
            Choose a conversation or find someone in Contacts.
          </EmptyState>
        )}
      </div>
    </>
  );
}
function ConversationView({
  workspaceId,
  conversationId,
  onUnread,
}: {
  workspaceId: string;
  conversationId: string;
  onUnread: (counts: Record<string, number>) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [state, setState] = useState("Connecting…"),
    [error, setError] = useState<unknown>(null),
    [text, setText] = useState(""),
    [older, setOlder] = useState(true),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const connection = useRef<Awaited<ReturnType<typeof connectChat>> | null>(null);
  const people = useQuery(membersQuery(workspaceId));
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void connectChat(
      workspaceId,
      conversationId,
      (values) => {
        if (!cancelled) setMessages(values);
      },
      (value) => {
        if (!cancelled) setState(value);
      },
      onUnread,
      controller.signal,
    ).then(
      (value) => {
        if (cancelled) value.close();
        else {
          connection.current = value;
          void command(`/workspaces/${workspaceId}/conversations/${conversationId}/read`).catch(
            () => undefined,
          );
        }
      },
      (cause) => {
        if (!cancelled) {
          setError(cause);
          setState("Unable to connect");
        }
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
      connection.current?.close();
      connection.current = null;
    };
  }, [workspaceId, conversationId, attempt, onUnread]);
  const names = new Map(
    people.data?.members.map((person) => [chatIdentity(workspaceId, person.userId), person.name]),
  );
  async function send(value: string, retryId?: string) {
    if (!connection.current) return;
    setBusy(true);
    setError(null);
    try {
      await connection.current.send(value, retryId);
      setText("");
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
      <section className="flex min-h-[540px] flex-col">
        <header className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex-1">Messages</h2>
          <Badge variant={state === "Connected" ? "success" : "secondary"}>
            <output aria-live="polite">{state}</output>
          </Badge>
          <Button
            onClick={() => {
              setError(null);
              connection.current?.close();
              setAttempt((value) => value + 1);
            }}
          >
            <RefreshCw aria-hidden="true" />
            Reconnect
          </Button>
        </header>
        <ErrorMessage error={error} />
        {older && state === "Connected" && (
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void connection
                .current!.history()
                .then(setOlder, setError)
                .finally(() => setBusy(false));
            }}
          >
            Load older messages
          </Button>
        )}
        <ol
          className="my-4 max-h-[55vh] flex-1 overflow-y-auto scrollbar-stable"
          aria-label="Messages"
          aria-live="polite"
        >
          {messages.map((message) => (
            <li
              key={message.id}
              className="flex gap-3 rounded-md px-1 py-3 hover:bg-muted/30 [&_time]:text-xs [&_time]:text-muted-foreground [&_p]:mt-1 [&_p]:whitespace-pre-wrap [&_p]:wrap-anywhere [&_p]:text-foreground"
            >
              <Avatar name={names.get(message.sender) ?? "Member"} />
              <div className="min-w-0 flex-1">
                <strong>{names.get(message.sender) ?? "Workspace member"}</strong>{" "}
                <time dateTime={new Date(message.time).toISOString()}>
                  {new Date(message.time).toLocaleTimeString()}
                </time>
                <p>{message.text}</p>
                {message.pending && <small>Sending…</small>}
                {message.failed && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void send(message.text, message.id);
                    }}
                  >
                    Retry message
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
        {!messages.length && state === "Connected" && (
          <p className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-surface px-5 py-10 text-center text-muted-foreground">
            No messages yet. Say hello.
          </p>
        )}
        <form
          className="flex flex-wrap items-end gap-3 border-t pt-4 [&>div]:min-w-40 [&>div]:flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            void send(text);
          }}
        >
          <FormField label="Message" hint="Ctrl/⌘ + Enter to send">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={4000}
              required
              placeholder="Write a message to your team…"
              className="min-h-20"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !busy &&
                  state === "Connected" &&
                  text.trim()
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </FormField>
          <Button
            variant="primary"
            type="submit"
            disabled={busy || state !== "Connected" || !text.trim()}
          >
            <Send aria-hidden="true" />
            Send message
          </Button>
        </form>
      </section>
    </Card>
  );
}
