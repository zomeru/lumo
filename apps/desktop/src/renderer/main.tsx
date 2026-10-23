import type { Transport } from "@lumolynk/api-client";
import { createAppRouter } from "@lumolynk/app";
import { configurePlatform } from "@lumolynk/app/platform";
import { initializeTheme } from "@lumolynk/ui/theme";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";

import "@lumolynk/ui/styles.css";
import { createRoot } from "react-dom/client";

import type { WindowApi } from "../window-api";
import { DesktopChrome } from "./window-chrome";
declare global {
  interface Window {
    lumolynk: {
      window: WindowApi;
      request: Transport;
      webOrigin: () => Promise<string>;
      openAttachment: (path: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      download: (path: string, body: unknown) => Promise<void>;
    };
  }
}
initializeTheme();
configurePlatform({
  kind: "desktop",
  webOrigin: await window.lumolynk.webOrigin(),
  transport: window.lumolynk.request,
  download: window.lumolynk.download,
  openAttachment: window.lumolynk.openAttachment,
});
const router = createAppRouter();
const root = document.getElementById("root");
if (!root) throw new Error("Missing app root");
createRoot(root).render(
  <StrictMode>
    <DesktopChrome api={window.lumolynk.window}>
      <RouterProvider router={router} />
    </DesktopChrome>
  </StrictMode>,
);
