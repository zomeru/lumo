import { EventEmitter } from "node:events";

import { expect, test, vi } from "vitest";

import { windowChannels, type WindowApi } from "../window-api";

const bridge = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn<(name: string, api: unknown) => void>(),
  invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));
const events = new EventEmitter();
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: bridge.exposeInMainWorld },
  ipcRenderer: {
    invoke: bridge.invoke,
    on: (channel: string, callback: (...args: unknown[]) => void) => events.on(channel, callback),
    removeListener: (channel: string, callback: (...args: unknown[]) => void) =>
      events.removeListener(channel, callback),
  },
}));

test("preload exposes only fixed window actions and removes state subscriptions without leaking the IPC event", async () => {
  await import("./index");
  const [name, api] = bridge.exposeInMainWorld.mock.calls[0]! as [string, { window: WindowApi }];
  expect(name).toBe("lumo");
  expect(Object.isFrozen(api)).toBe(true);
  expect(Object.isFrozen(api.window)).toBe(true);
  expect(Object.keys(api.window).sort()).toEqual([
    "close",
    "getState",
    "minimize",
    "onStateChanged",
    "platform",
    "toggleMaximize",
  ]);
  bridge.invoke.mockResolvedValue(undefined);
  await api.window.minimize();
  expect(bridge.invoke).toHaveBeenLastCalledWith(windowChannels.minimize);
  await api.window.toggleMaximize();
  expect(bridge.invoke).toHaveBeenLastCalledWith(windowChannels.toggleMaximize);
  await api.window.close();
  expect(bridge.invoke).toHaveBeenLastCalledWith(windowChannels.close);
  const state = { maximized: true, fullscreen: false };
  bridge.invoke.mockResolvedValue(state);
  expect(await api.window.getState()).toEqual(state);
  expect(bridge.invoke).toHaveBeenLastCalledWith(windowChannels.state);
  const first = vi.fn<(state: unknown) => void>();
  const second = vi.fn<(state: unknown) => void>();
  const unsubscribe = api.window.onStateChanged(first);
  const unsubscribeSecond = api.window.onStateChanged(second);
  events.emit(windowChannels.stateChanged, { sender: "privileged event" }, state);
  expect(first).toHaveBeenCalledExactlyOnceWith(state);
  expect(second).toHaveBeenCalledExactlyOnceWith(state);
  unsubscribe();
  events.emit(windowChannels.stateChanged, {}, state);
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledTimes(2);
  unsubscribeSecond();
  expect(events.listenerCount(windowChannels.stateChanged)).toBe(0);
});
