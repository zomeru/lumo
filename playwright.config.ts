import { defineConfig, devices } from "@playwright/test";

const apiOrigin = process.env.LUMOLYNK_E2E_API_ORIGIN ?? "http://localhost:3011";
const webOrigin = process.env.LUMOLYNK_E2E_WEB_ORIGIN ?? "http://localhost:3010";

export default defineConfig({
  testDir: "./tests/e2e/web",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command:
        "pnpm --filter @lumolynk/api exec tsx --env-file-if-exists=.env src/test/e2e-server.ts",
      url: `http://[::1]:${new URL(apiOrigin).port}/ready`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    },
    {
      command: `pnpm --filter @lumolynk/web build && pnpm --filter @lumolynk/web preview --host ::1 --port ${new URL(webOrigin).port}`,
      timeout: 120000,
      url: `http://[::1]:${new URL(webOrigin).port}`,
      env: { VITE_API_URL: apiOrigin },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
  ],
});
