import {
  approvalSchema,
  compensationSchema,
  leavePolicySchema,
  onboardingStepSchema,
  payrollResultSchema,
  personSchema,
  type HrAccess,
} from "@lumolynk/contracts/hr";
import type {
  StatutoryConfiguration,
  StatutoryConfigurationInput,
} from "@lumolynk/contracts/payroll";

import { mockApi, teamId, bobId } from "./mock-api";
export const hrId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  hrSecond = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hrThird = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const createdAt = "2026-10-21T08:00:00.000Z";
function statutoryFixture(): StatutoryConfigurationInput {
  const policy = {
    enabled: true,
    exemptionReason: "",
    rounding: "nearest_centavo",
    collection: "split",
    salaryBasis: "monthly_basic",
  } as const;
  return {
    label: "Reviewed Philippine rules",
    effectiveFrom: "2026-01-01",
    validThrough: "2026-12-31",
    reason: "Reviewed official circulars",
    confirmed: true,
    sources: [{ title: "Official sources", url: "https://www.sss.gov.ph/pay-contribution/" }],
    sss: {
      ...policy,
      employeeBps: 500,
      employerBps: 1000,
      mpfEmployeeBps: 500,
      mpfEmployerBps: 1000,
      minimumCreditMinor: 500000,
      maximumCreditMinor: 3500000,
      regularCreditCapMinor: 2000000,
      ecEnabled: true,
      brackets: [
        { fromMinor: 0, toMinor: 1000000, salaryCreditMinor: 500000, ecMinor: 1000 },
        { fromMinor: 1000000, toMinor: null, salaryCreditMinor: 3500000, ecMinor: 3000 },
      ],
    },
    pagibig: {
      ...policy,
      compensationCapMinor: 1000000,
      employeeCapMinor: null,
      employerCapMinor: null,
      brackets: [{ fromMinor: 0, toMinor: null, employeeBps: 200, employerBps: 200 }],
    },
    philhealth: {
      ...policy,
      totalBps: 500,
      employeeShareBps: 5000,
      employerShareBps: 5000,
      floorMinor: 1000000,
      ceilingMinor: 10000000,
      premiumCapMinor: null,
    },
    bir: {
      enabled: true,
      exemptionReason: "",
      rounding: "nearest_centavo",
      monthly: [
        { thresholdMinor: 0, fixedMinor: 0, bps: 0 },
        { thresholdMinor: 2083300, fixedMinor: 0, bps: 1500 },
      ],
      semimonthly: [{ thresholdMinor: 0, fixedMinor: 0, bps: 0 }],
    },
  };
}
export function hrFixture() {
  const server = mockApi(),
    base = `/api/v1/workspaces/${teamId}/hr`,
    actor = server.state.user.id;
  const person = (userId: string, name: string) =>
    personSchema.parse({
      userId,
      name,
      image: null,
      role: userId === actor ? "owner" : "member",
      employeeCode: userId === actor ? "A001" : "B001",
      jobTitle: "Engineer",
      departmentId: hrId,
      department: "Engineering",
      managerId: userId === actor ? null : actor,
      employmentType: "employee",
      status: "active",
      hireDate: "2026-01-01",
      endDate: null,
      location: "Manila",
    });
  const policy = leavePolicySchema.parse({
    id: hrId,
    version: 1,
    name: "Vacation",
    paid: true,
    allocationHalfDays: 30,
    effectiveFrom: "2026-01-01",
  });
  const result = payrollResultSchema.parse({
    grossMinor: 2500000,
    deductionsMinor: 238880,
    netMinor: 2261120,
    employerMinor: 335500,
    lines: [
      {
        label: "Basic pay",
        kind: "earning",
        amountMinor: 2500000,
        source: "compensation snapshot",
      },
      { label: "SSS", kind: "deduction", amountMinor: 125000, source: "PH fixture" },
      { label: "Employer SSS", kind: "employer", amountMinor: 250000, source: "PH fixture" },
    ],
    warnings: ["Independent review required"],
  });
  const step = onboardingStepSchema.parse({
    title: "Read policy",
    instructions: "Acknowledge the employee policy",
    group: "Before day one",
    assigneeRole: "employee",
    dueOffsetDays: 0,
    required: true,
    requiresVerification: true,
    requiresAttachment: false,
  });
  const run = {
    id: hrId,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    payoutDate: "2026-09-30",
    cutoffDate: "2026-09-30",
    status: "calculated",
    revision: 1,
    createdBy: bobId,
    publishedAt: null,
    ruleVersion: "PH fixture",
    warnings: [] as string[],
    replacesRunId: null,
  };
  const state = {
    statutoryConfigurations: [] as StatutoryConfiguration[],
    access: {
      userId: actor,
      owner: true,
      grants: [],
      hasReports: true,
      timezone: "Asia/Manila",
      currency: "PHP",
    } as HrAccess,
    people: [person(actor, "Alice Chen"), person(bobId, "Bob Rivera")],
    departments: [
      { id: hrId, name: "Engineering", managerId: actor, archived: false, employeeCount: 2 },
    ],
    requests: [
      approvalSchema.parse({
        id: hrId,
        requesterId: bobId,
        subject: "Review expense",
        description: "Work materials",
        priority: "high",
        details: {
          type: "expense",
          amountMinor: 100000,
          currency: "PHP",
          date: "2026-10-21",
          category: "Materials",
        },
        status: "pending",
        approverIds: [actor],
        currentStep: 0,
        blockedReason: null,
        createdAt,
        submittedAt: createdAt,
      }),
      approvalSchema.parse({
        id: hrSecond,
        requesterId: actor,
        subject: "My draft",
        description: "Please review",
        priority: "normal",
        details: { type: "general" },
        status: "draft",
        approverIds: [bobId],
        currentStep: 0,
        blockedReason: "Assign an approver",
        createdAt,
        submittedAt: null,
      }),
    ],
    policies: [policy],
    out: [
      { id: hrId, userId: bobId, startDate: "2026-10-22", endDate: "2026-10-23", status: "away" },
    ],
    attendance: {
      days: [
        {
          userId: actor,
          date: "2026-10-21",
          scheduled: "08:00–17:00",
          clockIn: createdAt,
          clockOut: null,
          breakMinutes: 30,
          workedMinutes: 450,
          lateMinutes: 16,
          late: true,
          undertimeMinutes: 30,
          overtimeMinutes: 0,
          approvedOvertimeMinutes: 0,
          status: "incomplete",
          correctionId: null,
        },
        {
          userId: bobId,
          date: "2026-10-21",
          scheduled: "08:00–17:00",
          clockIn: null,
          clockOut: null,
          breakMinutes: 0,
          workedMinutes: 0,
          lateMinutes: 0,
          late: false,
          undertimeMinutes: 480,
          overtimeMinutes: 0,
          approvedOvertimeMinutes: 0,
          status: "absent",
          correctionId: null,
        },
      ],
      state: "out",
      serverTime: createdAt,
      timezone: "Asia/Manila",
      metrics: { daysPresent: 1, lateArrivals: 1, workedMinutes: 450, absences: 1 },
    },
    compensations: [
      compensationSchema.parse({
        id: hrId,
        userId: bobId,
        effectiveFrom: "2026-01-01",
        salaryMinor: 2500000,
        reason: "Initial pay",
        allowances: [],
        actorId: actor,
        createdAt,
      }),
    ],
    run,
    result,
    estimate: result as typeof result | null,
    payslips: [
      {
        runId: hrId,
        startDate: run.startDate,
        endDate: run.endDate,
        payoutDate: run.payoutDate,
        status: "paid",
        result,
      },
    ],
    templates: [{ id: hrId, name: "Welcome", active: true, version: 1, steps: [step] }],
    tasks: [
      {
        id: hrId,
        instanceId: hrSecond,
        assigneeId: actor,
        step,
        dueDate: "2026-10-22",
        status: "todo",
      },
      {
        id: hrThird,
        instanceId: hrSecond,
        assigneeId: bobId,
        step: { ...step, title: "ID submission", assigneeRole: "hr" as const },
        dueDate: "2026-10-22",
        status: "submitted",
      },
    ],
    instances: [
      {
        id: hrSecond,
        name: "Welcome",
        userId: actor,
        invitationId: null,
        startDate: "2026-10-22",
        ownerId: actor,
        version: 1,
        completed: 0,
        total: 2,
        status: "in_progress",
      },
    ],
    verified: false,
  };
  const get = (path: string, handler: Parameters<typeof server.state.overrides.set>[1]) =>
    server.state.overrides.set(`GET ${base}${path}`, handler);
  const post = (
    path: string,
    handler: Parameters<typeof server.state.overrides.set>[1] = () => server.json({ ok: true }),
  ) => server.state.overrides.set(`POST ${base}${path}`, handler);
  get("/access", () => server.json(state.access));
  get("/people", (_body, url) => {
    const q = url.searchParams.get("q") ?? "";
    return server.json({
      people: state.people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
      nextOffset: null,
    });
  });
  get("/departments", () => server.json({ departments: state.departments }));
  for (const id of [actor, bobId])
    server.state.overrides.set(`PUT ${base}/people/${id}`, () => server.json({ ok: true }));
  post("/departments");
  server.state.overrides.set(`PUT ${base}/departments/${hrId}`, () => server.json({ ok: true }));
  get("/requests", (_body, url) => {
    const view = url.searchParams.get("view"),
      type = url.searchParams.get("type");
    return server.json({
      requests: state.requests.filter(
        (r) =>
          (!type || r.details.type === type) &&
          (view === "all" || view === "mine"
            ? view === "all" || r.requesterId === actor
            : r.status === "pending" && r.approverIds[r.currentStep] === actor),
      ),
      nextOffset: null,
    });
  });
  for (const request of state.requests) {
    get(`/requests/${request.id}/history`, () =>
      server.json({
        events: [
          { id: hrThird, actorId: bobId, action: "commented", comment: "Please review", createdAt },
        ],
        files: [{ id: hrThird, name: "receipt.txt", size: 4, mimeType: "text/plain" }],
      }),
    );
    post(`/requests/${request.id}/comments`);
    post(`/requests/${request.id}/action`, (body) => {
      if (body.action === "approve") request.status = "approved";
      if (body.action === "reject") request.status = "rejected";
      if (body.action === "cancel") request.status = "cancelled";
      if (body.action === "submit") request.status = "pending";
      return server.json({ ok: true });
    });
    server.state.overrides.set(`PUT ${base}/requests/${request.id}`, () =>
      server.json({ ok: true }),
    );
  }
  post("/requests", () => server.json({ ok: true, id: hrSecond }, 201));
  post(`/files/${hrThird}/download`, () =>
    server.json({ url: "https://bucket.s3.us-east-1.amazonaws.com/hr-file" }),
  );
  get("/leave/policies", () => server.json({ policies: state.policies }));
  post("/leave/policies");
  server.state.overrides.set(`PUT ${base}/leave/policies/${hrId}`, () => server.json({ ok: true }));
  post("/leave/adjustments");
  get("/leave/balances", (_body, url) =>
    server.json({
      balances: (url.searchParams.get("team") === "true" ? [actor, bobId] : [actor]).map(
        (userId) => ({
          userId,
          leaveTypeId: hrId,
          name: "Vacation",
          paid: true,
          balanceHalfDays: 30,
          pendingHalfDays: 2,
          usedHalfDays: 0,
          ledger: [
            { id: hrId, amountHalfDays: 30, source: "opening:2026", reason: "Opening", createdAt },
          ],
        }),
      ),
    }),
  );
  get("/leave/out", () => server.json({ absences: state.out }));
  get("/attendance", () => server.json(state.attendance));
  post("/attendance/punch", (body) => {
    state.attendance.state =
      body.action === "clock_out" ? "out" : body.action === "start_break" ? "break" : "working";
    return server.json({ ok: true });
  });
  const csv = () => server.json({ filename: "hr.csv", content: "Name,Amount\r\nBob,100" });
  get("/attendance/export", csv);
  get("/schedules", () =>
    server.json({
      schedules: [
        {
          id: hrId,
          userId: bobId,
          effectiveFrom: "2026-01-01",
          weekdays: [1, 2, 3, 4, 5],
          startMinute: 480,
          endMinute: 1020,
          breakMinutes: 60,
          graceMinutes: 15,
          paidBreaks: false,
          timezone: "Asia/Manila",
        },
      ],
    }),
  );
  post("/schedules");
  get("/holidays", () => server.json({ holidays: [{ date: "2026-10-23", name: "Holiday" }] }));
  post("/holidays");
  get("/payroll/me", () =>
    server.json({
      payslips: state.payslips,
      estimate: state.estimate,
      estimatePeriod: "2026-10-01 – 2026-10-31",
    }),
  );
  get(`/payroll/me/${hrId}/export`, csv);
  get("/payroll/schedule", () =>
    server.json({
      period: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        cutoffDate: "2026-10-31",
        payoutDate: "2026-10-31",
      },
    }),
  );
  get("/payroll/runs", () => server.json({ runs: [state.run] }));
  post("/payroll/runs");
  get(`/payroll/runs/${hrId}`, () =>
    server.json({
      run: state.run,
      employees: [
        {
          userId: bobId,
          result: state.result,
          verifiedBy: state.verified ? actor : null,
          verificationReference: state.verified ? "Checked primary tables" : null,
          snapshot: { input: { basicMinor: 2500000 } },
        },
      ],
    }),
  );
  post(`/payroll/runs/${hrId}/calculate`);
  post(`/payroll/runs/${hrId}/employees/${bobId}/verify`, () => {
    state.verified = true;
    return server.json({ ok: true });
  });
  post(`/payroll/runs/${hrId}/adjustments`);
  post(`/payroll/runs/${hrId}/action`, (body) => {
    const statuses: Record<string, string> = {
      approve: "approved",
      finalize: "finalized",
      mark_paid: "paid",
      return_to_draft: "draft",
      void: "voided",
    };
    if (typeof body.action === "string" && statuses[body.action])
      state.run.status = statuses[body.action]!;
    return server.json({ ok: true });
  });
  get(`/payroll/runs/${hrId}/export`, csv);
  get("/payroll/compensation", () => server.json({ compensations: state.compensations }));
  post("/payroll/compensation");
  get("/payroll/statutory-configurations", () =>
    server.json({ configurations: state.statutoryConfigurations, template: statutoryFixture() }),
  );
  post("/payroll/statutory-configurations", (body) => {
    state.statutoryConfigurations.unshift({
      ...(body as StatutoryConfigurationInput),
      id: hrId,
      actorId: actor,
      createdAt,
    });
    return server.json({ ok: true });
  });
  get("/payroll/settings", () =>
    server.json({
      settings: [],
      rules: {
        version: "PH fixture",
        effectiveFrom: "2025-01-01",
        effectiveTo: "2026-12-31",
        reviewStatus: "requires_independent_review",
        sources: [{ title: "Official sources", url: "https://www.sss.gov.ph/pay-contribution/" }],
      },
    }),
  );
  post("/payroll/settings");
  get("/grants", () =>
    server.json({
      grants: [{ userId: bobId, capability: "hr.people.manage", scope: "workspace" }],
    }),
  );
  post("/grants");
  get("/onboarding/templates", () => server.json({ templates: state.templates }));
  post("/onboarding/templates");
  server.state.overrides.set(`PUT ${base}/onboarding/templates/${hrId}`, () =>
    server.json({ ok: true }),
  );
  get("/onboarding/invitations", () =>
    server.json({
      invitations: [{ id: hrId, email: "invited@example.com", expiresAt: "2027-01-01T00:00:00Z" }],
    }),
  );
  post("/onboarding/instances");
  get("/onboarding", () => server.json({ instances: state.instances, tasks: state.tasks }));
  get(`/onboarding/instances/${hrSecond}`, () =>
    server.json({
      tasks: state.tasks,
      events: [
        {
          id: hrId,
          taskId: hrId,
          actorId: actor,
          action: "assigned",
          comment: "Start here",
          createdAt,
        },
      ],
      files: [{ id: hrThird, targetId: hrId, name: "policy.txt" }],
    }),
  );
  for (const task of state.tasks)
    post(`/onboarding/tasks/${task.id}/action`, (body) => {
      if (body.action === "complete") task.status = "submitted";
      if (body.action === "verify") task.status = "verified";
      if (body.action === "reopen") task.status = "todo";
      return server.json({ ok: true });
    });
  get("/notifications", () =>
    server.json({
      notifications: [
        {
          id: hrId,
          title: "Request waiting",
          module: "approvals",
          targetId: hrId,
          readAt: null,
          createdAt,
        },
      ],
    }),
  );
  post(`/notifications/${hrId}/read`);
  get("/approval-policies", () =>
    server.json({
      policies: [{ type: "expense", approverIds: [actor, bobId], requireAttachment: true }],
    }),
  );
  post("/approval-policies");
  get("/audit", () =>
    server.json({
      events: [
        {
          id: hrId,
          actorId: actor,
          action: "permissions.changed",
          targetId: bobId,
          data: { after: { capability: "hr.people.manage" } },
          createdAt,
        },
      ],
      nextOffset: null,
    }),
  );
  return { server, state, base, get, post };
}
