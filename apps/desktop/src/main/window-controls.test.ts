import { EventEmitter } from "node:events";

import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { beforeEach, expect, test, vi } from "vitest";

import { windowChannels } from "../window-api";

const handlers = vi.hoisted(() => new Map<string, (event: IpcMainInvokeEvent) => unknown>());
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: IpcMainInvokeEvent) => unknown) =>
      handlers.set(channel, handler),
  },
}));
import { registerWindowControls, synchronizeWindowState } from "./window-controls";

function createWindow() {
  const events = new EventEmitter();
  const mainFrame = { url: "lumolynk://app/login" };
  const window = Object.assign(events, {
    isDestroyed: vi.fn<() => boolean>(() => false),
    isMaximized: vi.fn<() => boolean>(() => false),
    isFullScreen: vi.fn<() => boolean>(() => false),
    minimize: vi.fn<() => void>(),
    maximize: vi.fn<() => void>(),
    unmaximize: vi.fn<() => void>(),
    close: vi.fn<() => void>(),
    webContents: {
      mainFrame,
      send: vi.fn<(channel: string, state: unknown) => void>(),
      isDestroyed: vi.fn<() => boolean>(() => false),
    },
  });
  return {
    window,
    event: { sender: window.webContents, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent,
  };
}
function invoke(channel: string, event: IpcMainInvokeEvent) {
  return handlers.get(channel)!(event);
}
beforeEach(() => handlers.clear());

test("window actions target the caller and toggle using the native state", () => {
  const { window, event } = createWindow();
  registerWindowControls(() => window as unknown as BrowserWindow);
  invoke(windowChannels.minimize, event);
  expect(window.minimize).toHaveBeenCalledOnce();
  invoke(windowChannels.toggleMaximize, event);
  expect(window.maximize).toHaveBeenCalledOnce();
  window.isMaximized.mockReturnValue(true);
  invoke(windowChannels.toggleMaximize, event);
  expect(window.unmaximize).toHaveBeenCalledOnce();
  expect(invoke(windowChannels.state, event)).toEqual({ maximized: true, fullscreen: false });
  window.isFullScreen.mockReturnValue(true);
  invoke(windowChannels.toggleMaximize, event);
  expect(window.unmaximize).toHaveBeenCalledOnce();
  invoke(windowChannels.close, event);
  expect(window.close).toHaveBeenCalledOnce();
});

test("rejects other windows, child frames, untrusted URLs and destroyed windows on every channel", () => {
  const { window, event } = createWindow();
  registerWindowControls(() => window as unknown as BrowserWindow);
  for (const channel of handlers.keys()) {
    expect(() => invoke(channel, { ...event, sender: {} } as IpcMainInvokeEvent)).toThrow(
      "Untrusted sender",
    );
    expect(() =>
      invoke(channel, {
        ...event,
        senderFrame: { url: "lumolynk://app/login" },
      } as IpcMainInvokeEvent),
    ).toThrow("Untrusted sender");
    window.webContents.mainFrame.url = "https://evil.test";
    expect(() => invoke(channel, event)).toThrow("Untrusted sender");
    window.webContents.mainFrame.url = "lumolynk://app/login";
    window.isDestroyed.mockReturnValue(true);
    expect(() => invoke(channel, event)).toThrow("Untrusted sender");
    window.isDestroyed.mockReturnValue(false);
  }
  expect(window.minimize).not.toHaveBeenCalled();
  expect(window.maximize).not.toHaveBeenCalled();
  expect(window.close).not.toHaveBeenCalled();
});

test("validates development origin and follows window replacement on macOS activation", () => {
  const first = createWindow();
  const next = createWindow();
  let current: BrowserWindow | null = first.window as unknown as BrowserWindow;
  registerWindowControls(() => current, "http://127.0.0.1:5174");
  first.window.webContents.mainFrame.url = "http://127.0.0.1:5174/login";
  invoke(windowChannels.minimize, first.event);
  current = next.window as unknown as BrowserWindow;
  expect(() => invoke(windowChannels.close, first.event)).toThrow("Untrusted sender");
  invoke(windowChannels.close, next.event);
  expect(next.window.close).toHaveBeenCalledOnce();
  current = null;
  expect(() => invoke(windowChannels.state, next.event)).toThrow("Untrusted sender");
});

test("publishes native maximize, restore and fullscreen state changes without sending to destroyed contents", () => {
  const { window } = createWindow();
  synchronizeWindowState(window as unknown as BrowserWindow);
  for (const event of [
    "maximize",
    "unmaximize",
    "enter-full-screen",
    "leave-full-screen",
    "restore",
  ]) {
    window.isMaximized.mockReturnValue(event === "maximize");
    window.isFullScreen.mockReturnValue(event === "enter-full-screen");
    window.emit(event);
    expect(window.webContents.send).toHaveBeenLastCalledWith(windowChannels.stateChanged, {
      maximized: event === "maximize",
      fullscreen: event === "enter-full-screen",
    });
  }
  window.webContents.isDestroyed.mockReturnValue(true);
  window.emit("maximize");
  expect(window.webContents.send).toHaveBeenCalledTimes(5);
});
