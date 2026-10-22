import { defineConfig } from "@playwright/test";

import base from "./playwright.config";
import { desktopApiOrigin } from "./tests/desktop/api-origin";
export default defineConfig({
  ...base,
  testDir: "./tests/desktop",
  webServer: (Array.isArray(base.webServer) ? base.webServer : [base.webServer!]).map(
    (server, index) =>
      index === 0
        ? {
            ...server,
            url: undefined,
            wait: { stdout: /E2E API ready on port/ },
            env: {
              ...server.env,
              LUMO_E2E_API_ORIGIN: desktopApiOrigin(),
              LUMO_E2E_API_HOST: "127.0.0.1",
            },
          }
        : server,
  ),
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 850 },
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
  timeout: 120000,
});
