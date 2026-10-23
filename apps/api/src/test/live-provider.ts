/** Explicit RTC signing smoke; credentials are never printed. */
import { randomUUID } from "node:crypto";

import { readServerEnv } from "@lumolynk/env/server";

import { createAgora } from "../integrations/agora";
if (process.env.LUMOLYNK_LIVE_AGORA !== "1")
  throw new Error("Set LUMOLYNK_LIVE_AGORA=1 to validate configured RTC credentials.");
const rtc = createAgora(readServerEnv()).rtcToken(
  `smoke${randomUUID().replaceAll("-", "")}`,
  randomUUID(),
);
if (!rtc.token.startsWith("007")) throw new Error("RTC credential smoke failed");
console.log("RTC AccessToken2 generated with configured credentials.");
