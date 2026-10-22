import { Server } from "node:http";
import { resolve } from "node:path";

import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createAuth } from "@lumo/auth";
import { conversation, conversationMember, messengerAttachment } from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { chatIdentity } from "@lumo/shared";
import AgoraToken from "agora-token";

import { createApp } from "../app.ts";
import { listenForWiki } from "../modules/office/wiki-notifications";
import { createS3Storage } from "../storage/s3";
import { createTestDatabase } from "./database.ts";

const apiOrigin = process.env.LUMO_E2E_API_ORIGIN ?? "http://localhost:3011";
const webOrigin = process.env.LUMO_E2E_WEB_ORIGIN ?? "http://localhost:3010";
const database = await createTestDatabase(process.env.TEST_DATABASE_URL);
const env = readServerEnv({
  ...process.env,
  DATABASE_URL: database.url,
  NODE_ENV: "test",
  PORT: Number(new URL(apiOrigin).port),
  API_ORIGIN: apiOrigin,
  WEB_ORIGIN: webOrigin,
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
  console.log(`E2E API ready on port ${env.PORT}`),
);
if (!(server instanceof Server)) throw new Error("Collaboration requires an HTTP server");
app.wiki.attach(server);
app.messenger.attach(server);
const notifications = await listenForWiki(database.pool, app.wiki, () => {}, app.messenger);
let stopping = false;
async function cleanup() {
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
  if (env.AWS_REGION && env.AWS_S3_BUCKET) {
    const storage = createS3Storage(env),
      files = await database.db.select().from(messengerAttachment);
    for (const file of files) {
      const prefix = `messenger/${file.workspaceId}/${file.id}`;
      const result = await Promise.allSettled([
        storage.remove(`${prefix}/staging`),
        storage.remove(`${prefix}/content`),
      ]);
      if (result.some((value) => value.status === "rejected"))
        console.error("Isolated Messenger test storage cleanup needs attention.");
    }
  }
  await database.cleanup();
}
function shutdown() {
  if (stopping) return;
  stopping = true;
  void Promise.all([app.wiki.close(), app.messenger.close(), notifications.close()]).finally(() =>
    server.close(() => {
      void cleanup();
    }),
  );
  if ("closeAllConnections" in server) server.closeAllConnections();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
