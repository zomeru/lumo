import { ApiError } from "@lumolynk/api-client";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fake = vi.hoisted(() => ({ api: vi.fn<(...args: unknown[]) => Promise<unknown>>() }));
vi.mock("../../lib/api", () => ({ api: fake.api, ApiError }));
import { connectMessenger, messengerKey } from "./messenger-api";

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  onopen?: () => void;
  onclose?: (value: { code: number }) => void;
  onmessage?: (value: { data: string }) => void;
  onerror?: () => void;
  send = vi.fn<(text: string) => void>();
  close = vi.fn<() => void>();
  readonly url: string;
  constructor(url: string) {
    this.url = url;
    Socket.instances.push(this);
  }
}
let client: QueryClient;
beforeEach(() => {
  vi.useFakeTimers();
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
  fake.api.mockReset();
  fake.api.mockResolvedValue({ url: "ws://localhost/messenger", token: "ticket" });
  client = new QueryClient();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const flush = () => vi.advanceTimersByTimeAsync(0);
test("workspace socket validates frames, coalesces updates, sends typing and refreshes tickets on reconnect", async () => {
  const state = vi.fn<(value: string) => void>(),
    typing = vi.fn<(id: string, actor: string) => void>(),
    invalidate = vi.spyOn(client, "invalidateQueries");
  const connection = connectMessenger("workspace", client, state, typing);
  await flush();
  const socket = Socket.instances[0]!;
  socket.onopen!();
  expect(state).toHaveBeenCalledWith("Connected");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: messengerKey("workspace") });
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    actor = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  socket.onmessage!({ data: "not-json" });
  socket.onmessage!({
    data: JSON.stringify({ type: "typing", conversationId: id, actorId: actor }),
  });
  expect(typing).toHaveBeenCalledWith(id, actor);
  for (let i = 0; i < 5; i++)
    socket.onmessage!({ data: JSON.stringify({ type: "changed", conversationId: null }) });
  await vi.advanceTimersByTimeAsync(500);
  expect(invalidate).toHaveBeenCalledTimes(3);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workspace", "workspace", "presence"] });
  connection.typing(id);
  expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: "typing", conversationId: id }));
  socket.onerror!();
  expect(state).toHaveBeenCalledWith("Connection interrupted");
  socket.onclose!({ code: 4001 });
  await vi.advanceTimersByTimeAsync(500);
  expect(fake.api).toHaveBeenCalledTimes(2);
  connection.close();
  expect(Socket.instances[1]!.close).toHaveBeenCalled();
});
test("authorization revocation clears active queries and does not reconnect", async () => {
  const reset = vi.spyOn(client, "resetQueries"),
    state = vi.fn<(value: string) => void>(),
    connection = connectMessenger("workspace", client, state, () => {});
  await flush();
  Socket.instances[0]!.onclose!({ code: 1008 });
  await vi.advanceTimersByTimeAsync(30000);
  expect(fake.api).toHaveBeenCalledTimes(1);
  expect(reset).toHaveBeenCalled();
  expect(state).toHaveBeenCalledWith("Access changed. Reopen Messenger.");
  connection.close();
});
test("offline tickets back off, while rejected sessions stop and cancellation never opens a socket", async () => {
  fake.api
    .mockRejectedValueOnce(new Error("Offline"))
    .mockRejectedValueOnce(new ApiError(401, "AUTH", "Sign in"));
  const state = vi.fn<(value: string) => void>(),
    connection = connectMessenger("workspace", client, state, () => {});
  await flush();
  expect(state).toHaveBeenCalledWith("Reconnecting…");
  await vi.advanceTimersByTimeAsync(500);
  expect(state).toHaveBeenCalledWith("Messenger access unavailable");
  connection.close();
  fake.api.mockResolvedValue({ url: "ws://localhost", token: "ticket" });
  const cancelled = connectMessenger("workspace", client, state, () => {});
  cancelled.close();
  await flush();
  expect(Socket.instances).toHaveLength(0);
});
