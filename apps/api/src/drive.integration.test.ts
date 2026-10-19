import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createAuth } from "@lumo/auth";
import {
  driveItem,
  driveShare,
  driveStar,
  membership,
  storageCleanup,
} from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { eq, inArray, sql } from "drizzle-orm";
import { beforeAll, afterAll, test, expect, vi } from "vitest";

import { createApp } from "./app";
import { cleanupStorage } from "./storage/cleanup";
import { PART_SIZE } from "./storage/storage";
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
  MAIL_DIR: "../../.local/drive-test-mail",
  DRIVE_MAX_FILE_BYTES: 64 * 1024 ** 2,
});
const memory = memoryStorage();
const app = createApp({
  db: database.db,
  auth: createAuth(database.db, env),
  env,
  storage: memory.storage,
});
type Actor = { id: string; cookie: string; workspaceId: string };
let alice: Actor, bob: Actor, outsider: Actor;
async function signup(name: string): Promise<Actor> {
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
    .map((v) => v.split(";")[0])
    .join("; ");
  const me = (await (await app.request("/api/v1/me", { headers: { cookie } })).json()) as {
    user: { id: string };
    activeWorkspaceId: string;
  };
  return { id: me.user.id, cookie, workspaceId: me.activeWorkspaceId };
}
function req(
  path = "",
  actor = alice,
  method = "GET",
  body?: unknown,
  workspaceId = alice.workspaceId,
) {
  return app.request(`/api/v1/workspaces/${workspaceId}/drive${path}`, {
    method,
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: actor.cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function folder(name = "Folder", parentId: string | null = null, actor = alice) {
  const response = await req("/folders", actor, "POST", { name, parentId });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}
async function initialized(
  name = "notes.txt",
  parentId: string | null = null,
  data = Buffer.from("hello Drive"),
  mimeType = "text/plain",
) {
  const response = await req("/uploads", alice, "POST", {
    name,
    parentId,
    size: data.length,
    mimeType,
    checksum: memory.sha(data),
  });
  expect(response.status).toBe(201);
  const session = (await response.json()) as { item: { id: string }; multipart: boolean };
  const row = await database.db.query.driveItem.findFirst({
    where: eq(driveItem.id, session.item.id),
  });
  expect(row?.objectKey).not.toContain(name);
  return { ...session, row: row!, data };
}
async function file(name = "notes.txt", parentId: string | null = null) {
  const session = await initialized(name, parentId);
  memory.put(session.row.stagingKey!, session.data, "text/plain");
  const response = await req(`/${session.row.id}/complete`, alice, "POST", {});
  expect(response.status).toBe(200);
  return session.row;
}
beforeAll(async () => {
  alice = await signup("AliceDrive");
  bob = await signup("BobDrive");
  outsider = await signup("OutsideDrive");
  await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
});
afterAll(() => database.cleanup());

test("private metadata, workspace isolation, session enforcement and strict input validation", async () => {
  const item = await file();
  expect((await req("", { ...alice, cookie: "" })).status).toBe(401);
  expect((await req("", outsider)).status).toBe(404);
  expect((await req(`/${item.id}`, bob)).status).toBe(404);
  expect((await req(`/${item.id}`, alice, "GET", undefined, bob.workspaceId)).status).toBe(404);
  expect((await req(`/${item.id}/download`, bob, "POST", {})).status).toBe(404);
  expect((await req(`/${item.id}/preview`, outsider, "POST", {})).status).toBe(404);
  for (const name of ["../bad", "bad\\file", "\u0000bad", ".", "..", " "])
    expect((await req("/folders", alice, "POST", { name })).status).toBe(400);
  expect((await req("/folders", alice, "POST", { name: "valid", ownerId: bob.id })).status).toBe(
    400,
  );
  expect((await req("?limit=1000")).status).toBe(400);
  expect(
    (
      await req("/uploads", alice, "POST", {
        name: "x",
        mimeType: "text/plain",
        size: 65 * 1024 ** 2,
      })
    ).status,
  ).toBe(413);
  expect(
    (await req("/uploads", alice, "POST", { name: "x", mimeType: "text/plain", size: 1 })).status,
  ).toBe(400);
  const result = await (await req(`/${item.id}`)).json();
  expect(result.item.ownerId).toBe(alice.id);
  expect(result.item.status).toBe("ready");
  expect(JSON.stringify(result)).not.toContain("stagingKey");
  expect(JSON.stringify(result)).not.toContain("objectKey");
});

test("verifies uploads before issuing URLs and promotes to immutable storage keys", async () => {
  const session = await initialized("immutable.txt");
  expect((await req(`/${session.row.id}/download`, alice, "POST", {})).status).toBe(409);
  memory.put(session.row.stagingKey!, Buffer.from("wrong"), "text/plain");
  expect((await req(`/${session.row.id}/complete`, alice, "POST", {})).status).toBe(400);
  memory.put(session.row.stagingKey!, session.data, "text/plain");
  expect((await req(`/${session.row.id}/complete`, alice, "POST", {})).status).toBe(200);
  expect((await req(`/${session.row.id}/complete`, alice, "POST", {})).status).toBe(200);
  memory.put(session.row.stagingKey!, Buffer.from("later overwrite"), "text/plain");
  expect(memory.objects.get(session.row.objectKey!)?.data).toEqual(session.data);
  expect((await req(`/${session.row.id}/download`, alice, "POST", {})).status).toBe(200);
  expect((await req(`/${session.row.id}/preview`, alice, "POST", {})).status).toBe(200);
  const jobs = await database.db
    .select()
    .from(storageCleanup)
    .where(eq(storageCleanup.key, session.row.objectKey!));
  expect(jobs).toHaveLength(0);
  const forged = await initialized("fake.png", null, Buffer.from("not a png"), "image/png");
  memory.put(forged.row.stagingKey!, forged.data, "image/png");
  expect((await req(`/${forged.row.id}/complete`, alice, "POST", {})).status).toBe(400);
  expect((await req(`/${forged.row.id}/cancel`, alice, "POST", {})).status).toBe(200);
});

test("nested folders, inherited viewer/editor access, revocation and member-only grants", async () => {
  const root = await folder("Team root"),
    nested = await folder("Nested", root.id),
    child = await file("shared.txt", nested.id);
  expect(
    (await req(`/${root.id}/shares`, alice, "PUT", { userId: outsider.id, permission: "viewer" }))
      .status,
  ).toBe(404);
  expect(
    (await req(`/${root.id}/shares`, alice, "PUT", { userId: bob.id, permission: "viewer" }))
      .status,
  ).toBe(200);
  expect((await req(`/${child.id}/download`, bob, "POST", {})).status).toBe(200);
  expect((await req(`/${child.id}`, bob, "PATCH", { name: "denied" })).status).toBe(403);
  expect(
    (await req(`/${root.id}/shares`, bob, "PUT", { userId: bob.id, permission: "editor" })).status,
  ).toBe(403);
  expect((await req("/folders", bob, "POST", { name: "denied", parentId: root.id })).status).toBe(
    403,
  );
  const listing = await (await req(`?parentId=${nested.id}`, bob)).json();
  expect(listing.items[0].id).toBe(child.id);
  expect(listing.canWrite).toBe(false);
  expect(
    (await (await req("?view=shared", bob)).json()).items.some(
      (v: { id: string }) => v.id === root.id,
    ),
  ).toBe(true);
  expect(
    (await req(`/${root.id}/shares`, alice, "PUT", { userId: bob.id, permission: "editor" }))
      .status,
  ).toBe(200);
  expect((await req(`/${child.id}`, bob, "PATCH", { name: "edited.txt" })).status).toBe(200);
  expect((await req(`/${child.id}`, bob, "PATCH", { parentId: null })).status).toBe(403);
  await folder("Bob content", root.id, bob);
  const grants = await (await req(`/${child.id}/shares`, bob)).json();
  expect(grants.shares[0].inheritedFrom).toBe(root.id);
  expect((await req(`/${root.id}/shares/${bob.id}`, alice, "DELETE", {})).status).toBe(200);
  expect((await req(`/${child.id}/download`, bob, "POST", {})).status).toBe(404);
});

test("rename, cycle-safe move, recursive copy, stars, search, sorting and pagination", async () => {
  const root = await folder("Navigation"),
    nested = await folder("Child", root.id),
    child = await file("needle.txt", nested.id);
  expect((await req(`/${root.id}`, alice, "PATCH", { parentId: nested.id })).status).toBe(409);
  expect((await req(`/${root.id}`, alice, "PATCH", { parentId: root.id })).status).toBe(409);
  expect(
    (await req(`/${child.id}`, alice, "PATCH", { name: "renamed.txt", parentId: root.id })).status,
  ).toBe(200);
  const nestedPage = await (await req(`?parentId=${root.id}`)).json();
  expect(nestedPage.breadcrumbs[0].name).toBe("Navigation");
  expect(nestedPage.items).toHaveLength(2);
  const copy = await req(`/${root.id}/copy`, alice, "POST", { name: "Clone", parentId: null });
  expect(copy.status).toBe(201);
  const clone = await copy.json();
  expect(clone.id).not.toBe(root.id);
  const clonedChildren = await (await req(`?parentId=${clone.id}`)).json();
  expect(clonedChildren.items).toHaveLength(2);
  const copiedFile = clonedChildren.items.find((v: { kind: string }) => v.kind === "file");
  expect((await req(`/${copiedFile.id}/copy`, alice, "POST", {})).status).toBe(201);
  expect((await req(`/${child.id}/star`, alice, "PUT", { starred: true })).status).toBe(200);
  expect(
    (await (await req("?view=starred")).json()).items.some(
      (v: { id: string }) => v.id === child.id,
    ),
  ).toBe(true);
  const results = await (await req("?q=renamed&type=text&sort=size&direction=desc&limit=1")).json();
  expect(results.items).toHaveLength(1);
  expect(results.nextOffset).toBe(1);
  expect((await req(`/${child.id}/star`, alice, "PUT", { starred: false })).status).toBe(200);
  expect((await (await req("?view=recent&limit=1")).json()).items).toHaveLength(1);
});

test("Trash preserves previous tombstones, denies content access and restores a deletion batch", async () => {
  const root = await folder("Trash root"),
    old = await file("already-deleted.txt", root.id),
    current = await file("recover.txt", root.id);
  expect((await req(`/${old.id}`, alice, "DELETE", {})).status).toBe(200);
  expect((await req(`/${root.id}`, alice, "DELETE", {})).status).toBe(200);
  expect((await req(`/${current.id}/download`, alice, "POST", {})).status).toBe(404);
  expect((await req(`/${current.id}/restore`, alice, "POST", {})).status).toBe(409);
  expect((await req(`/${root.id}/restore`, alice, "POST", {})).status).toBe(200);
  expect((await req(`/${current.id}/download`, alice, "POST", {})).status).toBe(200);
  expect((await req(`/${old.id}/download`, alice, "POST", {})).status).toBe(404);
  expect((await req(`/${current.id}/permanent`, alice, "DELETE", {})).status).toBe(409);
  expect(
    (await (await req("?view=trash")).json()).items.some((v: { id: string }) => v.id === old.id),
  ).toBe(true);
});

test("multipart sizes and checksums, retries after promotion failure, cancel and expiry", async () => {
  const large = await initialized(
    "large.bin",
    null,
    Buffer.alloc(PART_SIZE * 2, 42),
    "application/octet-stream",
  );
  expect(large.multipart).toBe(true);
  expect(
    (
      await req(`/${large.row.id}/parts`, bob, "POST", {
        partNumber: 1,
        checksum: memory.sha(large.data.subarray(0, PART_SIZE)),
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await req(`/${large.row.id}/parts`, alice, "POST", {
        partNumber: 3,
        checksum: memory.sha(large.data),
      })
    ).status,
  ).toBe(400);
  const part = await req(`/${large.row.id}/parts`, alice, "POST", {
    partNumber: 1,
    checksum: memory.sha(large.data.subarray(0, PART_SIZE)),
  });
  expect(part.status).toBe(200);
  const upload = memory.uploads.get(large.row.uploadId!)!;
  upload.parts.set(1, large.data.subarray(0, PART_SIZE));
  expect((await req(`/${large.row.id}/complete`, alice, "POST", {})).status).toBe(409);
  upload.parts.set(2, large.data.subarray(PART_SIZE));
  vi.mocked(memory.storage.copy).mockRejectedValueOnce(new Error("S3 temporarily offline"));
  expect((await req(`/${large.row.id}/complete`, alice, "POST", {})).status).toBe(500);
  expect((await req(`/${large.row.id}/complete`, alice, "POST", {})).status).toBe(200);
  const cancel = await initialized(
    "cancel.bin",
    null,
    Buffer.alloc(PART_SIZE * 2),
    "application/octet-stream",
  );
  expect((await req(`/${cancel.row.id}/cancel`, alice, "POST", {})).status).toBe(200);
  expect(memory.uploads.has(cancel.row.uploadId!)).toBe(false);
  expect((await req(`/${cancel.row.id}/complete`, alice, "POST", {})).status).toBe(404);
  const expired = await initialized("expired.txt");
  await database.db
    .update(driveItem)
    .set({ uploadExpiresAt: new Date(0) })
    .where(eq(driveItem.id, expired.row.id));
  expect((await req(`/${expired.row.id}/complete`, alice, "POST", {})).status).toBe(409);
});

test("ZIP archives contain real content and empty folders and authorize every selected root", async () => {
  const root = await folder("Archive"),
    empty = await folder("Empty", root.id);
  await file("in-zip.txt", root.id);
  expect(empty.id).toBeTruthy();
  expect((await req("/archive", bob, "POST", { ids: [root.id] })).status).toBe(404);
  const result = await req("/archive", alice, "POST", { ids: [root.id] });
  expect(result.status).toBe(200);
  const archive = [...memory.objects.entries()].find(([key]) => key.startsWith("drive-archives/"))!;
  expect(archive[1].data.subarray(0, 2).toString()).toBe("PK");
  expect(archive[1].data.toString()).toContain("in-zip.txt");
  expect(archive[1].data.toString()).toContain("Empty");
});

test("permanent deletion survives storage failure and cleanup removes all metadata and objects", async () => {
  const root = await folder("Purge"),
    child = await file("purge.txt", root.id);
  await req(`/${root.id}`, alice, "DELETE", {});
  expect((await req(`/${root.id}/permanent`, alice, "DELETE", {})).status).toBe(200);
  expect((await req(`/${child.id}/download`, alice, "POST", {})).status).toBe(404);
  await database.db
    .update(storageCleanup)
    .set({ notBefore: new Date(0) })
    .where(inArray(storageCleanup.key, [child.objectKey!, child.stagingKey!]));
  vi.mocked(memory.storage.remove).mockRejectedValueOnce(new Error("Temporary storage failure"));
  expect((await cleanupStorage(database.db, memory.storage)).failures).toBe(1);
  await database.db
    .update(storageCleanup)
    .set({ notBefore: new Date(0) })
    .where(inArray(storageCleanup.key, [child.objectKey!, child.stagingKey!]));
  await cleanupStorage(database.db, memory.storage);
  expect(
    await database.db.query.driveItem.findFirst({ where: eq(driveItem.id, root.id) }),
  ).toBeUndefined();
  expect(
    await database.db.query.driveItem.findFirst({ where: eq(driveItem.id, child.id) }),
  ).toBeUndefined();
  expect(memory.objects.has(child.objectKey!)).toBe(false);
});

test("relational tenant constraints and membership removal cascade shares/stars", async () => {
  const root = await folder("Membership"),
    child = await file("membership.txt", root.id);
  await req(`/${root.id}/shares`, alice, "PUT", { userId: bob.id, permission: "viewer" });
  await req(`/${child.id}/star`, bob, "PUT", { starred: true });
  await expect(
    database.db.transaction(async (tx) => {
      await tx.insert(driveShare).values({
        workspaceId: bob.workspaceId,
        itemId: child.id,
        userId: bob.id,
        permission: "viewer",
      });
    }),
  ).rejects.toThrow(/./);
  await expect(
    database.db.transaction(async (tx) => {
      await tx
        .update(driveItem)
        .set({ parentId: root.id })
        .where(eq(driveItem.workspaceId, bob.workspaceId));
      await tx.insert(driveItem).values({
        workspaceId: bob.workspaceId,
        ownerId: bob.id,
        name: "cross",
        originalName: "cross",
        kind: "folder",
        parentId: root.id,
      });
    }),
  ).rejects.toThrow(/./);
  await database.db
    .delete(membership)
    .where(
      sql`${membership.workspaceId} = ${alice.workspaceId} and ${membership.userId} = ${bob.id}`,
    );
  expect(
    await database.db.select().from(driveShare).where(eq(driveShare.userId, bob.id)),
  ).toHaveLength(0);
  expect(
    await database.db.select().from(driveStar).where(eq(driveStar.userId, bob.id)),
  ).toHaveLength(0);
  expect((await req(`/${child.id}/download`, bob, "POST", {})).status).toBe(404);
});

test("OpenAPI includes the real Drive routes", async () => {
  const document = await (await app.request("/api/openapi.json")).json();
  expect(document.paths["/api/v1/workspaces/{workspaceId}/drive/uploads"]).toBeDefined();
});

test("denies invalid destinations, unavailable uploads and unsupported inline previews", async () => {
  const pending = await initialized("pending.txt");
  expect((await req(`/${randomUUID()}`)).status).toBe(404);
  expect((await req(`?parentId=${pending.row.id}`)).status).toBe(404);
  expect(
    (await req("/folders", alice, "POST", { name: "under-file", parentId: pending.row.id })).status,
  ).toBe(409);
  expect((await req(`/${pending.row.id}`, alice, "PATCH", { name: "too early" })).status).toBe(409);
  expect((await req(`/${pending.row.id}/copy`, alice, "POST", {})).status).toBe(409);
  expect((await req("/archive", alice, "POST", { ids: [pending.row.id] })).status).toBe(409);
  expect(
    (
      await req(`/${pending.row.id}/parts`, alice, "POST", {
        partNumber: 2,
        checksum: memory.sha(pending.data),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await req(`/${pending.row.id}/parts`, alice, "POST", {
        partNumber: 1,
        checksum: memory.sha(Buffer.from("different")),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await req(`/${pending.row.id}/parts`, alice, "POST", {
        partNumber: 1,
        checksum: memory.sha(pending.data),
      })
    ).status,
  ).toBe(200);
  await req(`/${pending.row.id}/cancel`, alice, "POST", {});
  expect((await req(`/${pending.row.id}/restore`, alice, "POST", {})).status).toBe(409);
  const done = await file("done.txt");
  expect((await req(`/${done.id}/cancel`, alice, "POST", {})).status).toBe(409);
  expect(
    (await req(`/${done.id}/shares`, alice, "PUT", { userId: alice.id, permission: "viewer" }))
      .status,
  ).toBe(409);
  const binary = await initialized(
    "binary.dat",
    null,
    Buffer.from([1, 2, 3]),
    "application/octet-stream",
  );
  memory.put(binary.row.stagingKey!, binary.data, "application/octet-stream");
  expect((await req(`/${binary.row.id}/complete`, alice, "POST", {})).status).toBe(200);
  expect((await req(`/${binary.row.id}/preview`, alice, "POST", {})).status).toBe(400);
  for (const type of ["pdf", "other", "image", "folder"])
    expect((await req(`?type=${type}&sort=type`)).status).toBe(200);
});

test("direct child grants omit private ancestor names and do not transfer upload authority", async () => {
  await database.db
    .insert(membership)
    .values({ workspaceId: alice.workspaceId, userId: bob.id })
    .onConflictDoNothing();
  const root = await folder("Private ancestor name"),
    child = await folder("Directly shared child", root.id);
  await req(`/${child.id}/shares`, alice, "PUT", { userId: bob.id, permission: "viewer" });
  const response = await req(`?parentId=${child.id}`, bob);
  expect(response.status).toBe(200);
  const listing = await response.json();
  expect(listing.breadcrumbs).toEqual([{ id: child.id, name: "Directly shared child" }]);
  expect(JSON.stringify(listing)).not.toContain("Private ancestor name");
  const pending = await initialized("only-owner-finalizes.txt", child.id);
  await req(`/${pending.row.id}/shares`, alice, "PUT", { userId: bob.id, permission: "editor" });
  expect(
    (
      await req(`/${pending.row.id}/parts`, bob, "POST", {
        partNumber: 1,
        checksum: memory.sha(pending.data),
      })
    ).status,
  ).toBe(403);
  expect((await req(`/${pending.row.id}/complete`, bob, "POST", {})).status).toBe(403);
  const shares = await (await req(`/${child.id}/shares`)).json();
  expect(shares.shares[0].inheritedFrom).toBeNull();
  await req(`/${pending.row.id}/cancel`, alice, "POST", {});
});

test("configured MIME allowlists accept exact types and wildcard families and reject others", async () => {
  const filtered = createApp({
    db: database.db,
    auth: createAuth(database.db, env),
    env: { ...env, DRIVE_ALLOWED_MIME_TYPES: "text/plain,image/*" },
    storage: memory.storage,
  });
  async function upload(mimeType: string) {
    return filtered.request(`/api/v1/workspaces/${alice.workspaceId}/drive/uploads`, {
      method: "POST",
      headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: alice.cookie },
      body: JSON.stringify({
        name: "allowed-test",
        size: 1,
        mimeType,
        checksum: memory.sha(Buffer.from("x")),
      }),
    });
  }
  expect((await upload("text/plain")).status).toBe(201);
  expect((await upload("image/png")).status).toBe(201);
  expect((await upload("application/pdf")).status).toBe(400);
});

test("copy/archive bounds, cycles and deleted descendants are enforced before storage writes", async () => {
  const root = await folder("Limits"),
    nested = await folder("Nested", root.id),
    deleted = await file("skip-deleted.txt", nested.id);
  await req(`/${deleted.id}`, alice, "DELETE", {});
  expect((await req(`/${root.id}/copy`, alice, "POST", { parentId: nested.id })).status).toBe(409);
  expect((await req(`/${root.id}/copy`, alice, "POST", { parentId: null })).status).toBe(201);
  expect((await req("/archive", alice, "POST", { ids: [root.id, nested.id] })).status).toBe(200);
  const tooMany = await folder("Many");
  await database.db.insert(driveItem).values(
    Array.from({ length: 101 }, (_, index) => ({
      workspaceId: alice.workspaceId,
      ownerId: alice.id,
      parentId: tooMany.id,
      name: `empty-${index}`,
      originalName: `empty-${index}`,
      kind: "folder" as const,
    })),
  );
  expect((await req(`/${tooMany.id}/copy`, alice, "POST", {})).status).toBe(409);
  const large = await file("over-archive-limit.bin");
  await database.db
    .update(driveItem)
    .set({ size: 513 * 1024 ** 2 })
    .where(eq(driveItem.id, large.id));
  expect((await req(`/${large.id}/copy`, alice, "POST", { parentId: root.id })).status).toBe(409);
  expect((await req("/archive", alice, "POST", { ids: [large.id] })).status).toBe(409);
  const wide = await folder("Wide");
  await database.db.insert(driveItem).values(
    Array.from({ length: 1001 }, (_, index) => ({
      workspaceId: alice.workspaceId,
      ownerId: alice.id,
      parentId: wide.id,
      name: `wide-${index}`,
      originalName: `wide-${index}`,
      kind: "folder" as const,
    })),
  );
  expect((await req(`/${wide.id}`, alice, "DELETE", {})).status).toBe(409);
  expect((await req("/archive", alice, "POST", { ids: [wide.id] })).status).toBe(409);
});

test("nesting guards cover destinations, moving and copying deeper trees", async () => {
  let parentId: string | null = null;
  const ids: string[] = [];
  for (let index = 0; index < 63; index++) {
    const id = randomUUID();
    ids.push(id);
    await database.db.insert(driveItem).values({
      id,
      workspaceId: alice.workspaceId,
      ownerId: alice.id,
      parentId,
      name: `depth-${index}`,
      originalName: `depth-${index}`,
      kind: "folder",
    });
    parentId = id;
  }
  expect((await req("/folders", alice, "POST", { name: "too-deep", parentId })).status).toBe(409);
  const root = await folder("Shallow"),
    child = await folder("Child", root.id);
  expect((await req(`/${root.id}`, alice, "PATCH", { parentId: ids[61] })).status).toBe(409);
  expect((await req(`/${root.id}/copy`, alice, "POST", { parentId: ids[61] })).status).toBe(409);
  const extra = randomUUID();
  await database.db.insert(driveItem).values({
    id: extra,
    workspaceId: alice.workspaceId,
    ownerId: alice.id,
    parentId,
    name: "old-import",
    originalName: "old-import",
    kind: "folder",
  });
  expect((await req(`/${extra}`)).status).toBe(409);
  expect((await req(`/${child.id}`, alice, "PATCH", { parentId: null })).status).toBe(200);
});

test("failed initialization is recoverable and missing multipart checksums cannot be finalized", async () => {
  vi.mocked(memory.storage.putUrl).mockRejectedValueOnce(new Error("Storage down"));
  expect(
    (
      await req("/uploads", alice, "POST", {
        name: "init-fail.txt",
        mimeType: "text/plain",
        size: 1,
        checksum: memory.sha(Buffer.from("x")),
      })
    ).status,
  ).toBe(500);
  const large = await req("/uploads", alice, "POST", {
    name: "multipart-no-full-checksum.bin",
    mimeType: "application/octet-stream",
    size: 16 * 1024 ** 2,
  });
  expect(large.status).toBe(201);
  const session = await large.json();
  await req(`/${session.item.id}/cancel`, alice, "POST", {});
  const upload = await initialized("bad-promotion.txt");
  memory.put(upload.row.stagingKey!, upload.data, "text/plain");
  const originalStat = async (key: string) => {
    const value = memory.objects.get(key)!;
    return {
      size: value.data.length,
      mimeType: value.mimeType,
      etag: value.etag,
      checksum: value.checksum,
    };
  };
  vi.mocked(memory.storage.stat)
    .mockImplementationOnce(originalStat)
    .mockResolvedValueOnce({ size: 999, mimeType: "text/plain", etag: "wrong", checksum: null });
  expect((await req(`/${upload.row.id}/complete`, alice, "POST", {})).status).toBe(500);
  expect((await req(`/${upload.row.id}/complete`, alice, "POST", {})).status).toBe(200);
});

test("maintenance expires abandoned multipart work and removes orphaned archive objects", async () => {
  const abandoned = await initialized(
    "abandoned.bin",
    null,
    Buffer.alloc(16 * 1024 ** 2),
    "application/octet-stream",
  );
  await database.db
    .update(driveItem)
    .set({ uploadExpiresAt: new Date(0) })
    .where(eq(driveItem.id, abandoned.row.id));
  await database.db
    .update(storageCleanup)
    .set({ notBefore: new Date(0) })
    .where(inArray(storageCleanup.key, [abandoned.row.objectKey!, abandoned.row.stagingKey!]));
  const orphan = `drive-archives/orphan-${randomUUID()}`;
  memory.put(orphan, Buffer.from("zip"), "application/zip");
  await database.db.insert(storageCleanup).values({ key: orphan, notBefore: new Date(0) });
  const result = await cleanupStorage(database.db, memory.storage);
  expect(result.failures).toBe(0);
  expect(memory.objects.has(orphan)).toBe(false);
  expect(memory.uploads.has(abandoned.row.uploadId!)).toBe(false);
  expect(
    (await database.db.query.driveItem.findFirst({ where: eq(driveItem.id, abandoned.row.id) }))
      ?.status,
  ).toBe("failed");
});
