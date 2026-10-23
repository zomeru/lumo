import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";

import { createAuth } from "@lumolynk/auth";
import {
  meSchema,
  workspaceSchema,
  workspacesSchema,
  membersSchema,
  invitationCreatedSchema,
  discoverySchema,
  auditSchema,
  invitationsSchema,
} from "@lumolynk/contracts";
import { legalVersions } from "@lumolynk/contracts/legal";
import {
  invitation,
  membership,
  requestLimit,
  session as sessionTable,
  user,
  workspace,
} from "@lumolynk/database/schema";
import { readServerEnv } from "@lumolynk/env/server";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createApp } from "./app.ts";
import { enforceRateLimit } from "./middleware/rate-limit.ts";
import { createTestDatabase } from "./test/database.ts";

const file = new URL("../.env", import.meta.url);
const source = {
  ...(existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {}),
  ...process.env,
};
const database = await createTestDatabase(source.TEST_DATABASE_URL);
const { db } = database;
const mailDir = await mkdtemp(join(tmpdir(), "lumolynk-mail-"));
const env = readServerEnv({
  DATABASE_URL: database.url,
  BETTER_AUTH_SECRET: "integration-test-secret-with-more-than-32-characters",
  NODE_ENV: "test",
  MAIL_DIR: mailDir,
  LOG_LEVEL: "silent",
});
const auth = createAuth(db, env);
const app = createApp({ db, auth, env, clientIp: (c) => c.req.header("x-test-ip") ?? "127.0.0.1" });
const password = "Strong-test-password-2026!";
type Actor = { cookie: string; id: string; email: string; personalId: string };
let alice: Actor;
let bob: Actor;
let carol: Actor;
let teamId: string;
let signupIndex = 1;

async function request(path: string, actor?: Actor, method = "GET", body?: unknown) {
  return app.request(
    path.startsWith("/api/") || path.startsWith("/health") || path.startsWith("/ready")
      ? path
      : `/api/v1${path}`,
    {
      method,
      headers: {
        origin: env.WEB_ORIGIN,
        "content-type": "application/json",
        ...(actor ? { cookie: actor.cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
  );
}
async function signup(label: string): Promise<Actor> {
  const email = `${label.toLowerCase()}@example.com`;
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      origin: env.WEB_ORIGIN,
      "content-type": "application/json",
      "x-test-ip": `192.0.2.${signupIndex++}`,
    },
    body: JSON.stringify({
      name: label,
      email,
      password,
      confirmPassword: password,
      consent: {
        accepted: true,
        termsVersion: legalVersions.terms,
        privacyVersion: legalVersions.privacy,
      },
    }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  expect(cookie).toContain("session_token");
  const me = meSchema.parse(await (await request("/me", { cookie } as Actor)).json());
  return { cookie, id: me.user.id, email, personalId: me.activeWorkspaceId! };
}
async function verify(actor: Actor) {
  const files = await readdir(mailDir);
  for (const name of files) {
    const mail = JSON.parse(await readFile(join(mailDir, name), "utf8")) as {
      to: string;
      url: string;
    };
    if (mail.to === actor.email) {
      const response = await app.request(mail.url);
      if (![200, 302].includes(response.status))
        throw new Error(`Verification failed: ${await response.text()}`);
      return;
    }
  }
  throw new Error("Verification mail was not written");
}
async function invite(actor: Actor, target: Actor, role = "member") {
  const response = await request(`/workspaces/${teamId}/invitations`, actor, "POST", {
    email: target.email,
    role,
  });
  expect(response.status).toBe(201);
  return invitationCreatedSchema.parse(await response.json());
}

beforeAll(async () => {
  alice = await signup("Alice");
  bob = await signup("Bob");
  carol = await signup("Carol");
  await verify(bob);
  await verify(carol);
  const response = await request("/workspaces", alice, "POST", {
    name: "Acme",
    visibility: "invite-only",
    timezone: "Asia/Shanghai",
  });
  assert.equal(response.status, 201);
  teamId = workspaceSchema.parse(await response.json()).id;
});
afterAll(async () => {
  await database.cleanup();
  await rm(mailDir, { recursive: true, force: true });
});

describe("authentication and atomic registration", () => {
  test("health and readiness execute successfully", async () => {
    expect((await request("/health")).status).toBe(200);
    expect((await request("/ready")).status).toBe(200);
  });
  test("registration provisions a private personal workspace and owner membership", async () => {
    const ws = workspaceSchema.parse(
      await (await request(`/workspaces/${alice.personalId}`, alice)).json(),
    );
    expect(ws).toMatchObject({
      name: "Alice's Workspace",
      isPersonal: true,
      role: "owner",
      visibility: "private",
    });
    const members = membersSchema.parse(
      await (await request(`/workspaces/${alice.personalId}/members`, alice)).json(),
    );
    expect(members.members).toHaveLength(1);
    expect(JSON.stringify(members)).not.toMatch(/password|token|email/);
  });
  test("transaction rollback leaves no partial personal workspace", async () => {
    const id = randomUUID();
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(user).values({ id, name: "Rollback", email: "rollback@example.com" });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await db.select().from(workspace).where(eq(workspace.personalOwnerId, id))).toHaveLength(
      0,
    );
  });
  test("sessions restore from HTTP-only cookies and never expose credentials", async () => {
    const response = await request("/api/auth/sign-in/email", undefined, "POST", {
      email: alice.email,
      password,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    expect((await request("/me", alice)).status).toBe(200);
  });
  test("wrong passwords and anonymous requests are rejected", async () => {
    expect(
      (
        await request("/api/auth/sign-in/email", undefined, "POST", {
          email: alice.email,
          password: "Wrong-password-1234",
        })
      ).status,
    ).toBe(401);
    expect((await request("/me")).status).toBe(401);
  });
  test("sign-out revokes the actual server session", async () => {
    const temp = await signup("Logout");
    expect((await request("/api/auth/sign-out", temp, "POST", {})).status).toBe(200);
    expect((await request("/me", temp)).status).toBe(401);
  });
  test("renews HTTP-only cookies and rejects expired sessions", async () => {
    const actor = await signup("Renewal");
    const shortExpiry = new Date(Date.now() + 3600_000);
    await db
      .update(sessionTable)
      .set({ expiresAt: shortExpiry, updatedAt: new Date(Date.now() - 2 * 86400_000) })
      .where(eq(sessionTable.userId, actor.id));
    const restored = await request("/me", actor);
    expect(restored.status).toBe(200);
    expect(restored.headers.get("set-cookie")).toMatch(/session_token=.*HttpOnly/);
    const [renewed] = await db.select().from(sessionTable).where(eq(sessionTable.userId, actor.id));
    expect(renewed!.expiresAt.getTime()).toBeGreaterThan(shortExpiry.getTime());
    await db
      .update(sessionTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(sessionTable.userId, actor.id));
    const expired = await request("/me", actor);
    expect(expired.status).toBe(401);
    expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  test("unsupported auth endpoints and malformed registration are rejected", async () => {
    expect((await request("/api/auth/get-session", alice)).status).toBe(404);
    expect((await request("/api/auth/update-user", alice, "POST", { role: "owner" })).status).toBe(
      404,
    );
    expect(
      (
        await request("/api/auth/sign-up/email", undefined, "POST", {
          name: "x",
          email: "bad",
          password: "short",
        })
      ).status,
    ).toBe(400);
  });
});

describe("workspace isolation, settings and discovery", () => {
  test.each(["", "/members", "/invitations", "/activity"])(
    "nonmembers cannot read workspace%s",
    async (suffix) => {
      expect((await request(`/workspaces/${teamId}${suffix}`, bob)).status).toBe(404);
    },
  );
  test("nonmembers cannot mutate workspace data or set it active", async () => {
    expect((await request(`/workspaces/${teamId}`, bob, "PATCH", { name: "Stolen" })).status).toBe(
      404,
    );
    expect(
      (await request("/me/active-workspace", bob, "PUT", { workspaceId: teamId })).status,
    ).toBe(404);
    expect(
      (await request(`/workspaces/${teamId}/invitations`, bob, "POST", { email: carol.email }))
        .status,
    ).toBe(404);
    expect((await request(`/workspaces/${teamId}/members/${alice.id}`, bob, "DELETE")).status).toBe(
      404,
    );
  });
  test("validates inputs, unknown privilege fields and workspace IDs", async () => {
    for (const body of [
      { name: "" },
      { name: "x", personalOwnerId: bob.id },
      { name: "x", role: "admin" },
      { name: "x", timezone: "Mars" },
    ])
      expect((await request("/workspaces", bob, "POST", body)).status).toBe(400);
    expect((await request("/workspaces/not-a-uuid", alice)).status).toBe(400);
    expect((await request(`/workspaces/${teamId}`, alice, "PATCH", {})).status).toBe(400);
    expect(
      (await request(`/workspaces/${teamId}`, alice, "PATCH", { isPersonal: false })).status,
    ).toBe(400);
    expect(
      (await request(`/workspaces/${alice.personalId}`, alice, "PATCH", { visibility: "public" }))
        .status,
    ).toBe(400);
  });
  test("updates company settings and user profile in PostgreSQL", async () => {
    expect(
      (
        await request(`/workspaces/${teamId}`, alice, "PATCH", {
          description: "Our company",
          industry: "Technology",
          companySize: "11-50",
          currency: "CNY",
          language: "zh",
        })
      ).status,
    ).toBe(200);
    const ws = workspaceSchema.parse(await (await request(`/workspaces/${teamId}`, alice)).json());
    expect(ws).toMatchObject({
      description: "Our company",
      industry: "Technology",
      timezone: "Asia/Shanghai",
    });
    expect(
      (
        await request("/me", alice, "PATCH", {
          name: "Alice Chen",
          jobTitle: "Engineer",
          department: "Product",
        })
      ).status,
    ).toBe(200);
    expect(meSchema.parse(await (await request("/me", alice)).json()).user).toMatchObject({
      name: "Alice Chen",
      jobTitle: "Engineer",
    });
  });
  test("remembers active workspaces and lists only joined workspaces", async () => {
    expect(
      (await request("/me/active-workspace", alice, "PUT", { workspaceId: alice.personalId }))
        .status,
    ).toBe(200);
    expect(meSchema.parse(await (await request("/me", alice)).json()).activeWorkspaceId).toBe(
      alice.personalId,
    );
    expect(
      workspacesSchema
        .parse(await (await request("/workspaces", bob)).json())
        .workspaces.map((ws) => ws.id),
    ).not.toContain(teamId);
  });
  test("private/invite-only workspaces reject self-join and are hidden from discovery", async () => {
    expect((await request(`/workspaces/${teamId}/join`, bob, "POST", {})).status).toBe(404);
    const found = discoverySchema.parse(await (await request("/workspaces/discover", bob)).json());
    expect(found.workspaces.map((ws) => ws.id)).not.toContain(teamId);
    expect(
      (await request(`/workspaces/${teamId}`, alice, "PATCH", { visibility: "private" })).status,
    ).toBe(200);
    expect((await request(`/workspaces/${teamId}/join`, bob, "POST", {})).status).toBe(404);
  });
  test("public discovery exposes only metadata; joining assigns the member role", async () => {
    const pub = workspaceSchema.parse(
      await (
        await request("/workspaces", alice, "POST", { name: "Public Studio", visibility: "public" })
      ).json(),
    );
    const found = discoverySchema.parse(
      await (await request("/workspaces/discover?q=Public&limit=1", bob)).json(),
    );
    expect(found.workspaces[0]).toEqual({ id: pub.id, name: "Public Studio", description: "" });
    expect((await request(`/workspaces/${pub.id}/members`, bob)).status).toBe(404);
    const responses = await Promise.all([
      request(`/workspaces/${pub.id}/join`, bob, "POST", {}),
      request(`/workspaces/${pub.id}/join`, bob, "POST", {}),
    ]);
    for (const response of responses)
      expect(workspaceSchema.parse(await response.json()).role).toBe("member");
    expect((await request(`/workspaces/${pub.id}`, bob, "PATCH", { name: "Steal" })).status).toBe(
      403,
    );
    expect((await request(`/workspaces/${pub.id}/leave`, bob, "POST", {})).status).toBe(200);
    expect((await request(`/workspaces/${pub.id}/members`, bob)).status).toBe(404);
  });
});

describe("invitations and authorization", () => {
  let acceptedToken: string;
  test("rejects unverified addresses, other identities and malformed tokens", async () => {
    const item = await invite(alice, alice);
    expect(
      (await request("/invitations/accept", alice, "POST", { token: item.token })).status,
    ).toBe(403);
    expect((await request("/invitations/preview", bob, "POST", { token: item.token })).status).toBe(
      404,
    );
    expect((await request("/invitations/accept", bob, "POST", { token: "invalid" })).status).toBe(
      400,
    );
    expect(
      (await request("/invitations/accept", bob, "POST", { token: "f".repeat(64) })).status,
    ).toBe(404);
  });
  test("stores only a hash and accepts an identity-bound invitation once", async () => {
    const item = await invite(alice, bob);
    acceptedToken = item.token;
    const [stored] = await db.select().from(invitation).where(eq(invitation.id, item.id));
    expect(stored?.tokenHash).not.toBe(item.token);
    const preview = await request("/invitations/preview", bob, "POST", { token: item.token });
    expect(preview.status).toBe(200);
    expect(
      workspaceSchema.parse(
        await (await request("/invitations/accept", bob, "POST", { token: item.token })).json(),
      ),
    ).toMatchObject({ id: teamId, role: "member" });
    expect((await request("/invitations/accept", bob, "POST", { token: item.token })).status).toBe(
      404,
    );
    expect((await request("/invitations/preview", bob, "POST", { token: item.token })).status).toBe(
      404,
    );
  });
  test("ordinary members cannot invite, change roles, transfer ownership or read audit events", async () => {
    expect(
      (await request(`/workspaces/${teamId}/invitations`, bob, "POST", { email: carol.email }))
        .status,
    ).toBe(403);
    expect(
      (await request(`/workspaces/${teamId}/members/${bob.id}`, bob, "PATCH", { role: "admin" }))
        .status,
    ).toBe(403);
    expect(
      (await request(`/workspaces/${teamId}/transfer-ownership`, bob, "POST", { userId: bob.id }))
        .status,
    ).toBe(403);
    expect((await request(`/workspaces/${teamId}/activity`, bob)).status).toBe(403);
    expect((await request(`/workspaces/${teamId}/invitations`, bob)).status).toBe(403);
  });
  test("expired and revoked invitations fail, including copied IDs from another workspace", async () => {
    const first = await invite(alice, carol);
    await db
      .update(invitation)
      .set({ expiresAt: new Date(0) })
      .where(eq(invitation.id, first.id));
    expect(
      (await request("/invitations/accept", carol, "POST", { token: first.token })).status,
    ).toBe(404);
    const second = await invite(alice, carol);
    expect(
      (await request(`/workspaces/${alice.personalId}/invitations/${second.id}`, alice, "DELETE"))
        .status,
    ).toBe(404);
    expect(
      (await request(`/workspaces/${teamId}/invitations/${second.id}`, alice, "DELETE")).status,
    ).toBe(200);
    expect(
      (await request("/invitations/accept", carol, "POST", { token: second.token })).status,
    ).toBe(404);
    const pending = invitationsSchema.parse(
      await (await request(`/workspaces/${teamId}/invitations`, alice)).json(),
    );
    expect(pending.invitations.some((i) => i.id === second.id)).toBe(false);
  });
  test("role management honors hierarchy and moderators cannot promote themselves", async () => {
    const item = await invite(alice, carol, "moderator");
    expect(
      (await request("/invitations/accept", carol, "POST", { token: item.token })).status,
    ).toBe(200);
    expect(
      (
        await request(`/workspaces/${teamId}/members/${bob.id}`, carol, "PATCH", {
          role: "moderator",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(`/workspaces/${teamId}/invitations`, carol, "POST", {
          email: bob.email,
          role: "moderator",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(`/workspaces/${teamId}/members/${carol.id}`, alice, "PATCH", {
          role: "admin",
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/workspaces/${teamId}/members/${bob.id}`, carol, "PATCH", { role: "admin" }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(`/workspaces/${teamId}/members/${bob.id}`, carol, "PATCH", {
          role: "moderator",
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/workspaces/${teamId}/members/${alice.id}`, carol, "DELETE")).status,
    ).toBe(403);
    expect(
      (
        await request(`/workspaces/${teamId}/members/${alice.id}`, alice, "PATCH", {
          role: "member",
        })
      ).status,
    ).toBe(403);
  });
  test("removal immediately revokes read, write and active-workspace access", async () => {
    expect((await request(`/workspaces/${teamId}/members/${bob.id}`, carol, "DELETE")).status).toBe(
      200,
    );
    expect((await request(`/workspaces/${teamId}/members`, bob)).status).toBe(404);
    expect(
      (await request(`/workspaces/${teamId}/invitations`, bob, "POST", { email: alice.email }))
        .status,
    ).toBe(404);
    expect(
      (await request("/me/active-workspace", bob, "PUT", { workspaceId: teamId })).status,
    ).toBe(404);
    expect(meSchema.parse(await (await request("/me", bob)).json()).activeWorkspaceId).toBe(
      bob.personalId,
    );
    expect(
      (await request("/invitations/accept", bob, "POST", { token: acceptedToken })).status,
    ).toBe(404);
  });
  test("serializes concurrent revocation and mutations", async () => {
    let pending: Promise<Response> | undefined;
    await db.transaction(async (tx) => {
      await tx.select().from(workspace).where(eq(workspace.id, teamId)).for("update");
      pending = request(`/workspaces/${teamId}`, carol, "PATCH", { name: "Race attack" });
      await tx
        .delete(membership)
        .where(and(eq(membership.workspaceId, teamId), eq(membership.userId, carol.id)));
    });
    expect((await pending!).status).toBe(404);
    expect(
      (await request(`/workspaces/${teamId}`, carol, "PATCH", { name: "After removal" })).status,
    ).toBe(404);
  });
  test("owners cannot leave; ownership transfer preserves one owner", async () => {
    expect((await request(`/workspaces/${teamId}/leave`, alice, "POST", {})).status).toBe(409);
    expect(
      (
        await request(`/workspaces/${alice.personalId}/transfer-ownership`, alice, "POST", {
          userId: bob.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (await request(`/workspaces/${teamId}/transfer-ownership`, alice, "POST", { userId: bob.id }))
        .status,
    ).toBe(404);
    const item = await invite(alice, bob);
    await request("/invitations/accept", bob, "POST", { token: item.token });
    expect(
      (await request(`/workspaces/${teamId}/transfer-ownership`, alice, "POST", { userId: bob.id }))
        .status,
    ).toBe(200);
    expect(
      workspaceSchema.parse(await (await request(`/workspaces/${teamId}`, bob)).json()).role,
    ).toBe("owner");
    expect((await request(`/workspaces/${teamId}/leave`, alice, "POST", {})).status).toBe(200);
    const events = auditSchema.parse(
      await (await request(`/workspaces/${teamId}/activity`, bob)).json(),
    );
    expect(events.events.some((item) => item.action === "workspace.ownership.transferred")).toBe(
      true,
    );
  });
});

describe("HTTP protections", () => {
  test.each([400, 429])(
    "normalizes authentication errors with missing fields (%i)",
    async (status) => {
      const stub = createApp({
        db,
        auth: {
          ...auth,
          handler: async () =>
            new Response("{}", { status, headers: { "content-type": "application/json" } }),
        },
        env,
      });
      const response = await stub.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { origin: env.WEB_ORIGIN, "content-type": "application/json" },
        body: "{}",
      });
      expect(await response.json()).toMatchObject({
        error: { code: "AUTH_ERROR", message: "Authentication failed." },
      });
    },
  );
  test("preserves non-JSON auth responses and sanitizes unexpected failures", async () => {
    const plain = createApp({
      db,
      auth: { ...auth, handler: async () => new Response("ok") },
      env,
    });
    expect(await (await plain.request("/api/auth/verify-email")).text()).toBe("ok");
    const failed = createApp({
      db,
      auth: {
        ...auth,
        handler: async () => {
          throw new Error("private database connection details");
        },
      },
      env,
    });
    const response = await failed.request("/api/auth/verify-email");
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database");
    const http = createApp({
      db,
      auth: {
        ...auth,
        handler: async () => {
          throw new HTTPException(400);
        },
      },
      env,
    });
    expect((await http.request("/api/auth/verify-email")).status).toBe(400);
  });
  test("API rate limits return Retry-After and standardized errors", async () => {
    const key = createHash("sha256").update(`api:${bob.id}`).digest("hex");
    await db
      .update(requestLimit)
      .set({ count: 300, windowStart: new Date() })
      .where(eq(requestLimit.key, key));
    const response = await request("/me", bob);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await db.update(requestLimit).set({ count: 0 }).where(eq(requestLimit.key, key));
  });
  test("blocks cross-origin writes and enforces JSON and body limits", async () => {
    const cross = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        cookie: alice.cookie,
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(cross.status).toBe(403);
    expect(
      (
        await app.request("/api/v1/workspaces", {
          method: "POST",
          headers: { origin: env.WEB_ORIGIN },
          body: "{}",
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await app.request("/api/v1/workspaces", {
          method: "POST",
          headers: {
            origin: env.WEB_ORIGIN,
            "content-type": "application/json",
            cookie: alice.cookie,
          },
          body: "{",
        })
      ).status,
    ).toBe(400);
    expect((await request("/workspaces", alice, "POST", { name: "x".repeat(33000) })).status).toBe(
      413,
    );
  });
  test("returns CORS, request IDs, cache protection and standardized errors", async () => {
    const response = await request("/missing", alice);
    expect(response.status).toBe(404);
    expect(response.headers.get("access-control-allow-origin")).toBe(env.WEB_ORIGIN);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND", requestId: expect.any(String) },
    });
    const preflight = await app.request("/api/v1/workspaces", {
      method: "OPTIONS",
      headers: { origin: env.WEB_ORIGIN, "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(204);
  });
  test("persistent rate limiting resets after its window", async () => {
    const now = new Date();
    await enforceRateLimit(db, "test-rate", 1, now);
    await expect(enforceRateLimit(db, "test-rate", 1, now)).rejects.toMatchObject({ status: 429 });
    await enforceRateLimit(db, "test-rate", 1, new Date(now.getTime() + 61000));
  });
});

describe("membership edge cases", () => {
  let id: string;
  beforeAll(async () => {
    const response = await request("/workspaces", alice, "POST", { name: "Policy tests" });
    id = workspaceSchema.parse(await response.json()).id;
    await db.insert(membership).values([
      { workspaceId: id, userId: bob.id, role: "member" },
      { workspaceId: id, userId: carol.id, role: "admin" },
    ]);
  });
  test("missing member IDs and self-removal fail safely", async () => {
    const unknown = randomUUID();
    expect(
      (await request(`/workspaces/${id}/members/${unknown}`, alice, "PATCH", { role: "member" }))
        .status,
    ).toBe(404);
    expect((await request(`/workspaces/${id}/members/${unknown}`, alice, "DELETE")).status).toBe(
      404,
    );
    expect((await request(`/workspaces/${id}/members/${alice.id}`, alice, "DELETE")).status).toBe(
      403,
    );
    expect(
      (await request(`/workspaces/${id}/transfer-ownership`, alice, "POST", { userId: alice.id }))
        .status,
    ).toBe(403);
    expect(
      (await request(`/workspaces/${alice.personalId}`, alice, "PATCH", { name: "My Space" }))
        .status,
    ).toBe(200);
  });
  test("invalidates pending invitations when the inviter loses authority", async () => {
    const item = invitationCreatedSchema.parse(
      await (
        await request(`/workspaces/${id}/invitations`, carol, "POST", { email: bob.email })
      ).json(),
    );
    await request(`/workspaces/${id}/members/${carol.id}`, alice, "PATCH", { role: "member" });
    expect((await request("/invitations/accept", bob, "POST", { token: item.token })).status).toBe(
      404,
    );
    expect(
      (await request(`/workspaces/${id}/invitations/${item.id}`, carol, "DELETE")).status,
    ).toBe(403);
    expect(
      (await request(`/workspaces/${id}/invitations/${randomUUID()}`, alice, "DELETE")).status,
    ).toBe(404);
  });
  test("accepting an invitation never elevates an existing member", async () => {
    const item = invitationCreatedSchema.parse(
      await (
        await request(`/workspaces/${id}/invitations`, alice, "POST", {
          email: bob.email,
          role: "moderator",
        })
      ).json(),
    );
    const accepted = workspaceSchema.parse(
      await (await request("/invitations/accept", bob, "POST", { token: item.token })).json(),
    );
    expect(accepted.role).toBe("member");
  });
  test("bounds outstanding invitations and paginates directories and discovery", async () => {
    await db.insert(invitation).values(
      Array.from({ length: 100 }, (_, i) => ({
        workspaceId: id,
        invitedBy: alice.id,
        email: `pending${i}@example.com`,
        role: "member" as const,
        tokenHash: createHash("sha256").update(`pending${i}`).digest("hex"),
        expiresAt: new Date(Date.now() + 86400_000),
      })),
    );
    expect(
      (await request(`/workspaces/${id}/invitations`, alice, "POST", { email: bob.email })).status,
    ).toBe(409);
    const page = membersSchema.parse(
      await (await request(`/workspaces/${id}/members?limit=1`, alice)).json(),
    );
    expect(page.nextOffset).toBe(1);
    expect((await request(`/workspaces/${id}/members?limit=1000`, alice)).status).toBe(400);
    await request(`/workspaces/${id}`, alice, "PATCH", { visibility: "public" });
    const result = discoverySchema.parse(
      await (await request("/workspaces/discover?limit=1", carol)).json(),
    );
    expect(result.workspaces).toHaveLength(1);
  });
});

describe("registration consent enforcement", () => {
  const consent = {
    accepted: true,
    termsVersion: legalVersions.terms,
    privacyVersion: legalVersions.privacy,
  };
  test("rejects direct HTTP and auth API calls with missing, false or stale consent before creating users", async () => {
    for (const patch of [
      { consent: undefined },
      { consent: { ...consent, accepted: false } },
      { consent: { ...consent, termsVersion: "old" } },
      { consent: { ...consent, privacyVersion: "old" } },
      { confirmPassword: "different" },
      { registrationAcceptedAt: "2000-01-01" },
    ]) {
      const email = `${randomUUID()}@example.com`;
      const body = {
        name: "Consent test",
        email,
        password,
        confirmPassword: password,
        consent,
        ...patch,
      };
      const response = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          origin: env.WEB_ORIGIN,
          "content-type": "application/json",
          "x-test-ip": `192.0.2.${signupIndex++}`,
        },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
    }
    await expect(
      auth.api.signUpEmail({ body: { name: "Bypass", email: "bypass@example.com", password } }),
    ).rejects.toThrow(/Invalid input|expected string|Review|consent/);
    expect(await db.select().from(user).where(eq(user.email, "bypass@example.com"))).toHaveLength(
      0,
    );
  });
  test("records one server-dated acceptance with the user and preserves it through sign-in and duplicate registration", async () => {
    const before = Date.now();
    const actor = await signup("LegalAudit");
    const [record] = await db.select().from(user).where(eq(user.id, actor.id));
    expect(record).toMatchObject({
      registrationTermsVersion: legalVersions.terms,
      registrationPrivacyVersion: legalVersions.privacy,
    });
    expect(record!.registrationAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(record!.registrationAcceptedAt!.getTime()).toBeLessThanOrEqual(Date.now());
    const login = await request("/api/auth/sign-in/email", undefined, "POST", {
      email: actor.email,
      password,
    });
    expect(login.status).toBe(200);
    expect(await login.text()).not.toContain("registrationAcceptedAt");
    const duplicate = await request("/api/auth/sign-up/email", undefined, "POST", {
      name: "Duplicate",
      email: actor.email,
      password,
      confirmPassword: password,
      consent,
    });
    expect(duplicate.status).toBe(422);
    expect(await db.select().from(user).where(eq(user.id, actor.id))).toEqual([record]);
  });
});
