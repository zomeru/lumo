import { conversationSchema, conversationsSchema } from "@lumo/contracts/collaboration";
import { chatIdentity, type ChatMessage } from "@lumo/shared";
import { ErrorMessage, Field, Loading, PageHeading, SelectField, Avatar } from "@lumo/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "@tanstack/react-router";
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
      <div className="messenger-layout">
        <aside className="card conversation-sidebar">
          <h2>Conversations</h2>
          <ErrorMessage error={conversations.error} />
          {conversations.isPending ? (
            <Loading />
          ) : conversations.data?.conversations.length ? (
            conversations.data.conversations.map((item) => (
              <Link
                className="conversation-link"
                key={item.id}
                to="/w/$workspaceId/messenger/$conversationId"
                params={{ workspaceId, conversationId: item.id }}
              >
                {item.name}{" "}
                {item.providerGroupId && (unread[item.providerGroupId] ?? 0) > 0 && (
                  <span className="badge">{unread[item.providerGroupId]} unread</span>
                )}
                <small>{item.kind === "direct" ? "Direct message" : "Private group"}</small>
              </Link>
            ))
          ) : (
            <p>No conversations yet.</p>
          )}
          <div className="actions">
            {offset > 0 && (
              <button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
            )}
            {conversations.data?.nextOffset != null && (
              <button onClick={() => setOffset(conversations.data!.nextOffset!)}>Next</button>
            )}
          </div>
          <details>
            <summary>New conversation</summary>
            <form
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
              <SelectField label="Type" name="kind">
                <option value="direct">Direct message</option>
                <option value="group">Private group</option>
              </SelectField>
              <Field
                label="Find members"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                maxLength={100}
              />
              <fieldset>
                <legend>Participants</legend>
                {people.data?.members
                  .filter((person) => person.userId !== session.data?.user.id)
                  .map((person) => (
                    <label className="check-row" key={person.userId}>
                      <input type="checkbox" name="memberIds" value={person.userId} />
                      {person.name}
                    </label>
                  ))}
              </fieldset>
              <ErrorMessage error={people.error ?? create.error} />
              <button disabled={create.isPending}>Create conversation</button>
            </form>
          </details>
        </aside>
        {conversationId ? (
          <ConversationView
            key={conversationId}
            workspaceId={workspaceId}
            conversationId={conversationId}
            onUnread={setUnread}
          />
        ) : (
          <div className="empty">
            <h2>Start a conversation</h2>
            <p>Choose a conversation or find someone in Contacts.</p>
          </div>
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
    <section className="card conversation-view">
      <header className="section-heading">
        <h2>Messages</h2>
        <output aria-live="polite">{state}</output>
        <button
          onClick={() => {
            setError(null);
            connection.current?.close();
            setAttempt((value) => value + 1);
          }}
        >
          Reconnect
        </button>
      </header>
      <ErrorMessage error={error} />
      {older && state === "Connected" && (
        <button
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
        </button>
      )}
      <ol className="message-list" aria-label="Messages" aria-live="polite">
        {messages.map((message) => (
          <li key={message.id} className="message">
            <Avatar name={names.get(message.sender) ?? "Member"} />
            <div>
              <strong>{names.get(message.sender) ?? "Workspace member"}</strong>{" "}
              <time dateTime={new Date(message.time).toISOString()}>
                {new Date(message.time).toLocaleTimeString()}
              </time>
              <p>{message.text}</p>
              {message.pending && <small>Sending…</small>}
              {message.failed && (
                <button
                  disabled={busy}
                  onClick={() => {
                    void send(message.text, message.id);
                  }}
                >
                  Retry message
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!messages.length && state === "Connected" && (
        <p className="empty">No messages yet. Say hello.</p>
      )}
      <form
        className="message-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(text);
        }}
      >
        <Field
          label="Message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={4000}
          required
        />
        <button className="primary" disabled={busy || state !== "Connected" || !text.trim()}>
          Send message
        </button>
      </form>
    </section>
  );
}
