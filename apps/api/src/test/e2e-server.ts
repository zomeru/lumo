import { Server } from "node:http";
import { resolve } from "node:path";

import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createAuth } from "@lumo/auth";
import { conversation, conversationMember } from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { chatIdentity } from "@lumo/shared";
import AgoraToken from "agora-token";

import { createApp } from "../app.ts";
import { listenForWiki } from "../modules/office/wiki-notifications";
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
if (!(server instanceof Server)) throw new Error("Collaboration requires an HTTP server");
app.wiki.attach(server);
app.messenger.attach(server);
const notifications = await listenForWiki(database.pool, app.wiki, () => {}, app.messenger);
let stopping = false;
async function cleanup() {
  await Promise.all([app.wiki.close(), app.messenger.close()]);
  await notifications.close();
  if (
    process.env.LUMO_LIVE_AGORA === "1" &&
    env.AGORA_CHAT_REST_ORIGIN &&
    env.AGORA_APP_ID &&
    env.AGORA_APP_CERTIFICATE
  ) {
    const groups = await database.db
      .select({ id: conversation.providerGroupId })
      .from(conversation);
    const members = await database.db
      .select({ workspaceId: conversationMember.workspaceId, userId: conversationMember.userId })
      .from(conversationMember);
    const paths = [
      ...groups.filter((group) => group.id).map((group) => `/chatgroups/${group.id}`),
      ...new Set(
        members.map((member) => `/users/${chatIdentity(member.workspaceId, member.userId)}`),
      ),
    ];
    const token = AgoraToken.ChatTokenBuilder.buildAppToken(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      60,
    );
    for (const path of paths) {
      const response = await fetch(
        `${env.AGORA_CHAT_REST_ORIGIN}/app-id/${env.AGORA_APP_ID}${path}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        },
      ).catch(() => null);
      if (response && !response.ok && response.status !== 404)
        console.error("Live provider cleanup needs attention.");
    }
  }
  await database.cleanup();
}
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    void cleanup();
  });
  if ("closeAllConnections" in server) server.closeAllConnections();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
