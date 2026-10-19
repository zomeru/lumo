import { chatCredentialsSchema, conversationSchema } from "@lumo/contracts/collaboration";
import { mergeMessages, type ChatMessage } from "@lumo/shared";

import { api } from "../../lib/api";
import { installStaticChatCodec } from "./chat-codec";
export async function connectChat(
  workspaceId: string,
  conversationId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onState: (state: string) => void,
  onUnread: (counts: Record<string, number>) => void = () => {},
  signal?: AbortSignal,
) {
  const { default: imported } = await import("agora-chat");
  // The vendor UMD build exposes an additional default layer under Vite/Rolldown.
  const AgoraChat =
    "connection" in imported
      ? imported
      : (imported as unknown as { default: typeof imported }).default;
  AgoraChat.logger.disableAll();
  installStaticChatCodec(AgoraChat.connection);
  signal?.throwIfAborted();
  const credentialPath = `/workspaces/${workspaceId}/conversations/${conversationId}/credentials`;
  const credentials = () =>
    api(credentialPath, chatCredentialsSchema, { method: "POST", body: {}, signal });
  const authorize = () =>
    api(`/workspaces/${workspaceId}/conversations/${conversationId}`, conversationSchema, {
      signal,
    });
  const initial = await credentials();
  signal?.throwIfAborted();
  const connection = new AgoraChat.connection({
    appKey: initial.appKey,
    https: true,
    isFixedDeviceId: false,
  });
  let disposed = false;
  let ready = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    connection.removeEventHandler("lumo");
    connection.close();
    signal?.removeEventListener("abort", stop);
  };
  signal?.addEventListener("abort", stop, { once: true });
  const convert = (value: {
    id: string;
    msg?: string;
    data?: string;
    from?: string;
    time?: number;
  }) => ({
    id: value.id,
    text: value.msg ?? value.data ?? "",
    sender: value.from ?? "",
    time: value.time ?? Date.now(),
  });
  let messages: ChatMessage[] = [];
  const update = (incoming: ChatMessage[]) => {
    messages = mergeMessages(messages, incoming);
    if (!disposed) onMessages(messages);
  };
  const unread = async () => {
    const response = await connection.getServerConversations({ pageSize: 50, cursor: "" });
    if (!disposed)
      onUnread(
        Object.fromEntries(
          (response.data?.conversations ?? []).map((item) => [
            item.conversationId,
            item.conversationId === initial.groupId ? 0 : item.unReadCount,
          ]),
        ),
      );
  };
  const refresh = async () => {
    try {
      const value = await credentials();
      if (!disposed) {
        await connection.renewToken(value.token);
        await unread();
      }
    } catch {
      connection.close();
      onState("Access expired. Reopen this conversation.");
    }
  };
  let connectionError: unknown;
  connection.addEventHandler("lumo", {
    onConnected: () => onState(ready ? "Connected" : "Loading messages…"),
    onDisconnected: () => {
      if (!disposed) onState("Reconnecting…");
    },
    onReconnecting: () => onState("Reconnecting…"),
    onTextMessage: (message) => {
      if (message.to === initial.groupId) update([convert(message)]);
      else {
        void unread().catch(() => undefined);
      }
    },
    onTokenWillExpire: () => {
      void refresh();
    },
    onTokenExpired: () => {
      void refresh();
    },
    onError: (error) => {
      connectionError = error;
      onState("Chat connection interrupted. Reopen to reconnect.");
    },
  });
  const explain = (error: unknown) => {
    if (error instanceof Error) return error;
    const detail = error as { type?: unknown; message?: unknown };
    const code = typeof detail?.type === "number" ? ` (${detail.type})` : "";
    const message =
      typeof detail?.message === "string"
        ? detail.message.slice(0, 180).replace(/[a-zA-Z0-9+/=]{40,}/g, "[redacted]")
        : "Check Agora Chat configuration and network access.";
    return new Error(`Chat connection failed${code}: ${message}`);
  };
  try {
    await connection.open({ user: initial.identity, accessToken: initial.token });
  } catch (error) {
    connection.close();
    connection.removeEventHandler("lumo");
    throw explain(connectionError ?? error);
  }
  let cursor: string | number | null = null;
  const history = async () => {
    await authorize();
    const response = await connection.getHistoryMessages({
      targetId: initial.groupId,
      chatType: "groupChat",
      pageSize: 30,
      cursor,
      searchDirection: "up",
    });
    cursor = response.cursor ?? null;
    update(
      response.messages
        .filter((message) => message.type === "txt")
        .map((message) =>
          convert(message as { id: string; msg: string; from: string; time: number }),
        ),
    );
    return response.messages.length === 30;
  };
  try {
    await history();
    await unread();
  } catch (error) {
    stop();
    throw explain(error);
  }
  signal?.throwIfAborted();
  timer = setInterval(() => {
    void refresh();
  }, 60000);
  ready = true;
  onState("Connected");
  const pending = new Map<string, ReturnType<typeof AgoraChat.message.create>>();
  async function send(text: string, retryId?: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 4000)
      throw new Error("Messages must contain 1–4000 characters.");
    await authorize();
    const message = retryId
      ? pending.get(retryId)
      : AgoraChat.message.create({
          type: "txt",
          chatType: "groupChat",
          to: initial.groupId,
          msg: trimmed,
        });
    if (!message) throw new Error("This message cannot be retried.");
    pending.set(message.id, message);
    update([
      { id: message.id, text: trimmed, sender: initial.identity, time: Date.now(), pending: true },
    ]);
    try {
      const response = await connection.send(message);
      messages = messages.filter((item) => item.id !== message.id);
      pending.delete(message.id);
      update([
        { id: response.serverMsgId, text: trimmed, sender: initial.identity, time: Date.now() },
      ]);
    } catch (error) {
      update([
        { id: message.id, text: trimmed, sender: initial.identity, time: Date.now(), failed: true },
      ]);
      throw error;
    }
  }
  return {
    send,
    history,
    identity: initial.identity,
    close: () => {
      stop();
      messages = [];
      pending.clear();
    },
  };
}
