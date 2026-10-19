import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";

import { windowChannels, type WindowState } from "../window-api";
import { trustedRenderer } from "./policy";

export function registerWindowControls(getWindow: () => BrowserWindow | null, devOrigin?: string) {
  function invokingWindow(event: IpcMainInvokeEvent) {
    const window = getWindow();
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trustedRenderer(event.senderFrame.url, devOrigin)
    )
      throw new Error("Untrusted sender");
    return window;
  }
  ipcMain.handle(windowChannels.minimize, (event) => invokingWindow(event).minimize());
  ipcMain.handle(windowChannels.toggleMaximize, (event) => {
    const window = invokingWindow(event);
    // Native fullscreen has a separate lifecycle (notably on macOS).
    if (window.isFullScreen()) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle(windowChannels.close, (event) => invokingWindow(event).close());
  ipcMain.handle(windowChannels.state, (event) => windowState(invokingWindow(event)));
}

function windowState(window: BrowserWindow): WindowState {
  return { maximized: window.isMaximized(), fullscreen: window.isFullScreen() };
}

export function synchronizeWindowState(window: BrowserWindow) {
  const publish = () => {
    if (!window.webContents.isDestroyed())
      window.webContents.send(windowChannels.stateChanged, windowState(window));
  };
  window.on("maximize", publish);
  window.on("unmaximize", publish);
  window.on("enter-full-screen", publish);
  window.on("leave-full-screen", publish);
  window.on("restore", publish);
}
