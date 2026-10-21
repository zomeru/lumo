import { describe, expect, test } from "vitest";

import { meetingInputSchema, meetingSchema } from "./collaboration";
import {
  workspaceInputSchema,
  workspaceUpdateSchema,
  invitationInputSchema,
  paginationSchema,
  registrationSchema,
} from "./index.ts";
import {
  canChangeRole,
  canInvite,
  canInviteRole,
  canManageSettings,
  canRemoveMember,
} from "./permissions.ts";

describe("request contracts", () => {
  test("validates workspace defaults, timezones, bounds and server-owned fields", () => {
    expect(workspaceInputSchema.parse({ name: "  Acme  " })).toMatchObject({
      name: "Acme",
      visibility: "private",
      timezone: "UTC",
    });
    for (const input of [
      { name: "" },
      { name: "Acme", role: "owner" },
      { name: "Acme", timezone: "Mars/City" },
      { name: "Acme", description: "x".repeat(1001) },
    ])
      expect(workspaceInputSchema.safeParse(input).success).toBe(false);
    expect(workspaceInputSchema.parse({ name: "Acme", timezone: "Asia/Shanghai" }).timezone).toBe(
      "Asia/Shanghai",
    );
    expect(workspaceUpdateSchema.safeParse({}).success).toBe(false);
    expect(invitationInputSchema.parse({ email: "Test@Example.com" }).email).toBe(
      "test@example.com",
    );
    expect(
      invitationInputSchema.safeParse({ email: "test@example.com", role: "owner" }).success,
    ).toBe(false);
    expect(paginationSchema.parse({ limit: "20" }).limit).toBe(20);
    expect(paginationSchema.safeParse({ limit: 10000 }).success).toBe(false);
    expect(
      registrationSchema.safeParse({ name: "Alice", email: "alice@example.com", password: "short" })
        .success,
    ).toBe(false);
  });
});
describe("role policy", () => {
  test("settings and invitation authority follow the role matrix", () => {
    expect(
      ["owner", "admin", "moderator", "member"].map((r) => canManageSettings(r as "owner")),
    ).toEqual([true, true, false, false]);
    expect(canInvite("member")).toBe(false);
    expect(canInviteRole("moderator", "moderator")).toBe(false);
    expect(canInviteRole("moderator", "member")).toBe(true);
    expect(canInviteRole("owner", "owner")).toBe(false);
  });
  test("prevents peer edits, owner mutation and privilege escalation", () => {
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("moderator", "member")).toBe(true);
    expect(canRemoveMember("member", "owner")).toBe(false);
    expect(canChangeRole("owner", "member", "admin")).toBe(true);
    expect(canChangeRole("admin", "member", "moderator")).toBe(true);
    expect(canChangeRole("admin", "member", "admin")).toBe(false);
    expect(canChangeRole("admin", "admin", "member")).toBe(false);
    expect(canChangeRole("owner", "owner", "member")).toBe(false);
    expect(canChangeRole("owner", "member", "owner")).toBe(false);
    expect(canChangeRole("moderator", "member", "moderator")).toBe(false);
  });
});

test("meeting timezones preserve IANA aliases and reject numeric offsets", () => {
  for (const timezone of ["UTC", "GMT", "CET", "America/New_York", "Asia/Shanghai"]) {
    expect(meetingInputSchema.safeParse({ title: "Meeting", timezone }).success).toBe(true);
  }
  for (const timezone of ["+08:00", "-05:00", "Mars/City", ""]) {
    expect(meetingInputSchema.safeParse({ title: "Meeting", timezone }).success).toBe(false);
  }
});

test("existing fixed-offset meeting records remain readable while new schedules require IANA zones", () => {
  expect(
    meetingSchema.parse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      hostId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Legacy meeting",
      status: "scheduled",
      startsAt: "2030-01-01T12:00:00Z",
      timezone: "+08:00",
      createdAt: "2026-10-21T12:00:00Z",
    }).timezone,
  ).toBe("+08:00");
});

describe("registration requirements", () => {
  const password = "Strong-password-2026!";
  const valid = {
    name: "Alice",
    email: "alice@example.com",
    password,
    confirmPassword: password,
    consent: { accepted: true, termsVersion: "2026-10-21.1", privacyVersion: "2026-10-21.1" },
  };
  test("requires matching passwords and explicit acceptance of current versions", () => {
    expect(registrationSchema.strict().parse(valid).name).toBe("Alice");
    for (const patch of [
      { confirmPassword: "different" },
      { confirmPassword: undefined },
      { consent: undefined },
      { consent: { ...valid.consent, accepted: false } },
      { consent: { ...valid.consent, accepted: "true" } },
      { consent: { ...valid.consent, termsVersion: "old" } },
      { consent: { ...valid.consent, privacyVersion: "old" } },
      { consent: { ...valid.consent, acceptedAt: "2020-01-01" } },
      { registrationAcceptedAt: "2020-01-01" },
      { name: " " },
      { email: "invalid" },
      { password: "short", confirmPassword: "short" },
      { password: "x".repeat(129), confirmPassword: "x".repeat(129) },
    ])
      expect(registrationSchema.strict().safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
