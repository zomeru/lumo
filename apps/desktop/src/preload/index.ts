import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld(
  "lumo",
  Object.freeze({
    request: (path: string, options: { method?: string; body?: unknown } = {}) =>
      ipcRenderer.invoke("lumo:request", {
        path,
        method: options.method ?? "GET",
        body: options.body,
      }),
    openExternal: (url: string) => ipcRenderer.invoke("lumo:external", url),
    webOrigin: () => ipcRenderer.invoke("lumo:web-origin"),
  }),
);
