import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

import { appRoutes } from "./vite.config.ts";
export default defineProject({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [appRoutes(true), react()],
  test: {
    name: "web",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
  },
});
