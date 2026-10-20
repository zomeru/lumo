import { Server } from "node:http";

import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createAuth } from "@lumo/auth";
import { createDatabase } from "@lumo/database";
import { readServerEnv } from "@lumo/env/server";
import pino from "pino";

import { createApp } from "./app.ts";
import { listenForWiki } from "./modules/office/wiki-notifications";
import { cleanupStorage } from "./storage/cleanup";
import { createS3Storage } from "./storage/s3";

const env = readServerEnv();
const logger = pino({ level: env.LOG_LEVEL });
const { db, pool } = createDatabase(env.DATABASE_URL);
pool.on("error", () => logger.error("Database connection failed"));
const auth = createAuth(db, env);
const storage = createS3Storage(env);
const app = createApp({
  db,
  auth,
  env,
  storage,
  clientIp: (c) => getConnInfo(c).remote.address ?? "unknown",
});
let cleaning = false;
const maintenance = setInterval(() => {
  if (cleaning || !env.AWS_S3_BUCKET || !env.AWS_REGION) return;
  cleaning = true;
  void cleanupStorage(db, storage)
    .then(({ failures }) => {
      if (failures) logger.warn({ failures }, "Storage cleanup will retry");
    })
    .catch(() => logger.error("Storage maintenance failed"))
    .finally(() => {
      cleaning = false;
    });
}, 60_000);
maintenance.unref();
const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, () =>
  logger.info({ port: env.PORT }, "Lumo API ready"),
);
if (!(server instanceof Server)) throw new Error("Wiki requires the HTTP upgrade server");
app.wiki.attach(server);
// A dedicated LISTEN connection forwards durable Wiki updates between API instances.
const notifications = await listenForWiki(pool, app.wiki, () =>
  logger.error("Wiki notification connection or refresh failed; reconnect will retry"),
);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(maintenance);
  const timeout = setTimeout(() => {
    if ("closeAllConnections" in server) server.closeAllConnections();
    process.exitCode = 1;
  }, 10000);
  timeout.unref();
  void app.wiki.close().finally(() => {
    void notifications.close().finally(() => {
      server.close(() => {
        void pool.end().finally(() => clearTimeout(timeout));
      });
      if ("closeIdleConnections" in server) server.closeIdleConnections();
    });
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
