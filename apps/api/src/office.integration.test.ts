import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { parseEnv } from "node:util";

import { createAuth } from "@lumo/auth";
import { legalVersions } from "@lumo/contracts/legal";
import {
  membership,
  driveItem,
  officeDocument,
  officeVersion,
  storageCleanup,
  wikiConnection,
} from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, test, expect, vi } from "vitest";

import { createApp } from "./app";
import { createOfficeProvider, type OfficeProvider } from "./modules/office/provider";
import { officeTemplate } from "./modules/office/templates";
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
  MAIL_DIR: "../../.local/office-test-mail",
  ONLYOFFICE_DOCUMENT_SERVER_URL: "https://office.example.com",
  ONLYOFFICE_PUBLIC_API_BASE_URL: "https://api.example.com",
  ONLYOFFICE_JWT_SECRET: "office-test-secret-with-thirty-two-characters",
});
const memory = memoryStorage(),
  provider = {
    ...createOfficeProvider(env),
    download: vi.fn<OfficeProvider["download"]>(async () =>
      Readable.from(officeTemplate("document")),
    ),
    command: vi.fn<OfficeProvider["command"]>(async () => ({ error: 0 })),
  };
const app = createApp({
  db: database.db,
  auth: createAuth(database.db, env),
  env,
  storage: memory.storage,
  officeProvider: provider,
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
      confirmPassword: "Long-integration-password!2026",
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
function req(
  path = "",
  actor = alice,
  method = "GET",
  body?: unknown,
  workspaceId = alice.workspaceId,
) {
  return app.request(`/api/v1/workspaces/${workspaceId}${path}`, {
    method,
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: actor.cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function create(kind = "document", parentPageId: string | null = null) {
  const response = await req("/documents", alice, "POST", {
    name: `Synthetic ${kind}`,
    kind,
    parentId: null,
    parentPageId,
  });
  expect(response.status).toBe(200);
  return response.json();
}
async function config(id: string, actor = alice) {
  const response = await req(`/documents/${id}/editor-config`, actor, "POST", {});
  expect(response.status).toBe(200);
  return response.json();
}
async function callback(
  id: string,
  generation: number,
  key: string,
  status: number,
  url = `https://office.example.com/cache/${randomUUID()}`,
) {
  return app.request(`/api/internal/onlyoffice/callback/${id}/${generation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: await provider.sign({
        key,
        status,
        ...([2, 6].includes(status) ? { url, filetype: "docx" } : {}),
      }),
    }),
  });
}
beforeAll(async () => {
  alice = await signup("AliceOffice");
  bob = await signup("BobOffice");
  outsider = await signup("OutsideOffice");
  await database.db.insert(membership).values({ workspaceId: alice.workspaceId, userId: bob.id });
});
afterAll(async () => {
  await app.wiki.close();
  await database.cleanup();
});
test("all four kinds create canonical Drive files and authorized filtered inventories", async () => {
  for (const kind of ["document", "sheet", "slide", "wiki"]) {
    const doc = await create(kind);
    expect(doc.kind).toBe(kind);
    expect(doc.version).toBe(1);
    const drive = await (await req(`/drive/${doc.item.id}`)).json();
    expect(drive.item.id).toBe(doc.item.id);
    expect(drive.item.checksum).toBe(doc.item.checksum);
    expect((await req(`/documents?kind=${kind}`)).status).toBe(200);
    expect((await req(`/documents/${doc.item.id}`, outsider)).status).toBe(404);
    expect((await req(`/documents/${doc.item.id}`, bob)).status).toBe(404);
    expect((await req(`/documents/${doc.item.id}`, { ...alice, cookie: "" })).status).toBe(401);
    expect(
      (await req(`/documents/${doc.item.id}`, alice, "GET", undefined, bob.workspaceId)).status,
    ).toBe(404);
  }
  expect(
    (await req("/documents", alice, "POST", { name: "x", kind: "fake", parentId: null })).status,
  ).toBe(400);
});
test("server JWTs bind stable coeditor keys to actor, revision and workspace; source rechecks ACL", async () => {
  const doc = await create(),
    id = doc.item.id;
  await req(`/drive/${id}/shares`, alice, "PUT", { userId: bob.id, permission: "editor" });
  const a = await config(id),
    b = await config(id, bob);
  expect(a.config.document.key).toBe(b.config.document.key);
  expect(a.config.editorConfig.user.id).not.toBe(b.config.editorConfig.user.id);
  expect((await provider.verify(a.config.token)).document).toEqual(a.config.document);
  expect(a.config.editorConfig.customization).toEqual({ forcesave: true, uiTheme: "theme-system" });
  expect((await provider.verify(a.config.token)).editorConfig).toEqual(a.config.editorConfig);
  const url = new URL(a.config.document.url);
  expect((await app.request(url.pathname + url.search)).status).toBe(200);
  expect((await app.request(url.pathname + "?token=forged")).status).toBe(403);
  const bSource = new URL(b.config.document.url);
  await req(`/drive/${id}/shares/${bob.id}`, alice, "DELETE");
  expect(provider.command).toHaveBeenCalledWith({
    c: "drop",
    key: a.config.document.key,
    users: [bob.id],
  });
  expect((await app.request(bSource.pathname + bSource.search)).status).toBe(404);
  await callback(id, 0, a.config.document.key, 4);
});
test("viewer configs, grants and sharing use existing Drive authorization and private metadata", async () => {
  const doc = await create(),
    id = doc.item.id;
  await req(`/drive/${id}/shares`, alice, "PUT", { userId: bob.id, permission: "viewer" });
  const b = await config(id, bob);
  expect(b.config.editorConfig.mode).toBe("view");
  expect(b.config.document.permissions.edit).toBe(false);
  expect((await req(`/documents/${id}/save`, bob, "POST", {})).status).toBe(403);
  expect((await req(`/documents/${id}/share-item`, bob)).status).toBe(200);
  expect((await req(`/documents/${id}/versions`, outsider)).status).toBe(404);
  const text = await (await req(`/documents/${id}`)).text();
  expect(text).not.toMatch(/objectKey|stagingKey|JWT_SECRET/);
});
test("callback authentication rejects unsigned bodies, wrong scopes, tampering and MIME changes", async () => {
  const doc = await create(),
    id = doc.item.id,
    c = await config(id),
    key = c.config.document.key;
  expect(
    (
      await app.request(`/api/internal/onlyoffice/callback/${id}/0`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, status: 2, url: "http://localhost" }),
      })
    ).status,
  ).toBe(403);
  expect((await callback(id, 0, "wrong-key", 4)).status).toBe(403);
  expect(
    (
      await app.request(`/api/internal/onlyoffice/callback/${id}/0`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      })
    ).status,
  ).toBe(415);
  const response = await app.request(`/api/internal/onlyoffice/callback/${id}/0`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: 2,
      url: "http://attacker",
      token: await provider.sign({ key, status: 4 }),
    }),
  });
  expect(response.status).toBe(200);
  expect((await (await req(`/documents/${id}`)).json()).version).toBe(1);
  expect(
    (
      await app.request(`/api/internal/onlyoffice/callback/${id}/0`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: await provider.sign({
            key,
            status: 6,
            url: "https://office.example.com/x",
            filetype: "xlsx",
          }),
        }),
      })
    ).status,
  ).toBe(400);
});
test("durable snapshots deduplicate retries and serialize racing force/final saves without replacing history", async () => {
  const doc = await create(),
    id = doc.item.id,
    c = await config(id),
    key = c.config.document.key;
  const sourceUrl = new URL(c.config.document.url);
  const url = "https://office.example.com/cache/dedup";
  const results = await Promise.all([callback(id, 0, key, 6, url), callback(id, 0, key, 6, url)]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  let detail = await (await req(`/documents/${id}`)).json();
  expect(detail.version).toBe(2);
  expect(detail.generation).toBe(0);
  expect((await callback(id, 0, key, 2, "https://office.example.com/cache/final")).status).toBe(
    200,
  );
  expect((await callback(id, 0, key, 2, "https://office.example.com/cache/final")).status).toBe(
    200,
  );
  expect((await callback(id, 0, key, 6)).status).toBe(409);
  expect((await app.request(sourceUrl.pathname + sourceUrl.search)).status).toBe(403);
  detail = await (await req(`/documents/${id}`)).json();
  expect(detail.version).toBe(3);
  expect(detail.generation).toBe(1);
  const versions = await (await req(`/documents/${id}/versions`)).json();
  expect(versions.versions).toHaveLength(3);
  const keys = await database.db
    .select()
    .from(officeVersion)
    .where(eq(officeVersion.documentId, id));
  expect(new Set(keys.map((v) => v.objectKey)).size).toBe(3);
  for (const v of keys) expect(memory.objects.has(v.objectKey)).toBe(true);
  expect(
    (await req(`/documents/${id}/versions/${versions.versions[2].id}/download`, alice, "POST", {}))
      .status,
  ).toBe(200);
  expect(
    (await req(`/documents/${id}/versions/${versions.versions[2].id}/restore`, alice, "POST", {}))
      .status,
  ).toBe(200);
  expect((await (await req(`/documents/${id}`)).json()).version).toBe(4);
});
test("save failures preserve last good revision, surface state and allow callback retry", async () => {
  const doc = await create(),
    id = doc.item.id,
    c = await config(id),
    key = c.config.document.key;
  const initial = (await database.db.select().from(driveItem).where(eq(driveItem.id, id)))[0]!;
  expect((await callback(id, 0, key, 7)).status).toBe(200);
  expect((await (await req(`/documents/${id}`)).json()).state).toBe("error");
  const url = "https://office.example.com/cache/retry";
  memory.storage.write = vi
    .fn<typeof memory.storage.write>(memory.storage.write)
    .mockRejectedValueOnce(new Error("storage unavailable"));
  expect((await callback(id, 0, key, 6, url)).status).toBe(500);
  expect(
    (await database.db.select().from(driveItem).where(eq(driveItem.id, id)))[0]!.objectKey,
  ).toBe(initial.objectKey);
  expect((await callback(id, 0, key, 6, url)).status).toBe(200);
  expect((await (await req(`/documents/${id}`)).json()).version).toBe(2);
  await callback(id, 0, key, 4);
});
test("active editing blocks destructive Drive operations and restores; idle trash reopens same item", async () => {
  const doc = await create(),
    id = doc.item.id,
    c = await config(id),
    key = c.config.document.key;
  const v = (await (await req(`/documents/${id}/versions`)).json()).versions[0];
  expect((await req(`/drive/${id}`, alice, "DELETE")).status).toBe(409);
  expect((await req(`/drive/${id}`, alice, "PATCH", { parentId: null })).status).toBe(409);
  expect((await req(`/documents/${id}/versions/${v.id}/restore`, alice, "POST", {})).status).toBe(
    409,
  );
  await callback(id, 0, key, 4);
  expect((await req(`/drive/${id}`, alice, "DELETE")).status).toBe(200);
  expect((await req(`/documents/${id}`)).status).toBe(404);
  expect((await req(`/drive/${id}/restore`, alice, "POST", {})).status).toBe(200);
  expect((await req(`/documents/${id}`)).status).toBe(200);
});
test("retained revision cleanup is protected, then purge removes every snapshot before metadata", async () => {
  const doc = await create(),
    id = doc.item.id,
    c = await config(id);
  await callback(id, 0, c.config.document.key, 2);
  const revisions = await database.db
    .select()
    .from(officeVersion)
    .where(eq(officeVersion.documentId, id));
  await database.db
    .insert(storageCleanup)
    .values({ key: revisions[0]!.objectKey, notBefore: new Date(0) })
    .onConflictDoUpdate({ target: storageCleanup.key, set: { notBefore: new Date(0) } });
  await cleanupStorage(database.db, memory.storage);
  expect(memory.objects.has(revisions[0]!.objectKey)).toBe(true);
  await req(`/drive/${id}`, alice, "DELETE");
  expect((await req(`/drive/${id}/permanent`, alice, "DELETE")).status).toBe(200);
  await database.db.update(storageCleanup).set({ notBefore: new Date(0) });
  await cleanupStorage(database.db, memory.storage);
  for (const v of revisions) expect(memory.objects.has(v.objectKey)).toBe(false);
  expect(
    await database.db.select().from(officeDocument).where(eq(officeDocument.id, id)),
  ).toHaveLength(0);
});
test("Wiki tree, inherited sharing, cycles, leases, duplicate, subtree trash and physical purge", async () => {
  const root = await create("wiki"),
    child = await create("wiki", root.item.id);
  expect((await req(`/documents/${root.item.id}/editor-config`, alice, "POST", {})).status).toBe(
    400,
  );
  const tree = await (await req("/wiki/pages")).json();
  expect(
    tree.pages.find((p: { item: { id: string } }) => p.item.id === child.item.id).parentId,
  ).toBe(root.item.id);
  expect(
    (
      await req(`/wiki/pages/${root.item.id}`, alice, "PATCH", {
        parentId: child.item.id,
        position: 0,
      })
    ).status,
  ).toBe(409);
  const container = await (await req(`/documents/${root.item.id}/share-item`)).json();
  await req(`/drive/${container.id}/shares`, alice, "PUT", {
    userId: bob.id,
    permission: "viewer",
  });
  expect(
    (await req(`/wiki/pages/${child.item.id}/session`, bob, "POST", { format: "markdown-v1" }))
      .status,
  ).toBe(200);
  expect((await (await req("/wiki/pages", bob)).json()).pages).toHaveLength(2);
  expect((await req(`/drive/${child.item.id}`, alice, "PATCH", { parentId: null })).status).toBe(
    409,
  );
  expect((await req(`/drive/${child.item.id}`, alice, "DELETE")).status).toBe(409);
  const lease = randomUUID();
  await database.db
    .insert(wikiConnection)
    .values({ id: lease, documentId: child.item.id, expiresAt: new Date(Date.now() + 30000) });
  expect((await req(`/wiki/pages/${root.item.id}`, alice, "DELETE")).status).toBe(409);
  await database.db.delete(wikiConnection).where(eq(wikiConnection.id, lease));
  expect(
    (await req(`/wiki/pages/${child.item.id}`, alice, "PATCH", { parentId: null, position: 2 }))
      .status,
  ).toBe(200);
  expect((await req(`/wiki/pages/${root.item.id}/copy`, alice, "POST", {})).status).toBe(200);
  expect(
    (
      await req(`/wiki/pages/${child.item.id}`, alice, "PATCH", {
        parentId: root.item.id,
        position: 0,
      })
    ).status,
  ).toBe(200);
  expect((await req(`/wiki/pages/${root.item.id}`, alice, "DELETE")).status).toBe(200);
  expect((await req(`/documents/${child.item.id}`)).status).toBe(404);
  expect((await req(`/drive/${container.id}/restore`, alice, "POST", {})).status).toBe(200);
  await req(`/wiki/pages/${root.item.id}`, alice, "DELETE");
  await req(`/drive/${container.id}/permanent`, alice, "DELETE");
  await database.db.update(storageCleanup).set({ notBefore: new Date(0) });
  await cleanupStorage(database.db, memory.storage);
  expect(
    await database.db.select().from(officeDocument).where(eq(officeDocument.id, root.item.id)),
  ).toHaveLength(0);
  expect(
    await database.db.select().from(officeDocument).where(eq(officeDocument.id, child.item.id)),
  ).toHaveLength(0);
});

test("Wiki WebSocket initial sync, durable insert/delete, viewer rejection and revocation use real HTTP upgrades", async () => {
  const { createServer } = await import("node:http");
  const { WebSocket } = await import("ws");
  const Y = await import("yjs");
  const sync = await import("y-protocols/sync");
  const encoding = await import("lib0/encoding");
  const decoding = await import("lib0/decoding");
  const { getRequestListener } = await import("@hono/node-server");
  const listener = getRequestListener(app.fetch);
  const server = createServer((req, res) => {
    void listener(req, res);
  });
  app.wiki.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test listener");
  const root = await create("wiki"),
    id = root.item.id;
  const container = await (await req(`/documents/${id}/share-item`)).json();
  await req(`/drive/${container.id}/shares`, alice, "PUT", {
    userId: bob.id,
    permission: "editor",
  });
  const port = address.port;
  async function connect(actor: Actor) {
    const ticket = await (
      await req(`/wiki/pages/${id}/session`, actor, "POST", { format: "markdown-v1" })
    ).json();
    const doc = new Y.Doc();
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/internal/wiki/${id}?ticket=${ticket.token}`,
      { headers: { origin: env.WEB_ORIGIN } },
    );
    socket.on("error", () => {});
    let synced = false;
    socket.on("message", (data) => {
      const decoder = decoding.createDecoder(Buffer.from(data as Buffer));
      if (decoding.readVarUint(decoder) !== 0) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      const type = sync.readSyncMessage(decoder, encoder, doc, "remote");
      if (type === sync.messageYjsSyncStep2) synced = true;
      if (encoding.length(encoder) > 1) socket.send(encoding.toUint8Array(encoder));
    });
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      sync.writeUpdate(encoder, update);
      socket.send(encoding.toUint8Array(encoder));
    });
    await new Promise<void>((resolve) =>
      socket.once("open", () => {
        const e = encoding.createEncoder();
        encoding.writeVarUint(e, 0);
        sync.writeSyncStep1(e, doc);
        socket.send(encoding.toUint8Array(e));
        resolve();
      }),
    );
    await vi.waitFor(() => expect(synced).toBe(true));
    return { socket, doc };
  }
  const a = await connect(alice),
    b = await connect(bob);
  let viewer: Awaited<ReturnType<typeof connect>> | undefined;
  try {
    const ax = a.doc.getText("markdown");
    ax.insert(8, " durable Wiki");
    await vi.waitFor(() => expect(b.doc.getText("markdown").toJSON()).toContain("durable Wiki"));
    const bx = b.doc.getText("markdown");
    bx.delete(8, 13);
    await vi.waitFor(() =>
      expect(a.doc.getText("markdown").toJSON()).not.toContain("durable Wiki"),
    );
    await vi.waitFor(
      async () => expect((await (await req(`/documents/${id}`)).json()).version).toBeGreaterThan(1),
      { timeout: 5000 },
    );
    await req(`/drive/${container.id}/shares`, alice, "PUT", {
      userId: bob.id,
      permission: "viewer",
    });
    b.socket.close();
    viewer = await connect(bob);
    const closed = new Promise<number>((resolve) =>
      viewer!.socket.once("close", (code) => resolve(code)),
    );
    const vx = viewer.doc.getText("markdown");
    vx.delete(0, 1);
    expect(await closed).toBe(1008);
    await vi.waitFor(() => expect(a.doc.getText("markdown").toJSON()).toContain("Untitled"));
    await req(`/drive/${container.id}/shares/${bob.id}`, alice, "DELETE");
    expect(
      (await req(`/wiki/pages/${id}/session`, bob, "POST", { format: "markdown-v1" })).status,
    ).toBe(404);
  } finally {
    for (const client of [a, b, viewer]) {
      client?.socket.terminate();
      client?.doc.destroy();
    }
    await app.wiki.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("imported Drive Office files attach in place; nested inherited documents remain in Documents inventory", async () => {
  const folder = await (
    await req("/drive/folders", alice, "POST", { name: "Office inventory", parentId: null })
  ).json();
  const bytes = officeTemplate("sheet");
  const initialized = await (
    await req("/drive/uploads", alice, "POST", {
      name: "Imported.xlsx",
      parentId: folder.id,
      size: bytes.length,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksum: memory.sha(bytes),
    })
  ).json();
  const [row] = await database.db
    .select()
    .from(driveItem)
    .where(eq(driveItem.id, initialized.item.id));
  memory.put(
    row!.stagingKey!,
    bytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  await req(`/drive/${row!.id}/complete`, alice, "POST", {});
  expect((await req(`/documents/${row!.id}`)).status).toBe(200);
  expect((await (await req(`/documents/${row!.id}`)).json()).kind).toBe("sheet");
  expect(
    (await (await req("/documents?type=sheet")).json()).items.map((v: { id: string }) => v.id),
  ).toContain(row!.id);
  await req(`/drive/${folder.id}/shares`, alice, "PUT", { userId: bob.id, permission: "viewer" });
  expect(
    (await (await req("/documents?view=shared", bob)).json()).items.map(
      (v: { id: string }) => v.id,
    ),
  ).toContain(row!.id);
  expect(
    (await req(`/documents/${row!.id}/versions/${randomUUID()}/download`, alice, "POST", {}))
      .status,
  ).toBe(404);
  const root = await create("wiki");
  expect((await req(`/documents/${root.item.id}/save`, alice, "POST", {})).status).toBe(400);
  const fake = await (
    await req("/drive/uploads", alice, "POST", {
      name: "unsupported.txt",
      parentId: null,
      size: 4,
      mimeType: "text/plain",
      checksum: memory.sha(Buffer.from("text")),
    })
  ).json();
  const [fakeRow] = await database.db
    .select()
    .from(driveItem)
    .where(eq(driveItem.id, fake.item.id));
  memory.put(fakeRow!.stagingKey!, Buffer.from("text"), "text/plain");
  await req(`/drive/${fakeRow!.id}/complete`, alice, "POST", {});
  expect((await req(`/documents/${fakeRow!.id}`)).status).toBe(400);
  expect((await req(`/documents/${fakeRow!.id}/editor-config`, alice, "POST", {})).status).toBe(
    400,
  );
});

test("Wiki WebSocket origin/ticket bounds, awareness identity, notifications and protocol rejection", async () => {
  const { createServer } = await import("node:http");
  const { WebSocket } = await import("ws");
  const { getRequestListener } = await import("@hono/node-server");
  const Y = await import("yjs");
  const encoding = await import("lib0/encoding");
  const decoding = await import("lib0/decoding");
  const listener = getRequestListener(app.fetch),
    server = createServer((req, res) => {
      void listener(req, res);
    });
  app.wiki.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing listener");
  const port = address.port;
  const root = await create("wiki"),
    id = root.item.id;
  const ticket = await (
    await req(`/wiki/pages/${id}/session`, alice, "POST", { format: "markdown-v1" })
  ).json();
  async function denied(path: string, origin = env.WEB_ORIGIN) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers: { origin } });
    socket.on("error", () => {});
    await new Promise<void>((resolve) => socket.once("close", () => resolve()));
    return socket;
  }
  const sockets: InstanceType<typeof WebSocket>[] = [];
  async function connect() {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/internal/wiki/${id}?ticket=${ticket.token}`,
      { headers: { origin: env.WEB_ORIGIN } },
    );
    socket.on("error", () => {});
    sockets.push(socket);
    await new Promise<void>((resolve) => socket.once("open", () => resolve()));
    return socket;
  }
  const frame = (type: number, data?: Uint8Array) => {
    const e = encoding.createEncoder();
    encoding.writeVarUint(e, type);
    if (data) encoding.writeVarUint8Array(e, data);
    return encoding.toUint8Array(e);
  };
  try {
    expect((await denied(`/api/internal/wiki/${id}?ticket=bad`)).readyState).toBe(WebSocket.CLOSED);
    expect(
      (await denied(`/api/internal/wiki/${id}?ticket=${ticket.token}`, "https://evil.example.com"))
        .readyState,
    ).toBe(WebSocket.CLOSED);
    expect(
      (await denied(`/api/internal/wiki/${randomUUID()}?ticket=${ticket.token}`)).readyState,
    ).toBe(WebSocket.CLOSED);
    const socket = await connect();
    let awareness = "";
    socket.on("message", (raw) => {
      const d = decoding.createDecoder(Buffer.from(raw as Buffer));
      if (decoding.readVarUint(d) === 1) {
        const value = decoding.createDecoder(decoding.readVarUint8Array(d));
        const count = decoding.readVarUint(value);
        if (count) {
          decoding.readVarUint(value);
          decoding.readVarUint(value);
          awareness = decoding.readVarString(value);
        }
      }
    });
    const update = encoding.createEncoder();
    encoding.writeVarUint(update, 1);
    encoding.writeVarUint(update, 100);
    encoding.writeVarUint(update, 1);
    encoding.writeVarString(update, JSON.stringify({ user: { name: "Imposter" }, cursor: null }));
    socket.send(frame(1, encoding.toUint8Array(update)));
    await vi.waitFor(() => expect(awareness).toContain("AliceOffice"));
    expect(awareness).not.toContain("Imposter");
    socket.send(frame(3));
    await app.wiki.refresh(id);
    await app.wiki.refresh(randomUUID());
    app.wiki.awareness("invalid JSON");
    app.wiki.awareness(JSON.stringify({ id: randomUUID(), data: "" }));
    const remote = new Y.Doc();
    const [current] = await database.db
      .select()
      .from(officeDocument)
      .where(eq(officeDocument.id, id));
    Y.applyUpdate(remote, Buffer.from(current!.wikiState!, "base64"));
    remote.getText("markdown").insert(0, "remote persisted change");
    await database.db
      .update(officeDocument)
      .set({ wikiState: Buffer.from(Y.encodeStateAsUpdate(remote)).toString("base64") })
      .where(eq(officeDocument.id, id));
    await app.wiki.refresh(id);
    remote.destroy();
    app.wiki.awareness(
      JSON.stringify({ id, data: Buffer.from(encoding.toUint8Array(update)).toString("base64") }),
    );
    const rejected = new Promise<number>((resolve) =>
      socket.once("close", (code) => resolve(code)),
    );
    socket.send(frame(99));
    expect(await rejected).toBe(1008);
    const textSocket = await connect();
    const textClose = new Promise<number>((resolve) =>
      textSocket.once("close", (code) => resolve(code)),
    );
    textSocket.send("not binary");
    expect(await textClose).toBe(1003);
    const overloaded = await connect();
    const busy = new Promise<number>((resolve) =>
      overloaded.once("close", (code) => resolve(code)),
    );
    for (let i = 0; i < 110; i++) overloaded.send(frame(3));
    expect(await busy).toBe(1013);
    const wrongAwareness = await connect();
    const awClose = new Promise<number>((resolve) =>
      wrongAwareness.once("close", (code) => resolve(code)),
    );
    const tooMany = encoding.createEncoder();
    encoding.writeVarUint(tooMany, 201);
    wrongAwareness.send(frame(1, encoding.toUint8Array(tooMany)));
    expect(await awClose).toBe(1008);
  } finally {
    for (const socket of sockets) socket.terminate();
    await app.wiki.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("force-save commands can await their callback without holding its workspace lock", async () => {
  const doc = await create(),
    id = doc.item.id,
    c = await config(id),
    key = c.config.document.key;
  provider.command.mockImplementationOnce(async (command) => {
    expect(command).toEqual({ c: "forcesave", key });
    const saved = await callback(id, 0, key, 6);
    expect(saved.status).toBe(200);
    return { error: 0 };
  });
  expect((await req(`/documents/${id}/save`, alice, "POST", {})).status).toBe(200);
  expect((await (await req(`/documents/${id}`)).json()).version).toBe(2);
  await callback(id, 0, key, 4);
});
test("permission changes retain unrelated edit access and disconnect effective downgrades only", async () => {
  const a = await create(),
    b = await create();
  for (const doc of [a, b])
    await req(`/drive/${doc.item.id}/shares`, alice, "PUT", {
      userId: bob.id,
      permission: "editor",
    });
  const ac = await config(a.item.id),
    bc = await config(b.item.id);
  provider.command.mockClear();
  await req(`/drive/${a.item.id}/shares`, alice, "PUT", { userId: bob.id, permission: "viewer" });
  expect(
    provider.command.mock.calls.some(
      ([value]) => value.key === ac.config.document.key && value.c === "drop",
    ),
  ).toBe(true);
  expect(
    provider.command.mock.calls.some(
      ([value]) => value.key === bc.config.document.key && value.c === "drop",
    ),
  ).toBe(false);
  await callback(a.item.id, 0, ac.config.document.key, 4);
  await callback(b.item.id, 0, bc.config.document.key, 4);
});

test("Wiki heartbeat recovers missed notifications, expires abandoned leases and closes dead peers", async () => {
  const { createServer } = await import("node:http");
  const { getRequestListener } = await import("@hono/node-server");
  const { WebSocket } = await import("ws");
  const Y = await import("yjs");
  const sync = await import("y-protocols/sync");
  const decoding = await import("lib0/decoding");
  const encoding = await import("lib0/encoding");
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const listener = getRequestListener(app.fetch);
  const server = createServer((request, response) => {
    void listener(request, response);
  });
  app.wiki.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing listener");
  const root = await create("wiki"),
    id = root.item.id;
  const ticket = await (
    await req(`/wiki/pages/${id}/session`, alice, "POST", { format: "markdown-v1" })
  ).json();
  const url = `ws://127.0.0.1:${address.port}/api/internal/wiki/${id}?ticket=${ticket.token}`;
  const socket = new WebSocket(url, { headers: { origin: env.WEB_ORIGIN } });
  const dead = new WebSocket(url, { headers: { origin: env.WEB_ORIGIN }, autoPong: false });
  const local = new Y.Doc(),
    remote = new Y.Doc();
  let pings = 0;
  socket.on("ping", () => pings++);
  socket.on("message", (raw) => {
    const decoder = decoding.createDecoder(Buffer.from(raw as Buffer));
    if (decoding.readVarUint(decoder) !== 0) return;
    const response = encoding.createEncoder();
    encoding.writeVarUint(response, 0);
    sync.readSyncMessage(decoder, response, local, "remote");
    if (encoding.length(response) > 1) socket.send(encoding.toUint8Array(response));
  });
  try {
    await Promise.all(
      [socket, dead].map((ws) => new Promise<void>((resolve) => ws.once("open", resolve))),
    );
    await vi.waitFor(async () =>
      expect(
        (await database.db.select().from(wikiConnection).where(eq(wikiConnection.documentId, id)))
          .length,
      ).toBe(2),
    );
    const expired = randomUUID();
    await database.db
      .insert(wikiConnection)
      .values({ id: expired, documentId: id, expiresAt: new Date(Date.now() - 60000) });
    const [current] = await database.db
      .select()
      .from(officeDocument)
      .where(eq(officeDocument.id, id));
    Y.applyUpdate(remote, Buffer.from(current!.wikiState!, "base64"));
    remote.getText("markdown").insert(0, "recovered notification");
    await database.db
      .update(officeDocument)
      .set({ wikiState: Buffer.from(Y.encodeStateAsUpdate(remote)).toString("base64") })
      .where(eq(officeDocument.id, id));
    // No refresh/NOTIFY delivery: the periodic durable-state reconciliation must recover it.
    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(() =>
      expect(local.getText("markdown").toJSON()).toContain("recovered notification"),
    );
    await vi.waitFor(() => expect(pings).toBeGreaterThan(0));
    await vi.waitFor(async () =>
      expect(
        await database.db.select().from(wikiConnection).where(eq(wikiConnection.id, expired)),
      ).toHaveLength(0),
    );
    const closed = new Promise<void>((resolve) => dead.once("close", () => resolve()));
    await vi.advanceTimersByTimeAsync(15000);
    await closed;
    expect(socket.readyState).toBe(WebSocket.OPEN);
  } finally {
    socket.terminate();
    dead.terminate();
    await app.wiki.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    local.destroy();
    remote.destroy();
    vi.useRealTimers();
  }
});

test("module inventories combine owned and shared items without widening ACLs and lock file types", async () => {
  const shared = await create("document"),
    privateDoc = await create("document"),
    sheet = await create("sheet");
  const mineResponse = await req("/documents", bob, "POST", {
    name: "Bob document",
    kind: "document",
    parentId: null,
  });
  expect(mineResponse.status).toBe(200);
  const mine = await mineResponse.json();
  await req(`/drive/${shared.item.id}/shares`, alice, "PUT", {
    userId: bob.id,
    permission: "viewer",
  });
  const list = await (await req("/documents?module=docs&type=slide", bob)).json();
  const ids = list.items.map((item: { id: string }) => item.id);
  expect(ids).toContain(shared.item.id);
  expect(ids).toContain(mine.item.id);
  expect(ids).not.toContain(privateDoc.item.id);
  expect(ids).not.toContain(sheet.item.id);
  expect(
    (await req(`/drive/${shared.item.id}`, bob, "PATCH", { name: "denied.docx" })).status,
  ).toBe(403);
  const owned = await (await req("/drive?module=all&ownership=owned", bob)).json();
  expect(owned.items.map((item: { id: string }) => item.id)).toContain(mine.item.id);
  expect(owned.items.map((item: { id: string }) => item.id)).not.toContain(shared.item.id);
  const received = await (await req("/drive?module=all&ownership=shared", bob)).json();
  expect(received.items.map((item: { id: string }) => item.id)).toContain(shared.item.id);
  expect(received.items.map((item: { id: string }) => item.id)).not.toContain(mine.item.id);
  expect(
    (
      await req("/drive/uploads", bob, "POST", {
        module: "sheets",
        name: "wrong.docx",
        parentId: null,
        size: 1,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        checksum: memory.sha(Buffer.from("a")),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await req("/drive/uploads", bob, "POST", {
        module: "docs",
        name: "large.docx",
        parentId: null,
        size: 65 * 1024 ** 2,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        checksum: memory.sha(Buffer.from("a")),
      })
    ).status,
  ).toBe(413);
});
test("legacy Wiki state upgrades once, preserves unsnapshotted Markdown and retains historical versions", async () => {
  const Y = await import("yjs");
  const { wikiMarkdown, isSourceWiki } = await import("./modules/office/wiki-markdown");
  const doc = await create("wiki"),
    id = doc.item.id;
  const legacy = new Y.Doc(),
    heading = new Y.XmlElement("heading"),
    text = new Y.XmlText();
  heading.setAttribute("level", "1");
  text.insert(0, "Legacy knowledge 中文");
  heading.insert(0, [text]);
  legacy.getXmlFragment("prosemirror").insert(0, [heading]);
  const state = Buffer.from(Y.encodeStateAsUpdate(legacy)).toString("base64");
  legacy.destroy();
  await database.db
    .update(officeDocument)
    .set({ wikiState: state })
    .where(eq(officeDocument.id, id));
  const before = (await (await req(`/documents/${id}/versions`)).json()).versions;
  expect((await req(`/wiki/pages/${id}/session`, alice, "POST", {})).status).toBe(400);
  const response = await req(`/wiki/pages/${id}/session`, alice, "POST", { format: "markdown-v1" });
  expect(response.status).toBe(200);
  const [upgraded] = await database.db
    .select()
    .from(officeDocument)
    .where(eq(officeDocument.id, id));
  const decoded = new Y.Doc();
  Y.applyUpdate(decoded, Buffer.from(upgraded!.wikiState!, "base64"));
  expect(isSourceWiki(decoded)).toBe(true);
  expect(wikiMarkdown(decoded)).toBe("# Legacy knowledge 中文\n");
  decoded.destroy();
  expect(upgraded!.generation).toBe(doc.generation + 1);
  await req(`/wiki/pages/${id}/session`, alice, "POST", { format: "markdown-v1" });
  expect((await (await req(`/documents/${id}`)).json()).generation).toBe(upgraded!.generation);
  expect((await (await req(`/documents/${id}/versions`)).json()).versions).toEqual(before);
});
