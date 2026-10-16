import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    projects: ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/routeTree.gen.ts",
        "**/main.tsx",
        "apps/api/src/index.ts",
        "packages/database/src/migrate.ts",
        "**/*.d.ts",
        "**/test/**",
        "**/*.test.{ts,tsx}",
        "**/*.integration.test.{ts,tsx}",
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
