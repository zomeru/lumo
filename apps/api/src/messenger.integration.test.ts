import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { Server } from "node:http";
import { parseEnv } from "node:util";

import { serve } from "@hono/node-server";
import { createAuth } from "@lumo/auth";
import type { Conversation } from "@lumo/contracts/collaboration";
import { legalVersions } from "@lumo/contracts/legal";
import { messengerMessageSchema, type MessengerMessage } from "@lumo/contracts/messenger";
import {
  membership,
  messengerMessage,
  conversationMember,
  storageCleanup,
  conversation,
} from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { and, eq } from "drizzle-orm";
import { beforeAll, afterAll, test, expect } from "vitest";
import { WebSocket, type RawData } from "ws";

import { createApp } from "./app";
import { listenForWiki } from "./modules/office/wiki-notifications";
import { cleanupStorage } from "./storage/cleanup";
import { createTestDatabase } from "./test/database";
import { memoryStorage } from "./test/storage";

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
  MAIL_DIR: "../../.local/messenger-mail",
});
const files = memoryStorage();
const app = createApp({
  storage: files.storage,
  db: database.db,
  auth: createAuth(database.db, env),
  env,
});
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
  return app.request(path.startsWith("/api/") ? path : `/api/v1${path}`, {
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
  const list = await (await req(`${base()}/conversations?includeChannels=true`, bob)).json();
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

test("private attachments validate metadata, immutable content and current download authorization", async () => {
  const channel = await createChannel("Private files", "private", [bob.id]);
  const data = Buffer.from("private file contents"),
    input = {
      name: "notes.txt",
      mimeType: "text/plain",
      size: data.length,
      checksum: files.sha(data),
    };
  const uploaded = await req(
    `${base()}/conversations/${channel.id}/attachments`,
    alice,
    "POST",
    input,
  );
  expect(uploaded.status).toBe(201);
  const { id } = await uploaded.json();
  const staging = `messenger/${alice.workspaceId}/${id}/staging`,
    content = `messenger/${alice.workspaceId}/${id}/content`;
  files.put(staging, Buffer.from("wrong size"), input.mimeType);
  expect(
    (await req(`${base()}/messenger/attachments/${id}/complete`, alice, "POST", {})).status,
  ).toBe(400);
  files.put(staging, data, input.mimeType);
  expect(
    (await req(`${base()}/messenger/attachments/${id}/complete`, bob, "POST", {})).status,
  ).toBe(403);
  expect(
    (await req(`${base()}/messenger/attachments/${id}/complete`, alice, "POST", {})).status,
  ).toBe(200);
  files.put(staging, Buffer.from("mutated staging"), input.mimeType);
  expect(files.objects.get(content)?.data).toEqual(data);
  expect(
    (await req(`${base()}/messenger/attachments/${id}/download`, alice, "POST", {})).status,
  ).toBe(404);
  expect(
    (
      await req(`${base()}/conversations/${publicChannel.id}/messages`, alice, "POST", {
        nonce: randomUUID(),
        body: "Wrong channel",
        attachmentIds: [id],
      })
    ).status,
  ).toBe(404);
  const message = await send(channel.id, "", alice, { attachmentIds: [id] });
  expect(message.attachments).toMatchObject([{ id, name: "notes.txt", scanStatus: "unscanned" }]);
  await database.db.insert(storageCleanup).values({ key: content, notBefore: new Date(0) });
  await cleanupStorage(database.db, files.storage);
  expect(files.objects.has(content)).toBe(true);

  expect(
    (await req(`${base()}/messenger/attachments/${id}/download`, bob, "POST", {})).status,
  ).toBe(200);
  for (const actor of [admin, outsider])
    expect(
      (await req(`${base()}/messenger/attachments/${id}/download`, actor, "POST", {})).status,
    ).toBe(404);
  expect(
    (await req(`${base(bob.workspaceId)}/messenger/attachments/${id}/download`, bob, "POST", {}))
      .status,
  ).toBe(404);
  expect(
    (await req(`${base()}/channels/${channel.id}/members/${bob.id}`, alice, "DELETE", {})).status,
  ).toBe(200);
  expect(
    (await req(`${base()}/messenger/attachments/${id}/download`, bob, "POST", {})).status,
  ).toBe(404);
  expect((await req(`${base()}/messages/${message.id}`, alice, "DELETE", {})).status).toBe(200);
  await database.db
    .update(storageCleanup)
    .set({ notBefore: new Date(0) })
    .where(eq(storageCleanup.key, content));
  await cleanupStorage(database.db, files.storage);
  expect(files.objects.has(content)).toBe(false);

  expect(
    (await req(`${base()}/messenger/attachments/${id}/download`, alice, "POST", {})).status,
  ).toBe(404);
  for (const invalid of [
    { ...input, name: "payload.exe" },
    { ...input, size: 30 * 1024 ** 2 },
    { ...input, mimeType: "text/html" },
  ])
    expect(
      (await req(`${base()}/conversations/${channel.id}/attachments`, alice, "POST", invalid))
        .status,
    ).toBe(400);
});

test("notification aggregates apply preferences and never reveal private conversations", async () => {
  const channel = await createChannel("Unread channel", "public", [bob.id]);
  const first = await send(channel.id, "Unread mention", alice, { mentionIds: [bob.id] });
  await send(channel.id, "Unread ordinary");
  const secret = await createChannel("Hidden notices", "private");
  await send(secret.id, "Secret notification");
  let notifications = await (await req(`${base()}/messenger/notifications`, bob)).json();
  expect(
    notifications.conversations.find((c: { id: string }) => c.id === channel.id),
  ).toMatchObject({ unread: 2, mentions: 1 });
  expect(
    (
      await req(`${base()}/conversations/${channel.id}/preferences`, bob, "POST", {
        notifications: "mentions",
      })
    ).status,
  ).toBe(200);
  notifications = await (await req(`${base()}/messenger/notifications?limit=1`, bob)).json();
  expect(notifications.totalUnread).toBeGreaterThanOrEqual(1);
  expect(
    (
      await req(`${base()}/conversations/${channel.id}/preferences`, bob, "POST", {
        notifications: "muted",
      })
    ).status,
  ).toBe(200);
  notifications = await (await req(`${base()}/messenger/notifications`, bob)).json();
  expect(notifications.conversations.some((c: { id: string }) => c.id === channel.id)).toBe(false);
  const restricted = await (await req(`${base()}/messenger/notifications`, admin)).json();
  expect(JSON.stringify(restricted)).not.toContain(privateChannel.id);
  expect(
    (
      await req(`${base()}/conversations/${channel.id}/cursor`, bob, "POST", {
        messageId: first.id,
      })
    ).status,
  ).toBe(200);
  expect((await req(`${base()}/messenger/notifications`, outsider)).status).toBe(404);
  const docs = await (await app.request("/api/openapi.json")).json();
  expect(docs.paths["/api/v1/workspaces/{workspaceId}/channels"]).toBeDefined();
});

test("workspace removal transfers channel ownership without granting administrators private access", async () => {
  const created = await req(`${base()}/channels`, bob, "POST", {
    name: "Member-owned secret",
    visibility: "private",
    memberIds: [admin.id],
  });
  expect(created.status).toBe(201);
  const owned = await created.json();
  const abandoned = await (
    await req(`${base()}/channels`, bob, "POST", {
      name: "Sole private owner",
      visibility: "private",
    })
  ).json();
  expect((await req(`${base()}/conversations/${owned.id}`, alice)).status).toBe(404);
  expect((await req(`${base()}/members/${bob.id}`, alice, "DELETE", {})).status).toBe(200);
  const inherited = await (await req(`${base()}/conversations/${owned.id}`, admin)).json();
  expect(inherited.role).toBe("owner");
  expect((await req(`${base()}/conversations/${owned.id}`, alice)).status).toBe(404);
  const [retained] = await database.db
    .select()
    .from(conversation)
    .where(eq(conversation.id, abandoned.id));
  expect(retained?.archivedAt).toBeTruthy();
  await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
});

test("conversation activity is auditable without exposing private resource IDs through workspace activity", async () => {
  const channel = await createChannel("Private audit", "private", [bob.id]);
  expect(
    (
      await req(`${base()}/channels/${channel.id}`, alice, "PATCH", {
        description: "Retained topic",
      })
    ).status,
  ).toBe(200);
  expect(
    (await req(`${base()}/channels/${channel.id}`, alice, "PATCH", { archived: true })).status,
  ).toBe(200);
  const activity = await (
    await req(`${base()}/conversations/${channel.id}/activity?limit=1`)
  ).json();
  expect(activity.events[0]).toMatchObject({
    conversationId: channel.id,
    actorId: alice.id,
    action: "channel.updated",
  });
  expect(activity.nextOffset).toBe(1);
  const stored = await (await req(`${base()}/conversations/${channel.id}`)).json();
  expect(stored.description).toBe("Retained topic");
  expect((await req(`${base()}/conversations/${channel.id}/activity`, bob)).status).toBe(403);
  expect((await req(`${base()}/conversations/${channel.id}/activity`, admin)).status).toBe(404);
  expect(
    (await req(`${base(bob.workspaceId)}/conversations/${channel.id}/activity`, bob)).status,
  ).toBe(404);
  expect(JSON.stringify(await (await req(`${base()}/activity`)).json())).not.toContain(channel.id);
});

test("message mutation and channel edge cases fail closed and preserve visible history", async () => {
  const channel = await createChannel("Lifecycle edges", "public");
  const path = `${base()}/conversations/${channel.id}`;
  expect((await req(`${path}/leave`, bob, "POST", {})).status).toBe(404);
  expect(
    (await req(`${base()}/channels/${channel.id}`, alice, "PATCH", { name: "general" })).status,
  ).toBe(409);
  expect(
    (await req(`${base()}/channels/${channel.id}`, alice, "PATCH", { archived: true })).status,
  ).toBe(200);
  expect((await req(`${path}/join`, bob, "POST", {})).status).toBe(409);
  expect(
    (await req(`${base()}/channels/${channel.id}`, alice, "PATCH", { archived: false })).status,
  ).toBe(200);
  const row = await send(channel.id, "Toggle states");
  for (const [action, body] of [
    ["reaction", { emoji: "👍", active: false }],
    ["pin", { active: false }],
  ] as const)
    expect((await req(`${base()}/messages/${row.id}/${action}`, alice, "POST", body)).status).toBe(
      200,
    );
  const secret = await createChannel("Hidden parent", "private");
  const parent = await send(secret.id, "Private parent");
  for (const query of [`around=${parent.id}`, `parentId=${parent.id}`])
    expect((await req(`${path}/messages?${query}`)).status).toBe(404);
  expect((await req(`${path}/messages?limit=0`)).status).toBe(400);
  expect(
    (
      await req(`${path}/messages`, alice, "POST", {
        nonce: randomUUID(),
        body: "Spoof",
        senderId: bob.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await req(`${base()}/conversations/${secret.id}/messages`, alice, "POST", {
        nonce: randomUUID(),
        body: "Invalid mention",
        mentionIds: [bob.id],
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await req(`${path}/messages`, alice, "POST", {
        nonce: randomUUID(),
        body: "Foreign mention",
        mentionIds: [outsider.id],
      })
    ).status,
  ).toBe(404);
  expect((await req(`${base()}/messages/${row.id}`, alice, "DELETE", {})).status).toBe(200);
  expect(
    (await req(`${base()}/messages/${row.id}/pin`, alice, "POST", { active: true })).status,
  ).toBe(404);
  expect((await req(`${path}/cursor`, alice, "POST", { messageId: parent.id })).status).toBe(404);
  const search = await (
    await req(
      `${base()}/messenger/search?q=parent&conversationId=${secret.id}&from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z&limit=1`,
    )
  ).json();
  expect(search.results).toHaveLength(1);
});

test("long histories and large channel directories stay bounded and use stable sequence cursors", async () => {
  const channel = await createChannel("Scale history", "public", [bob.id]);
  await database.db.insert(messengerMessage).values(
    Array.from({ length: 1000 }, (_, index) => ({
      workspaceId: alice.workspaceId,
      conversationId: channel.id,
      senderId: alice.id,
      nonce: randomUUID(),
      body: `Scale message ${index}`,
    })),
  );
  const path = `${base()}/conversations/${channel.id}/messages`;
  const first = await (await req(`${path}?limit=40`, bob)).json();
  expect(first.messages).toHaveLength(40);
  expect(first.messages.at(-1).body).toBe("Scale message 999");
  const second = await (await req(`${path}?limit=40&before=${first.nextBefore}`, bob)).json();
  expect(second.messages).toHaveLength(40);
  expect(second.messages.every((m: MessengerMessage) => m.sequence < first.nextBefore)).toBe(true);
  await database.db.insert(conversation).values(
    Array.from({ length: 100 }, (_, index) => ({
      workspaceId: alice.workspaceId,
      createdBy: alice.id,
      kind: "channel",
      name: `Scale directory ${index}`,
      slug: `scale-directory-${index}`,
      visibility: "public" as const,
    })),
  );
  const directory = await (await req(`${base()}/channels?limit=20&q=Scale`, bob)).json();
  expect(directory.conversations).toHaveLength(20);
  expect(directory.nextOffset).toBe(20);
  const notifications = await (await req(`${base()}/messenger/notifications`, bob)).json();
  expect(notifications.totalUnread).toBeGreaterThanOrEqual(1000);
});

test("realtime tickets bind sessions, durable commits invalidate two clients and revocation closes live sockets", async () => {
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  if (!(server instanceof Server)) throw new Error("Expected HTTP server");
  if (!server.listening) await once(server, "listening");
  app.messenger.attach(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  const notifications = await listenForWiki(database.pool, app.wiki, () => {}, app.messenger),
    sockets: WebSocket[] = [];
  const connect = async (actor: Actor) => {
    const response = await req(`${base()}/messenger/session`, actor, "POST", {});
    expect(response.status).toBe(200);
    const { token } = await response.json();
    const ws = new WebSocket(
      `ws://127.0.0.1:${address.port}/api/internal/messenger?ticket=${encodeURIComponent(token)}`,
      { origin: env.WEB_ORIGIN },
    );
    sockets.push(ws);
    const initial = once(ws, "message");
    await once(ws, "open");
    await initial;
    return ws;
  };
  try {
    const a = await connect(alice),
      b = await connect(bob);
    const eventA = once(a, "message"),
      eventB = once(b, "message");
    const sent = await send(publicChannel.id, "Durable realtime");
    const [ra, rb] = await Promise.all([eventA, eventB]);
    expect(JSON.parse(ra[0].toString())).toEqual({ type: "changed", conversationId: null });
    expect(rb[0].toString()).not.toContain(sent.body);
    const received = await (
      await req(
        `${base()}/conversations/${publicChannel.id}/messages?after=${sent.sequence - 1}`,
        bob,
      )
    ).json();
    expect(received.messages.map((m: MessengerMessage) => m.id)).toContain(sent.id);

    const typingFrame = new Promise<{ type: string; conversationId: string; actorId: string }>(
      (resolve) => {
        const receive = (raw: RawData) => {
          const value = JSON.parse(
            (Array.isArray(raw)
              ? Buffer.concat(raw)
              : Buffer.isBuffer(raw)
                ? raw
                : Buffer.from(raw)
            ).toString("utf8"),
          );
          if (value.type === "typing") {
            b.off("message", receive);
            resolve(value);
          }
        };
        b.on("message", receive);
      },
    );
    a.send(JSON.stringify({ type: "typing", conversationId: publicChannel.id }));
    expect(await typingFrame).toMatchObject({
      type: "typing",
      conversationId: publicChannel.id,
      actorId: alice.id,
    });
    const forbidden = await connect(bob),
      deniedTyping = once(forbidden, "close");
    forbidden.send(JSON.stringify({ type: "typing", conversationId: privateChannel.id }));
    expect((await deniedTyping)[0]).toBe(1008);
    const malformed = await connect(alice),
      invalidFrame = once(malformed, "close");
    malformed.send("invalid-json");
    expect((await invalidFrame)[0]).toBe(1008);
    const forged = new WebSocket(
      `ws://127.0.0.1:${address.port}/api/internal/messenger?ticket=forged`,
      { origin: env.WEB_ORIGIN },
    );
    sockets.push(forged);
    await once(forged, "error");
    const closed = once(b, "close");
    await database.db
      .delete(membership)
      .where(and(eq(membership.workspaceId, alice.workspaceId), eq(membership.userId, bob.id)));
    expect((await closed)[0]).toBe(1008);
    expect((await req(`${base()}/messenger/session`, bob, "POST", {})).status).toBe(404);
    await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
    const renewed = await connect(bob);
    expect(renewed.readyState).toBe(WebSocket.OPEN);
    const privateEvents: string[] = [];
    a.on("message", (data) =>
      privateEvents.push(
        (Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.isBuffer(data)
            ? data
            : Buffer.from(data)
        ).toString("utf8"),
      ),
    );
    const dm = await (
      await req(`${base()}/conversations`, bob, "POST", {
        kind: "direct",
        name: "Hidden",
        memberIds: [admin.id],
      })
    ).json();
    await send(dm.id, "Do not broadcast", bob);
    expect(
      privateEvents.every((value) => !value.includes(dm.id) && !value.includes("Do not broadcast")),
    ).toBe(true);
    const revoked = once(renewed, "close");
    await req("/api/auth/sign-out", bob, "POST", {});
    await app.messenger.refresh(alice.workspaceId);
    expect((await revoked)[0]).toBe(1008);
  } finally {
    for (const ws of sockets) ws.terminate();
    await app.messenger.close();
    await notifications.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
