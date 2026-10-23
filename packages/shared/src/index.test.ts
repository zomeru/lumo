import { test, expect } from "vitest";

import { rtcIdentity } from "./index";
test("RTC identities separate camera and screen identities", () => {
  expect(rtcIdentity("user")).toBe("user");
  expect(rtcIdentity("user", true)).toBe("user-screen");
});
test("pasted invitation and meeting links accept only configured server destinations", async () => {
  const { parseLumoLynkLink } = await import("./index");
  expect(
    parseLumoLynkLink(
      "https://lumolynk.test/invite?token=" + "a".repeat(64),
      "https://lumolynk.test",
    ),
  ).toEqual({ kind: "invite", token: "a".repeat(64) });
  expect(
    parseLumoLynkLink(
      "https://lumolynk.test/meetings/11111111-1111-4111-8111-111111111111",
      "https://lumolynk.test",
    ),
  ).toMatchObject({ kind: "meeting" });
  expect(() =>
    parseLumoLynkLink("https://evil.test/invite?token=" + "a".repeat(64), "https://lumolynk.test"),
  ).toThrow("LumoLynk server");
  expect(() => parseLumoLynkLink("https://lumolynk.test/evil", "https://lumolynk.test")).toThrow(
    "valid LumoLynk",
  );
});

test("shared links reject credential-bearing, malformed and incomplete destinations", async () => {
  const { parseLumoLynkLink } = await import("./index");
  for (const link of [
    "https://user:password@lumolynk.test/invite?token=" + "a".repeat(64),
    "https://lumolynk.test/invite",
    "https://lumolynk.test/invite?token=invalid",
    "https://lumolynk.test/meetings/not-an-id",
  ])
    expect(() => parseLumoLynkLink(link, "https://lumolynk.test")).toThrow(/./);
});
