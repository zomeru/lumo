import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createAuth } from "@lumolynk/auth";
import { legalVersions } from "@lumolynk/contracts/legal";
import { statutoryConfigurationsSchema } from "@lumolynk/contracts/payroll";
import {
  membership,
  profile as userProfile,
  requestLimit,
  user,
  workspace,
  hrShift,
  hrPayrollRun,
  hrPayrollAdjustment,
} from "@lumolynk/database/schema";
import { readServerEnv } from "@lumolynk/env/server";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";

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
async function configureStatutory(request: typeof req, effectiveFrom = "2025-01-01") {
  const { template } = statutoryConfigurationsSchema.parse(
    await (await request("/payroll/statutory-configurations")).json(),
  );
  const rules = { ...template, effectiveFrom, reason: "Explicitly reviewed accounting fixture" };
  rules.sss.salaryBasis = "monthly_basic";
  rules.sss.collection = "split";
  rules.pagibig.salaryBasis = "monthly_basic";
  expect((await request("/payroll/statutory-configurations", owner, "POST", rules)).status).toBe(
    200,
  );
  return rules;
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
// Each case owns its request window; production rate-limit behavior remains enabled.
beforeEach(async () => {
  await database.db.delete(requestLimit);
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
  await database.db
    .update(userProfile)
    .set({ jobTitle: "Architect" })
    .where(eq(userProfile.userId, manager.id));
  const sorted = await (await req("/people?sort=jobTitle", employee)).json();
  const titles = sorted.people.map((person: { jobTitle: string }) => person.jobTitle);
  expect(titles.indexOf("Architect")).toBeGreaterThanOrEqual(0);
  expect(titles.indexOf("Architect")).toBeLessThan(titles.indexOf("Engineer"));
  expect(directory.people[0]).toMatchObject({
    employeeCode: "",
    hireDate: null,
    endDate: null,
    employmentType: "",
  });
  const privileged = await (await req("/people?q=Engineer", admin)).json();
  expect(privileged.people[0].employeeCode).toBe("EMP001");
  expect((await req("/people?sort=unknown", employee)).status).toBe(400);
  const filtered = await (
    await req("/people?role=member&sort=department&order=desc", employee)
  ).json();
  expect(filtered.people.every((person: { role: string }) => person.role === "member")).toBe(true);
  expect((await req("/people", outsider)).status).toBe(404);
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

test("Payroll runs require explicit grants, independent statutory review, immutable snapshots and own published payslips", async () => {
  for (const path of ["/payroll/compensation", "/payroll/runs", "/payroll/settings"]) {
    expect((await req(path, admin)).status).toBe(403);
    expect((await req(path, manager)).status).toBe(403);
    expect((await req(path, employee)).status).toBe(403);
  }
  const settings = {
    effectiveFrom: "2026-01-01",
    frequency: "monthly",
    currency: "PHP",
    workingDaysPerYear: 261,
    minutesPerDay: 480,
    overtimeBps: 12500,
    holidayBps: 20000,
    restDayBps: 13000,
    nightDifferentialBps: 0,
    deductUndertime: false,
    publishOnFinalize: false,
    payoutDay: 30,
    reason: "Reviewed monthly schedule",
  };
  expect((await req("/payroll/settings", owner, "POST", settings)).status).toBe(200);
  await configureStatutory(req);
  expect(
    (
      await req("/payroll/compensation", owner, "POST", {
        userId: owner.id,
        effectiveFrom: "2026-01-01",
        salaryMinor: 2500000,
        reason: "Own salary",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await req("/payroll/compensation", owner, "POST", {
        userId: employee.id,
        effectiveFrom: "2026-01-01",
        salaryMinor: 2500000,
        reason: "Initial monthly salary",
      })
    ).status,
  ).toBe(200);
  const created = await req("/payroll/runs", owner, "POST", {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    cutoffDate: "2026-09-30",
    payoutDate: "2026-09-30",
  });
  expect(created.status).toBe(201);
  const id = (await created.json()).id as string;
  expect((await req(`/payroll/runs/${id}`, outsider)).status).toBe(404);
  expect((await req(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  const calculated = await (await req(`/payroll/runs/${id}`)).json();
  expect(calculated.run.warnings).toEqual([]);
  expect(calculated.employees).toHaveLength(1);
  expect(calculated.employees[0].result.netMinor).toBe(2261120);
  expect(calculated.employees[0].snapshot.compensationSources).toHaveLength(1);
  const revision = calculated.run.revision as number;
  expect(
    (await req(`/payroll/runs/${id}/action`, owner, "POST", { action: "finalize", revision }))
      .status,
  ).toBe(409);
  expect(
    (await req(`/payroll/runs/${id}/action`, owner, "POST", { action: "approve", revision }))
      .status,
  ).toBe(409);
  expect((await (await req("/payroll/me", employee)).json()).payslips).toHaveLength(0);
  expect((await req(`/payroll/me/${id}/export`, employee)).status).toBe(404);
  await grant(admin.id, "hr.payroll.read_all");
  await grant(admin.id, "hr.payroll.runs.approve");
  expect(
    (await req(`/payroll/runs/${id}/action`, admin, "POST", { action: "approve", revision }))
      .status,
  ).toBe(409);
  const verification = {
    revision,
    expectedNetMinor: 2261120,
    reference:
      "Independently checked official SSS/PhilHealth/Pag-IBIG/BIR sources and every payroll line (test fixture).",
    confirmed: true,
  };
  expect(
    (await req(`/payroll/runs/${id}/employees/${employee.id}/verify`, owner, "POST", verification))
      .status,
  ).toBe(409);
  expect(
    (
      await req(`/payroll/runs/${id}/employees/${employee.id}/verify`, admin, "POST", {
        ...verification,
        expectedNetMinor: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (await req(`/payroll/runs/${id}/employees/${employee.id}/verify`, admin, "POST", verification))
      .status,
  ).toBe(200);
  expect(
    (await req(`/payroll/runs/${id}/action`, admin, "POST", { action: "approve", revision }))
      .status,
  ).toBe(200);
  expect(
    (await req(`/payroll/runs/${id}/action`, owner, "POST", { action: "finalize", revision }))
      .status,
  ).toBe(200);
  expect(
    (await req(`/payroll/runs/${id}/action`, owner, "POST", { action: "finalize", revision }))
      .status,
  ).toBe(409);
  expect((await req(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(409);
  expect((await (await req("/payroll/me", employee)).json()).payslips).toHaveLength(0);
  expect(
    (await req(`/payroll/runs/${id}/action`, owner, "POST", { action: "publish", revision }))
      .status,
  ).toBe(200);
  const own = await (await req("/payroll/me", employee)).json();
  expect(own.payslips).toHaveLength(1);
  expect(own.payslips[0].result.netMinor).toBe(2261120);
  expect(
    (await (await req(`/payroll/me?userId=${employee.id}`, manager)).json()).payslips,
  ).toHaveLength(0);
  expect((await req(`/payroll/me/${id}/export`, employee)).status).toBe(200);
  expect((await req(`/payroll/me/${id}/export`, manager)).status).toBe(404);
  expect(
    (await req(`/payroll/runs/${id}/action`, owner, "POST", { action: "mark_paid", revision }))
      .status,
  ).toBe(409);
  expect(
    (
      await req(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "mark_paid",
        revision,
        confirmation: "record_payment",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req("/payroll/compensation", owner, "POST", {
        userId: employee.id,
        effectiveFrom: "2026-09-01",
        salaryMinor: 3000000,
        reason: "Backdated change",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await req("/payroll/settings", owner, "POST", {
        ...settings,
        effectiveFrom: "2026-10-01",
        overtimeBps: 15000,
      })
    ).status,
  ).toBe(200);
  expect((await (await req(`/payroll/runs/${id}`)).json()).employees[0].result.netMinor).toBe(
    2261120,
  );
});

test("Onboarding snapshots templates, protects submissions and activates pending invitations atomically", async () => {
  const template = {
    name: "New hire",
    active: true,
    steps: [
      {
        title: "Policy acknowledgment",
        instructions: "Read and acknowledge the policy",
        group: "Before day one",
        assigneeRole: "employee",
        dueOffsetDays: -1,
        required: true,
        requiresVerification: true,
        requiresAttachment: true,
      },
    ],
  };
  const created = await req("/onboarding/templates", owner, "POST", template);
  expect(created.status).toBe(201);
  const templateId = (await created.json()).id as string;
  const assigned = await req("/onboarding/instances", owner, "POST", {
    templateId,
    userId: employee.id,
    startDate: "2026-10-22",
    hrAssigneeId: owner.id,
  });
  expect(assigned.status).toBe(201);
  const instanceId = (await assigned.json()).id as string;
  const mine = await (await req("/onboarding?view=mine", employee)).json();
  const task = mine.tasks.find((t: { instanceId: string }) => t.instanceId === instanceId);
  expect(task.step.title).toBe("Policy acknowledgment");
  expect(task.dueDate).toBe("2026-10-21");
  expect(
    (
      await req(`/onboarding/templates/${templateId}`, owner, "PUT", {
        ...template,
        steps: [{ ...template.steps[0], title: "Updated policy" }],
      })
    ).status,
  ).toBe(200);
  expect(
    (await (await req("/onboarding?view=mine", employee)).json()).tasks.find(
      (t: { id: string }) => t.id === task.id,
    ).step.title,
  ).toBe("Policy acknowledgment");
  expect(
    (await req(`/onboarding/tasks/${task.id}/action`, employee, "POST", { action: "complete" }))
      .status,
  ).toBe(409);
  const data = Buffer.from("Private acknowledgment");
  const file = await req(`/files/task/${task.id}/uploads`, employee, "POST", {
    name: "acknowledgment.txt",
    mimeType: "text/plain",
    size: data.length,
    checksum: memory.sha(data),
  });
  expect(file.status).toBe(201);
  const fileId = (await file.json()).id as string;
  memory.put(`hr/${owner.workspaceId}/${fileId}/staging`, data, "text/plain");
  expect((await req(`/files/${fileId}/complete`, employee, "POST", {})).status).toBe(200);
  expect((await req(`/files/${fileId}/download`, admin, "POST", {})).status).toBe(404);
  expect((await req(`/onboarding/instances/${instanceId}`, admin)).status).toBe(404);
  expect(
    (await req(`/onboarding/tasks/${task.id}/action`, employee, "POST", { action: "complete" }))
      .status,
  ).toBe(200);
  expect(
    (await req(`/onboarding/tasks/${task.id}/action`, employee, "POST", { action: "verify" }))
      .status,
  ).toBe(403);
  expect(
    (await req(`/onboarding/tasks/${task.id}/action`, owner, "POST", { action: "verify" })).status,
  ).toBe(200);
  const checklists = await (await req("/onboarding?view=checklists")).json();
  expect(checklists.instances.find((i: { id: string }) => i.id === instanceId).status).toBe(
    "completed",
  );
  await database.db.update(user).set({ emailVerified: true }).where(eq(user.id, outsider.id));
  const [prehire] = await database.db.select().from(user).where(eq(user.id, outsider.id));
  const invited = await app.request(`/api/v1/workspaces/${owner.workspaceId}/invitations`, {
    method: "POST",
    headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: owner.cookie },
    body: JSON.stringify({ email: prehire!.email, role: "member" }),
  });
  expect(invited.status).toBe(201);
  const invite = (await invited.json()) as { id: string; token: string };
  expect(
    (
      await req("/onboarding/instances", owner, "POST", {
        templateId,
        invitationId: invite.id,
        startDate: "2026-11-01",
        hrAssigneeId: owner.id,
      })
    ).status,
  ).toBe(201);
  expect((await req("/onboarding?view=mine", outsider)).status).toBe(404);
  const accepted = await app.request("/api/v1/invitations/accept", {
    method: "POST",
    headers: {
      origin: env.WEB_ORIGIN,
      "content-type": "application/json",
      cookie: outsider.cookie,
    },
    body: JSON.stringify({ token: invite.token }),
  });
  expect(accepted.status).toBe(200);
  const joined = await (await req("/onboarding?view=mine", outsider)).json();
  expect(joined.tasks).toHaveLength(1);
  expect(joined.tasks[0].assigneeId).toBe(outsider.id);
  expect(joined.tasks[0].step.title).toBe("Updated policy");
});

test("Sensitive access remains explicit after grants, review history is protected, and removal preserves payroll", async () => {
  await grant(manager.id, "hr.permissions.manage");
  expect((await req("/audit", manager)).status).toBe(403);
  expect(
    (
      await req("/grants", manager, "POST", {
        userId: manager.id,
        capability: "hr.payroll.read_all",
        scope: "workspace",
      })
    ).status,
  ).toBe(403);
  await grant(admin.id, "hr.attendance.read_team", "direct_reports");
  expect((await req(`/attendance?month=2026-10&userId=${employee.id}`, admin)).status).toBe(403);
  await grant(admin.id, "hr.payroll.compensation.manage");
  expect(
    (
      await req(`/people/${owner.id}`, owner, "PUT", {
        jobTitle: "Founder",
        hireDate: "2026-10-01",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req("/schedules", owner, "POST", {
        userId: owner.id,
        effectiveFrom: "2026-10-01",
        weekdays: [1, 2, 3, 4, 5],
        startMinute: 480,
        endMinute: 1020,
        breakMinutes: 60,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req("/payroll/compensation", admin, "POST", {
        userId: owner.id,
        effectiveFrom: "2026-10-01",
        salaryMinor: 4000000,
        reason: "Independently assigned owner compensation",
      })
    ).status,
  ).toBe(200);
  const created = await req("/payroll/runs", owner, "POST", {
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    cutoffDate: "2026-10-31",
    payoutDate: "2026-10-31",
  });
  expect(created.status).toBe(201);
  const id = (await created.json()).id as string;
  expect((await req(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  const detail = await (await req(`/payroll/runs/${id}`)).json();
  expect(detail.employees.some((e: { userId: string }) => e.userId === owner.id)).toBe(false);
  expect((await (await req("/payroll/me")).json()).payslips).toHaveLength(0);
  expect(
    (await req(`/payroll/runs/${id}`, outsider, "GET", undefined, outsider.workspaceId)).status,
  ).toBe(404);
  const remove = await app.request(
    `/api/v1/workspaces/${owner.workspaceId}/members/${employee.id}`,
    {
      method: "DELETE",
      headers: { origin: env.WEB_ORIGIN, "content-type": "application/json", cookie: owner.cookie },
      body: "{}",
    },
  );
  expect(remove.status).toBe(200);
  expect((await req("/payroll/me", employee)).status).toBe(404);
  const runs = await (await req("/payroll/runs")).json();
  const paid = runs.runs.find((r: { status: string }) => r.status === "paid");
  expect(paid).toBeTruthy();
  const historical = await (await req(`/payroll/runs/${paid.id}`)).json();
  expect(historical.employees.some((e: { userId: string }) => e.userId === employee.id)).toBe(true);
});

async function policyLab() {
  const [ws] = await database.db
    .insert(workspace)
    .values({ name: `HR lab ${randomUUID()}`, timezone: "Asia/Manila", currency: "PHP" })
    .returning();
  await database.db.insert(membership).values([
    { workspaceId: ws!.id, userId: owner.id, role: "owner" },
    { workspaceId: ws!.id, userId: admin.id, role: "admin" },
    { workspaceId: ws!.id, userId: employee.id },
    { workspaceId: ws!.id, userId: manager.id },
  ]);
  const request = (path: string, actor = owner, method = "GET", body?: unknown) =>
    req(path, actor, method, body, ws!.id);
  expect(
    (
      await request(`/people/${employee.id}`, owner, "PUT", {
        employeeCode: "LAB001",
        managerId: manager.id,
        hireDate: "2025-01-01",
      })
    ).status,
  ).toBe(200);
  const schedule = {
    userId: employee.id,
    effectiveFrom: "2025-01-01",
    weekdays: [1, 2, 3, 4, 5],
    startMinute: 480,
    endMinute: 1020,
    breakMinutes: 60,
    graceMinutes: 15,
    paidBreaks: false,
  };
  expect((await request("/schedules", owner, "POST", schedule)).status).toBe(200);
  return { id: ws!.id, request, schedule };
}
test("Department and request policy administration cover edits, missing records, blocked routing and required receipts", async () => {
  const { request, id: workspaceId } = await policyLab();
  const department = await request("/departments", owner, "POST", {
    name: "Ops",
    managerId: manager.id,
  });
  expect(department.status).toBe(201);
  const depId = (await department.json()).id as string;
  expect((await request("/departments", owner, "POST", { name: "Ops" })).status).toBe(409);
  expect(
    (await request(`/departments/${depId}`, owner, "PUT", { name: "Operations", archived: true }))
      .status,
  ).toBe(200);
  expect(
    (await request(`/departments/${randomUUID()}`, owner, "PUT", { name: "Unknown" })).status,
  ).toBe(404);
  expect(
    (await request(`/people/${employee.id}`, owner, "PUT", { departmentId: depId })).status,
  ).toBe(404);
  expect((await request("/approval-policies", employee)).status).toBe(403);
  expect(
    (
      await request("/approval-policies", owner, "POST", {
        type: "expense",
        approverIds: [manager.id, admin.id],
        requireAttachment: true,
      })
    ).status,
  ).toBe(200);
  expect((await (await request("/approval-policies")).json()).policies).toHaveLength(1);
  const expense = {
    subject: "Receipt required",
    details: {
      type: "expense",
      amountMinor: 10000,
      currency: "PHP",
      date: "2026-10-01",
      category: "Supplies",
    },
  };
  expect((await request("/requests", employee, "POST", expense)).status).toBe(409);
  const created = await request("/requests", employee, "POST", { ...expense, draft: true });
  const id = (await created.json()).id as string;
  expect(
    (
      await request(`/requests/${id}`, employee, "PUT", {
        ...expense,
        subject: "Edited receipt",
        draft: true,
      })
    ).status,
  ).toBe(200);
  expect((await request(`/requests/${id}`, manager, "PUT", expense)).status).toBe(403);
  expect(
    (await request(`/requests/${id}/action`, employee, "POST", { action: "submit" })).status,
  ).toBe(409);
  expect(
    (
      await request(`/requests/${id}/action`, owner, "POST", {
        action: "reassign",
        approverIds: [],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/requests/${id}/action`, owner, "POST", {
        action: "reassign",
        approverIds: [employee.id],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/requests/${id}/action`, owner, "POST", {
        action: "reassign",
        approverIds: [outsider.id],
      })
    ).status,
  ).toBe(404);
  const upload = await request(`/files/request/${id}/uploads`, employee, "POST", {
    name: "not-an-image.png",
    mimeType: "image/png",
    size: 4,
    checksum: memory.sha(Buffer.from("MZxx")),
  });
  const fileId = (await upload.json()).id as string;
  memory.put(`hr/${workspaceId}/${fileId}/staging`, Buffer.from("MZxx"), "image/png");
  expect((await request(`/files/${fileId}/complete`, employee, "POST", {})).status).toBe(400);
  expect(
    (await request(`/requests/${id}/action`, employee, "POST", { action: "cancel" })).status,
  ).toBe(200);
  const general = await request("/requests", employee, "POST", {
    subject: "Rejectable",
    details: { type: "general" },
  });
  const generalId = (await general.json()).id as string;
  expect(
    (
      await request(`/requests/${generalId}/action`, manager, "POST", {
        action: "reject",
        comment: "Budget unavailable",
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(`/requests/${generalId}/action`, manager, "POST", { action: "reject" })).status,
  ).toBe(200);
  expect(
    (await request(`/requests/${generalId}/action`, manager, "POST", { action: "approve" })).status,
  ).toBe(409);
  expect(
    (await request(`/requests/${generalId}/action`, employee, "POST", { action: "cancel" })).status,
  ).toBe(409);
  expect(
    (
      await request(`/requests/${generalId}/action`, owner, "POST", {
        action: "reassign",
        approverIds: [admin.id],
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(
        `/requests?view=all&status=rejected&type=general&employeeId=${employee.id}&approverId=${manager.id}&fromDate=2025-01-01&toDate=2027-01-01`,
      )
    ).status,
  ).toBe(200);
  const notifications = await (await request("/notifications", employee)).json();
  expect(
    (
      await request(
        `/notifications/${notifications.notifications[0].id}/read`,
        employee,
        "POST",
        {},
      )
    ).status,
  ).toBe(200);
});
test("Leave accrual, carryover expiry, eligibility, half days, unpaid leave and policy snapshots remain consistent", async () => {
  const { request } = await policyLab();
  const initial = {
    name: "Accruing leave",
    paid: true,
    allocationHalfDays: 10,
    accrualHalfDaysMonthly: 2,
    carryoverHalfDays: 4,
    carryoverExpiryMonth: 3,
    effectiveFrom: "2025-01-01",
  };
  const created = await request("/leave/policies", owner, "POST", initial);
  const typeId = (await created.json()).id as string;
  expect((await request("/leave/policies", owner, "POST", initial)).status).toBe(409);
  await request("/leave/balances?year=2025", employee);
  const current = await (await request("/leave/balances?year=2026", employee)).json();
  expect(current.balances[0].balanceHalfDays).toBe(10 + 2 * (new Date().getUTCMonth() + 1));
  expect(
    current.balances[0].ledger.some((l: { source: string }) => l.source === "expiry:2026"),
  ).toBe(true);
  expect((await request("/leave/balances?team=true&year=2026", employee)).status).toBe(403);
  expect((await request("/leave/balances?team=true&year=2026", manager)).status).toBe(200);
  const leave = await request("/requests", employee, "POST", {
    subject: "Half day",
    details: {
      type: "leave",
      leaveTypeId: typeId,
      startDate: "2026-10-22",
      endDate: "2026-10-22",
      halfDay: true,
    },
  });
  expect(leave.status).toBe(201);
  const id = (await leave.json()).id as string;
  expect(
    (
      await request(`/leave/policies/${typeId}`, owner, "PUT", {
        ...initial,
        paid: false,
        allowHalfDay: false,
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(`/requests/${id}/action`, manager, "POST", { action: "approve" })).status,
  ).toBe(200);
  const approved = await (await request("/requests?view=mine", employee)).json();
  expect(approved.requests[0].details.paid).toBe(true);
  expect(approved.requests[0].details.policyVersion).toBe(1);
  expect(
    (await request(`/requests/${id}/action`, employee, "POST", { action: "cancel" })).status,
  ).toBe(200);
  expect(
    (
      await request("/requests", employee, "POST", {
        subject: "Disallowed half",
        details: {
          type: "leave",
          leaveTypeId: typeId,
          startDate: "2026-10-23",
          endDate: "2026-10-23",
          halfDay: true,
        },
      })
    ).status,
  ).toBe(400);
  const unpaid = await request("/leave/policies", owner, "POST", {
    name: "Unpaid",
    paid: false,
    allocationHalfDays: 0,
    enforceBalance: false,
    effectiveFrom: "2025-01-01",
  });
  const unpaidId = (await unpaid.json()).id as string;
  const requestLeave = await request("/requests", employee, "POST", {
    subject: "Unpaid day",
    details: {
      type: "leave",
      leaveTypeId: unpaidId,
      startDate: "2026-10-23",
      endDate: "2026-10-23",
    },
  });
  expect(requestLeave.status).toBe(201);
  const unpaidRequest = (await requestLeave.json()).id as string;
  expect(
    (await request(`/requests/${unpaidRequest}/action`, manager, "POST", { action: "approve" }))
      .status,
  ).toBe(200);
  expect(
    (
      await request("/leave/adjustments", owner, "POST", {
        userId: employee.id,
        leaveTypeId: randomUUID(),
        year: 2026,
        amountHalfDays: 2,
        reason: "Missing policy",
        idempotencyKey: randomUUID(),
      })
    ).status,
  ).toBe(404);
  expect(
    (await request(`/leave/policies/${typeId}`, owner, "PUT", { ...initial, archived: true }))
      .status,
  ).toBe(200);
  expect(
    (
      await request("/requests", employee, "POST", {
        subject: "Archived",
        details: {
          type: "leave",
          leaveTypeId: typeId,
          startDate: "2026-10-26",
          endDate: "2026-10-26",
        },
      })
    ).status,
  ).toBe(400);
});
test("Attendance aggregates split shifts without inventing lateness and scopes filtered team exports", async () => {
  const lab = await policyLab();
  const base = {
    workspaceId: lab.id,
    userId: employee.id,
    workDate: "2026-10-20",
    timezone: "Asia/Manila",
    schedule: lab.schedule,
    breaks: [],
  };
  await database.db.insert(hrShift).values([
    {
      ...base,
      clockIn: new Date("2026-10-20T00:00:00Z"),
      clockOut: new Date("2026-10-20T04:00:00Z"),
    },
    {
      ...base,
      clockIn: new Date("2026-10-20T05:00:00Z"),
      clockOut: new Date("2026-10-20T09:00:00Z"),
    },
  ]);
  const report = await (await lab.request("/attendance?month=2026-10", employee)).json();
  const day = report.days.find((d: { date: string }) => d.date === "2026-10-20");
  expect(day.workedMinutes).toBe(480);
  expect(day.late).toBe(false);
  expect(day.lateMinutes).toBe(0);
  expect((await lab.request("/attendance?month=2026-10&team=true", employee)).status).toBe(403);
  expect(
    (await lab.request("/attendance?month=2026-10&team=true&status=absent", manager)).status,
  ).toBe(200);
  expect(
    (
      await lab.request(
        `/attendance/export?month=2026-10&team=true&departmentId=${randomUUID()}`,
        manager,
      )
    ).status,
  ).toBe(200);
  expect((await lab.request("/attendance?month=invalid", employee)).status).toBe(400);
  expect((await lab.request("/schedules", employee)).status).toBe(403);
  expect((await lab.request("/schedules", owner, "POST", lab.schedule)).status).toBe(409);
  expect(
    (await lab.request("/schedules", owner, "POST", { ...lab.schedule, userId: outsider.id }))
      .status,
  ).toBe(404);
});

test("Payroll supports classified adjustments, independent revisions, void-and-reissue and effective workday rates", async () => {
  const { id: workspaceId, request, schedule } = await policyLab();
  const period = {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    cutoffDate: "2026-09-30",
    payoutDate: "2026-09-30",
  };
  expect((await request("/payroll/runs", owner, "POST", period)).status).toBe(409);
  const settings = {
    effectiveFrom: "2026-01-01",
    frequency: "monthly",
    currency: "PHP",
    workingDaysPerYear: 261,
    minutesPerDay: 480,
    overtimeBps: 12500,
    holidayBps: 20000,
    restDayBps: 13000,
    nightDifferentialBps: 1000,
    deductUndertime: false,
    publishOnFinalize: true,
    payoutDay: 30,
    reason: "Verified business rules",
  };
  expect((await request("/payroll/settings", owner, "POST", settings)).status).toBe(200);
  await configureStatutory(request);
  expect((await request("/payroll/settings", owner, "POST", settings)).status).toBe(409);
  expect(
    (await request("/payroll/runs", owner, "POST", { ...period, endDate: "2026-09-15" })).status,
  ).toBe(400);
  expect(
    (await request("/payroll/runs", owner, "POST", { ...period, cutoffDate: "2026-08-31" })).status,
  ).toBe(400);
  const created = await request("/payroll/runs", owner, "POST", period);
  expect(created.status).toBe(201);
  const id = (await created.json()).id as string;
  expect((await request("/payroll/runs", owner, "POST", period)).status).toBe(409);
  expect((await request(`/payroll/runs/${id}/calculate`, admin, "POST", {})).status).toBe(403);
  expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  let detail = await (await request(`/payroll/runs/${id}`)).json();
  expect(detail.run.warnings).not.toHaveLength(0);
  expect(
    (
      await request("/payroll/compensation", owner, "POST", {
        userId: outsider.id,
        effectiveFrom: "2026-01-01",
        salaryMinor: 1,
        reason: "Not a member",
      })
    ).status,
  ).toBe(404);
  for (const [effectiveFrom, salaryMinor] of [
    ["2026-01-01", 2500000],
    ["2026-09-16", 3000000],
  ] as const)
    expect(
      (
        await request("/payroll/compensation", owner, "POST", {
          userId: employee.id,
          effectiveFrom,
          salaryMinor,
          reason: "Effective compensation",
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await request("/payroll/compensation", owner, "POST", {
        userId: employee.id,
        effectiveFrom: "2026-01-01",
        salaryMinor: 2500000,
        reason: "Duplicate date",
      })
    ).status,
  ).toBe(409);
  await request("/holidays", owner, "POST", { date: "2026-09-01", name: "Lab holiday" });
  await database.db.insert(hrShift).values({
    workspaceId,
    userId: employee.id,
    workDate: "2026-09-03",
    clockIn: new Date("2026-09-03T00:00:00Z"),
    clockOut: new Date("2026-09-03T11:00:00Z"),
    timezone: "Asia/Manila",
    schedule,
    breaks: [{ start: "2026-09-03T04:00:00Z", end: "2026-09-03T05:00:00Z" }],
  });
  const overtime = await request("/requests", employee, "POST", {
    subject: "Approved extra time",
    details: { type: "overtime", date: "2026-09-03", durationMinutes: 120 },
  });
  const overtimeId = (await overtime.json()).id as string;
  expect(
    (await request(`/requests/${overtimeId}/action`, manager, "POST", { action: "approve" }))
      .status,
  ).toBe(200);
  const purchase = await request("/requests", employee, "POST", {
    subject: "Purchase",
    details: {
      type: "purchase",
      amountMinor: 10000,
      currency: "PHP",
      quantity: 1,
      vendor: "Supplier",
    },
  });
  const purchaseId = (await purchase.json()).id as string;
  await request(`/requests/${purchaseId}/action`, manager, "POST", { action: "approve" });
  const adjustment = {
    userId: employee.id,
    label: "Reviewed reimbursement",
    amountMinor: 10000,
    classification: "earning_nontaxable",
    reason: "Receipt independently checked",
    idempotencyKey: randomUUID(),
  };
  expect(
    (
      await request(`/payroll/runs/${id}/adjustments`, owner, "POST", {
        ...adjustment,
        userId: owner.id,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(`/payroll/runs/${id}/adjustments`, owner, "POST", {
        ...adjustment,
        sourceRequestId: purchaseId,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/payroll/runs/${id}/adjustments`, owner, "POST", {
        ...adjustment,
        sourceRequestId: randomUUID(),
      })
    ).status,
  ).toBe(404);
  for (let i = 0; i < 2; i++)
    expect(
      (await request(`/payroll/runs/${id}/adjustments`, owner, "POST", adjustment)).status,
    ).toBe(200);
  expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  detail = await (await request(`/payroll/runs/${id}`)).json();
  const result = detail.employees[0].result;
  expect(result.lines.find((l: { label: string }) => l.label === "Basic pay").amountMinor).toBe(
    2761905,
  );
  expect(
    result.lines.find((l: { label: string }) => l.label === "Approved overtime").amountMinor,
  ).toBe(35920);
  expect(
    result.lines.filter((l: { label: string }) => l.label === "Reviewed reimbursement"),
  ).toHaveLength(1);
  expect(detail.employees[0].snapshot.compensationSources).toHaveLength(2);
  await request("/grants", owner, "POST", {
    userId: admin.id,
    capability: "hr.payroll.runs.approve",
    scope: "workspace",
  });
  await request("/grants", owner, "POST", {
    userId: admin.id,
    capability: "hr.payroll.read_all",
    scope: "workspace",
  });
  const verify = {
    revision: detail.run.revision,
    expectedNetMinor: result.netMinor,
    reference: "Reviewed every line and official contribution tables with source records",
    confirmed: true,
  };
  expect(
    (await request(`/payroll/runs/${id}/employees/${admin.id}/verify`, admin, "POST", verify))
      .status,
  ).toBe(403);
  expect(
    (await request(`/payroll/runs/${id}/employees/${randomUUID()}/verify`, admin, "POST", verify))
      .status,
  ).toBe(404);
  expect(
    (
      await request(`/payroll/runs/${id}/employees/${employee.id}/verify`, admin, "POST", {
        ...verify,
        revision: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (await request(`/payroll/runs/${id}/employees/${employee.id}/verify`, admin, "POST", verify))
      .status,
  ).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "return_to_draft",
        revision: verify.revision,
      })
    ).status,
  ).toBe(200);
  await request(`/payroll/runs/${id}/calculate`, owner, "POST", {});
  detail = await (await request(`/payroll/runs/${id}`)).json();
  expect(detail.employees[0].verifiedBy).toBeNull();
  verify.revision = detail.run.revision;
  await request(`/payroll/runs/${id}/employees/${employee.id}/verify`, admin, "POST", verify);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, admin, "POST", {
        action: "approve",
        revision: verify.revision,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${id}/adjustments`, owner, "POST", {
        ...adjustment,
        idempotencyKey: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "finalize",
        revision: verify.revision - 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "finalize",
        revision: verify.revision,
      })
    ).status,
  ).toBe(200);
  expect((await (await request("/payroll/me", employee)).json()).payslips).toHaveLength(1);
  expect(
    (await request(`/requests/${overtimeId}/action`, employee, "POST", { action: "cancel" }))
      .status,
  ).toBe(409);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "return_to_draft",
        revision: verify.revision,
      })
    ).status,
  ).toBe(409);
  expect((await request(`/payroll/runs/${id}/export`)).status).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "void",
        revision: verify.revision,
        reason: "Incorrect employee inputs; reissue after correction",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "void",
        revision: verify.revision,
        reason: "Already voided",
      })
    ).status,
  ).toBe(409);
  const replacement = await request("/payroll/runs", owner, "POST", {
    ...period,
    replacesRunId: id,
    reason: "Reissue after documented correction",
  });
  expect(replacement.status).toBe(201);
});
test("Onboarding handles role assignments, independent verification, reopening and archived templates", async () => {
  const { request } = await policyLab();
  const step = {
    title: "Policy",
    instructions: "Read carefully",
    group: "Day one",
    assigneeRole: "employee",
    dueOffsetDays: 0,
    required: true,
    requiresVerification: false,
  };
  const template = await request("/onboarding/templates", owner, "POST", {
    name: "Role checklist",
    steps: [
      step,
      { ...step, title: "Manager review", assigneeRole: "manager", requiresVerification: true },
      { ...step, title: "HR form", assigneeRole: "hr", requiresVerification: true },
      { ...step, title: "IT optional", assigneeRole: "it", required: false },
    ],
  });
  const templateId = (await template.json()).id as string;
  expect((await request("/onboarding/templates", employee)).status).toBe(403);
  const assignment = await request("/onboarding/instances", owner, "POST", {
    templateId,
    userId: employee.id,
    startDate: "2026-10-21",
    hrAssigneeId: owner.id,
  });
  const id = (await assignment.json()).id as string;
  const detail = await (await request(`/onboarding/instances/${id}`)).json();
  const tasks = detail.tasks as {
    id: string;
    assigneeId: string | null;
    step: { title: string };
    status: string;
  }[];
  const employeeTask = tasks.find((t) => t.step.title === "Policy")!,
    managerTask = tasks.find((t) => t.step.title === "Manager review")!,
    hrTask = tasks.find((t) => t.step.title === "HR form")!,
    itTask = tasks.find((t) => t.step.title === "IT optional")!;
  expect(
    (
      await request(`/onboarding/tasks/${employeeTask.id}/action`, employee, "POST", {
        action: "complete",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/onboarding/tasks/${employeeTask.id}/action`, employee, "POST", {
        action: "complete",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/onboarding/tasks/${employeeTask.id}/action`, owner, "POST", {
        action: "verify",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`/onboarding/tasks/${employeeTask.id}/action`, owner, "POST", {
        action: "reopen",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/onboarding/tasks/${employeeTask.id}/action`, owner, "POST", {
        action: "reopen",
        comment: "Correct acknowledgment",
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(`/onboarding/tasks/${itTask.id}/action`, owner, "POST", { action: "reassign" }))
      .status,
  ).toBe(400);
  expect(
    (
      await request(`/onboarding/tasks/${itTask.id}/action`, owner, "POST", {
        action: "reassign",
        assigneeId: admin.id,
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(`/onboarding/tasks/${itTask.id}/action`, admin, "POST", { action: "complete" }))
      .status,
  ).toBe(200);
  expect(
    (await request(`/onboarding/tasks/${hrTask.id}/action`, owner, "POST", { action: "complete" }))
      .status,
  ).toBe(200);
  expect(
    (await request(`/onboarding/tasks/${hrTask.id}/action`, owner, "POST", { action: "verify" }))
      .status,
  ).toBe(403);
  expect(
    (
      await request(`/onboarding/tasks/${managerTask.id}/action`, manager, "POST", {
        action: "complete",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/onboarding/tasks/${managerTask.id}/action`, owner, "POST", {
        action: "verify",
      })
    ).status,
  ).toBe(200);
  expect((await request("/onboarding?view=checklists", manager)).status).toBe(200);
  expect((await request("/onboarding?view=checklists", admin)).status).toBe(403);
  expect(
    (
      await request(`/onboarding/templates/${templateId}`, owner, "PUT", {
        name: "Archived",
        active: false,
        steps: [step],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request("/onboarding/instances", owner, "POST", {
        templateId,
        userId: employee.id,
        startDate: "2026-10-21",
        hrAssigneeId: owner.id,
      })
    ).status,
  ).toBe(404);
  expect((await request(`/onboarding/instances/${randomUUID()}`, employee)).status).toBe(404);
  expect(
    (
      await request(`/onboarding/tasks/${randomUUID()}/action`, employee, "POST", {
        action: "complete",
      })
    ).status,
  ).toBe(404);
  const blockedUpload = await request(`/files/task/${managerTask.id}/uploads`, manager, "POST", {
    name: "late.txt",
    mimeType: "text/plain",
    size: 4,
    checksum: memory.sha(Buffer.from("late")),
  });
  expect(blockedUpload.status).toBe(409);
});

test("Payroll snapshots unpaid leave, holiday/rest-day premiums, night work and semimonthly settings", async () => {
  const { id: workspaceId, request, schedule } = await policyLab();
  const night = {
    ...schedule,
    effectiveFrom: "2026-09-03",
    startMinute: 1320,
    endMinute: 360,
    breakMinutes: 0,
  };
  await request("/schedules", owner, "POST", night);
  const settings = {
    effectiveFrom: "2026-01-01",
    frequency: "semimonthly",
    currency: "PHP",
    workingDaysPerYear: 261,
    minutesPerDay: 480,
    overtimeBps: 12500,
    holidayBps: 20000,
    restDayBps: 13000,
    nightDifferentialBps: 1000,
    deductUndertime: false,
    publishOnFinalize: false,
    payoutDay: 30,
    reason: "Semimonthly fixture",
  };
  expect((await request("/payroll/settings", owner, "POST", settings)).status).toBe(200);
  await configureStatutory(request);
  await request("/payroll/compensation", owner, "POST", {
    userId: employee.id,
    effectiveFrom: "2026-01-01",
    salaryMinor: 2500000,
    reason: "Monthly salary",
    allowances: [{ label: "Taxable transport", amountMinor: 10000, taxable: true }],
  });
  await request("/holidays", owner, "POST", { date: "2026-09-04", name: "Holiday" });
  const type = await request("/leave/policies", owner, "POST", {
    name: "Unpaid",
    paid: false,
    allocationHalfDays: 0,
    enforceBalance: false,
    effectiveFrom: "2026-01-01",
  });
  const typeId = (await type.json()).id as string;
  const leave = await request("/requests", employee, "POST", {
    subject: "Unpaid day",
    details: { type: "leave", leaveTypeId: typeId, startDate: "2026-09-02", endDate: "2026-09-02" },
  });
  await request(`/requests/${(await leave.json()).id}/action`, manager, "POST", {
    action: "approve",
  });
  for (const date of ["2026-09-04", "2026-09-05"]) {
    const work = await request("/requests", employee, "POST", {
      subject: "Approved special-day work",
      details: { type: "overtime", date, durationMinutes: 480 },
    });
    await request(`/requests/${(await work.json()).id}/action`, manager, "POST", {
      action: "approve",
    });
    await database.db.insert(hrShift).values({
      workspaceId,
      userId: employee.id,
      workDate: date,
      timezone: "Asia/Manila",
      schedule: night,
      clockIn: new Date(`${date}T14:00:00Z`),
      clockOut: new Date(new Date(`${date}T14:00:00Z`).getTime() + 8 * 3600000),
      breaks: [],
    });
  }
  const created = await request("/payroll/runs", owner, "POST", {
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    cutoffDate: "2026-09-15",
    payoutDate: "2026-09-15",
  });
  expect(created.status).toBe(201);
  const id = (await created.json()).id as string;
  expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  const detail = await (await request(`/payroll/runs/${id}`)).json();
  const lines = detail.employees[0].result.lines as { label: string; amountMinor: number }[];
  for (const label of [
    "Unpaid leave",
    "Approved holiday work",
    "Approved rest-day work",
    "Night differential",
    "Taxable transport",
  ])
    expect(lines.find((l) => l.label === label)?.amountMinor).toBeGreaterThan(0);
  const source = detail.employees[0].snapshot.input;
  expect(source.holidayMinutes).toBe(480);
  expect(source.restMinutes).toBe(480);
  expect(source.nightMinutes).toBe(960);
  expect(
    (
      await request(`/payroll/runs/${id}/action`, owner, "POST", {
        action: "publish",
        revision: detail.run.revision,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/payroll/runs", owner, "POST", {
        startDate: "2026-09-16",
        endDate: "2026-09-30",
        cutoffDate: "2026-09-30",
        payoutDate: "2026-09-30",
      })
    ).status,
  ).toBe(201);
});
test("Private upload state rejects bad metadata, unauthorized writers and unknown targets", async () => {
  const { id: workspaceId, request } = await policyLab();
  const draft = await request("/requests", employee, "POST", {
    subject: "Private draft",
    details: { type: "general" },
    draft: true,
  });
  const id = (await draft.json()).id as string;
  const data = Buffer.from("document");
  const input = {
    name: "document.txt",
    mimeType: "text/plain",
    size: data.length,
    checksum: memory.sha(data),
  };
  expect((await request(`/files/request/${id}/uploads`, manager, "POST", input)).status).toBe(403);
  expect((await request(`/files/unknown/${id}/uploads`, employee, "POST", input)).status).toBe(404);
  expect((await request(`/files/${randomUUID()}/download`, employee, "POST", {})).status).toBe(404);
  const upload = await request(`/files/request/${id}/uploads`, employee, "POST", input);
  const fileId = (await upload.json()).id as string;
  memory.put(`hr/${workspaceId}/${fileId}/staging`, Buffer.from("bad"), "text/plain");
  expect((await request(`/files/${fileId}/complete`, employee, "POST", {})).status).toBe(400);
  memory.put(`hr/${workspaceId}/${fileId}/staging`, data, "text/plain");
  expect((await request(`/files/${fileId}/complete`, employee, "POST", {})).status).toBe(200);
  expect((await request(`/files/${fileId}/complete`, employee, "POST", {})).status).toBe(200);
  expect((await request(`/files/${fileId}/download`, manager, "POST", {})).status).toBe(200);
  expect((await request(`/files/${fileId}/download`, admin, "POST", {})).status).toBe(404);
  await request(`/requests/${id}/action`, employee, "POST", { action: "submit" });
  await request(`/requests/${id}/action`, manager, "POST", { action: "approve" });
  expect((await request(`/files/request/${id}/uploads`, employee, "POST", input)).status).toBe(403);
});

test("Leave reserves other pending dates, requires documents and validates eligibility and missing policies", async () => {
  const { id: workspaceId, request } = await policyLab();
  const created = await request("/leave/policies", owner, "POST", {
    name: "Limited",
    paid: true,
    allocationHalfDays: 2,
    effectiveFrom: "2026-01-01",
    requireDocumentation: true,
  });
  const typeId = (await created.json()).id as string;
  const input = {
    subject: "Documented leave",
    details: { type: "leave", leaveTypeId: typeId, startDate: "2026-10-22", endDate: "2026-10-22" },
  };
  const draft = await request("/requests", employee, "POST", { ...input, draft: true });
  const id = (await draft.json()).id as string;
  expect(
    (await request(`/requests/${id}/action`, employee, "POST", { action: "submit" })).status,
  ).toBe(400);
  const bytes = Buffer.from("evidence");
  const upload = await request(`/files/request/${id}/uploads`, employee, "POST", {
    name: "evidence.txt",
    size: bytes.length,
    mimeType: "text/plain",
    checksum: memory.sha(bytes),
  });
  const fileId = (await upload.json()).id as string;
  memory.put(`hr/${workspaceId}/${fileId}/staging`, bytes, "text/plain");
  await request(`/files/${fileId}/complete`, employee, "POST", {});
  expect(
    (await request(`/requests/${id}/action`, employee, "POST", { action: "submit" })).status,
  ).toBe(200);
  expect(
    (
      await request("/requests", employee, "POST", {
        ...input,
        details: { ...input.details, startDate: "2026-10-23", endDate: "2026-10-23" },
      })
    ).status,
  ).toBe(409);
  const pending = await (await request("/leave/balances?team=true&year=2026", manager)).json();
  expect(pending.balances.some((b: { pendingHalfDays: number }) => b.pendingHalfDays === 2)).toBe(
    true,
  );
  expect(
    (
      await request(`/leave/policies/${randomUUID()}`, owner, "PUT", {
        name: "Unknown",
        paid: true,
        allocationHalfDays: 2,
        effectiveFrom: "2026-01-01",
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request("/requests", employee, "POST", {
        ...input,
        details: { ...input.details, leaveTypeId: randomUUID() },
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(`/people/${employee.id}`, owner, "PUT", {
        hireDate: "2026-10-01",
        managerId: manager.id,
      })
    ).status,
  ).toBe(200);
  const delayed = await request("/leave/policies", owner, "POST", {
    name: "Probation",
    paid: true,
    allocationHalfDays: 20,
    eligibleAfterDays: 90,
    effectiveFrom: "2026-01-01",
  });
  expect(
    (
      await request("/requests", employee, "POST", {
        ...input,
        details: { ...input.details, leaveTypeId: (await delayed.json()).id },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/grants", owner, "POST", {
        userId: manager.id,
        capability: "hr.attendance.read_team",
        scope: "direct_reports",
      })
    ).status,
  ).toBe(200);
  expect((await request("/attendance?month=2026-10&team=true", manager)).status).toBe(200);
  expect(
    (
      await request("/grants", owner, "POST", {
        userId: manager.id,
        capability: "hr.attendance.read_team",
        scope: "workspace",
        revoke: true,
      })
    ).status,
  ).toBe(200);
  expect((await request("/people?q=LAB&limit=1")).status).toBe(200);
  const page = await (await request("/people?limit=1")).json();
  expect(page.nextOffset).toBe(1);
  const audit = await (await request("/audit?limit=1")).json();
  expect(audit.nextOffset).toBe(1);
  expect((await request(`/requests/${randomUUID()}/history`, employee)).status).toBe(404);
  expect((await request(`/requests/${id}`, employee, "PUT", input)).status).toBe(409);
});

test("Payroll schedule suggestions, selected estimates, durable payout reminders and API documentation respect authorization", async () => {
  const { id, request } = await policyLab();
  expect((await request("/payroll/schedule", admin)).status).toBe(403);
  expect((await (await request("/payroll/schedule")).json()).period).toBeNull();
  expect((await (await request("/payroll/me", employee)).json()).estimate).toBeNull();
  const settings = {
    effectiveFrom: "2025-01-01",
    frequency: "monthly",
    currency: "PHP",
    workingDaysPerYear: 261,
    minutesPerDay: 480,
    overtimeBps: 12500,
    holidayBps: 20000,
    restDayBps: 13000,
    deductUndertime: false,
    payoutDay: 31,
    reason: "Independent calendar test",
  };
  expect((await request("/payroll/settings", owner, "POST", settings)).status).toBe(200);
  await configureStatutory(request);
  expect((await (await request("/payroll/schedule")).json()).period).toMatchObject({
    startDate: expect.stringMatching(/-01$/),
  });
  expect((await request("/payroll/me?periodStart=2026-09-02", employee)).status).toBe(400);
  expect((await request("/payroll/me?periodStart=invalid", employee)).status).toBe(400);
  expect(
    (
      await request("/payroll/compensation", owner, "POST", {
        userId: employee.id,
        effectiveFrom: "2026-01-01",
        salaryMinor: 2500000,
        reason: "Fixture salary",
      })
    ).status,
  ).toBe(200);
  const estimate = await (await request("/payroll/me?periodStart=2026-09-01", employee)).json();
  expect(estimate.estimatePeriod).toBe("2026-09-01 – 2026-09-30");
  expect(estimate.estimate.netMinor).toBeGreaterThan(0);
  const [run] = await database.db
    .insert(hrPayrollRun)
    .values({
      workspaceId: id,
      createdBy: owner.id,
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      cutoffDate: "2025-01-31",
      payoutDate: "2025-01-31",
      status: "finalized",
    })
    .returning();
  const notifications = async () => (await request("/notifications")).json();
  const first = await notifications();
  const reminder = first.notifications.filter(
    (n: { title: string }) => n.title === "Payroll payout is due",
  );
  expect(reminder).toHaveLength(1);
  expect((await notifications()).notifications).toEqual(first.notifications);
  expect((await (await request("/notifications", admin)).json()).notifications).toEqual([]);
  await request(`/notifications/${reminder[0].id}/read`, owner, "POST", {});
  expect((await notifications()).notifications[0].readAt).toBeTruthy();
  await database.db
    .update(hrPayrollRun)
    .set({ status: "paid" })
    .where(eq(hrPayrollRun.id, run!.id));
  expect((await notifications()).notifications).toHaveLength(1);
  const doc = await (await app.request("/api/openapi.json")).json();
  expect(
    doc.paths["/api/v1/workspaces/{workspaceId}/hr/payroll/runs/{id}/action"].post.security,
  ).toEqual([{ cookieAuth: [] }]);
  expect(doc.paths["/api/v1/workspaces/{workspaceId}/hr/requests"].post.requestBody).toBeTruthy();
});

test("Payroll blocks missing and incomplete sources while preserving prorated, paid-break and night-work evidence", async () => {
  const { id, request, schedule } = await policyLab();
  const settings = {
    effectiveFrom: "2025-01-01",
    frequency: "monthly",
    currency: "PHP",
    workingDaysPerYear: 261,
    minutesPerDay: 480,
    overtimeBps: 12500,
    holidayBps: 20000,
    restDayBps: 13000,
    nightDifferentialBps: 1000,
    deductUndertime: false,
    payoutDay: 31,
    reason: "Unusual time inputs",
  };
  await request("/payroll/settings", owner, "POST", settings);
  await configureStatutory(request);
  await request(`/people/${employee.id}`, owner, "PUT", {
    hireDate: "2026-09-10",
    endDate: "2026-09-20",
    managerId: manager.id,
  });
  await request(`/people/${admin.id}`, owner, "PUT", { employmentType: "contractor" });
  await request("/schedules", owner, "POST", {
    ...schedule,
    effectiveFrom: "2026-09-15",
    paidBreaks: true,
  });
  await request("/payroll/compensation", owner, "POST", {
    userId: employee.id,
    effectiveFrom: "2026-09-15",
    salaryMinor: 2500000,
    reason: "Partial coverage fixture",
  });
  const base = { workspaceId: id, userId: employee.id, timezone: "Asia/Manila" };
  await database.db.insert(hrShift).values([
    {
      ...base,
      workDate: "2026-09-15",
      schedule,
      clockIn: new Date("2026-09-15T14:00:00Z"),
      clockOut: new Date("2026-09-15T22:00:00Z"),
      breaks: [{ start: "2026-09-15T16:00:00Z", end: "2026-09-15T17:00:00Z" }],
    },
    {
      ...base,
      workDate: "2026-09-16",
      schedule: { ...schedule, paidBreaks: true },
      clockIn: new Date("2026-09-16T14:00:00Z"),
      clockOut: new Date("2026-09-16T22:00:00Z"),
      breaks: [{ start: "2026-09-16T16:00:00Z", end: null }],
    },
    {
      ...base,
      workDate: "2026-09-17",
      schedule: null,
      clockIn: new Date("2026-09-17T14:00:00Z"),
      clockOut: new Date("2026-09-18T15:00:00Z"),
      breaks: [{ start: "2026-09-17T16:00:00Z", end: null }],
    },
    {
      ...base,
      workDate: "2026-09-18",
      schedule,
      clockIn: new Date("2026-09-18T14:00:00Z"),
      clockOut: null,
      breaks: [{ start: "2026-09-18T16:00:00Z", end: null }],
    },
  ]);
  const correction = await request("/requests", employee, "POST", {
    subject: "Correct day shift",
    details: {
      type: "attendance_correction",
      date: "2026-09-16",
      clockIn: "2026-09-16T00:00:00Z",
      clockOut: "2026-09-16T09:00:00Z",
      breakMinutes: 60,
    },
  });
  expect(
    (
      await request(`/requests/${(await correction.json()).id}/action`, manager, "POST", {
        action: "approve",
      })
    ).status,
  ).toBe(200);
  const created = await request("/payroll/runs", owner, "POST", {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    cutoffDate: "2026-09-30",
    payoutDate: "2026-09-30",
  });
  const runId = (await created.json()).id as string;
  expect((await request(`/payroll/runs/${runId}/calculate`, owner, "POST", {})).status).toBe(200);
  const detail = await (await request(`/payroll/runs/${runId}`)).json();
  expect(detail.run.warnings.join(" ")).toContain("Compensation does not cover");
  expect(detail.run.warnings.join(" ")).toContain("24 hours");
  expect(detail.run.warnings.join(" ")).toContain("incomplete");
  expect(detail.employees).toHaveLength(1);
  expect(detail.employees[0].result.warnings.join(" ")).toContain("Prorated");
  expect(detail.employees[0].result.warnings.join(" ")).toContain("corrected breaks");
  expect(detail.employees[0].snapshot.input.nightMinutes).toBeGreaterThan(0);
  const personal = await request("/payroll/me?periodStart=2026-09-01", owner);
  expect((await personal.json()).estimate).toBeNull();
});

test("Directory filters apply before pagination without exposing confidential fields", async () => {
  const { request } = await policyLab();
  const department = await request("/departments", owner, "POST", { name: "Filtered team" });
  const id = (await department.json()).id as string;
  await request(`/people/${employee.id}`, owner, "PUT", { departmentId: id, status: "on_leave" });
  const result = await (
    await request(`/people?departmentId=${id}&status=on_leave&limit=1`, admin)
  ).json();
  expect(result.people).toHaveLength(1);
  expect(result.people[0].userId).toBe(employee.id);
  expect(result.nextOffset).toBeNull();
  expect(JSON.stringify(result)).not.toMatch(/salary|compensation|email|tax/);
  expect((await (await request(`/people?departmentId=${randomUUID()}`)).json()).people).toEqual([]);
  expect((await request("/people?status=invalid")).status).toBe(400);
});

test("Employment termination and closed payroll source corrections require deliberate history", async () => {
  const { id, request } = await policyLab();
  expect(
    (await request(`/people/${employee.id}`, owner, "PUT", { status: "terminated" })).status,
  ).toBe(400);
  expect(
    (
      await request(`/people/${employee.id}`, owner, "PUT", {
        status: "terminated",
        endDate: "2026-09-30",
        managerId: manager.id,
      })
    ).status,
  ).toBe(200);
  const expense = await request("/requests", employee, "POST", {
    subject: "Closed source",
    details: {
      type: "expense",
      amountMinor: 1000,
      currency: "PHP",
      date: "2026-09-01",
      category: "Travel expense",
    },
  });
  expect(expense.status).toBe(201);
  const sourceId = (await expense.json()).id as string;
  expect(
    (await request(`/requests/${sourceId}/action`, manager, "POST", { action: "approve" })).status,
  ).toBe(200);
  const [run] = await database.db
    .insert(hrPayrollRun)
    .values({
      workspaceId: id,
      createdBy: owner.id,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      cutoffDate: "2026-09-30",
      payoutDate: "2026-09-30",
      status: "finalized",
    })
    .returning();
  await database.db.insert(hrPayrollAdjustment).values({
    workspaceId: id,
    runId: run!.id,
    userId: employee.id,
    sourceRequestId: sourceId,
    data: {},
    actorId: owner.id,
    idempotencyKey: randomUUID(),
  });
  expect(
    (await request(`/requests/${sourceId}/action`, employee, "POST", { action: "cancel" })).status,
  ).toBe(409);
  expect(
    (
      await request("/payroll/settings", owner, "POST", {
        effectiveFrom: "2026-10-01",
        frequency: "monthly",
        currency: "PHP",
        workingDaysPerYear: 261,
        minutesPerDay: 480,
        overtimeBps: 12500,
        holidayBps: 20000,
        restDayBps: 13000,
        deductUndertime: false,
        payoutDay: 31,
        reason: "New period fixture",
      })
    ).status,
  ).toBe(200);
  await database.db
    .update(hrPayrollRun)
    .set({ status: "voided" })
    .where(eq(hrPayrollRun.id, run!.id));
  const [voided] = await database.db
    .insert(hrPayrollRun)
    .values({
      workspaceId: id,
      createdBy: owner.id,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      cutoffDate: "2026-10-31",
      payoutDate: "2026-10-31",
      status: "voided",
    })
    .returning();
  const period = {
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    cutoffDate: "2026-10-31",
    payoutDate: "2026-10-31",
  };
  expect((await request("/payroll/runs", owner, "POST", period)).status).toBe(409);
  expect(
    (
      await request("/payroll/runs", owner, "POST", {
        ...period,
        replacesRunId: voided!.id,
        reason: "Controlled replacement with original evidence",
      })
    ).status,
  ).toBe(201);
});

test("statutory settings are explicit, workspace-scoped, effective-dated and protected by payroll capabilities", async () => {
  const { request } = await policyLab();
  const path = "/payroll/statutory-configurations";
  const draft = statutoryConfigurationsSchema.parse(await (await request(path)).json());
  expect(draft.configurations).toEqual([]);
  for (const actor of [admin, manager, employee]) {
    expect((await request(path, actor)).status).toBe(403);
    expect((await request(path, actor, "POST", draft.template)).status).toBe(403);
  }
  expect((await request(path, outsider)).status).toBe(404);
  await request("/grants", owner, "POST", {
    userId: manager.id,
    capability: "hr.permissions.manage",
    scope: "workspace",
  });
  expect((await request(path, manager)).status).toBe(403);
  expect((await request(path, owner, "POST", { ...draft.template, confirmed: false })).status).toBe(
    400,
  );
  expect(
    (await request(path, owner, "POST", { ...draft.template, effectiveFrom: "2026-01-16" })).status,
  ).toBe(400);
  const rules = await configureStatutory(request);
  expect((await request(path, owner, "POST", rules)).status).toBe(409);
  await request("/grants", owner, "POST", {
    userId: admin.id,
    capability: "hr.payroll.settings.manage",
    scope: "workspace",
  });
  expect((await request(path, admin)).status).toBe(200);
  const next = {
    ...rules,
    effectiveFrom: "2027-01-01",
    validThrough: "2027-12-31",
    label: "New year reviewed rules",
  };
  expect((await request(path, admin, "POST", next)).status).toBe(200);
  const saved = statutoryConfigurationsSchema.parse(await (await request(path)).json());
  expect(saved.configurations).toHaveLength(2);
  expect(saved.configurations[0]).toMatchObject(next);
  expect(saved.configurations[1]).toMatchObject(rules);
  const audit = await (await request("/audit")).json();
  expect(
    audit.events.filter((e: { action: string }) => e.action === "statutory_configuration.changed"),
  ).toHaveLength(2);
  expect((await (await req(path)).json()).configurations).toHaveLength(1);
});

async function statutoryPayrollLab(frequency = "monthly") {
  const lab = await policyLab();
  const settings = {
    effectiveFrom: "2026-01-01",
    frequency,
    currency: "PHP",
    workingDaysPerYear: 261,
    minutesPerDay: 480,
    overtimeBps: 12500,
    holidayBps: 20000,
    restDayBps: 13000,
    nightDifferentialBps: 0,
    deductUndertime: false,
    publishOnFinalize: true,
    payoutDay: 30,
    reason: "Reviewed statutory integration policy",
  };
  expect((await lab.request("/payroll/settings", owner, "POST", settings)).status).toBe(200);
  expect(
    (
      await lab.request("/payroll/compensation", owner, "POST", {
        userId: employee.id,
        effectiveFrom: "2026-01-01",
        salaryMinor: 2500000,
        reason: "Reviewed salary fixture",
      })
    ).status,
  ).toBe(200);
  await lab.request("/grants", owner, "POST", {
    userId: admin.id,
    capability: "hr.payroll.runs.approve",
    scope: "workspace",
  });
  await lab.request("/grants", owner, "POST", {
    userId: admin.id,
    capability: "hr.payroll.read_all",
    scope: "workspace",
  });
  return lab;
}
async function releaseStatutoryRun(request: typeof req, runId: string) {
  const detail = await (await request(`/payroll/runs/${runId}`)).json();
  expect(detail.run.warnings).toEqual([]);
  expect(
    (
      await request(`/payroll/runs/${runId}/employees/${employee.id}/verify`, admin, "POST", {
        revision: detail.run.revision,
        expectedNetMinor: detail.employees[0].result.netMinor,
        confirmed: true,
        reference: "Independently reconciled statutory tables and source payroll lines",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${runId}/action`, admin, "POST", {
        action: "approve",
        revision: detail.run.revision,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${runId}/action`, owner, "POST", {
        action: "finalize",
        revision: detail.run.revision,
      })
    ).status,
  ).toBe(200);
  return await (await request(`/payroll/runs/${runId}`)).json();
}
test("configured rules drive generated payroll, invalidate open approvals and preserve finalized snapshots", async () => {
  const { request } = await statutoryPayrollLab();
  const period = {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    cutoffDate: "2026-09-30",
    payoutDate: "2026-09-30",
  };
  const created = await request("/payroll/runs", owner, "POST", period),
    id = (await created.json()).id as string;
  expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(409);
  const rules = await configureStatutory(request, "2026-01-01");
  expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  const before = await (await request(`/payroll/runs/${id}`)).json();
  expect(before.employees[0].result.netMinor).toBe(2261120);
  const changed = structuredClone(rules);
  changed.effectiveFrom = "2026-09-01";
  changed.sss.employeeBps = 400;
  changed.sss.mpfEmployeeBps = 400;
  changed.philhealth.totalBps = 400;
  changed.bir.monthly = [{ thresholdMinor: 0, fixedMinor: 0, bps: 0 }];
  expect((await request("/payroll/statutory-configurations", owner, "POST", changed)).status).toBe(
    200,
  );
  const invalidated = await (await request(`/payroll/runs/${id}`)).json();
  expect(invalidated.run.status).toBe("draft");
  expect(invalidated.run.revision).toBeGreaterThan(before.run.revision);
  expect(invalidated.employees).toEqual([]);
  expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
  const calculated = await (await request(`/payroll/runs/${id}`)).json();
  expect(calculated.employees[0].result.netMinor).toBe(2330000);
  expect(calculated.employees[0].snapshot.rules).toEqual(changed);
  const closed = await releaseStatutoryRun(request, id);
  expect(
    (
      await request("/payroll/statutory-configurations", owner, "POST", {
        ...rules,
        effectiveFrom: "2026-08-01",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/payroll/statutory-configurations", owner, "POST", {
        ...rules,
        effectiveFrom: "2026-10-01",
      })
    ).status,
  ).toBe(200);
  expect(await (await request(`/payroll/runs/${id}`)).json()).toEqual(closed);
  const future = await request("/payroll/runs", owner, "POST", {
    startDate: "2027-01-01",
    endDate: "2027-01-31",
    cutoffDate: "2027-01-31",
    payoutDate: "2027-01-31",
  });
  const futureId = (await future.json()).id as string;
  expect((await request(`/payroll/runs/${futureId}/calculate`, owner, "POST", {})).status).toBe(
    409,
  );
  const own = await (await request("/payroll/me?periodStart=2027-01-01", employee)).json();
  expect(own.estimate).toBeNull();
  expect(own.estimateUnavailableReason).toContain("entire payroll period");
  expect(own.payslips[0].result).toEqual(closed.employees[0].result);
});

test("actual remuneration reconciles finalized first-cutoff earnings exactly once at month-end", async () => {
  const { request } = await statutoryPayrollLab("semimonthly");
  const { template } = statutoryConfigurationsSchema.parse(
    await (await request("/payroll/statutory-configurations")).json(),
  );
  expect(
    (
      await request("/payroll/statutory-configurations", owner, "POST", {
        ...template,
        effectiveFrom: "2026-01-01",
      })
    ).status,
  ).toBe(200);
  const create = async (start: string, end: string) => {
    const reply = await request("/payroll/runs", owner, "POST", {
      startDate: start,
      endDate: end,
      cutoffDate: end,
      payoutDate: end,
    });
    expect(reply.status).toBe(201);
    return (await reply.json()).id as string;
  };
  const first = await create("2026-09-01", "2026-09-15"),
    second = await create("2026-09-16", "2026-09-30");
  await request(`/payroll/runs/${second}/calculate`, owner, "POST", {});
  const incomplete = await (await request(`/payroll/runs/${second}`)).json();
  expect(incomplete.run.warnings.join(" ")).toContain("Finalize the first cutoff");
  await request(`/payroll/runs/${first}/adjustments`, owner, "POST", {
    userId: employee.id,
    label: "Taxable incentive",
    amountMinor: 500000,
    classification: "earning_taxable",
    reason: "Approved monthly incentive",
    idempotencyKey: randomUUID(),
  });
  await request(`/payroll/runs/${first}/calculate`, owner, "POST", {});
  const firstClosed = await releaseStatutoryRun(request, first);
  expect(
    firstClosed.employees[0].result.lines.find((l: { label: string }) => l.label === "SSS")
      .amountMinor,
  ).toBe(0);
  await request(`/payroll/runs/${second}/calculate`, owner, "POST", {});
  const monthEnd = await (await request(`/payroll/runs/${second}`)).json();
  expect(monthEnd.employees[0].snapshot.priorRunId).toBe(first);
  expect(monthEnd.employees[0].snapshot.input.priorRemunerationMinor).toBe(1750000);
  expect(
    monthEnd.employees[0].result.lines.find((l: { label: string }) => l.label === "SSS MPF")
      .amountMinor,
  ).toBe(50000);
  const once = monthEnd.employees[0].result;
  await request(`/payroll/runs/${second}/calculate`, owner, "POST", {});
  expect((await (await request(`/payroll/runs/${second}`)).json()).employees[0].result).toEqual(
    once,
  );
  await releaseStatutoryRun(request, second);
  expect(
    (
      await request(`/payroll/runs/${first}/action`, owner, "POST", {
        action: "void",
        revision: firstClosed.run.revision,
        reason: "Cannot invalidate closed month reconciliation",
      })
    ).status,
  ).toBe(409);
});

test("voiding a source cutoff prevents finalizing an already approved month-end calculation", async () => {
  const { request } = await statutoryPayrollLab("semimonthly");
  const { template } = statutoryConfigurationsSchema.parse(
    await (await request("/payroll/statutory-configurations")).json(),
  );
  await request("/payroll/statutory-configurations", owner, "POST", template);
  const create = async (start: string, end: string) =>
    (
      await (
        await request("/payroll/runs", owner, "POST", {
          startDate: start,
          endDate: end,
          cutoffDate: end,
          payoutDate: end,
        })
      ).json()
    ).id as string;
  const first = await create("2026-09-01", "2026-09-15");
  await request(`/payroll/runs/${first}/calculate`, owner, "POST", {});
  const source = await releaseStatutoryRun(request, first);
  const second = await create("2026-09-16", "2026-09-30");
  await request(`/payroll/runs/${second}/calculate`, owner, "POST", {});
  const detail = await (await request(`/payroll/runs/${second}`)).json();
  await request(`/payroll/runs/${second}/employees/${employee.id}/verify`, admin, "POST", {
    revision: detail.run.revision,
    expectedNetMinor: detail.employees[0].result.netMinor,
    confirmed: true,
    reference: "Independently reconciled with the currently finalized first cutoff",
  });
  expect(
    (
      await request(`/payroll/runs/${second}/action`, admin, "POST", {
        action: "approve",
        revision: detail.run.revision,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/payroll/runs/${first}/action`, owner, "POST", {
        action: "void",
        revision: source.run.revision,
        reason: "Source payroll requires controlled reissue",
      })
    ).status,
  ).toBe(200);
  const blocked = await request(`/payroll/runs/${second}/action`, owner, "POST", {
    action: "finalize",
    revision: detail.run.revision,
  });
  expect(blocked.status).toBe(409);
  expect((await blocked.json()).error.code).toBe("PAYROLL_RECONCILIATION_CHANGED");
});
test("actual-remuneration collection handles second-cutoff hires and first-cutoff departures", async () => {
  for (const hire of [true, false]) {
    const { request } = await statutoryPayrollLab("semimonthly");
    const { template } = statutoryConfigurationsSchema.parse(
      await (await request("/payroll/statutory-configurations")).json(),
    );
    await request("/payroll/statutory-configurations", owner, "POST", template);
    await request(`/people/${employee.id}`, owner, "PUT", {
      hireDate: hire ? "2026-09-16" : "2026-01-01",
      endDate: hire ? null : "2026-09-10",
      managerId: manager.id,
    });
    const end = hire ? "2026-09-30" : "2026-09-15";
    const created = await request("/payroll/runs", owner, "POST", {
      startDate: hire ? "2026-09-16" : "2026-09-01",
      endDate: end,
      cutoffDate: end,
      payoutDate: end,
    });
    const id = (await created.json()).id as string;
    expect((await request(`/payroll/runs/${id}/calculate`, owner, "POST", {})).status).toBe(200);
    const detail = await (await request(`/payroll/runs/${id}`)).json();
    expect(detail.run.warnings).toEqual([]);
    expect(detail.employees[0].snapshot.input.finalCollection).toBe(!hire);
    expect(
      detail.employees[0].result.lines.find((l: { label: string }) => l.label === "SSS")
        .amountMinor,
    ).toBeGreaterThan(0);
  }
});
