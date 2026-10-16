import { describe, expect, test } from "vitest";

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
