import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, type Page } from "@playwright/test";

type Reply = { status: number; body: unknown };
async function api(page: Page, path: string, method = "GET", body?: unknown): Promise<Reply> {
  return page.evaluate(
    async (input) => {
      const bridge = (
        window as unknown as {
          lumo?: {
            request: (path: string, options: { method: string; body?: unknown }) => Promise<Reply>;
          };
        }
      ).lumo;
      if (bridge)
        return bridge.request(`/api/v1${input.path}`, { method: input.method, body: input.body });
      const response = await fetch(`http://localhost:3011/api/v1${input.path}`, {
        method: input.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name, exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function select(page: Page, label: string, name: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
/** Primary HR workflows run against the real server in browser, mobile and Electron. */
export async function verifyHr(owner: Page, colleague: Page, screenshot: (name: string) => string) {
  const errors: string[] = [];
  owner.on("pageerror", (error) => errors.push(error.message));
  colleague.on("pageerror", (error) => errors.push(error.message));
  const email = `hr-colleague-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await colleague.goto("http://localhost:3010/register");
  await colleague.getByLabel("Full name").fill("HR Colleague");
  await colleague.getByLabel("Email address").fill(email);
  await colleague.getByLabel("Password", { exact: true }).fill("Strong-hr-test-password-2026!");
  await colleague.getByRole("button", { name: "Create account" }).click();
  await expect(colleague).toHaveURL(/\/w\/[a-f0-9-]+/);
  let verification = "";
  await expect
    .poll(async () => {
      for (const file of await readdir(resolve(".local/e2e-mail"))) {
        const mail = JSON.parse(await readFile(resolve(".local/e2e-mail", file), "utf8")) as {
          to: string;
          url: string;
        };
        if (mail.to === email) verification = mail.url;
      }
      return !!verification;
    })
    .toBe(true);
  await colleague.goto(verification);
  await expect(colleague).toHaveURL(/\/workspaces$/);
  const me = (await api(owner, "/me")).body as { user: { id: string }; activeWorkspaceId: string };
  const workspaceId = me.activeWorkspaceId;
  const invited = await api(owner, `/workspaces/${workspaceId}/invitations`, "POST", {
    email,
    role: "member",
  });
  expect(invited.status).toBe(201);
  const token = (invited.body as { token: string }).token;
  expect((await api(colleague, "/invitations/accept", "POST", { token })).status).toBe(200);
  const teammate = (await api(colleague, "/me")).body as {
    user: { id: string };
    activeWorkspaceId: string;
  };
  const base = `/workspaces/${workspaceId}/hr`;
  const configure = async (path: string, body: unknown, status = 200) => {
    const result = await api(owner, `${base}${path}`, "POST", body);
    expect(result.status).toBe(status);
    return result.body;
  };
  expect(
    (
      await api(owner, `${base}/people/${teammate.user.id}`, "PUT", {
        employeeCode: "HR001",
        jobTitle: "Engineer",
        managerId: me.user.id,
        hireDate: "2026-01-01",
      })
    ).status,
  ).toBe(200);
  await configure("/schedules", {
    userId: teammate.user.id,
    effectiveFrom: "2026-01-01",
    weekdays: [1, 2, 3, 4, 5],
    startMinute: 480,
    endMinute: 1020,
    breakMinutes: 60,
  });
  const policy = (await configure(
    "/leave/policies",
    { name: "Vacation", paid: true, allocationHalfDays: 30, effectiveFrom: "2026-01-01" },
    201,
  )) as { id: string };
  await navigate(owner, "People");
  await expect(owner.getByRole("heading", { name: "HR Colleague", exact: true })).toBeVisible();
  await owner.screenshot({ path: screenshot("people"), fullPage: true });
  const colleagueOrigin = new URL(colleague.url()).origin;
  await colleague.goto(`${colleagueOrigin}/w/${workspaceId}/leave`);
  await expect(colleague.getByRole("heading", { name: "Leave", exact: true })).toBeVisible();
  await colleague.getByRole("button", { name: "Request leave", exact: true }).click();
  await colleague.getByLabel("Subject", { exact: true }).fill("HR end-to-end leave");
  await select(colleague, "Leave category", "Vacation");
  let day = new Date(Date.now() + 86400000);
  while ([0, 6].includes(day.getUTCDay())) day = new Date(day.getTime() + 86400000);
  const leaveDate = day.toISOString().slice(0, 10);
  await colleague.getByLabel("Start date", { exact: true }).fill(leaveDate);
  await colleague.getByLabel("End date", { exact: true }).fill(leaveDate);
  await colleague.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(colleague.getByRole("dialog")).toHaveCount(0);
  await navigate(owner, "Approvals");
  await expect(owner.getByRole("heading", { name: "HR end-to-end leave" })).toBeVisible();
  await owner.getByRole("button", { name: "View request", exact: true }).click();
  await owner.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await owner.screenshot({ path: screenshot("approvals"), fullPage: true });
  await colleague.reload();
  await expect(colleague.getByText("14 days left", { exact: true })).toBeVisible();
  await colleague.screenshot({ path: screenshot("leave"), fullPage: true });
  await navigate(owner, "Attendance");
  await owner.getByRole("button", { name: "Clock in", exact: true }).click();
  await owner.getByRole("button", { name: "Start break", exact: true }).click();
  await owner.getByRole("button", { name: "End break", exact: true }).click();
  await owner.getByRole("button", { name: "Clock out", exact: true }).click();
  await expect(owner.getByRole("button", { name: "Clock in", exact: true })).toBeVisible();
  await owner.screenshot({ path: screenshot("attendance"), fullPage: true });
  await configure("/payroll/settings", {
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
    reason: "E2E fixture business settings",
  });
  const statutory = (
    await api(owner, `/workspaces/${workspaceId}/hr/payroll/statutory-configurations`)
  ).body as { template: unknown };
  await configure("/payroll/statutory-configurations", statutory.template);
  await configure("/payroll/compensation", {
    userId: teammate.user.id,
    effectiveFrom: "2026-01-01",
    salaryMinor: 2500000,
    reason: "E2E fixture salary",
  });
  await configure("/grants", {
    userId: teammate.user.id,
    capability: "hr.payroll.runs.manage",
    scope: "workspace",
  });
  const run = (await configure(
    "/payroll/runs",
    {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      cutoffDate: "2026-09-30",
      payoutDate: "2026-09-30",
    },
    201,
  )) as { id: string };
  expect(
    (await api(colleague, `${base}/payroll/runs/${run.id}/calculate`, "POST", {})).status,
  ).toBe(200);
  await navigate(owner, "Payroll");
  await owner.getByRole("button", { name: "Pay Runs", exact: true }).click();
  await owner.getByRole("button", { name: "Review run", exact: true }).click();
  await owner.getByLabel("Independently checked net amount (centavos)").fill("2261120");
  await owner
    .getByLabel("Reviewer evidence and statutory/source references")
    .fill("E2E test fixture confirmation, not production accounting sign-off");
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Record independent verification" }).click();
  await expect(owner.getByText(/Verified · E2E test fixture confirmation/)).toBeVisible();
  await owner.getByRole("button", { name: "Approve verified run" }).click();
  await owner.getByRole("button", { name: "Finalize payroll", exact: true }).click();
  await owner.getByRole("button", { name: "Confirm finalize payroll" }).click();
  await owner.getByRole("button", { name: "Publish payslips", exact: true }).click();
  await owner.getByRole("button", { name: "Confirm publish payslips" }).click();
  await owner.getByRole("button", { name: "Close dialog" }).click();
  await owner.screenshot({ path: screenshot("payroll"), fullPage: true });
  await navigate(colleague, "Payroll");
  await expect(colleague.getByRole("button", { name: "Download payslip CSV" })).toBeVisible();
  expect((await api(colleague, `${base}/payroll/compensation`)).status).toBe(403);
  const template = (await configure(
    "/onboarding/templates",
    {
      name: "E2E welcome",
      steps: [
        {
          title: "Acknowledge team policy",
          instructions: "Read the team policy",
          group: "First day",
          assigneeRole: "employee",
          dueOffsetDays: 0,
          required: true,
        },
      ],
    },
    201,
  )) as { id: string };
  await configure(
    "/onboarding/instances",
    {
      templateId: template.id,
      userId: teammate.user.id,
      startDate: leaveDate,
      hrAssigneeId: me.user.id,
    },
    201,
  );
  await navigate(colleague, "Onboarding");
  await colleague.getByRole("button", { name: "Open checklist", exact: true }).click();
  await colleague.getByRole("button", { name: "Complete task", exact: true }).click();
  await expect(colleague.getByRole("dialog").getByText("completed", { exact: true })).toBeVisible();
  await colleague.getByRole("button", { name: "Close dialog" }).click();
  await navigate(owner, "Onboarding");
  await owner.getByRole("button", { name: "Checklists", exact: true }).click();
  await select(owner, "Checklist status", "Completed");
  await expect(owner.getByText("1 / 1 required tasks complete")).toBeVisible();
  await owner.screenshot({ path: screenshot("onboarding"), fullPage: true });
  const ledger = (await api(colleague, `${base}/leave/balances?year=2026`)).body as {
    balances: { leaveTypeId: string; balanceHalfDays: number }[];
  };
  expect(ledger.balances.find((b) => b.leaveTypeId === policy.id)?.balanceHalfDays).toBe(28);
  expect(errors).toEqual([]);
}
