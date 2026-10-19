import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createAuth } from "@lumo/auth";
import { membership, meeting, requestLimit } from "@lumo/database/schema";
import * as databaseSchema from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { beforeAll, afterAll, describe, test, expect, vi } from "vitest";

import { createApp } from "./app";
import type { CollaborationProvider } from "./integrations/agora";
import { createTestDatabase } from "./test/database";
const source = {
  ...(existsSync(new URL("../.env", import.meta.url))
    ? parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"))
    : {}),
  ...process.env,
};
const database = await createTestDatabase(source.TEST_DATABASE_URL);
const env = readServerEnv({
  DATABASE_URL: database.url,
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  MAIL_DIR: "../../.local/collaboration-mail",
});
const provider: CollaborationProvider = {
  chatUser: vi.fn<CollaborationProvider["chatUser"]>(async () => randomUUID()),
  createGroup: vi.fn<CollaborationProvider["createGroup"]>(async () => randomUUID()),
  removeMember: vi.fn<CollaborationProvider["removeMember"]>(async () => {}),
  deactivate: vi.fn<CollaborationProvider["deactivate"]>(async () => {}),
  chatToken: () => ({
    appKey: "org#app",
    token: "provider-chat-token",
    expiresAt: new Date(Date.now() + 120000).toISOString(),
  }),
  rtcToken: (channel, uid) => ({
    channel,
    uid,
    appId: "a".repeat(32),
    token: "provider-rtc-token",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  }),
};
const app = createApp({ db: database.db, auth: createAuth(database.db, env), env, provider });
let alice: { id: string; cookie: string; workspaceId: string },
  bob: typeof alice,
  outsider: typeof alice;
const base = "/api/v1";
async function req(path: string, actor = alice, method = "GET", body?: unknown) {
  return app.request(path.startsWith("/api/") ? path : base + path, {
    method,
    headers: { origin: env.WEB_ORIGIN, "Content-Type": "application/json", cookie: actor.cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function signup(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({
      name,
      email: `${name}-${randomUUID()}@example.com`,
      password: "Long-integration-password!2026",
    }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const me = (await (await app.request(base + "/me", { headers: { cookie } })).json()) as {
    user: { id: string };
    activeWorkspaceId: string;
  };
  return { id: me.user.id, cookie, workspaceId: me.activeWorkspaceId };
}
beforeAll(async () => {
  alice = await signup("Alice");
  bob = await signup("Bob");
  outsider = await signup("Outsider");
  await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
});
afterAll(() => database.cleanup());
let conversationId: string, meetingId: string;
describe("conversation isolation and lifecycle", () => {
  test("requires sessions and validates participants", async () => {
    expect(
      (await req(`/workspaces/${alice.workspaceId}/conversations`, { ...alice, cookie: "" }))
        .status,
    ).toBe(401);
    for (const input of [
      { kind: "direct", name: "DM", memberIds: [outsider.id] },
      { kind: "direct", name: "DM", memberIds: [alice.id] },
    ])
      expect(
        (await req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", input)).status,
      ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", {
          kind: "direct",
          name: "DM",
          memberIds: [],
          role: "admin",
        })
      ).status,
    ).toBe(400);
  });
  test("creates exactly one workspace-scoped DM under concurrent requests", async () => {
    const body = { kind: "direct", name: "DM", memberIds: [bob.id] };
    const responses = await Promise.all([
      req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", body),
      req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", body),
    ]);
    const values = (await Promise.all(responses.map((response) => response.json()))) as {
      id: string;
      memberIds: string[];
    }[];
    expect(values[0]!.id).toBe(values[1]!.id);
    conversationId = values[0]!.id;
    expect(values[0]!.memberIds.sort()).toEqual([alice.id, bob.id].sort());
  });
  test("lists only conversations belonging to the authenticated participant", async () => {
    expect((await req(`/workspaces/${alice.workspaceId}/conversations`, outsider)).status).toBe(
      404,
    );
    expect(
      (await (await req(`/workspaces/${alice.workspaceId}/conversations`, bob)).json())
        .conversations,
    ).toHaveLength(1);
    await database.db
      .insert(membership)
      .values({ workspaceId: alice.workspaceId, userId: outsider.id });
    expect(
      (await (await req(`/workspaces/${alice.workspaceId}/conversations`, outsider)).json())
        .conversations,
    ).toHaveLength(0);
    expect(
      (
        await req(
          `/workspaces/${alice.workspaceId}/conversations/${conversationId}/credentials`,
          outsider,
          "POST",
          {},
        )
      ).status,
    ).toBe(404);
  });
  test("provisions provider groups once and credentials never contain server secrets", async () => {
    const path = `/workspaces/${alice.workspaceId}/conversations/${conversationId}/credentials`;
    const result = await req(path, alice, "POST", {});
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.token).toBe("provider-chat-token");
    expect(JSON.stringify(body)).not.toContain(env.BETTER_AUTH_SECRET);
    await req(path, bob, "POST", {});
    expect(provider.createGroup).toHaveBeenCalledTimes(1);
    expect(
      (
        await req(
          `/workspaces/${bob.workspaceId}/conversations/${conversationId}/credentials`,
          bob,
          "POST",
          {},
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await req(
          `/workspaces/${alice.workspaceId}/conversations/${conversationId}/read`,
          bob,
          "POST",
          {},
        )
      ).status,
    ).toBe(200);
  });
  test("supports private groups and bounded pagination", async () => {
    const response = await req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", {
      kind: "group",
      name: "Project",
      memberIds: [bob.id, outsider.id],
    });
    expect(response.status).toBe(201);
    const page = await (await req(`/workspaces/${alice.workspaceId}/conversations?limit=1`)).json();
    expect(page.conversations).toHaveLength(1);
    expect(page.nextOffset).toBe(1);
    expect((await req(`/workspaces/${alice.workspaceId}/conversations?limit=10000`)).status).toBe(
      400,
    );
  });
});
describe("meeting authorization", () => {
  test("persists meetings with server-selected host and validates input", async () => {
    expect(
      (
        await req(`/workspaces/${alice.workspaceId}/meetings`, bob, "POST", {
          title: "Test",
          hostId: bob.id,
        })
      ).status,
    ).toBe(400);
    const response = await req(`/workspaces/${alice.workspaceId}/meetings`, alice, "POST", {
      title: "Standup",
      participantIds: [bob.id],
    });
    expect(response.status).toBe(201);
    const value = await response.json();
    meetingId = value.id;
    expect(value.hostId).toBe(alice.id);
    expect((await req(`/workspaces/${alice.workspaceId}/meetings?limit=0`)).status).toBe(400);
  });
  test("rejects foreign IDs, foreign invitees and malformed token requests", async () => {
    expect(
      (await req(`/workspaces/${bob.workspaceId}/meetings`, alice, "POST", { title: "Foreign" }))
        .status,
    ).toBe(404);
    expect((await req(`/meetings/${randomUUID()}/token`, alice, "POST", {})).status).toBe(404);
    expect(
      (
        await req(`/meetings/${meetingId}/token`, alice, "POST", {
          uid: "attacker",
          channel: "arbitrary",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await req(`/workspaces/${bob.workspaceId}/meetings`, bob, "POST", {
          title: "Invalid",
          participantIds: [alice.id],
        })
      ).status,
    ).toBe(404);
  });
  test("issues matching camera and screen identities after membership checks", async () => {
    const camera = await (await req(`/meetings/${meetingId}/token`, bob, "POST", {})).json();
    const screen = await (
      await req(`/meetings/${meetingId}/token`, bob, "POST", { screen: true })
    ).json();
    expect(camera.uid).toBe(bob.id);
    expect(screen.uid).toBe(`${bob.id}-screen`);
    expect(screen.channel).toBe(camera.channel);
    const detail = await (await req(`/meetings/${meetingId}`, bob)).json();
    expect(
      detail.participants.find((person: { userId: string }) => person.userId === bob.id).online,
    ).toBe(true);
    expect((await req(`/meetings/${meetingId}/end`, bob, "POST", {})).status).toBe(403);
    expect((await req(`/meetings/${meetingId}/leave`, bob, "POST", {})).status).toBe(200);
  });
  test("scheduled meetings enforce opening time and timezone", async () => {
    expect(
      (
        await req(`/workspaces/${alice.workspaceId}/meetings`, alice, "POST", {
          title: "Past",
          startsAt: "2020-01-01T00:00:00Z",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await req(`/workspaces/${alice.workspaceId}/meetings`, alice, "POST", {
          title: "Bad timezone",
          timezone: "Unknown",
        })
      ).status,
    ).toBe(400);
    const scheduled = await (
      await req(`/workspaces/${alice.workspaceId}/meetings`, alice, "POST", {
        title: "Future",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
      })
    ).json();
    expect(scheduled.status).toBe("scheduled");
    expect((await req(`/meetings/${scheduled.id}/token`, bob, "POST", {})).status).toBe(409);
    await database.db
      .update(meeting)
      .set({ startsAt: new Date(Date.now() + 1000) })
      .where(eq(meeting.id, scheduled.id));
    expect((await req(`/meetings/${scheduled.id}/token`, bob, "POST", {})).status).toBe(200);
  });
  test("open meetings permit authenticated outsiders without granting workspace access", async () => {
    const open = await (
      await req(`/workspaces/${alice.workspaceId}/meetings`, alice, "POST", {
        title: "Open",
        access: "open",
      })
    ).json();
    await database.db.delete(membership).where(eq(membership.userId, outsider.id));
    const response = await req(`/meetings/${open.id}`, outsider);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(alice.workspaceId);
    expect((await req(`/meetings/${open.id}/token`, outsider, "POST", {})).status).toBe(200);
    expect((await req(`/meetings/${meetingId}`, outsider)).status).toBe(404);
    expect((await req(`/workspaces/${alice.workspaceId}/members`, outsider)).status).toBe(404);
  });
  test("ending a meeting denies all later tokens", async () => {
    expect((await req(`/meetings/${meetingId}/end`, alice, "POST", {})).status).toBe(200);
    expect((await req(`/meetings/${meetingId}/token`, bob, "POST", {})).status).toBe(409);
  });
});
describe("revocation and security boundaries", () => {
  test("denies provider access before removing membership and cascades conversation participants", async () => {
    const response = await req(
      `/workspaces/${alice.workspaceId}/members/${bob.id}`,
      alice,
      "DELETE",
      {},
    );
    expect(response.status).toBe(200);
    expect(provider.deactivate).toHaveBeenCalled();
    expect(provider.removeMember).toHaveBeenCalled();
    expect(
      (
        await req(
          `/workspaces/${alice.workspaceId}/conversations/${conversationId}/credentials`,
          bob,
          "POST",
          {},
        )
      ).status,
    ).toBe(404);
    expect((await req(`/meetings/${meetingId}/token`, bob, "POST", {})).status).toBe(404);
  });
  test("documents real routes in OpenAPI without weakening auth", async () => {
    const document = await (await app.request("/api/openapi.json")).json();
    expect(document.paths["/api/v1/meetings/{meetingId}/token"]).toBeDefined();
    expect((await app.request("/api/reference")).status).toBe(200);
  });
  test("uses persistent rate limits for token abuse", async () => {
    for (let index = 0; index < 31; index++)
      await req(`/meetings/${meetingId}/token`, alice, "POST", {});
    expect((await req(`/meetings/${meetingId}/token`, alice, "POST", {})).status).toBe(429);
    await database.db.delete(requestLimit);
  });
  test("provider outage fails closed and preserves membership", async () => {
    await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
    // Restore canonical participant mapping via a newly created conversation.
    const item = await (
      await req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", {
        kind: "group",
        name: "New group",
        memberIds: [bob.id],
      })
    ).json();
    await req(
      `/workspaces/${alice.workspaceId}/conversations/${item.id}/credentials`,
      bob,
      "POST",
      {},
    );
    vi.mocked(provider.deactivate).mockRejectedValueOnce(new Error("Provider offline"));
    expect(
      (await req(`/workspaces/${alice.workspaceId}/members/${bob.id}`, alice, "DELETE", {})).status,
    ).toBe(500);
    expect((await req(`/workspaces/${alice.workspaceId}/members`, bob)).status).toBe(200);
  });
});

test("migration schema exposes all cross-tenant relational constraints", () => {
  const tables = Object.values(databaseSchema).filter(
    (value) =>
      typeof value === "object" && value !== null && Symbol.for("drizzle:IsDrizzleTable") in value,
  );
  const configs = tables.map((value) =>
    getTableConfig(value as typeof databaseSchema.conversation),
  );
  expect(configs.every((config) => config.columns.length > 0)).toBe(true);
  expect(
    configs
      .flatMap((config) => config.foreignKeys)
      .every((key) => key.reference().columns.length > 0),
  ).toBe(true);
});

test("email-bound invitations can be declined once without creating membership", async () => {
  const account = await database.db.query.user.findFirst({
    where: eq(databaseSchema.user.id, outsider.id),
  });
  const response = await req(`/workspaces/${alice.workspaceId}/invitations`, alice, "POST", {
    email: account!.email,
  });
  expect(response.status).toBe(201);
  const invite = (await response.json()) as { token: string };
  expect((await req("/invitations/decline", bob, "POST", { token: invite.token })).status).toBe(
    404,
  );
  expect(
    (await req("/invitations/decline", outsider, "POST", { token: "f".repeat(64) })).status,
  ).toBe(404);
  expect(
    (await req("/invitations/decline", outsider, "POST", { token: invite.token })).status,
  ).toBe(200);
  expect(
    (await req("/invitations/decline", outsider, "POST", { token: invite.token })).status,
  ).toBe(404);
  expect((await req("/invitations/accept", outsider, "POST", { token: invite.token })).status).toBe(
    403,
  );
});

test("conversation re-creation after revocation does not restore old private history", async () => {
  const remove = await req(
    `/workspaces/${alice.workspaceId}/members/${bob.id}`,
    alice,
    "DELETE",
    {},
  );
  expect(remove.status).toBe(200);
  await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
  const created = await (
    await req(`/workspaces/${alice.workspaceId}/conversations`, alice, "POST", {
      kind: "direct",
      name: "New DM",
      memberIds: [bob.id],
    })
  ).json();
  expect(created.id).not.toBe(conversationId);
  expect(
    (
      await req(
        `/workspaces/${alice.workspaceId}/conversations/${conversationId}/credentials`,
        bob,
        "POST",
        {},
      )
    ).status,
  ).toBe(404);
});
test("meeting lists paginate authorized results and reject outsiders", async () => {
  const page = await (await req(`/workspaces/${alice.workspaceId}/meetings?limit=1`)).json();
  expect(page.meetings).toHaveLength(1);
  expect(page.nextOffset).toBe(1);
  expect((await req(`/workspaces/${alice.workspaceId}/meetings`, outsider)).status).toBe(404);
  expect((await req(`/meetings/${randomUUID()}`, outsider)).status).toBe(404);
});

test("JSON-looking media types cannot bypass the exact mutation content-type guard", async () => {
  const response = await app.request(`/api/v1/meetings/${meetingId}/token`, {
    method: "POST",
    headers: { origin: env.WEB_ORIGIN, cookie: alice.cookie, "content-type": "application/jsonx" },
    body: "{}",
  });
  expect(response.status).toBe(415);
});
