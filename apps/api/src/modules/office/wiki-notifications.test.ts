import { EventEmitter } from "node:events";

import { afterEach, expect, test, vi } from "vitest";

import { listenForWiki } from "./wiki-notifications";

const connection = () =>
  Object.assign(new EventEmitter(), {
    query: vi.fn<(statement: string) => Promise<void>>(async () => {}),
    release: vi.fn<(destroy?: boolean) => void>(),
  });
afterEach(() => vi.useRealTimers());
test("lost LISTEN connection resubscribes, ignores stale notifications and releases on shutdown", async () => {
  vi.useFakeTimers();
  const first = connection(),
    second = connection();
  const pool = {
    connect: vi
      .fn<() => Promise<ReturnType<typeof connection>>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second),
  };
  const wiki = {
      refresh: vi.fn<(id: string) => Promise<void>>(async () => {}),
      awareness: vi.fn<(payload: string) => void>(),
    },
    failed = vi.fn<() => void>();
  const listener = await listenForWiki(pool, wiki, failed);
  first.emit("notification", { channel: "lumolynk_wiki", payload: "page" });
  first.emit("notification", { channel: "lumolynk_wiki_awareness", payload: "presence" });
  first.emit("notification", { channel: "unknown" });
  expect(wiki.refresh).toHaveBeenCalledWith("page");
  expect(wiki.awareness).toHaveBeenCalledWith("presence");
  first.emit("error", new Error("Connection lost"));
  first.emit("end");
  first.emit("notification", { channel: "lumolynk_wiki", payload: "stale" });
  expect(first.release).toHaveBeenCalledExactlyOnceWith(true);
  expect(failed).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(second.query.mock.calls.map(([sql]) => sql)).toEqual([
    "LISTEN lumolynk_wiki",
    "LISTEN lumolynk_wiki_awareness",
  ]);
  wiki.refresh.mockRejectedValueOnce(new Error("Refresh failed"));
  second.emit("notification", { channel: "lumolynk_wiki", payload: "new" });
  await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(2));
  await listener.close();
  expect(second.release).toHaveBeenCalledExactlyOnceWith();
  second.emit("notification", { channel: "lumolynk_wiki", payload: "after-close" });
  expect(wiki.refresh).toHaveBeenCalledTimes(2);
});
test("connection and subscription failures retry without leaking clients or retrying after shutdown", async () => {
  vi.useFakeTimers();
  const broken = connection(),
    healthy = connection();
  broken.query.mockRejectedValueOnce(new Error("LISTEN denied"));
  const pool = {
    connect: vi
      .fn<() => Promise<ReturnType<typeof connection>>>()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(broken)
      .mockResolvedValue(healthy),
  };
  const wiki = {
      refresh: vi.fn<(id: string) => Promise<void>>(async () => {}),
      awareness: vi.fn<(payload: string) => void>(),
    },
    failed = vi.fn<() => void>();
  const listener = await listenForWiki(pool, wiki, failed);
  await vi.advanceTimersByTimeAsync(5000);
  expect(broken.release).toHaveBeenCalledExactlyOnceWith(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(healthy.query).toHaveBeenCalledTimes(2);
  healthy.emit("end");
  await listener.close();
  await vi.advanceTimersByTimeAsync(10000);
  expect(pool.connect).toHaveBeenCalledTimes(3);
});
