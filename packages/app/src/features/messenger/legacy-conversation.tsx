import { chatIdentity, type ChatMessage } from "@lumo/shared";
import { formatDateTime } from "@lumo/shared/date-time";
import { Badge, Button, ErrorMessage, FormField, Textarea } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppAvatar as Avatar } from "../../components/app-avatar";
import { command, membersQuery } from "../../lib/api";
import { connectChat } from "./chat";
export function LegacyConversationView({
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
  const photos = new Map(
    people.data?.members.map((person) => [chatIdentity(workspaceId, person.userId), person.image]),
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <section className="flex min-h-0 flex-1 flex-col">
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
          className="my-4 min-h-0 flex-1 overflow-y-auto"
          aria-label="Messages"
          aria-live="polite"
        >
          {messages.map((message) => (
            <li
              key={message.id}
              className="flex gap-3 rounded-md px-1 py-3 hover:bg-muted/30 [&_time]:text-xs [&_time]:text-muted-foreground [&_p]:mt-1 [&_p]:whitespace-pre-wrap [&_p]:wrap-anywhere [&_p]:text-foreground"
            >
              <Avatar
                name={names.get(message.sender) ?? "Member"}
                src={photos.get(message.sender) ?? undefined}
              />
              <div className="min-w-0 flex-1">
                <strong>{names.get(message.sender) ?? "Workspace member"}</strong>{" "}
                <time dateTime={new Date(message.time).toISOString()}>
                  {formatDateTime(message.time)}
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
    </div>
  );
}
