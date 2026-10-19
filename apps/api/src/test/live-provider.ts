/** Explicitly opt-in provider smoke; no credentials printed. Created provider records are cleaned. */
import { randomUUID } from "node:crypto";

import { readServerEnv } from "@lumo/env/server";
import AgoraToken from "agora-token";
const { ChatTokenBuilder } = AgoraToken;
import { createAgora } from "../integrations/agora";
if (process.env.LUMO_LIVE_AGORA !== "1")
  throw new Error("Set LUMO_LIVE_AGORA=1 to allow live provider operations.");
const env = readServerEnv();
const provider = createAgora(env);
const identities = [
  `smoke_${randomUUID().replaceAll("-", "")}`,
  `smoke_${randomUUID().replaceAll("-", "")}`,
];
let groupId: string | undefined;
try {
  const uuids = await Promise.all(identities.map((identity) => provider.chatUser(identity)));
  groupId = await provider.createGroup("Lumo integration smoke", identities);
  const chat = provider.chatToken(uuids[0]!);
  const rtc = provider.rtcToken(`smoke${randomUUID().replaceAll("-", "")}`, randomUUID());
  if (!groupId || !chat.token.startsWith("007") || !rtc.token.startsWith("007"))
    throw new Error("Provider credential smoke failed");
  console.log(
    "Live Chat: provisioned users, private group, user token. RTC: AccessToken2 generated.",
  );
  await provider.deactivate(identities[1]!);
  await provider.removeMember(groupId, identities[1]!);
  console.log("Live Chat revocation: user disabled and removed from group.");
} finally {
  const token = ChatTokenBuilder.buildAppToken(env.AGORA_APP_ID!, env.AGORA_APP_CERTIFICATE!, 60);
  for (const path of [
    ...(groupId ? [`/chatgroups/${groupId}`] : []),
    ...identities.map((identity) => `/users/${identity}`),
  ]) {
    const response = await fetch(
      `${env.AGORA_CHAT_REST_ORIGIN}/app-id/${env.AGORA_APP_ID}${path}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok && response.status !== 404) process.exitCode = 1;
  }
}
