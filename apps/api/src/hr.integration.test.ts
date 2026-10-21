import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createAuth } from "@lumo/auth";
import { membership } from "@lumo/database/schema";
import { readServerEnv } from "@lumo/env/server";
import { beforeAll, afterAll, expect, test } from "vitest";

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
  BETTER_AUTH_SECRET: "hr-test-secret-with-at-least-thirty-two-characters",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  MAIL_DIR: "../../.local/hr-test-mail",
});
const memory = memoryStorage();
const app = createApp({
  db: database.db,
  auth: createAuth(database.db, env),
  env,
  storage: memory.storage,
});
type Actor = { id: string; cookie: string; workspaceId: string };
let owner: Actor, admin: Actor, employee: Actor, outsider: Actor, manager: Actor;
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
  path: string,
  actor = owner,
  method = "GET",
  body?: unknown,
  workspaceId = owner.workspaceId,
) {
  return app.request(`/api/v1/workspaces/${workspaceId}/hr${path}`, {
    method,
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: actor.cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function grant(userId: string, capability: string, scope = "workspace") {
  const r = await req("/grants", owner, "POST", { userId, capability, scope });
  expect(r.status).toBe(200);
}
beforeAll(async () => {
  owner = await signup("OwnerHr");
  admin = await signup("AdminHr");
  employee = await signup("EmployeeHr");
  outsider = await signup("OutsiderHr");
  manager = await signup("ManagerHr");
  await database.db.insert(membership).values([
    { workspaceId: owner.workspaceId, userId: admin.id, role: "admin" },
    { workspaceId: owner.workspaceId, userId: employee.id },
    { workspaceId: owner.workspaceId, userId: manager.id },
  ]);
});
afterAll(() => database.cleanup());
test("HR access is isolated by workspace and generic admin cannot administer grants", async () => {
  expect((await req("/access", { ...owner, cookie: "" })).status).toBe(401);
  expect((await req("/access", outsider)).status).toBe(404);
  expect((await req("/access", owner, "GET", undefined, outsider.workspaceId)).status).toBe(404);
  const access = await (await req("/access", admin)).json();
  expect(access.owner).toBe(false);
  expect(access.grants).toEqual([]);
  expect((await req("/grants", admin)).status).toBe(403);
  expect(
    (
      await req("/grants", admin, "POST", {
        userId: admin.id,
        capability: "hr.payroll.read_all",
        scope: "workspace",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await req("/grants", owner, "POST", {
        userId: owner.id,
        capability: "hr.payroll.read_all",
        scope: "workspace",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await req("/grants", owner, "POST", {
        userId: outsider.id,
        capability: "hr.people.manage",
        scope: "workspace",
      })
    ).status,
  ).toBe(404);
  await grant(admin.id, "hr.people.manage");
  const changed = await (await req("/access", admin)).json();
  expect(changed.grants).toHaveLength(1);
  expect((await req("/audit", admin)).status).toBe(403);
  const audit = await (await req("/audit")).json();
  expect(audit.events[0].actorId).toBe(owner.id);
  expect(
    (
      await req("/grants", owner, "POST", {
        userId: admin.id,
        capability: "hr.people.manage",
        scope: "direct_reports",
      })
    ).status,
  ).toBe(403);
});
