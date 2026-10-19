import { test, expect, vi, afterEach } from "vitest";
const fakes = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  token: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    appKey: "org#app",
    identity: "user",
    token: "token",
    groupId: "group",
    expiresAt: new Date().toISOString(),
  })),
  open: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  close: vi.fn<() => void>(),
  renew: vi.fn<(value: string) => Promise<void>>(async () => {}),
  history: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    messages: [{ id: "old", type: "txt", msg: "Hello", from: "other", time: 1 }],
    cursor: "old",
  })),
  send: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ serverMsgId: "server" })),
}));
vi.mock("agora-chat", () => ({
  default: {
    logger: { disableAll: () => {} },
    connection: class {
      addEventHandler(_name: string, handlers: typeof fakes.handlers) {
        fakes.handlers = handlers;
      }
      removeEventHandler() {}
      open = fakes.open;
      close = fakes.close;
      renewToken = fakes.renew;
      getHistoryMessages = fakes.history;
      getServerConversations = async () => ({
        data: { conversations: [{ conversationId: "other", unReadCount: 2 }] },
      });
      send = fakes.send;
    },
    message: { create: (body: { msg: string }) => ({ ...body, id: "optimistic" }) },
  },
}));
vi.mock("../../lib/api", () => ({ api: fakes.token }));
import { connectChat } from "./chat";
afterEach(() => {
  vi.useRealTimers();
});
test("loads provider history, filters foreign groups, reconciles optimistic sends and closes", async () => {
  const messages = vi.fn<(...args: unknown[]) => void>(),
    state = vi.fn<(state: string) => void>();
  const connection = await connectChat("workspace", "conversation", messages, state);
  expect(fakes.open).toHaveBeenCalledWith({ user: "user", accessToken: "token" });
  expect(messages).toHaveBeenCalledWith([expect.objectContaining({ text: "Hello" })]);
  fakes.handlers.onConnected!();
  expect(state).toHaveBeenCalledWith("Connected");
  fakes.handlers.onTextMessage!({ id: "new", to: "group", msg: "Live", from: "other", time: 2 });
  fakes.handlers.onTextMessage!({ id: "foreign", to: "other", msg: "Secret" });
  expect(messages.mock.calls.at(-1)![0]).toHaveLength(2);
  await connection.send("New message");
  expect(messages.mock.calls.at(-1)![0]).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "server", text: "New message" })]),
  );
  await expect(connection.send("")).rejects.toThrow(/./);
  await expect(connection.send("a".repeat(4001))).rejects.toThrow(/./);
  await expect(connection.send("retry", "unknown")).rejects.toThrow(/./);
  expect(await connection.history()).toBe(false);
  connection.close();
});
test("failed sends can be retried without duplicating optimistic messages", async () => {
  const messages = vi.fn<(...args: unknown[]) => void>();
  const connection = await connectChat("ws", "conv", messages, () => {});
  fakes.send.mockRejectedValueOnce(new Error("offline"));
  await expect(connection.send("draft")).rejects.toThrow("offline");
  expect(messages.mock.calls.at(-1)![0]).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "optimistic", failed: true })]),
  );
  await connection.send("draft", "optimistic");
  connection.close();
});
test("refresh, reconnect and denied authorization transitions are explicit", async () => {
  vi.useFakeTimers();
  const state = vi.fn<(state: string) => void>();
  const connection = await connectChat("ws", "conv", () => {}, state);
  fakes.handlers.onDisconnected!();
  fakes.handlers.onReconnecting!();
  fakes.handlers.onError!();
  fakes.handlers.onTokenWillExpire!();
  await vi.advanceTimersByTimeAsync(1);
  expect(fakes.renew).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  fakes.token.mockRejectedValueOnce(new Error("removed"));
  fakes.handlers.onTokenExpired!();
  await vi.advanceTimersByTimeAsync(1);
  expect(state).toHaveBeenCalledWith("Access expired. Reopen this conversation.");
  connection.close();
  fakes.handlers.onDisconnected!();
});
test("failed history closes the provider connection", async () => {
  fakes.history.mockRejectedValueOnce(new Error("history failed"));
  await expect(
    connectChat(
      "ws",
      "conv",
      () => {},
      () => {},
    ),
  ).rejects.toThrow("history failed");
  expect(fakes.close).toHaveBeenCalled();
});

test("provider error objects become safe actionable messages and cancelled mounts do not connect", async () => {
  fakes.open.mockRejectedValueOnce({ type: 16, message: "websocket disconnected" });
  await expect(
    connectChat(
      "ws",
      "conv",
      () => {},
      () => {},
    ),
  ).rejects.toThrow("Chat connection failed (16): websocket disconnected");
  fakes.open.mockRejectedValueOnce({ type: 8 });
  await expect(
    connectChat(
      "ws",
      "conv",
      () => {},
      () => {},
    ),
  ).rejects.toThrow("Check Agora Chat configuration");
  const controller = new AbortController();
  controller.abort();
  await expect(
    connectChat(
      "ws",
      "conv",
      () => {},
      () => {},
      () => {},
      controller.signal,
    ),
  ).rejects.toThrow(/abort/i);
});
test("message-history variants retain text safety, ordering and provider pagination", async () => {
  fakes.history.mockResolvedValueOnce({
    messages: [
      { id: "file", type: "file" },
      { id: "fallback", type: "txt", data: "Plain text" },
      { id: "empty", type: "txt" },
    ],
  });
  const messages = vi.fn<(...args: unknown[]) => void>();
  const connection = await connectChat(
    "ws",
    "conv",
    messages,
    () => {},
    () => {},
  );
  expect(messages).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ text: "Plain text", sender: "" })]),
  );
  fakes.history.mockResolvedValueOnce({
    messages: Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      type: "txt",
      msg: "Older",
      from: "user",
      time: index,
    })),
  });
  expect(await connection.history()).toBe(true);
  connection.close();
});

test("cancellation during login closes the socket before it can become usable", async () => {
  const controller = new AbortController();
  let finish: () => void = () => {};
  fakes.open.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const state = vi.fn<(value: string) => void>();
  const pending = connectChat(
    "ws",
    "conv",
    () => {},
    state,
    () => {},
    controller.signal,
  );
  await vi.waitFor(() => expect(fakes.open).toHaveBeenCalled());
  controller.abort();
  finish();
  await expect(pending).rejects.toThrow(/abort/i);
  expect(fakes.close).toHaveBeenCalled();
  expect(state).not.toHaveBeenCalledWith("Connected");
});
test("provider callback errors are preserved safely when open rejects without a reason", async () => {
  fakes.open.mockImplementationOnce(async () => {
    fakes.handlers.onError!({ type: 16, message: "Rejected " + "a".repeat(64) });
    throw undefined;
  });
  await expect(
    connectChat(
      "ws",
      "conv",
      () => {},
      () => {},
    ),
  ).rejects.toThrow("Chat connection failed (16): Rejected [redacted]");
});
