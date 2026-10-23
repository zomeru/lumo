import { readServerEnv } from "@lumolynk/env/server";
import { test, expect } from "vitest";

import { createAgora } from "./agora";

const env = readServerEnv({
  DATABASE_URL: "postgresql://localhost/lumolynk_test",
  BETTER_AUTH_SECRET: "test-secret-over-thirty-two-characters",
  AGORA_APP_ID: "a".repeat(32),
  AGORA_APP_CERTIFICATE: "b".repeat(32),
});
test("signs short-lived matching RTC AccessToken2 credentials without exposing the certificate", () => {
  const rtc = createAgora(env).rtcToken("meeting-channel", "user-identity");
  expect(rtc).toMatchObject({
    appId: env.AGORA_APP_ID,
    channel: "meeting-channel",
    uid: "user-identity",
  });
  expect(rtc.token).toMatch(/^007/);
  expect(new Date(rtc.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(60000);
  expect(JSON.stringify(rtc)).not.toContain(env.AGORA_APP_CERTIFICATE);
});
test("missing RTC configuration fails closed", () => {
  expect(() =>
    createAgora({ ...env, AGORA_APP_CERTIFICATE: undefined }).rtcToken("channel", "user"),
  ).toThrow("configuration");
});
