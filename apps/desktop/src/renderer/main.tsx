import type { Transport } from "@lumo/api-client";
import { createAppRouter } from "@lumo/app";
import { configurePlatform } from "@lumo/app/platform";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";

import "@lumo/ui/styles.css";
import { createRoot } from "react-dom/client";
declare global {
  interface Window {
    lumo: {
      request: Transport;
      webOrigin: () => Promise<string>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
configurePlatform({
  kind: "desktop",
  webOrigin: await window.lumo.webOrigin(),
  transport: window.lumo.request,
});
const router = createAppRouter();
const root = document.getElementById("root");
if (!root) throw new Error("Missing app root");
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
