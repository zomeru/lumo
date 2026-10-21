import { webcrypto } from "node:crypto";

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from "vitest";

import { allPeopleQuery, downloadHrFile } from "./features/hr/hr-api";
import { formString } from "./features/hr/hr-ui";
import { uploadHrFile } from "./features/hr/request-dialog";
import { clearWorkspaceCache } from "./lib/api";
import { configurePlatform } from "./platform";
import { createAppRouter } from "./router";
import { hrFixture, hrId, hrSecond } from "./test/hr-fixture";
import { bobId, teamId } from "./test/mock-api";
import { selectOption } from "./test/select-option";
let fixture: ReturnType<typeof hrFixture>, client: QueryClient, click: MockInstance<() => void>;
beforeEach(() => {
  fixture = hrFixture();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn<() => string>(() => "blob:test"),
      revokeObjectURL: vi.fn<(url: string) => void>(),
    }),
  );
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  click.mockRestore();
  vi.unstubAllGlobals();
  configurePlatform(undefined);
});
async function show(module: string, search = "") {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/w/${teamId}/${module}${search}`] }),
    client,
  );
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", {
    name:
      module === "hr-onboarding" ? "Onboarding" : module.charAt(0).toUpperCase() + module.slice(1),
  });
  return { user: userEvent.setup(), router };
}
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
async function close(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}
function calls(path: string, method = "POST") {
  return fixture.server.fetch.mock.calls.filter(
    ([url, init]) =>
      typeof url === "string" && url.endsWith(`/hr${path}`) && init?.method === method,
  );
}
function body(path: string, method = "POST") {
  const call = calls(path, method).at(-1);
  return JSON.parse(call?.[1]?.body as string) as Record<string, unknown>;
}
test("People edits scoped profiles and departments, shows reporting relationships and preserves search in URLs", async () => {
  const { user, router } = await show("people");
  await user.click((await screen.findAllByRole("button", { name: "View profile" }))[1]!);
  change("Job title", "Senior Engineer");
  change("Employee code", "B002");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls(`/people/${bobId}`, "PUT")).toHaveLength(1));
  expect(body(`/people/${bobId}`, "PUT").jobTitle).toBe("Senior Engineer");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Org chart" }));
  expect(await screen.findByText(/Reports to: Alice Chen/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Departments" }));
  await user.click(await screen.findByRole("button", { name: "Edit department" }));
  change("Department name", "Engineering & Design");
  await selectOption(user, "Status", "Archived");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls(`/departments/${hrId}`, "PUT")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add department" }));
  change("Department name", "Operations");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls("/departments")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Directory" }));
  change("Search people", "Bob");
  await waitFor(() => expect(router.state.location.search.q).toBe("Bob"));
  expect(await screen.findByText("Bob Rivera", { selector: "h2" })).toBeVisible();
});
test("ordinary employees see read-only employment details and no payroll administration", async () => {
  fixture.state.access = { ...fixture.state.access, owner: false, hasReports: false };
  const { user } = await show("people");
  await user.click((await screen.findAllByRole("button", { name: "View profile" }))[0]!);
  expect(screen.getByLabelText("Job title")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  await close(user);
  expect(screen.queryByRole("button", { name: "HR administration" })).not.toBeInTheDocument();
});
test("Approvals exposes history, comments, assigned decisions, downloads and editable drafts", async () => {
  const { user } = await show("approvals");
  await user.click(await screen.findByRole("button", { name: "View request" }));
  expect(await screen.findByText(/Please review/)).toBeVisible();
  change("Comment", "Checked receipt");
  await user.click(screen.getByRole("button", { name: "Add comment" }));
  await waitFor(() => expect(calls(`/requests/${hrId}/comments`)).toHaveLength(1));
  await user.click(await screen.findByRole("button", { name: "Download receipt.txt" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  await user.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "My requests" }));
  await user.click(await screen.findByRole("button", { name: "View request" }));
  await user.click(screen.getByRole("button", { name: "Edit draft" }));
  change("Subject", "Edited draft");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls(`/requests/${hrSecond}`, "PUT")).toHaveLength(1));
});
test.each([
  "General request",
  "Leave",
  "Expense reimbursement",
  "Purchase request",
  "Overtime",
  "Business travel",
  "Cash advance",
])("New request modal submits typed %s details", async (type) => {
  const { user } = await show("approvals");
  await user.click(screen.getByRole("button", { name: "New request" }));
  await user.click(screen.getByRole("button", { name: type }));
  change("Subject", `Request ${type}`);
  const fields: Record<string, string> = {
    "Start date": "2026-10-22",
    "End date": "2026-10-23",
    "Amount in centavos / minor units": "10000",
    Date: "2026-10-22",
    "Expense category": "Travel",
    Quantity: "2",
    Vendor: "Supplier",
    Destination: "Manila",
    "Planned repayment date": "2026-11-01",
    "Overtime minutes": "120",
  };
  for (const [label, value] of Object.entries(fields))
    if (screen.queryByLabelText(label, { exact: true })) change(label, value);
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(calls("/requests")).toHaveLength(1));
  await waitFor(() => expect(calls(`/requests/${hrSecond}/action`)).toHaveLength(1));
  expect(body("/requests").subject).toBe(`Request ${type}`);
  expect(body("/requests").draft).toBe(true);
});
test("Leave shows ledger, absence visibility, scoped balances and policy actions", async () => {
  const { user } = await show("leave");
  await user.click(await screen.findByRole("button", { name: "View balance history" }));
  expect(await screen.findByText(/15 days · Opening/)).toBeVisible();
  await close(user);
  await user.click(screen.getByRole("button", { name: "Who is out" }));
  expect(await screen.findByText(/Away · Oct. 22, 2026/)).toBeVisible();
  change("Month", "2026-11");
  await user.click(screen.getByRole("button", { name: "Team balances" }));
  expect(await screen.findByRole("table")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Adjust balance" }));
  change("Adjustment (signed half-day units)", "2");
  change("Reason", "Correct opening allocation");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls("/leave/adjustments")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Policies" }));
  await user.click(await screen.findByRole("button", { name: "Archive" }));
  await waitFor(() => expect(calls(`/leave/policies/${hrId}`, "PUT")).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Add leave policy" }));
  change("Leave category", "Wellness");
  change("Annual allocation (half-day units)", "10");
  change("Effective from", "2026-01-01");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls("/leave/policies")).toHaveLength(1));
});
test("Attendance clock controls, CSV, corrections and schedule setup call real transport contracts", async () => {
  const { user } = await show("attendance");
  await user.click(await screen.findByRole("button", { name: "Clock in" }));
  await user.click(await screen.findByRole("button", { name: "Start break" }));
  await user.click(await screen.findByRole("button", { name: "End break" }));
  await user.click(await screen.findByRole("button", { name: "Clock out" }));
  await waitFor(() => expect(calls("/attendance/punch")).toHaveLength(4));
  await user.click(screen.getByRole("button", { name: "Export CSV" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  await user.click(screen.getByRole("button", { name: "Correct" }));
  change("Correct clock in (UTC)", "2026-10-21T00:00");
  change("Correct clock out (UTC)", "2026-10-21T09:00");
  change("Reason", "Missed punch");
  await user.click(screen.getByRole("button", { name: "Submit correction" }));
  await waitFor(() => expect(calls("/requests")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Team attendance" }));
  expect(await screen.findByRole("columnheader", { name: "Person" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Schedules" }));
  await user.click(screen.getByRole("button", { name: "Assign work schedule" }));
  change("Effective date", "2026-11-01");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls("/schedules")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  change("Holiday date", "2026-12-25");
  change("Holiday name", "Christmas");
  await user.click(screen.getByRole("button", { name: "Save holiday" }));
  await waitFor(() => expect(calls("/holidays")).toHaveLength(1));
});
test("Payroll exposes own released slips, compensation history and effective salary entry", async () => {
  const { user } = await show("payroll");
  expect(await screen.findByText("Take-home pay estimate")).toBeVisible();
  await user.click(screen.getByText("View payslip breakdown"));
  expect(screen.getAllByText(/Employer SSS/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Download payslip CSV" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  await user.click(screen.getByRole("button", { name: "Employees" }));
  await user.click(await screen.findByRole("button", { name: "Add effective compensation" }));
  change("Effective date", "2026-11-01");
  change("Monthly salary (PHP centavos)", "3000000");
  change("Reason", "Promotion");
  change("Allowance label (optional)", "Transport");
  change("Monthly allowance (PHP centavos)", "10000");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls("/payroll/compensation")).toHaveLength(1));
  expect(body("/payroll/compensation").userId).toBe(bobId);
});
test("Pay run review requires explicit verification and confirms publication and payment actions", async () => {
  const { user } = await show("payroll", "?tab=Pay%20Runs");
  await user.click(await screen.findByRole("button", { name: "Review run" }));
  change("Independently checked net amount (centavos)", "2261120");
  change(
    "Reviewer evidence and statutory/source references",
    "Checked all statutory tables and attendance sources independently",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Record independent verification" }));
  await waitFor(() =>
    expect(calls(`/payroll/runs/${hrId}/employees/${bobId}/verify`)).toHaveLength(1),
  );
  await user.click(screen.getByRole("button", { name: "Approve verified run" }));
  await user.click(await screen.findByRole("button", { name: "Finalize payroll" }));
  await user.click(screen.getByRole("button", { name: "Confirm finalize payroll" }));
  await user.click(await screen.findByRole("button", { name: "Publish payslips" }));
  await user.click(screen.getByRole("button", { name: "Confirm publish payslips" }));
  await user.click(await screen.findByRole("button", { name: "Record paid" }));
  await user.click(screen.getByRole("button", { name: "Confirm record paid" }));
  await user.click(screen.getByRole("button", { name: "Export run CSV" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  expect(body(`/payroll/runs/${hrId}/action`).confirmation).toBe("record_payment");
});
test("Payroll settings and explicit grant management are available to authorized administrators", async () => {
  const { user } = await show("payroll", "?tab=Settings");
  await screen.findByText("Philippine statutory configuration");
  change("Effective date", "2026-11-01");
  for (const [label, value] of Object.entries({
    "Working days per year": "261",
    "Work minutes per day": "480",
    "Overtime multiplier (basis points; 10000 = 1×)": "12500",
    "Holiday multiplier (basis points)": "20000",
    "Rest-day multiplier (basis points)": "13000",
    "Monthly / second payout day": "30",
    "Reason for change": "Reviewed business policy",
  }))
    change(label, value);
  await user.click(screen.getByRole("button", { name: "Save effective settings" }));
  await waitFor(() => expect(calls("/payroll/settings")).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Grant capability" }));
  await waitFor(() => expect(calls("/grants")).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Revoke" }));
  await waitFor(() => expect(calls("/grants")).toHaveLength(2));
});
test("Onboarding completes and verifies tasks, opens private files and keeps template editing separate", async () => {
  const { user } = await show("hr-onboarding");
  await user.click((await screen.findAllByRole("button", { name: "Open checklist" }))[0]!);
  await user.click(screen.getByRole("button", { name: "Complete task" }));
  await user.click(await screen.findByRole("button", { name: "Verify submission" }));
  await user.click(screen.getByRole("button", { name: "Download policy.txt" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  await close(user);
  await user.click(screen.getByRole("button", { name: "Checklists" }));
  expect(await screen.findByText("0 / 2 required tasks complete")).toBeVisible();
  await selectOption(user, "Checklist status", "All");
  await user.click(screen.getByRole("button", { name: "Templates" }));
  await user.click(await screen.findByRole("button", { name: "Edit template" }));
  change("Template name", "Welcome v2");
  await user.click(screen.getByRole("button", { name: "Add step" }));
  fireEvent.change(screen.getAllByLabelText("Task title")[1]!, {
    target: { value: "Meet the team" },
  });
  await user.click(screen.getAllByRole("button", { name: "Move up" })[1]!);
  await user.click(screen.getAllByRole("button", { name: "Move down" })[0]!);
  await user.click(screen.getAllByRole("button", { name: "Remove step" })[1]!);
  await user.click(screen.getByRole("button", { name: "Save template version" }));
  await waitFor(() => expect(calls(`/onboarding/templates/${hrId}`, "PUT")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Start a checklist" }));
  change("Start date", "2026-11-01");
  await selectOption(user, "Employee or pending invitation", "Invited: invited@example.com");
  await user.click(screen.getByRole("button", { name: "Assign checklist" }));
  await waitFor(() => expect(calls("/onboarding/instances")).toHaveLength(1));
  expect(body("/onboarding/instances").invitationId).toBe(hrId);
});
test("HR administration and inbox expose scoped audit, routing policies and notifications", async () => {
  const { user } = await show("people", "?tab=HR%20administration");
  expect(await screen.findByText("Protected HR audit history")).toBeVisible();
  await user.click(screen.getByText(/permissions.changed/));
  expect(screen.getByText(/Target:/)).toBeVisible();
  await user.click(screen.getByLabelText("Ordered approvers (select in approval order)"));
  await user.click(await screen.findByRole("checkbox", { name: "Bob Rivera" }));
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Save routing policy" }));
  await waitFor(() => expect(calls("/approval-policies")).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "HR notifications" }));
  expect(await screen.findByText("Request waiting")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Mark read" }));
  await waitFor(() => expect(calls(`/notifications/${hrId}/read`)).toHaveLength(1));
  await user.click(screen.getByRole("link", { name: "Open approvals" }));
  expect(await screen.findByRole("heading", { name: "Approvals" })).toBeVisible();
});
test("employees cannot browse payroll administration through a deep link", async () => {
  fixture.state.access = { ...fixture.state.access, owner: false, hasReports: false };
  fixture.get("/payroll/runs", () => fixture.server.error(403, "Payroll access denied"));
  await show("payroll", "?tab=Pay%20Runs");
  expect(await screen.findByRole("alert")).toHaveTextContent("Payroll access denied");
  expect(screen.queryByRole("button", { name: "Employees" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
});

test.each(["people", "approvals", "leave", "attendance", "payroll", "hr-onboarding"])(
  "%s renders a useful access error before any protected screen",
  async (module) => {
    fixture.get("/access", () => fixture.server.error(403, "HR access is unavailable"));
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/w/${teamId}/${module}`] }),
      client,
    );
    await router.load();
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HR access is unavailable");
  },
);
test.each(["people", "approvals", "leave", "attendance", "payroll", "hr-onboarding"])(
  "%s keeps a loading state while its access decision is pending",
  async (module) => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    fixture.get("/access", async () => {
      await pending;
      return fixture.server.json(fixture.state.access);
    });
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/w/${teamId}/${module}`] }),
      client,
    );
    await router.load();
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("Loading your workspace…")).toBeVisible();
    release();
    await screen.findByRole("heading", {
      name:
        module === "hr-onboarding"
          ? "Onboarding"
          : module.charAt(0).toUpperCase() + module.slice(1),
    });
  },
);
test("Empty HR sections show real empty states without fabricated balances, pay or onboarding tasks", async () => {
  fixture.state.requests = [];
  fixture.state.policies = [];
  fixture.state.out = [];
  fixture.state.payslips = [];
  fixture.state.estimate = null;
  fixture.state.tasks = [];
  fixture.state.instances = [];
  fixture.state.templates = [];
  const { user, router } = await show("approvals");
  expect(await screen.findByText("Nothing waiting for you")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "My requests" }));
  expect(await screen.findByText("No requests yet")).toBeVisible();
  await router.navigate({
    to: "/w/$workspaceId/leave",
    params: { workspaceId: teamId },
    search: {},
  });
  expect(await screen.findByText("No leave policies configured")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Who is out" }));
  expect(await screen.findByText("No one is on leave this month")).toBeVisible();
  await router.navigate({
    to: "/w/$workspaceId/payroll",
    params: { workspaceId: teamId },
    search: {},
  });
  expect(await screen.findByText("No published payslips yet")).toBeVisible();
  expect(screen.getByText(/Your estimate becomes available/)).toBeVisible();
  await router.navigate({
    to: "/w/$workspaceId/hr-onboarding",
    params: { workspaceId: teamId },
    search: {},
  });
  expect(await screen.findByText("Nothing for you to do")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Checklists" }));
  expect(await screen.findByText("No checklists here")).toBeVisible();
  await router.navigate({
    to: "/w/$workspaceId/people",
    params: { workspaceId: teamId },
    search: { q: "unmatched" },
  });
  expect(await screen.findByText("No people match your search")).toBeVisible();
  fixture.state.departments = [];
  await user.click(screen.getByRole("button", { name: "Departments" }));
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "hr"] });
  expect(await screen.findByText("No departments yet")).toBeVisible();
});
test("Draft cancellation, rejection and blocked-routing resolution are explicit review actions", async () => {
  const { user } = await show("approvals");
  await user.click(await screen.findByRole("button", { name: "View request" }));
  await user.click(screen.getByRole("button", { name: "Reject" }));
  await waitFor(() => expect(calls(`/requests/${hrId}/action`)).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "My requests" }));
  await user.click(await screen.findByRole("button", { name: "View request" }));
  await user.click(screen.getByRole("button", { name: "Cancel request" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(body(`/requests/${hrSecond}/action`).action).toBe("cancel");
});
test("HR can create templates, reassign tasks and reopen completed submissions with a reason", async () => {
  const { user } = await show("hr-onboarding");
  await user.click((await screen.findAllByRole("button", { name: "Open checklist" }))[0]!);
  const forms = screen.getAllByRole("button", { name: "Update task assignment" });
  await user.click(forms[0]!);
  await waitFor(() => expect(calls(`/onboarding/tasks/${hrId}/action`)).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Complete task" }));
  await waitFor(() => expect(screen.getAllByLabelText("Reason to reopen").length).toBe(2));
  fireEvent.change(screen.getAllByLabelText("Reason to reopen")[0]!, {
    target: { value: "Review revised form" },
  });
  await user.click(screen.getAllByRole("button", { name: "Reopen task" })[0]!);
  await waitFor(() => expect(body(`/onboarding/tasks/${hrId}/action`).action).toBe("reopen"));
  await close(user);
  await user.click(screen.getByRole("button", { name: "Templates" }));
  await user.click(screen.getByRole("button", { name: "New template" }));
  change("Template name", "IT setup");
  change("Task title", "Issue access");
  change("Instructions", "Prepare account access");
  await selectOption(user, "Assignee role", "it");
  await selectOption(user, "Required task", "Optional");
  await selectOption(user, "Independent verification", "Required");
  await selectOption(user, "Document submission", "Required");
  change("HTTPS reference link (optional)", "https://example.com/policy");
  await user.click(screen.getByRole("button", { name: "Save template version" }));
  await waitFor(() => expect(calls("/onboarding/templates")).toHaveLength(1));
});
test("Pay run drafting, adjustments and voids preserve deliberate operator actions", async () => {
  const { user } = await show("payroll", "?tab=Pay%20Runs");
  await user.click(screen.getByRole("button", { name: "New pay run" }));
  await screen.findByRole("button", { name: "Create draft run" });
  for (const [label, value] of Object.entries({
    "Period start": "2026-10-01",
    "Period end": "2026-10-31",
    "Attendance cutoff": "2026-10-31",
    "Payout date": "2026-10-31",
  }))
    change(label, value);
  await user.click(screen.getByRole("button", { name: "Create draft run" }));
  await waitFor(() => expect(calls("/payroll/runs")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Review run" }));
  await user.click(screen.getByRole("button", { name: "Calculate draft" }));
  await waitFor(() => expect(calls(`/payroll/runs/${hrId}/calculate`)).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Add adjustment" }));
  change("Line label", "Bonus");
  change("Signed adjustment (PHP centavos)", "5000");
  change("Reason / correction reference", "Documented approved bonus");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(calls(`/payroll/runs/${hrId}/adjustments`)).toHaveLength(1));
  await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Return to draft" }));
  await waitFor(() => expect(body(`/payroll/runs/${hrId}/action`).action).toBe("return_to_draft"));
  await user.click(screen.getByRole("button", { name: "Void run" }));
  change("Void reason", "Incorrect period fixture");
  await user.click(screen.getByRole("button", { name: "Record void" }));
  await waitFor(() => expect(body(`/payroll/runs/${hrId}/action`).action).toBe("void"));
});

test.each(["approvals", "leave", "attendance", "payroll", "hr-onboarding"])(
  "ordinary workspace admins retain only permitted personal %s views",
  async (module) => {
    fixture.state.access = { ...fixture.state.access, owner: false, hasReports: false };
    fixture.server.state.workspaces[1]!.role = "admin";
    await show(module);
    for (const tab of [
      "All requests",
      "Team balances",
      "Policies",
      "Team attendance",
      "Schedules",
      "Employees",
      "Settings",
      "Checklists",
      "Templates",
    ])
      expect(screen.queryByRole("button", { name: tab })).not.toBeInTheDocument();
  },
);
test("explicit payroll read grants permit review without granting money-changing actions", async () => {
  fixture.state.access = {
    ...fixture.state.access,
    owner: false,
    hasReports: false,
    grants: [
      {
        userId: fixture.state.access.userId,
        capability: "hr.payroll.read_all",
        scope: "workspace",
      },
    ],
  };
  const { user } = await show("payroll", "?tab=Pay%20Runs");
  await user.click(await screen.findByRole("button", { name: "Review run" }));
  expect(
    await screen.findByText(
      "Your own unpublished payroll figures are withheld from operator views.",
    ),
  ).toBeVisible();
  for (const action of ["Calculate draft", "Add adjustment", "Approve verified run", "Void run"])
    expect(screen.queryByRole("button", { name: action })).not.toBeInTheDocument();
});
test("an access administrator can manage grants without fetching confidential payroll settings", async () => {
  fixture.state.access = {
    ...fixture.state.access,
    owner: false,
    hasReports: false,
    grants: [
      {
        userId: fixture.state.access.userId,
        capability: "hr.permissions.manage",
        scope: "workspace",
      },
    ],
  };
  await show("payroll", "?tab=Settings");
  expect(await screen.findByText("HR and payroll permissions")).toBeVisible();
  expect(screen.queryByText("Philippine statutory configuration")).not.toBeInTheDocument();
  expect(
    fixture.server.fetch.mock.calls.some(
      ([url]) =>
        typeof url === "string" &&
        (url.endsWith("/payroll/settings") || url.endsWith("/payroll/statutory-configurations")),
    ),
  ).toBe(false);
});

test("Org hierarchy safely identifies a malformed reporting cycle", async () => {
  fixture.state.people[0]!.managerId = bobId;
  const { user } = await show("people");
  await user.click(screen.getByRole("button", { name: "Org chart" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reporting cycle detected");
  expect(screen.getByRole("region", { name: "Reporting hierarchy" })).toBeVisible();
});

test("Directory selectors follow real pagination and reject a non-advancing page cursor", async () => {
  fixture.get("/people", (_body, url) =>
    fixture.server.json({
      people: [fixture.state.people[Number(url.searchParams.get("offset")) || 0]],
      nextOffset: url.searchParams.get("offset") === "0" ? 1 : null,
    }),
  );
  const data = await client.fetchQuery(allPeopleQuery(teamId));
  expect(data.people.map((p) => p.name)).toEqual(["Alice Chen", "Bob Rivera"]);
  fixture.get("/people", () => fixture.server.json({ people: [], nextOffset: 0 }));
  await expect(client.fetchQuery(allPeopleQuery(teamId))).rejects.toThrow(
    "Invalid directory pagination",
  );
});
test("Private downloads use Electron's native authenticated boundary when configured", async () => {
  const download = vi.fn<(path: string, body: unknown) => Promise<void>>(async () => {});
  configurePlatform({
    kind: "desktop",
    webOrigin: "http://localhost",
    transport: async () => ({ status: 200, body: { ok: true } }),
    download,
  });
  await downloadHrFile(teamId, hrId);
  expect(download).toHaveBeenCalledWith(
    `/api/v1/workspaces/${teamId}/hr/files/${hrId}/download`,
    {},
  );
});
test("Private uploads hash bytes, use signed PUTs, complete only after success and report upload failures", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const bytes = new TextEncoder().encode("private document");
  const file = new File([bytes], "document.txt");
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  fixture.post(`/files/request/${hrId}/uploads`, () =>
    fixture.server.json({ id: hrSecond, url: "https://uploads.example.test/key" }),
  );
  fixture.server.state.overrides.set("PUT /key", () => new Response(null, { status: 200 }));
  fixture.post(`/files/${hrSecond}/complete`);
  await uploadHrFile(teamId, "request", hrId, file);
  expect(body(`/files/request/${hrId}/uploads`).mimeType).toBe("text/plain");
  expect(calls(`/files/${hrSecond}/complete`)).toHaveLength(1);
  fixture.server.state.overrides.set("PUT /key", () => new Response(null, { status: 500 }));
  await expect(uploadHrFile(teamId, "request", hrId, file)).rejects.toThrow("File upload failed");
  expect(calls(`/files/${hrSecond}/complete`)).toHaveLength(1);
  const values = new FormData();
  values.set("file", file);
  expect(formString(values, "file")).toBe("");
});
test("A typed request uploads its receipt before submission and preserves the draft on upload failure", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const { user } = await show("approvals");
  const bytes = new TextEncoder().encode("receipt");
  const file = new File([bytes], "receipt.txt", { type: "text/plain" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  fixture.post(`/files/request/${hrSecond}/uploads`, () =>
    fixture.server.json({ id: hrId, url: "https://uploads.example.test/receipt" }),
  );
  fixture.post(`/files/${hrId}/complete`);
  fixture.server.state.overrides.set("PUT /receipt", () => new Response(null, { status: 500 }));
  await user.click(screen.getByRole("button", { name: "New request" }));
  change("Subject", "Receipt request");
  await user.upload(
    screen.getByLabelText("Attachment (PDF, PNG, JPEG or text; up to 10 MB)"),
    file,
  );
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("File upload failed");
  expect(calls("/requests")).toHaveLength(1);
  fixture.server.state.overrides.set("PUT /receipt", () => new Response(null, { status: 200 }));
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(calls(`/requests/${hrSecond}/action`)).toHaveLength(1));
  expect(calls("/requests")).toHaveLength(1);
});

test("Attendance persists team filters and exports exactly the selected authorized query", async () => {
  const { user, router } = await show("attendance", "?month=2026-09&tab=Team%20attendance");
  await selectOption(user, "Filter employee", "Bob Rivera");
  await selectOption(user, "Filter department", "Engineering");
  await selectOption(user, "Filter attendance status", "absent");
  await user.click(screen.getByRole("button", { name: "Export CSV" }));
  await waitFor(() =>
    expect(
      fixture.server.fetch.mock.calls.some(
        ([url]) =>
          typeof url === "string" &&
          url.includes("/attendance/export?month=2026-09&team=true") &&
          url.includes(`userId=${bobId}`) &&
          url.includes(`departmentId=${hrId}`) &&
          url.includes("status=absent"),
      ),
    ).toBe(true),
  );
  expect(router.state.location.search).toMatchObject({
    month: "2026-09",
    employeeId: bobId,
    departmentId: hrId,
    status: "absent",
  });
  await selectOption(user, "Filter employee", "Authorized team");
  await selectOption(user, "Filter department", "All departments");
  await selectOption(user, "Filter attendance status", "all");
});
test("Leave edits versioned policy defaults, expiry and partial-day eligibility", async () => {
  const { user } = await show("leave", "?tab=Policies");
  await user.click(await screen.findByRole("button", { name: "Edit policy" }));
  expect(screen.getByLabelText("Leave category")).toHaveValue("Vacation");
  change("Carryover expiry month (optional, 1–12)", "3");
  await selectOption(user, "Partial-day requests", "Full days only");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(body(`/leave/policies/${hrId}`, "PUT")).toMatchObject({
      name: "Vacation",
      carryoverExpiryMonth: 3,
      allowHalfDay: false,
    }),
  );
});
test("My Pay estimates use the selected period and a new run starts from the configured schedule", async () => {
  const { user } = await show("payroll");
  change("Estimate period start (day 1 or 16)", "2026-09-01");
  await waitFor(() =>
    expect(
      fixture.server.fetch.mock.calls.some(
        ([url]) => typeof url === "string" && url.endsWith("/payroll/me?periodStart=2026-09-01"),
      ),
    ).toBe(true),
  );
  await user.click(screen.getByRole("button", { name: "Pay Runs" }));
  await user.click(screen.getByRole("button", { name: "New pay run" }));
  await screen.findByRole("button", { name: "Create draft run" });
  expect(screen.getByLabelText("Period start")).toHaveValue("2026-10-01");
  expect(screen.getByLabelText("Payout date")).toHaveValue("2026-10-31");
});

test("People handles unassigned employment, missing managers and paginated directory navigation", async () => {
  Object.assign(fixture.state.people[1]!, {
    jobTitle: "",
    department: "",
    departmentId: null,
    managerId: hrSecond,
    hireDate: null,
  });
  fixture.state.departments[0]!.archived = true;
  fixture.state.departments[0]!.managerId = hrSecond;
  fixture.get("/people", (_body, url) =>
    fixture.server.json({
      people: fixture.state.people,
      nextOffset:
        url.searchParams.get("limit") === "100" || url.searchParams.get("offset") !== "0"
          ? null
          : 50,
    }),
  );
  const { user } = await show("people");
  await user.click(await screen.findByRole("button", { name: "Next" }));
  await user.click(await screen.findByRole("button", { name: "Previous" }));
  await user.click((await screen.findAllByRole("button", { name: "View profile" }))[1]!);
  await selectOption(user, "Department", "No department");
  await selectOption(user, "Manager", "None");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(body(`/people/${bobId}`, "PUT")).toMatchObject({
      departmentId: null,
      managerId: null,
      hireDate: null,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Org chart" }));
  expect(await screen.findByText(/Manager unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/No department/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Departments" }));
  expect(await screen.findByText(/Unassigned/)).toBeVisible();
});
test("Unpaid unlimited leave retains its canonical request and cancellation action", async () => {
  fixture.state.policies[0]!.paid = false;
  fixture.state.policies[0]!.enforceBalance = false;
  fixture.get("/leave/balances", () =>
    fixture.server.json({
      balances: [
        {
          userId: fixture.state.access.userId,
          leaveTypeId: hrId,
          name: "Unpaid",
          paid: false,
          balanceHalfDays: 0,
          pendingHalfDays: 0,
          usedHalfDays: 0,
          ledger: [],
        },
      ],
    }),
  );
  fixture.state.requests[0]!.requesterId = fixture.state.access.userId;
  fixture.state.requests[0]!.details = {
    type: "leave",
    leaveTypeId: hrId,
    startDate: "2026-10-22",
    endDate: "2026-10-22",
    halfDay: false,
  };
  const { user } = await show("leave");
  expect(await screen.findByText("No fixed limit")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cancel leave" }));
  await waitFor(() => expect(body(`/requests/${hrId}/action`).action).toBe("cancel"));
  await user.click(screen.getByRole("button", { name: "Request leave" }));
  expect(await screen.findByRole("dialog")).toBeVisible();
});

test("Directory filters are URL-backed, reset pagination and preserve workspace-scoped transport", async () => {
  const { user, router } = await show("people", "?offset=50");
  await selectOption(user, "Directory department", "Engineering");
  await selectOption(user, "Employment status filter", "On leave");
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      offset: 0,
      departmentId: hrId,
      status: "on_leave",
    }),
  );
  expect(
    fixture.server.fetch.mock.calls.some(
      ([url]) =>
        typeof url === "string" &&
        url.includes(`/workspaces/${teamId}/hr/people?`) &&
        url.includes(`departmentId=${hrId}&status=on_leave`),
    ),
  ).toBe(true);
  await selectOption(user, "Directory department", "All departments");
  await selectOption(user, "Employment status filter", "All statuses");
});

test("Workspace changes evict recipient HR inbox data alongside other private workspace queries", async () => {
  client.setQueryData(["hr-inbox", teamId], { notifications: [{ title: "Private notification" }] });
  client.setQueryData(["workspace", teamId, "hr", "/payroll/me"], { payslips: [] });
  await clearWorkspaceCache(client);
  expect(client.getQueryData(["hr-inbox", teamId])).toBeUndefined();
  expect(client.getQueryData(["workspace", teamId, "hr", "/payroll/me"])).toBeUndefined();
});

test("All requests preserves employee, approver, date, type and status filters in the URL", async () => {
  const { user, router } = await show("approvals", "?tab=All%20requests&offset=50");
  await selectOption(user, "Requester filter", "Bob Rivera");
  await selectOption(user, "Approver filter", "Alice Chen");
  change("Created from", "2026-09-01");
  change("Created through", "2026-10-31");
  await selectOption(user, "Request status", "approved");
  await selectOption(user, "Request type", "expense");
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      offset: 0,
      employeeId: bobId,
      approverId: fixture.state.access.userId,
      fromDate: "2026-09-01",
      toDate: "2026-10-31",
      requestType: "expense",
      status: "approved",
    }),
  );
  expect(
    fixture.server.fetch.mock.calls.some(
      ([url]) =>
        typeof url === "string" &&
        url.includes("view=all") &&
        url.includes(`employeeId=${bobId}`) &&
        url.includes("fromDate=2026-09-01") &&
        url.includes("type=expense"),
    ),
  ).toBe(true);
  await selectOption(user, "Requester filter", "All employees");
  await selectOption(user, "Approver filter", "All approvers");
  change("Created from", "");
  change("Created through", "");
});
test.each([
  {
    details: {
      type: "leave",
      leaveTypeId: hrId,
      startDate: "2026-10-22",
      endDate: "2026-10-23",
      halfDay: false,
    },
    text: "Oct. 22, 2026 – Oct. 23, 2026",
  },
  {
    details: {
      type: "travel",
      destination: "Cebu",
      startDate: "2026-10-22",
      endDate: "2026-10-23",
      amountMinor: 10000,
      currency: "PHP",
    },
    text: "Oct. 22, 2026 – Oct. 23, 2026",
  },
  {
    details: { type: "overtime", date: "2026-10-21", durationMinutes: 120 },
    text: "Oct. 21, 2026 · 120 minutes",
  },
  { details: { type: "general" }, text: "General request" },
  {
    details: {
      type: "attendance_correction",
      date: "2026-10-21",
      clockIn: "2026-10-21T00:00:00Z",
      clockOut: "2026-10-21T09:00:00Z",
      breakMinutes: 60,
    },
    text: "Oct. 21, 2026",
  },
] as const)(
  "Approval cards show the requester and relevant $details.type facts",
  async ({ details, text }) => {
    fixture.state.requests[0]!.details = details;
    await show("approvals");
    expect(await screen.findByText(`Bob Rivera · ${text}`)).toBeVisible();
  },
);

async function openStatutory() {
  const result = await show("payroll", "?tab=Settings");
  await result.user.click(
    await screen.findByRole("button", { name: "Configure statutory contributions" }),
  );
  change("Statutory effective date", "2026-11-01");
  change("Statutory change reason", "Accounting reviewed official contribution tables");
  await result.user.click(
    screen.getByRole("checkbox", { name: /I reviewed the official sources/ }),
  );
  return result;
}
test("statutory editor persists rates, peso limits, brackets and rounding as a reviewed effective version", async () => {
  const { user } = await openStatutory();
  change("Configuration name", "November Accounting review");
  change("SSS employee rate (%)", "4.75");
  change("SSS MPF employer rate (%)", "9.5");
  change("SSS maximum monthly salary credit (PHP)", "40000");
  change("Pag-IBIG employee contribution cap (PHP)", "199.99");
  change("PhilHealth total premium rate (%)", "4.5");
  change("PhilHealth total premium cap (PHP)", "4500");
  await selectOption(user, "SSS rounding", "Round down to centavo");
  await user.click(screen.getByText("SSS brackets (2 rows)"));
  change("SSS brackets row 1 Employer EC (PHP)", "12.50");
  await user.click(screen.getByText("Pag-IBIG brackets (1 rows)"));
  change("Pag-IBIG brackets row 1 Employee rate (%)", "1.75");
  await user.click(screen.getByText("BIR monthly (2 rows)"));
  change("BIR monthly row 2 Marginal rate (%)", "12.5");
  await user.click(screen.getByRole("button", { name: "Save statutory configuration" }));
  await waitFor(() => expect(calls("/payroll/statutory-configurations")).toHaveLength(1));
  expect(body("/payroll/statutory-configurations")).toMatchObject({
    effectiveFrom: "2026-11-01",
    confirmed: true,
    sss: {
      employeeBps: 475,
      mpfEmployerBps: 950,
      maximumCreditMinor: 4000000,
      rounding: "down_centavo",
      brackets: [{ ecMinor: 1250 }, {}],
    },
    pagibig: { employeeCapMinor: 19999, brackets: [{ employeeBps: 175 }] },
    philhealth: { totalBps: 450, premiumCapMinor: 450000 },
    bir: { monthly: [{}, { bps: 1250 }] },
  });
  await user.click(await screen.findByText("Nov. 1, 2026 · November Accounting review"));
  expect(screen.getByText("Immutable version")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Use as new configuration draft" }));
  expect(screen.getByLabelText("SSS employee rate (%)")).toHaveValue(4.75);
  expect(screen.getByLabelText("Statutory effective date")).toHaveValue("");
  expect(
    screen.getByRole("checkbox", { name: /I reviewed the official sources/ }),
  ).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Cancel configuration" }));
  expect(
    await screen.findByRole("button", { name: "Configure statutory contributions" }),
  ).toBeVisible();
});
test("statutory editor validates shares, bracket continuity and evidence before sending a configuration", async () => {
  const { user } = await openStatutory();
  change("PhilHealth employee share (%)", "40");
  await user.click(screen.getByRole("button", { name: "Save statutory configuration" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Employee and employer shares must total 100%",
  );
  expect(calls("/payroll/statutory-configurations")).toHaveLength(0);
  change("PhilHealth employer share (%)", "60");
  await user.click(screen.getByText("SSS brackets (2 rows)"));
  change("SSS brackets row 2 Salary from (PHP)", "9999");
  await user.click(screen.getByRole("button", { name: "Save statutory configuration" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("without gaps or overlaps");
  change("SSS brackets row 2 Salary from (PHP)", "10000");
  fixture.post("/payroll/statutory-configurations", () =>
    fixture.server.error(409, "This affects a finalized payroll period"),
  );
  await user.click(screen.getByRole("button", { name: "Save statutory configuration" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("finalized payroll period");
});
test("statutory editors add and remove salary, tax and source rows without losing entered values", async () => {
  const { user } = await openStatutory();
  for (const name of [
    "SSS brackets (2 rows)",
    "Pag-IBIG brackets (1 rows)",
    "BIR monthly (2 rows)",
    "BIR semimonthly (1 rows)",
  ])
    await user.click(screen.getByText(name));
  change("SSS brackets row 2 Employer EC (PHP)", "35.25");
  await user.click(screen.getByRole("button", { name: "Add SSS brackets row" }));
  await user.click(screen.getByRole("button", { name: "Remove SSS brackets row 1" }));
  expect(screen.getByLabelText("SSS brackets row 1 Employer EC (PHP)")).toHaveValue(35.25);
  for (const group of ["Pag-IBIG brackets", "BIR monthly", "BIR semimonthly"]) {
    await user.click(screen.getByRole("button", { name: `Add ${group} row` }));
    await user.click(
      screen.getByRole("button", {
        name: `Remove ${group} row ${group === "BIR monthly" ? 3 : 2}`,
      }),
    );
  }
  await user.click(screen.getByRole("button", { name: "Add source" }));
  change("Source 2 title", "PhilHealth source");
  change("Source 2 HTTPS URL", "https://www.philhealth.gov.ph/");
  await user.click(screen.getByRole("button", { name: "Remove source 1" }));
  expect(screen.getByLabelText("Source 1 title")).toHaveValue("PhilHealth source");
});
test("statutory legal exemptions, collection timing, bases, EC and tax rounding remain explicit", async () => {
  const { user } = await openStatutory();
  await selectOption(user, "SSS salary basis", "Actual remuneration for the month");
  await selectOption(user, "SSS semimonthly collection", "Collect at month-end / final cutoff");
  await selectOption(user, "Employer Employees’ Compensation", "No EC component");
  await selectOption(user, "BIR rounding", "Round up to centavo");
  for (const label of ["SSS", "Pag-IBIG", "PhilHealth", "BIR"]) {
    await selectOption(user, `${label} calculation`, "Disabled with documented legal basis");
    change(`${label} legal exemption reason`, "Reviewed employee statutory exemption eligibility");
  }
  await user.click(screen.getByRole("button", { name: "Save statutory configuration" }));
  await waitFor(() => expect(calls("/payroll/statutory-configurations")).toHaveLength(1));
  const saved = body("/payroll/statutory-configurations");
  expect(saved.sss).toMatchObject({
    enabled: false,
    ecEnabled: false,
    salaryBasis: "period_remuneration",
    collection: "second_cutoff",
  });
  expect(saved.bir).toMatchObject({ enabled: false, rounding: "up_centavo" });
  await user.click(await screen.findByText("Nov. 1, 2026 · Reviewed Philippine rules"));
  expect(screen.getAllByText("Reviewed employee statutory exemption eligibility")).toHaveLength(4);
});
test("statutory settings errors remain visible and grants-only administrators never fetch statutory data", async () => {
  fixture.get("/payroll/statutory-configurations", () =>
    fixture.server.error(403, "Statutory configuration access denied"),
  );
  await show("payroll", "?tab=Settings");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Statutory configuration access denied",
  );
});

test("organization visualization connects nodes and supports collapse, search, zoom and profiles", async () => {
  HTMLElement.prototype.scrollTo =
    vi.fn<(options?: ScrollToOptions | number, y?: number) => void>();
  const { user } = await show("people");
  await user.click(screen.getByRole("button", { name: "Org chart" }));
  await screen.findByRole("button", { name: /View profile: Bob Rivera/ });
  expect(document.querySelectorAll('svg path[stroke="currentColor"]').length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Collapse reports for Alice Chen" }));
  expect(
    screen.queryByRole("button", { name: /View profile: Bob Rivera/ }),
  ).not.toBeInTheDocument();
  change("Find in organization", "Bob");
  await user.click(screen.getByRole("button", { name: "Locate" }));
  await user.click(await screen.findByRole("button", { name: /View profile: Bob Rivera/ }));
  expect(screen.getByRole("dialog", { name: "Bob Rivera" })).toBeVisible();
  await close(user);
  await user.click(screen.getByRole("button", { name: "Zoom out" }));
  expect(screen.getByLabelText("Chart zoom")).toHaveTextContent("90%");
  await user.click(screen.getByRole("button", { name: "Fit to view" }));
});
