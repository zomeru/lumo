import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createAuth } from "@lumo/auth";
import { createDatabase } from "@lumo/database";
import { readServerEnv } from "@lumo/env/server";
import pino from "pino";

import { createApp } from "./app.ts";

const env = readServerEnv();
const logger = pino({ level: env.LOG_LEVEL });
const { db, pool } = createDatabase(env.DATABASE_URL);
pool.on("error", () => logger.error("Database connection failed"));
const auth = createAuth(db, env);
const app = createApp({
  db,
  auth,
  env,
  clientIp: (c) => getConnInfo(c).remote.address ?? "unknown",
});
const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, () =>
  logger.info({ port: env.PORT }, "Lumo API ready"),
);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => {
    if ("closeAllConnections" in server) server.closeAllConnections();
    process.exitCode = 1;
  }, 10000);
  timeout.unref();
  server.close(() => {
    void pool.end().finally(() => clearTimeout(timeout));
  });
  if ("closeIdleConnections" in server) server.closeIdleConnections();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
