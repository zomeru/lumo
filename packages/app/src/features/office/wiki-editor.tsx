import { wikiSessionSchema } from "@lumolynk/contracts/office";
import { Button, ErrorMessage, Loading } from "@lumolynk/ui";
import { useEffect, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { api, ApiError } from "../../lib/api";
import { wikiPath } from "./office-api";

import "./wiki.css";
import WikiSource, { type WikiConnection } from "./wiki-source";
export default function WikiEditor({ workspaceId, id }: { workspaceId: string; id: string }) {
  const [connection, setConnection] = useState<WikiConnection | null>(null),
    [status, setStatus] = useState("Connecting…"),
    [error, setError] = useState<Error | null>(null),
    [attempt, setAttempt] = useState(0),
    [people, setPeople] = useState<string[]>([]);
  useEffect(() => {
    let disposed = false,
      provider: WebsocketProvider | undefined,
      doc: Y.Doc | undefined;
    const controller = new AbortController();
    async function ticket() {
      return api(`${wikiPath(workspaceId)}/${id}/session`, wikiSessionSchema, {
        method: "POST",
        body: { format: "markdown-v1" },
        signal: controller.signal,
      });
    }
    void ticket()
      .then((session) => {
        if (disposed) return;
        doc = new Y.Doc();
        provider = new WebsocketProvider(session.url, session.name, doc, {
          params: { ticket: session.token },
          disableBc: true,
        });
        const current = { doc, provider, editable: session.editable };
        provider.awareness.setLocalStateField("user", { ...session.user, color: "#2563eb" });
        provider.on("status", (value: { status: string }) => {
          if (!disposed)
            setStatus(
              value.status === "connected"
                ? "Connected · changes sync automatically"
                : "Offline · keep this page open to reconnect",
            );
        });
        provider.on("sync", (synced: boolean) => {
          if (synced && !disposed) setConnection(current);
        });
        provider.on("connection-close", (event: CloseEvent | null) => {
          if (event?.code === 1008 && !disposed) {
            setConnection(null);
            setError(
              new Error(
                "Wiki access changed or an update was rejected. Reload the page to check your access.",
              ),
            );
            provider?.disconnect();
          }
        });
        provider.awareness.on("change", () => {
          if (!disposed)
            setPeople(
              [...current.provider.awareness.getStates().values()]
                .map((v) => (typeof v.user?.name === "string" ? v.user.name : ""))
                .filter(Boolean),
            );
        });
      })
      .catch((cause: unknown) => {
        if (!disposed)
          setError(cause instanceof Error ? cause : new Error("Unable to connect to Wiki."));
      });
    const renewal = setInterval(() => {
      void ticket()
        .then((session) => {
          if (provider) {
            provider.params = { ticket: session.token };
          }
        })
        .catch((cause: unknown) => {
          if (!disposed) {
            if (cause instanceof ApiError && [401, 403, 404, 409].includes(cause.status)) {
              provider?.disconnect();
              setConnection(null);
              setError(
                new Error("Unable to renew Wiki access. Reconnect after checking your connection."),
              );
            } else {
              setStatus("Offline · keep this page open to reconnect");
            }
          }
        });
    }, 45000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(renewal);
      provider?.destroy();
      doc?.destroy();
    };
  }, [workspaceId, id, attempt]);
  return (
    <div className="lumolynk-wiki flex min-h-0 flex-1 flex-col">
      <output className="flex flex-wrap justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <span>{status}</span>
        <span>{[...new Set(people)].join(", ")}</span>
      </output>
      {error ? (
        <div className="grid gap-4 p-5">
          <ErrorMessage error={error} />
          <Button
            onClick={() => {
              setError(null);
              setConnection(null);
              setAttempt((v) => v + 1);
            }}
          >
            Reconnect
          </Button>
        </div>
      ) : connection ? (
        <WikiSource connection={connection} />
      ) : (
        <Loading label="Synchronizing Wiki…" />
      )}
    </div>
  );
}
