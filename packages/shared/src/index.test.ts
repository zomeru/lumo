import { test, expect } from "vitest";

import { chatIdentity, rtcIdentity, mergeMessages } from "./index";
test("provider identities separate workspaces and camera/screen identities", () => {
  expect(chatIdentity("one", "user")).not.toBe(chatIdentity("two", "user"));
  expect(rtcIdentity("user")).toBe("user");
  expect(rtcIdentity("user", true)).toBe("user-screen");
});
test("reconnect reconciliation replaces optimistic messages and preserves stable ordering", () => {
  const first = { id: "a", text: "hello", sender: "user", time: 1, pending: true };
  const second = { ...first, id: "b", time: 2 };
  expect(
    mergeMessages(
      [first, second],
      [
        { ...first, pending: false },
        { ...second, id: "c" },
      ],
    ),
  ).toEqual([{ ...first, pending: false }, second, { ...second, id: "c" }]);
});

test("pasted invitation and meeting links accept only configured server destinations", async () => {
  const { parseLumoLink } = await import("./index");
  expect(
    parseLumoLink("https://lumo.test/invite?token=" + "a".repeat(64), "https://lumo.test"),
  ).toEqual({ kind: "invite", token: "a".repeat(64) });
  expect(
    parseLumoLink(
      "https://lumo.test/meetings/11111111-1111-4111-8111-111111111111",
      "https://lumo.test",
    ),
  ).toMatchObject({ kind: "meeting" });
  expect(() =>
    parseLumoLink("https://evil.test/invite?token=" + "a".repeat(64), "https://lumo.test"),
  ).toThrow("Lumo server");
  expect(() => parseLumoLink("https://lumo.test/evil", "https://lumo.test")).toThrow("valid Lumo");
});

test("shared links reject credential-bearing, malformed and incomplete destinations", async () => {
  const { parseLumoLink } = await import("./index");
  for (const link of [
    "https://user:password@lumo.test/invite?token=" + "a".repeat(64),
    "https://lumo.test/invite",
    "https://lumo.test/invite?token=invalid",
    "https://lumo.test/meetings/not-an-id",
  ])
    expect(() => parseLumoLink(link, "https://lumo.test")).toThrow(/./);
});
