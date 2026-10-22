import type { Transport } from "@lumo/api-client";
import { createAppRouter } from "@lumo/app";
import { configurePlatform } from "@lumo/app/platform";
import { initializeTheme } from "@lumo/ui/theme";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";

import "@lumo/ui/styles.css";
import { createRoot } from "react-dom/client";

import type { WindowApi } from "../window-api";
import { DesktopChrome } from "./window-chrome";
declare global {
  interface Window {
    lumo: {
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
  webOrigin: await window.lumo.webOrigin(),
  transport: window.lumo.request,
  download: window.lumo.download,
  openAttachment: window.lumo.openAttachment,
});
const router = createAppRouter();
const root = document.getElementById("root");
if (!root) throw new Error("Missing app root");
createRoot(root).render(
  <StrictMode>
    <DesktopChrome api={window.lumo.window}>
      <RouterProvider router={router} />
    </DesktopChrome>
  </StrictMode>,
);
