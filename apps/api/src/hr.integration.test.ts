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

test("People profiles remain workspace scoped, reject reporting cycles and omit confidential data", async () => {
  const response = await req("/departments", owner, "POST", {
    name: "Engineering",
    managerId: manager.id,
  });
  expect(response.status).toBe(201);
  const department = (await response.json()) as { id: string };
  expect((await req("/departments", admin, "POST", { name: "Finance" })).status).toBe(403);
  const profile = {
    employeeCode: "EMP001",
    jobTitle: "Engineer",
    departmentId: department.id,
    managerId: manager.id,
    hireDate: "2026-01-01",
  };
  expect((await req(`/people/${employee.id}`, employee, "PUT", profile)).status).toBe(403);
  expect((await req(`/people/${employee.id}`, admin, "PUT", profile)).status).toBe(200);
  expect(
    (await req(`/people/${manager.id}`, owner, "PUT", { managerId: employee.id })).status,
  ).toBe(409);
  expect(
    (await req(`/people/${manager.id}`, owner, "PUT", { employeeCode: "EMP001" })).status,
  ).toBe(409);
  expect((await req(`/people/${outsider.id}`, owner, "PUT", {})).status).toBe(404);
  const directory = await (await req("/people?q=Engineer", employee)).json();
  expect(directory.people).toHaveLength(1);
  expect(directory.people[0].role).toBe("member");
  expect(directory.people[0].managerId).toBe(manager.id);
  for (const field of ["salary", "compensation", "email", "taxId", "password"])
    expect(JSON.stringify(directory)).not.toContain(`"${field}"`);
  const deps = await (await req("/departments")).json();
  expect(deps.departments[0].employeeCount).toBe(1);
  expect((await req(`/people/${employee.id}`, outsider, "PUT", profile)).status).toBe(404);
});

test("Approvals enforce assigned sequential decisions, safe retries, drafts, comments and private attachments", async () => {
  const created = await req("/requests", employee, "POST", {
    subject: "Equipment request",
    details: {
      type: "purchase",
      amountMinor: 150000,
      currency: "PHP",
      quantity: 1,
      vendor: "Vendor",
    },
    approverIds: [manager.id],
    draft: true,
  });
  expect(created.status).toBe(201);
  const { id } = (await created.json()) as { id: string };
  expect((await req(`/requests/${id}/history`, admin)).status).toBe(404);
  expect((await req("/requests?view=all", employee)).status).toBe(403);
  expect(
    (await req(`/requests/${id}/action`, employee, "POST", { action: "approve" })).status,
  ).toBe(403);
  expect(
    (
      await req(`/requests/${id}/action`, owner, "POST", {
        action: "reassign",
        approverIds: [manager.id, admin.id],
      })
    ).status,
  ).toBe(200);
  const data = Buffer.from("Confidential receipt");
  const upload = await req(`/files/request/${id}/uploads`, employee, "POST", {
    name: "receipt.txt",
    mimeType: "text/plain",
    size: data.length,
    checksum: memory.sha(data),
  });
  expect(upload.status).toBe(201);
  const attachment = (await upload.json()) as { id: string };
  memory.put(`hr/${owner.workspaceId}/${attachment.id}/staging`, data, "text/plain");
  expect((await req(`/files/${attachment.id}/complete`, employee, "POST", {})).status).toBe(200);
  expect((await req(`/files/${attachment.id}/download`, outsider, "POST", {})).status).toBe(404);
  expect(
    (await req(`/requests/${id}/comments`, employee, "POST", { comment: "Please review" })).status,
  ).toBe(200);
  expect((await req(`/requests/${id}/action`, employee, "POST", { action: "submit" })).status).toBe(
    200,
  );
  expect((await req(`/requests/${id}/action`, admin, "POST", { action: "approve" })).status).toBe(
    403,
  );
  expect((await req(`/requests/${id}/action`, manager, "POST", { action: "approve" })).status).toBe(
    200,
  );
  let mine = await (await req("/requests?view=mine", employee)).json();
  expect(mine.requests[0].status).toBe("pending");
  expect(mine.requests[0].currentStep).toBe(1);
  const approvals = await Promise.all([
    req(`/requests/${id}/action`, admin, "POST", { action: "approve" }),
    req(`/requests/${id}/action`, admin, "POST", { action: "approve" }),
  ]);
  expect(approvals.map((r) => r.status)).toEqual([200, 200]);
  mine = await (await req("/requests?view=mine", employee)).json();
  expect(mine.requests[0].status).toBe("approved");
  const history = await (await req(`/requests/${id}/history`, employee)).json();
  expect(history.events.filter((e: { action: string }) => e.action === "approve")).toHaveLength(2);
  expect(history.files).toHaveLength(1);
  const inbox = await (await req("/notifications", employee)).json();
  expect(inbox.notifications.some((n: { targetId: string }) => n.targetId === id)).toBe(true);
  expect((await req(`/files/${attachment.id}/download`, employee, "POST", {})).status).toBe(200);
  expect(
    (
      await req("/requests", owner, "POST", {
        subject: "Self approve",
        details: { type: "general" },
        approverIds: [owner.id],
      })
    ).status,
  ).toBe(400);
  const blocked = await req("/requests", owner, "POST", {
    subject: "Missing routing",
    details: { type: "general" },
    draft: true,
  });
  expect(blocked.status).toBe(201);
  const blockedId = (await blocked.json()).id as string;
  expect(
    (await req(`/requests/${blockedId}/action`, owner, "POST", { action: "submit" })).status,
  ).toBe(409);
});

test("Leave shares approval state, charges schedules and holidays, and reverses ledger once", async () => {
  expect(
    (
      await req("/schedules", owner, "POST", {
        userId: employee.id,
        effectiveFrom: "2026-01-01",
        weekdays: [1, 2, 3, 4, 5],
        startMinute: 480,
        endMinute: 1020,
        breakMinutes: 60,
      })
    ).status,
  ).toBe(200);
  expect(
    (await req("/holidays", owner, "POST", { date: "2026-10-23", name: "Workspace holiday" }))
      .status,
  ).toBe(200);
  const policy = await req("/leave/policies", owner, "POST", {
    name: "Vacation",
    paid: true,
    allocationHalfDays: 30,
    effectiveFrom: "2026-01-01",
  });
  expect(policy.status).toBe(201);
  const leaveTypeId = (await policy.json()).id as string;
  const response = await req("/requests", employee, "POST", {
    subject: "Vacation",
    description: "Private reason",
    details: { type: "leave", leaveTypeId, startDate: "2026-10-22", endDate: "2026-10-26" },
  });
  expect(response.status).toBe(201);
  const id = (await response.json()).id as string;
  expect(
    (
      await req("/requests", employee, "POST", {
        subject: "Overlap",
        details: { type: "leave", leaveTypeId, startDate: "2026-10-22", endDate: "2026-10-22" },
      })
    ).status,
  ).toBe(409);
  const pending = await (await req("/leave/balances?year=2026", employee)).json();
  expect(pending.balances[0].balanceHalfDays).toBe(30);
  expect(pending.balances[0].pendingHalfDays).toBe(4);
  const results = await Promise.all([
    req(`/requests/${id}/action`, manager, "POST", { action: "approve" }),
    req(`/requests/${id}/action`, manager, "POST", { action: "approve" }),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  const approved = await (await req("/leave/balances?year=2026", employee)).json();
  expect(approved.balances[0].balanceHalfDays).toBe(26);
  expect(
    approved.balances[0].ledger.filter((l: { source: string }) => l.source.startsWith("approved:")),
  ).toHaveLength(1);
  const out = await (await req("/leave/out?startDate=2026-10-01&endDate=2026-10-31", admin)).json();
  expect(out.absences).toHaveLength(1);
  expect(JSON.stringify(out)).not.toContain("Private reason");
  expect(JSON.stringify(out)).not.toContain("Vacation");
  expect((await req(`/leave/balances?year=2026&userId=${employee.id}`, manager)).status).toBe(200);
  expect((await req(`/leave/balances?year=2026&userId=${employee.id}`, admin)).status).toBe(403);
  expect((await req(`/requests/${id}/action`, employee, "POST", { action: "cancel" })).status).toBe(
    200,
  );
  expect((await req(`/requests/${id}/action`, employee, "POST", { action: "cancel" })).status).toBe(
    200,
  );
  const cancelled = await (await req("/leave/balances?year=2026", employee)).json();
  expect(cancelled.balances[0].balanceHalfDays).toBe(30);
  expect(cancelled.balances[0].usedHalfDays).toBe(0);
  const rest = await req("/requests", employee, "POST", {
    subject: "Rest day",
    details: { type: "leave", leaveTypeId, startDate: "2026-10-24", endDate: "2026-10-24" },
  });
  expect(rest.status).toBe(400);
  const adjustment = {
    userId: employee.id,
    leaveTypeId,
    year: 2026,
    amountHalfDays: 2,
    reason: "Opening correction",
    idempotencyKey: randomUUID(),
  };
  expect((await req("/leave/adjustments", admin, "POST", adjustment)).status).toBe(403);
  for (let i = 0; i < 2; i++)
    expect((await req("/leave/adjustments", owner, "POST", adjustment)).status).toBe(200);
  const balance = await (await req("/leave/balances?year=2026", employee)).json();
  expect(balance.balances[0].balanceHalfDays).toBe(32);
});

test("Attendance clocks are authoritative, idempotent and scoped; reviewed corrections preserve punches", async () => {
  const punch = async (action: string, key = randomUUID()) =>
    req("/attendance/punch", employee, "POST", { action, idempotencyKey: key });
  expect((await punch("end_break")).status).toBe(409);
  const key = randomUUID();
  expect((await punch("clock_in", key)).status).toBe(200);
  expect((await punch("clock_in", key)).status).toBe(200);
  expect((await punch("clock_in")).status).toBe(409);
  expect((await punch("start_break", key)).status).toBe(409);
  expect((await punch("start_break")).status).toBe(200);
  expect((await punch("clock_out")).status).toBe(409);
  expect((await punch("end_break")).status).toBe(200);
  expect((await punch("start_break")).status).toBe(200);
  expect((await punch("end_break")).status).toBe(200);
  expect((await punch("clock_out")).status).toBe(200);
  const month = new Date().toISOString().slice(0, 7);
  const response = await req(`/attendance?month=${month}`, employee);
  expect(response.status).toBe(200);
  const attendance = await response.json();
  expect(attendance.days.length).toBeGreaterThanOrEqual(28);
  expect(attendance.state).toBe("out");
  expect((await req(`/attendance?month=${month}&userId=${employee.id}`, admin)).status).toBe(403);
  expect((await req(`/attendance?month=${month}&userId=${employee.id}`, manager)).status).toBe(200);
  expect((await req(`/attendance/export?month=${month}&userId=${employee.id}`, admin)).status).toBe(
    403,
  );
  const exported = await (await req(`/attendance/export?month=${month}`, employee)).json();
  expect(exported.filename).toContain(owner.workspaceId);
  expect(exported.content.split("\r\n")).toHaveLength(attendance.days.length + 1);
  const correction = await req("/requests", employee, "POST", {
    subject: "Missed punch",
    description: "Clock correction",
    details: {
      type: "attendance_correction",
      date: "2026-10-21",
      clockIn: "2026-10-21T08:00:00Z",
      clockOut: "2026-10-21T17:00:00Z",
      breakMinutes: 60,
    },
  });
  expect(correction.status).toBe(201);
  const id = (await correction.json()).id as string;
  expect((await req(`/requests/${id}/action`, manager, "POST", { action: "approve" })).status).toBe(
    200,
  );
  const corrected = await (await req("/attendance?month=2026-10", employee)).json();
  const day = corrected.days.find((d: { date: string }) => d.date === "2026-10-21");
  expect(day.workedMinutes).toBe(480);
  expect(day.correctionId).toBe(id);
  expect((await req(`/requests/${id}/action`, employee, "POST", { action: "cancel" })).status).toBe(
    409,
  );
});
