import { resolve } from "node:path";

import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createAuth } from "@lumo/auth";
import { readServerEnv } from "@lumo/env/server";

import { createApp } from "../app.ts";
import { createTestDatabase } from "./database.ts";

const database = await createTestDatabase(process.env.TEST_DATABASE_URL);
const env = readServerEnv({
  ...process.env,
  DATABASE_URL: database.url,
  NODE_ENV: "test",
  PORT: 3011,
  API_ORIGIN: "http://localhost:3011",
  WEB_ORIGIN: "http://localhost:3010",
  MAIL_DIR: resolve("../../.local/e2e-mail"),
  LOG_LEVEL: "silent",
});
const auth = createAuth(database.db, env);
const app = createApp({
  db: database.db,
  auth,
  env,
  clientIp: (c) => getConnInfo(c).remote.address ?? "unknown",
});
const server = serve({ fetch: app.fetch, port: env.PORT }, () =>
  console.log("E2E API ready on port 3011"),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    void database.cleanup();
  });
  if ("closeAllConnections" in server) server.closeAllConnections();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
