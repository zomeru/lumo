import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createAuth } from "@lumo/auth";
import type { Conversation } from "@lumo/contracts/collaboration";
import { legalVersions } from "@lumo/contracts/legal";
import { messengerMessageSchema, type MessengerMessage } from "@lumo/contracts/messenger";
import { membership, messengerMessage, conversationMember } from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { and, eq } from "drizzle-orm";
import { beforeAll, afterAll, test, expect } from "vitest";

import { createApp } from "./app";
import { createTestDatabase } from "./test/database";

const source = {
  ...parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8")),
  ...process.env,
};
const database = await createTestDatabase(source.TEST_DATABASE_URL);
const env = readServerEnv({
  DATABASE_URL: database.url,
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  MAIL_DIR: "../../.local/messenger-mail",
});
const app = createApp({ db: database.db, auth: createAuth(database.db, env), env });
type Actor = { id: string; cookie: string; workspaceId: string };
let alice: Actor,
  bob: Actor,
  admin: Actor,
  outsider: Actor,
  publicChannel: Conversation,
  privateChannel: Conversation,
  root: MessengerMessage;
const base = (id = alice.workspaceId) => `/workspaces/${id}`;
async function req(path: string, actor = alice, method = "GET", body?: unknown) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: actor.cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function signup(name: string): Promise<Actor> {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({
      name,
      email: `${randomUUID()}@example.com`,
      password: "Messenger-test-password!2026",
      confirmPassword: "Messenger-test-password!2026",
      consent: {
        accepted: true,
        termsVersion: legalVersions.terms,
        privacyVersion: legalVersions.privacy,
      },
    }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const me = await (await app.request("/api/v1/me", { headers: { cookie } })).json();
  return { id: me.user.id, cookie, workspaceId: me.activeWorkspaceId };
}
async function createChannel(name: string, visibility = "public", memberIds: string[] = []) {
  const response = await req(`${base()}/channels`, alice, "POST", { name, visibility, memberIds });
  expect(response.status).toBe(201);
  return (await response.json()) as Conversation;
}
async function send(id: string, body: string, actor = alice, extra: object = {}) {
  const response = await req(`${base()}/conversations/${id}/messages`, actor, "POST", {
    body,
    nonce: randomUUID(),
    ...extra,
  });
  expect(response.status).toBe(201);
  return messengerMessageSchema.parse(await response.json());
}
beforeAll(async () => {
  alice = await signup("Alice");
  bob = await signup("Bob");
  admin = await signup("Admin");
  outsider = await signup("Outsider");
  await database.db.insert(membership).values([
    { workspaceId: alice.workspaceId, userId: bob.id },
    { workspaceId: alice.workspaceId, userId: admin.id, role: "admin" },
  ]);
});
afterAll(() => database.cleanup());
test("channel creation validates names, participant scope and session identity", async () => {
  expect((await req(`${base()}/channels`, { ...alice, cookie: "" })).status).toBe(401);
  for (const body of [
    { name: "bad/name" },
    { name: "Secret", memberIds: [outsider.id] },
    { name: "Spoof", createdBy: bob.id },
  ])
    expect((await req(`${base()}/channels`, alice, "POST", body)).status).toBeGreaterThanOrEqual(
      400,
    );
  publicChannel = await createChannel("general");
  privateChannel = await createChannel("Private payroll", "private");
  expect((await req(`${base()}/channels`, alice, "POST", { name: "GENERAL" })).status).toBe(409);
  const elsewhere = await req(`${base(outsider.workspaceId)}/channels`, outsider, "POST", {
    name: "general",
  });
  expect(elsewhere.status).toBe(201);
});
test("public history is workspace-readable and posting requires joining", async () => {
  root = await send(publicChannel.id, "Public launch notes");
  expect((await req(`${base()}/conversations/${publicChannel.id}/messages`, outsider)).status).toBe(
    404,
  );
  const history = await (
    await req(`${base()}/conversations/${publicChannel.id}/messages`, bob)
  ).json();
  expect(history.messages).toHaveLength(1);
  expect(
    (
      await req(`${base()}/conversations/${publicChannel.id}/messages`, bob, "POST", {
        body: "blocked",
        nonce: randomUUID(),
      })
    ).status,
  ).toBe(403);
  expect(
    (await req(`${base()}/conversations/${publicChannel.id}/join`, bob, "POST", {})).status,
  ).toBe(200);
  await send(publicChannel.id, "Joined", bob);
});
test("private discovery, history, members and mutations deny admins and substituted workspace IDs", async () => {
  const secret = await send(privateChannel.id, "Confidential salary");
  for (const actor of [bob, admin, outsider]) {
    for (const suffix of ["", "/messages", "/members"]) {
      expect(
        (await req(`${base()}/conversations/${privateChannel.id}${suffix}`, actor)).status,
      ).toBe(404);
    }
    for (const [method, suffix, body] of [
      ["PATCH", "", { body: "stolen" }],
      ["DELETE", "", {}],
      ["POST", "/reaction", { emoji: "👍", active: true }],
      ["POST", "/pin", { active: true }],
    ] as const)
      expect(
        (await req(`${base()}/messages/${secret.id}${suffix}`, actor, method, body)).status,
      ).toBe(404);
    expect(
      (await req(`${base()}/conversations/${privateChannel.id}/join`, actor, "POST", {})).status,
    ).toBe(404);
  }
  const browse = await (await req(`${base()}/channels`, bob)).json();
  expect(browse.conversations.map((v: Conversation) => v.name)).toEqual(["general"]);
  expect(
    (await req(`${base(bob.workspaceId)}/conversations/${publicChannel.id}/messages`, bob)).status,
  ).toBe(404);
  const search = await (await req(`${base()}/messenger/search?q=salary`, admin)).json();
  expect(search.results).toEqual([]);
});
test("nonce retries, thread integrity, reactions, pins, sender edits and tombstones persist correctly", async () => {
  const nonce = randomUUID(),
    path = `${base()}/conversations/${publicChannel.id}/messages`;
  const results = await Promise.all([
    req(path, alice, "POST", { nonce, body: "Retry-safe release" }),
    req(path, alice, "POST", { nonce, body: "Retry-safe release" }),
  ]);
  const values = await Promise.all(results.map((r) => r.json()));
  expect(values[0].id).toBe(values[1].id);
  await send(publicChannel.id, "Thread reply", bob, { parentId: root.id });
  const reply = await (await req(`${path}?parentId=${root.id}`)).json();
  expect(reply.messages).toHaveLength(1);
  expect(
    (
      await req(path, alice, "POST", {
        nonce: randomUUID(),
        body: "Nested",
        parentId: reply.messages[0].id,
      })
    ).status,
  ).toBe(404);
  const secret = await send(privateChannel.id, "Other destination");
  expect(
    (
      await req(path, alice, "POST", {
        nonce: randomUUID(),
        body: "Wrong parent",
        parentId: secret.id,
      })
    ).status,
  ).toBe(404);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await req(`${base()}/messages/${root.id}/reaction`, bob, "POST", {
          emoji: "👍",
          active: true,
        })
      ).status,
    ).toBe(200);
  expect(
    (await req(`${base()}/messages/${root.id}/pin`, bob, "POST", { active: true })).status,
  ).toBe(200);
  const pinned = await (await req(`${path}?pinned=true`)).json();
  expect(pinned.messages[0]).toMatchObject({
    id: root.id,
    reactions: [{ emoji: "👍", count: 1, mine: false }],
    replies: 1,
  });
  expect(
    (await req(`${base()}/messages/${root.id}`, bob, "PATCH", { body: "Forged" })).status,
  ).toBe(403);
  expect(
    (await req(`${base()}/messages/${root.id}`, alice, "PATCH", { body: "Edited launch" })).status,
  ).toBe(200);
  expect((await req(`${base()}/messages/${root.id}`, alice, "DELETE", {})).status).toBe(200);
  const deleted = await (await req(`${path}?around=${root.id}`)).json();
  expect(deleted.messages.at(-1)).toMatchObject({
    id: root.id,
    body: "",
    reactions: [],
    attachments: [],
  });
});
test("durable cursors advance monotonically and mentions/search only use authorized resources", async () => {
  const first = await send(publicChannel.id, "Hello @Bob", alice, { mentionIds: [bob.id] });
  const last = await send(publicChannel.id, "Searchable launch", alice);
  const list = await (await req(`${base()}/conversations`, bob)).json();
  expect(list.conversations.find((v: Conversation) => v.id === publicChannel.id)).toMatchObject({
    mentions: 1,
    joined: true,
  });
  for (const messageId of [last.id, first.id])
    expect(
      (await req(`${base()}/conversations/${publicChannel.id}/cursor`, bob, "POST", { messageId }))
        .status,
    ).toBe(200);
  const [member] = await database.db
    .select()
    .from(conversationMember)
    .where(
      and(
        eq(conversationMember.conversationId, publicChannel.id),
        eq(conversationMember.userId, bob.id),
      ),
    );
  expect(member!.lastReadSequence).toBe(last.sequence);
  const search = await (
    await req(`${base()}/messenger/search?q=Searchable&authorId=${alice.id}`, bob)
  ).json();
  expect(search.results.map((v: MessengerMessage) => v.id)).toContain(last.id);
  const page = await (
    await req(`${base()}/conversations/${publicChannel.id}/messages?limit=2`)
  ).json();
  expect(page.messages).toHaveLength(2);
  expect(page.nextBefore).toBeTypeOf("number");
  const older = await (
    await req(
      `${base()}/conversations/${publicChannel.id}/messages?before=${page.nextBefore}&limit=2`,
    )
  ).json();
  expect(older.messages.every((v: MessengerMessage) => v.sequence < page.nextBefore)).toBe(true);
});
test("explicit channel owners manage invitations, ownership, archive and revocation", async () => {
  const path = `${base()}/channels/${privateChannel.id}`;
  expect((await req(`${path}/members`, alice, "POST", { userId: outsider.id })).status).toBe(404);
  expect((await req(`${path}/members`, alice, "POST", { userId: bob.id })).status).toBe(200);
  expect((await req(`${base()}/conversations/${privateChannel.id}`, bob)).status).toBe(200);
  expect((await req(path, bob, "PATCH", { description: "unauthorized" })).status).toBe(403);
  expect((await req(path, alice, "PATCH", { visibility: "public" })).status).toBe(400);
  expect((await req(path, alice, "PATCH", { archived: true })).status).toBe(200);
  expect(
    (
      await req(`${base()}/conversations/${privateChannel.id}/messages`, bob, "POST", {
        body: "Archived",
        nonce: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect((await req(path, alice, "PATCH", { archived: false })).status).toBe(200);
  expect(
    (await req(`${base()}/conversations/${privateChannel.id}/leave`, alice, "POST", {})).status,
  ).toBe(409);
  expect(
    (await req(`${path}/members`, alice, "POST", { userId: bob.id, role: "owner" })).status,
  ).toBe(200);
  expect((await req(`${path}/members/${alice.id}`, bob, "DELETE", {})).status).toBe(200);
  expect((await req(`${base()}/conversations/${privateChannel.id}`, alice)).status).toBe(404);
});
test("1:1 creation is concurrent-safe, group sets are immutable and workspace revocation cannot restore DM history", async () => {
  const path = `${base()}/conversations`,
    body = { kind: "direct", name: "DM", memberIds: [bob.id] };
  const responses = await Promise.all([
    req(path, alice, "POST", body),
    req(path, bob, "POST", { ...body, memberIds: [alice.id] }),
  ]);
  const [a, b] = await Promise.all(responses.map((r) => r.json()));
  expect(a.id).toBe(b.id);
  await send(a.id, "Private DM");
  expect((await req(`${path}/${a.id}`, admin)).status).toBe(404);
  expect(
    (await req(`${base()}/channels/${a.id}/members`, alice, "POST", { userId: admin.id })).status,
  ).toBe(403);
  const group = await (
    await req(path, alice, "POST", {
      kind: "group",
      name: "Team DM",
      memberIds: [bob.id, admin.id],
    })
  ).json();
  await send(group.id, "Group message");
  expect((await req(`${base()}/members/${bob.id}`, alice, "DELETE", {})).status).toBe(200);
  expect((await req(`${path}/${a.id}/messages`, bob)).status).toBe(404);
  await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
  const fresh = await (await req(path, alice, "POST", body)).json();
  expect(fresh.id).not.toBe(a.id);
  expect(
    await database.db
      .select()
      .from(messengerMessage)
      .where(eq(messengerMessage.conversationId, a.id)),
  ).toHaveLength(1);
});
