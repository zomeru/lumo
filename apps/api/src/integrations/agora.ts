import { randomBytes } from "node:crypto";

import type { ServerEnv } from "@lumo/env/server";
import AgoraToken from "agora-token";
const { ChatTokenBuilder, RtcTokenBuilder, RtcRole } = AgoraToken;
import { z } from "zod";

import { AppError } from "../lib/errors";
export interface CollaborationProvider {
  chatUser: (identity: string) => Promise<string>;
  createGroup: (name: string, identities: string[]) => Promise<string>;
  removeMember: (groupId: string, identity: string) => Promise<void>;
  deactivate: (identity: string) => Promise<void>;
  chatToken: (uuid: string) => { appKey: string; token: string; expiresAt: string };
  rtcToken: (
    channel: string,
    uid: string,
  ) => { appId: string; channel: string; uid: string; token: string; expiresAt: string };
}
export function createAgora(env: ServerEnv): CollaborationProvider {
  function credentials() {
    if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE)
      throw new AppError(
        503,
        "RTC_NOT_CONFIGURED",
        "Meetings need server-side Agora configuration.",
      );
    return { id: env.AGORA_APP_ID, certificate: env.AGORA_APP_CERTIFICATE };
  }
  async function rest(
    path: string,
    method = "GET",
    body?: unknown,
    allowMissing = false,
  ): Promise<unknown> {
    const { id, certificate } = credentials();
    if (!env.AGORA_CHAT_APP_KEY || !env.AGORA_CHAT_REST_ORIGIN)
      throw new AppError(
        503,
        "CHAT_NOT_CONFIGURED",
        "Agora Chat must be enabled and configured by your administrator.",
      );
    try {
      const response = await fetch(`${env.AGORA_CHAT_REST_ORIGIN}/app-id/${id}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${ChatTokenBuilder.buildAppToken(id, certificate, 60)}`,
          "Content-Type": "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) throw new Error("Provider rejected request");
      return await response.json();
    } catch {
      throw new AppError(
        503,
        "CHAT_UNAVAILABLE",
        "Agora Chat is unavailable. Please try again later.",
      );
    }
  }
  const account = z.object({
    entities: z.array(z.object({ uuid: z.string(), activated: z.boolean().optional() })).min(1),
  });
  async function ensureUser(identity: string) {
    const existing = await rest(`/users/${identity}`, "GET", undefined, true);
    if (existing) return account.parse(existing).entities[0]!;
    return account.parse(
      await rest("/users", "POST", {
        username: identity,
        password: randomBytes(32).toString("hex"),
      }),
    ).entities[0]!;
  }
  return {
    async chatUser(identity) {
      const account = await ensureUser(identity);
      return account.uuid;
    },
    async createGroup(name, identities) {
      const owner = "lumo_service";
      await ensureUser(owner);
      for (const identity of identities) {
        const member = await ensureUser(identity);
        if (member.activated === false) await rest(`/users/${identity}/activate`, "POST", {});
      }
      const response = await rest("/chatgroups", "POST", {
        groupname: name,
        desc: "Lumo private conversation",
        public: false,
        maxusers: 200,
        approval: true,
        allowinvites: false,
        owner,
        members: identities,
      });
      return z.object({ data: z.object({ groupid: z.string() }) }).parse(response).data.groupid;
    },
    async removeMember(groupId, identity) {
      await rest(
        `/chatgroups/${encodeURIComponent(groupId)}/users/${identity}`,
        "DELETE",
        undefined,
        true,
      );
    },
    async deactivate(identity) {
      await rest(`/users/${identity}/deactivate`, "POST", {}, true);
    },
    chatToken(uuid) {
      const { id, certificate } = credentials();
      if (!env.AGORA_CHAT_APP_KEY)
        throw new AppError(503, "CHAT_NOT_CONFIGURED", "Agora Chat is not configured.");
      return {
        appKey: env.AGORA_CHAT_APP_KEY,
        token: ChatTokenBuilder.buildUserToken(id, certificate, uuid, 120),
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      };
    },
    rtcToken(channel, uid) {
      const { id, certificate } = credentials();
      return {
        appId: id,
        channel,
        uid,
        token: RtcTokenBuilder.buildTokenWithUserAccount(
          id,
          certificate,
          channel,
          uid,
          RtcRole.PUBLISHER,
          60,
          60,
        ),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
    },
  };
}
