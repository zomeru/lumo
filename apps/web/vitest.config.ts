import { fileURLToPath, URL } from "node:url";

import { defineProject, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default defineProject((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      name: "web",
      environment: "jsdom",
      setupFiles: [fileURLToPath(new URL("./src/test/setup.ts", import.meta.url))],
      include: ["src/**/*.test.{ts,tsx}"],
      clearMocks: true,
    },
  }),
);
