import { conversationSchema, conversationsSchema } from "@lumo/contracts/collaboration";
import { messengerSessionSchema, messengerEventSchema } from "@lumo/contracts/messenger";
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { api, ApiError } from "../../lib/api";

export const messengerPath = (workspaceId: string, id?: string) =>
  `/workspaces/${workspaceId}/conversations${id ? `/${id}` : ""}`;
export const messengerKey = (workspaceId: string) =>
  ["workspace", workspaceId, "messenger"] as const;
export const conversationsQuery = (workspaceId: string, offset = 0, q = "") =>
  queryOptions({
    queryKey: [...messengerKey(workspaceId), "conversations", offset, q],
    queryFn: ({ signal }) =>
      api(
        `${messengerPath(workspaceId)}?offset=${offset}&includeChannels=true&q=${encodeURIComponent(q)}`,
        conversationsSchema,
        { signal },
      ),
    refetchInterval: 30000,
  });
export const conversationQuery = (workspaceId: string, id: string) =>
  queryOptions({
    queryKey: [...messengerKey(workspaceId), "conversation", id],
    queryFn: ({ signal }) => api(messengerPath(workspaceId, id), conversationSchema, { signal }),
    retry: false,
  });
export function connectMessenger(
  workspaceId: string,
  client: QueryClient,
  onState: (state: string) => void,
  onTyping: (conversationId: string, actorId: string) => void,
) {
  let disposed = false,
    socket: WebSocket | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    attempt = 0;
  let invalidation: ReturnType<typeof setTimeout> | undefined;
  const invalidate = () => {
    if (invalidation || disposed) return;
    invalidation = setTimeout(() => {
      invalidation = undefined;
      if (!disposed) void client.invalidateQueries({ queryKey: messengerKey(workspaceId) });
    }, 500);
  };
  const controller = new AbortController();
  const reconnect = () => {
    if (disposed) return;
    onState("Reconnecting…");
    retry = setTimeout(
      () => {
        void connect();
      },
      Math.min(15000, 500 * 2 ** attempt++),
    );
  };
  async function connect() {
    try {
      const ticket = await api(
        `/workspaces/${workspaceId}/messenger/session`,
        messengerSessionSchema,
        { method: "POST", body: {}, signal: controller.signal },
      );
      if (disposed) return;
      socket = new WebSocket(`${ticket.url}?ticket=${encodeURIComponent(ticket.token)}`);
      socket.onopen = () => {
        attempt = 0;
        onState("Connected");
        void client.invalidateQueries({ queryKey: messengerKey(workspaceId) });
        void client.invalidateQueries({ queryKey: ["workspace", workspaceId, "presence"] });
      };
      socket.onmessage = (event) => {
        try {
          const value = messengerEventSchema.parse(JSON.parse(String(event.data)));
          if (value.type === "typing" && value.conversationId && value.actorId)
            onTyping(value.conversationId, value.actorId);
          else if (value.type === "presence") {
            void client.invalidateQueries({ queryKey: ["workspace", workspaceId, "presence"] });
            void client.invalidateQueries({ queryKey: ["presence-preference"] });
          } else invalidate();
        } catch {
          /* Invalid frames never enter query state. */
        }
      };
      socket.onclose = (event) => {
        if (disposed) return;
        if (event.code === 1008) {
          void client.resetQueries({ queryKey: messengerKey(workspaceId) });
          onState("Access changed. Reopen Messenger.");
          return;
        }
        reconnect();
      };
      socket.onerror = () => onState("Connection interrupted");
    } catch (error) {
      if (disposed) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        void client.resetQueries({ queryKey: messengerKey(workspaceId) });
        onState("Messenger access unavailable");
        return;
      }
      reconnect();
    }
  }
  void connect();
  return {
    typing(id: string) {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "typing", conversationId: id }));
    },
    close() {
      disposed = true;
      controller.abort();
      clearTimeout(retry);
      clearTimeout(invalidation);
      socket?.close();
    },
  };
}
