import { readFile } from "node:fs/promises";
import { join, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  protocol,
  shell,
  session,
  dialog,
  desktopCapturer,
} from "electron";

import { driveDownload, openMessengerAttachment } from "./drive-download";
import { remoteOrigin, trustedRenderer, externalUrl, rendererCsp } from "./policy";
import { createRendererPolicy } from "./renderer-policy";
import { createSessionTransport } from "./transport";
import { registerWindowControls, synchronizeWindowState } from "./window-controls";

const dirname = fileURLToPath(new URL(".", import.meta.url));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "lumolynk",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
const apiOrigin = remoteOrigin(
  process.env.DESKTOP_API_URL ?? import.meta.env.MAIN_VITE_API_URL ?? "http://localhost:3001",
);
const webOrigin = remoteOrigin(
  process.env.DESKTOP_WEB_ORIGIN ?? import.meta.env.MAIN_VITE_WEB_ORIGIN ?? "http://localhost:3000",
);
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
const devOrigin = devUrl ? new URL(devUrl).origin : undefined;
if (devUrl && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(devUrl).hostname))
  throw new Error("Untrusted development host");
if (app.commandLine.hasSwitch("user-data-dir"))
  app.setPath("userData", app.commandLine.getSwitchValue("user-data-dir"));
let window: BrowserWindow | null = null;
void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerWindowControls(() => window, devOrigin);
  const request = await createSessionTransport(
    apiOrigin,
    webOrigin,
    join(app.getPath("userData"), "session.enc"),
  );
  function sender(event: Electron.IpcMainInvokeEvent) {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trustedRenderer(event.senderFrame.url, devOrigin)
    )
      throw new Error("Untrusted sender");
  }
  ipcMain.handle("lumolynk:request", (event, input: unknown) => {
    sender(event);
    return request(input);
  });
  ipcMain.handle("lumolynk:web-origin", (event) => {
    sender(event);
    return webOrigin;
  });
  ipcMain.handle("lumolynk:download", async (event, input: unknown) => {
    sender(event);
    await driveDownload(input, request, (url) => window!.webContents.downloadURL(url));
  });
  ipcMain.handle("lumolynk:media-external", async (event, path: unknown) => {
    sender(event);
    await openMessengerAttachment(path, request, (url) => shell.openExternal(url));
  });
  ipcMain.handle("lumolynk:external", async (event, url: unknown) => {
    sender(event);
    await shell.openExternal(externalUrl(url, webOrigin));
  });
  const rendererRoot = resolve(dirname, "../renderer");
  const loadPackagedPolicy = createRendererPolicy(apiOrigin);
  protocol.handle("lumolynk", async (req) => {
    const url = new URL(req.url);
    if (url.hostname !== "app" || req.method !== "GET") return new Response(null, { status: 403 });
    let path: string;
    try {
      path = resolve(rendererRoot, `.${decodeURIComponent(url.pathname)}`);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (path !== rendererRoot && !path.startsWith(rendererRoot + sep))
      return new Response(null, { status: 403 });
    if (!extname(path)) path = join(rendererRoot, "index.html");
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".woff2": "font/woff2",
    };
    try {
      const csp =
        extname(path) === ".html"
          ? await loadPackagedPolicy()
          : rendererCsp(undefined, undefined, undefined, apiOrigin);
      return new Response(await readFile(path), {
        headers: {
          "Content-Type": types[extname(path)] ?? "application/octet-stream",
          "Content-Security-Policy": csp,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  const ses = session.defaultSession;
  ses.on("will-download", (_event, item) => {
    // Electron's native save dialog keeps file contents outside the renderer.
    item.setSaveDialogOptions({ title: "Save LumoLynk download" });
  });
  if (devOrigin) {
    const loadDevelopmentPolicy = createRendererPolicy(
      apiOrigin,
      devOrigin,
      import.meta.env.LUMOLYNK_CSP_NONCE,
    );
    ses.webRequest.onHeadersReceived({ urls: [`${devOrigin}/*`] }, (details, callback) => {
      if (details.resourceType !== "mainFrame") {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
      void loadDevelopmentPolicy().then(
        (csp) =>
          callback({
            responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] },
          }),
        () => callback({ cancel: true }),
      );
    });
  }
  ses.setPermissionCheckHandler(
    (contents, permission, origin) =>
      contents === window?.webContents &&
      trustedRenderer(origin, devOrigin) &&
      ["media", "display-capture"].includes(permission),
  );
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (
      contents !== window?.webContents ||
      !trustedRenderer(details.requestingUrl, devOrigin) ||
      !["media", "display-capture"].includes(permission)
    ) {
      callback(false);
      return;
    }
    void dialog
      .showMessageBox(window!, {
        type: "question",
        message: `Allow LumoLynk to use ${permission === "media" ? "your camera or microphone" : "screen sharing"}?`,
        buttons: ["Deny", "Allow"],
        defaultId: 0,
        cancelId: 0,
      })
      .then(
        (result) => callback(result.response === 1),
        () => callback(false),
      );
  });
  ses.setDisplayMediaRequestHandler(
    (details, callback) => {
      if (
        !window ||
        !details.userGesture ||
        details.frame !== window.webContents.mainFrame ||
        !trustedRenderer(details.frame?.url ?? "", devOrigin)
      ) {
        callback({});
        return;
      }
      void (async () => {
        const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
        if (!sources.length) {
          await dialog.showMessageBox(window!, {
            type: "info",
            message: "No screens or windows are available to share on this system.",
            buttons: ["OK"],
          });
          callback({});
          return;
        }
        const result = await dialog.showMessageBox(window!, {
          message: "Choose a screen or window to share",
          buttons: ["Cancel", ...sources.map((source) => source.name)],
          defaultId: 0,
          cancelId: 0,
        });
        const source = sources[result.response - 1];
        callback(source ? { video: source } : {});
      })().catch(() => callback({}));
    },
    { useSystemPicker: true },
  );
  function createWindow() {
    window = new BrowserWindow({
      title: "LumoLynk",
      ...(process.platform === "darwin"
        ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 12, y: 12 } }
        : { frame: false }),
      resizable: true,
      maximizable: true,
      minimizable: true,
      width: 1280,
      height: 850,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: "#0b1425",
      icon: join(app.getAppPath(), "resources/icon.png"),
      webPreferences: {
        preload: join(dirname, "../preload/index.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    window.setMenu(null);
    synchronizeWindowState(window);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (!trustedRenderer(url, devOrigin)) event.preventDefault();
    });
    window.webContents.on("will-attach-webview", (event) => event.preventDefault());
    void window.loadURL(devUrl ?? "lumolynk://app/login");
    window.on("closed", () => {
      window = null;
    });
  }
  createWindow();
  app.on("activate", () => {
    if (!window) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
