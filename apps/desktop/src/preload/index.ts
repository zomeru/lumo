import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { windowChannels, type WindowApi, type WindowState } from "../window-api";

const windowApi: WindowApi = Object.freeze({
  platform: process.platform,
  minimize: () => ipcRenderer.invoke(windowChannels.minimize),
  toggleMaximize: () => ipcRenderer.invoke(windowChannels.toggleMaximize),
  close: () => ipcRenderer.invoke(windowChannels.close),
  getState: () => ipcRenderer.invoke(windowChannels.state),
  onStateChanged: (listener: (state: WindowState) => void) => {
    const handler = (_event: IpcRendererEvent, state: WindowState) => listener(state);
    ipcRenderer.on(windowChannels.stateChanged, handler);
    return () => ipcRenderer.removeListener(windowChannels.stateChanged, handler);
  },
});
contextBridge.exposeInMainWorld(
  "lumo",
  Object.freeze({
    window: windowApi,
    request: (path: string, options: { method?: string; body?: unknown } = {}) =>
      ipcRenderer.invoke("lumo:request", {
        path,
        method: options.method ?? "GET",
        body: options.body,
      }),
    openAttachment: (path: string) => ipcRenderer.invoke("lumo:media-external", path),
    openExternal: (url: string) => ipcRenderer.invoke("lumo:external", url),
    download: (path: string, body: unknown) => ipcRenderer.invoke("lumo:download", { path, body }),
    webOrigin: () => ipcRenderer.invoke("lumo:web-origin"),
  }),
);
