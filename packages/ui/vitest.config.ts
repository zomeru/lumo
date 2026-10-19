import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  test: {
    name: "ui",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
