import type { ServerEnv } from "@lumo/env/server";
import AgoraToken from "agora-token";

import { AppError } from "../lib/errors";

const { RtcTokenBuilder, RtcRole } = AgoraToken;
export interface CollaborationProvider {
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
  return {
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
