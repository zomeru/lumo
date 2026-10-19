import { defineConfig } from "@playwright/test";

import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/desktop",
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
