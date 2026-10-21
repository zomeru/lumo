import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createAuth } from "@lumo/auth";
import { avatarIdentity } from "@lumo/contracts/avatar";
import { membership } from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, expect, test, vi } from "vitest";

import { createApp } from "./app";
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
  BETTER_AUTH_SECRET: "avatar-test-secret-at-least-thirty-two-characters",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
});
const memory = memoryStorage();
const app = createApp({
  db: database.db,
  auth: createAuth(database.db, env),
  env,
  storage: memory.storage,
});
afterAll(() => database.cleanup());
function request(path: string, cookie: string, method = "GET", body?: unknown) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: { cookie, origin: env.WEB_ORIGIN, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function signup(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({
      name,
      email: `${randomUUID()}@example.com`,
      password: "Long-avatar-password-2026!",
    }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const me = await (await request("/me", cookie)).json();
  return { cookie, id: me.user.id as string, workspaceId: me.activeWorkspaceId as string };
}
test("avatar uploads persist privately, replace and remove storage objects, and enforce shared membership", async () => {
  const owner = await signup("Photo Owner"),
    member = await signup("Photo Member"),
    outsider = await signup("Photo Outsider");
  await database.db
    .insert(membership)
    .values({ workspaceId: owner.workspaceId, userId: member.id, role: "member" });
  const data = await sharp({ create: { width: 512, height: 256, channels: 3, background: "blue" } })
    .png()
    .toBuffer();
  const input = { mimeType: "image/png", data: data.toString("base64") };
  expect((await request("/me/avatar/config", owner.cookie)).status).toBe(200);
  expect((await request("/me/avatar", "", "PUT", input)).status).toBe(401);
  expect(
    (await request("/me/avatar", owner.cookie, "PUT", { ...input, mimeType: "image/svg+xml" }))
      .status,
  ).toBe(400);
  expect(
    (await request("/me/avatar", owner.cookie, "PUT", { ...input, data: "aGVsbG8=" })).status,
  ).toBe(400);
  const saved = await request("/me/avatar", owner.cookie, "PUT", input);
  expect(saved.status).toBe(200);
  const { image } = await saved.json(),
    identity = avatarIdentity(image)!;
  const path = `/avatars/${identity.userId}/${identity.version}`;
  expect(memory.objects.size).toBe(1);
  const stored = [...memory.objects.values()][0]!;
  expect(await sharp(stored.data).metadata()).toMatchObject({
    format: "webp",
    width: 256,
    height: 256,
  });
  expect((await (await request("/me", owner.cookie)).json()).user.image).toBe(image);
  expect((await request(path, owner.cookie)).status).toBe(200);
  expect((await request(path, member.cookie)).status).toBe(200);
  expect((await request(path, outsider.cookie)).status).toBe(404);
  await database.db
    .delete(membership)
    .where(and(eq(membership.workspaceId, owner.workspaceId), eq(membership.userId, member.id)));
  expect((await request(path, member.cookie)).status).toBe(404);
  expect((await request("/me/avatar", owner.cookie, "PUT", input)).status).toBe(200);
  expect(memory.objects.size).toBe(1);
  expect((await request(path, owner.cookie)).status).toBe(404);
  vi.mocked(memory.storage.write).mockRejectedValueOnce(new Error("Storage unavailable"));
  expect((await request("/me/avatar", owner.cookie, "PUT", input)).status).toBe(500);
  expect(memory.objects.size).toBe(1);
  expect((await request("/me/avatar", owner.cookie, "DELETE")).status).toBe(200);
  expect(memory.objects.size).toBe(0);
  expect((await (await request("/me", owner.cookie)).json()).user.image).toBeNull();
});
