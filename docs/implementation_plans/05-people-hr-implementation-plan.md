# 05 — People & HR Module Implementation Plan (LumoLynk)

**Status:** Implementation specification for Codex  
**Target:** Existing LumoLynk monorepo, web and desktop applications, API, database, and shared packages\
**Source UI references:** `docs/ui_samples/people_&_hr_flow/`  
**Goal:** Implement an integrated, workspace-scoped People & HR system, with secure HR/payroll access and production-quality end-to-end flows.

> **Instructions to the implementing AI agent:** Read this entire plan first. Inspect the actual repository, relevant existing documentation, all six sections' PNG references, routes, UI primitives, auth and workspace-membership design, API patterns, database/ORM, storage, and tests before changing code. The samples guide layout and interaction, not security or domain correctness. Adapt paths and names to the existing architecture. Implement functioning features rather than UI-only placeholders. Do not introduce a parallel auth system, duplicate database packages, unnecessary dependencies, or incompatible design conventions. If any detail below conflicts with an established repository convention, favor the repository convention and document the deviation.

---

## 1. Objectives and non-negotiable constraints

1. Cover **Approvals, Leave, Attendance, Payroll, Onboarding, People**. Two optional, small supporting pages are **HR Settings** and **Reports & Analytics**. Prefer reusing existing settings/navigation patterns; do not create unnecessary top-level navigation clutter.
2. Ensure **workspace isolation on every query and mutation**. A person may belong to several workspaces, and their job/department/compensation may be different in each.
3. Separate **platform user identity**, **workspace membership role**, **employment information/job role**, and **HR capabilities**. No automatic payroll access from job titles such as Manager, HR, or Accountant, and no automatic payroll access from a generic workspace admin role.
4. **Workspace owner** may administer HR and payroll. Additional HR/accounting/payroll specialists gain only the explicit capabilities the owner grants. Employees can access their own permitted records.
5. Enforce authorization **at the server, in database query scoping, and for files/exports**, not only by hiding tabs or buttons.
6. UI should follow existing LumoLynk design system, compact enterprise styling, reusable components, responsive web/desktop patterns, and the provided PNG designs. Preserve existing logo, professional blue/dark-blue palette, navigation, and shared layout.
7. Leave, attendance, approvals, and payroll are connected through **canonical records**. Avoid duplicated request states or payroll values that cannot be traced to a source.
8. Use accurate time-zone and money handling: UTC instants for events; workspace-local calendar dates and schedules; **decimal/integer-minor-unit financial calculations**, never floating-point money arithmetic.
9. Changes to finalized payroll must be deliberate, logged, and corrected via controlled adjustments/revisions rather than silent editing.
10. No actual salary transfers, government filings, bank integration, or external remittances unless a suitable integration already exists and is explicitly in scope. A `paid` status is a recorded business action, not proof that LumoLynk transmitted funds.

**Not in first release:** Recruiting/ATS, biometric/geofenced attendance, employee tax filing, full benefits administration, external banking payouts, government portal submission, cross-border payroll calculations, and broad performance management. Architect extensibly but do not prematurely build these.

---

## 2. Repository discovery and UI analysis (Phase 0)

Before writing feature code:

- Examine `docs/ui_samples/people_&_hr_flow/` **including every PNG**. Inventory filenames, map images to the six requested modules, and note elements that are ambiguous. View the actual images; do not rely on filename guesses.
- Read existing repo docs and inspect packages/apps for frontend routing, Electron web UI sharing, API conventions, database schema, migrations, validation, authentication, sessions, workspace selection, role checks, storage, notifications, CSV downloads, audit logging, testing, and design components.
- Identify the existing source of truth for users and workspace memberships. Confirm whether the code uses Drizzle/PostgreSQL, Hono, TanStack Router, etc.; **adapt to actual code** rather than assuming historical decisions remain true.
- Check whether existing Employees, HR, Approvals, Leave, Drive, Events, or Settings code already exists; reuse/refactor it instead of creating duplicate functionality.
- Produce a short discovery note in the repo docs or implementation PR describing actual paths, current patterns, UI screenshots mapped to each page, database changes, API boundaries, and gaps.
- Keep web and desktop implementations consistent through existing shared UI and business-logic packages. Avoid duplicating page/business logic between applications.

**Phase gate:** The agent can explain where every feature will live, which existing components will be reused, and how access control will be enforced before implementing new tables/endpoints.

---

## 3. Navigation and experience

**People & HR** is a workspace-scoped navigation group with these six main items, preserving the order below:

1. **Approvals:** `Waiting for me` · `My requests` · `All requests` + **New request**
2. **Leave:** `My leave` · `Who is out` · `Team balances` + **Request leave**
3. **Attendance:** `My attendance` · `Team attendance` · `Adjustments` (permission-gated) + clock actions
4. **Payroll:** **`My Pay` · `Pay Runs` · `Employees` · `Settings`**
5. **Onboarding:** `My onboarding` · `Checklists` · `Templates`
6. **People:** `Directory` · `Org chart` · `Departments` + **Invite people**

Optional: **HR Settings** and **Reports & Analytics**, as two separate secondary menu items **only if** the existing information architecture benefits. Otherwise put them in an HR administrator settings subpage, and use small Reports links within each module. Do not introduce duplicate settings destinations.

**Access-driven navigation:** Tab availability depends on capability, and deep links must return an appropriate 403/404 on the server when unauthorized. `My Pay`, `My leave`, and `My attendance` remain available to the employee for their own data. Use helpful empty, loading, error, success, and no-permission states. Preserve filters/pagination in URLs where existing routing practices support it. Keyboard accessibility and semantic form labels are required.

---

## 4. Module specifications

### 4.1 Approvals

**Tabs**

- **Waiting for me:** Requests where the current member is the **currently assigned** approver. Show type, requester, submitted date, relevant dates/amounts, status, priority, and actions.
- **My requests:** Requests created by the current member, including drafts, pending, approved, rejected, cancelled, and history.
- **All requests:** Authorized HR/approval administrators only; workspace-scoped search/filter by type, status, employee, date, and approver. Do **not** expose this to every employee just because the tab exists in the UI.

**New request types**

- Leave: vacation, sick, statutory, unpaid, and other workspace-configurable categories
- Expense reimbursement (amount, currency, expense date, category, receipts)
- Purchase request (description, quantity/amount, vendor/justification)
- Overtime (date, start/end or duration, reason)
- Business travel (destination, dates, purpose, estimated expenses)
- Cash advance (amount, reason, optional planned repayment)
- General request (subject, description, attachment)

**Workflow**

- Typed, validated forms with drafts and submit/cancel; configurable request requirements and attachments.
- Status progression: `draft → pending → approved/rejected/cancelled`; optionally `returned_for_revision`. Support one or several ordered approval steps where a policy requires it.
- Store comments, decisions, timestamps, and request history. Only the assigned approver (or an explicit delegated approver) can approve/reject a pending step. The requester cannot approve their own request by default; any exception must be an explicit policy.
- Routing may use the employee's manager, a designated HR role, accounting, an assigned approver, or configured rules. Handle missing approvers with clear blocked state and an admin resolution path, not implicit approval.
- Requests must have a single canonical workflow. **Leave requests and overtime approvals created here must resolve to the same domain records** visible in Leave and Attendance.
- Reimbursements/advances/purchase/travel requests are tracked and approved here. Their payroll inclusion must be **explicitly configured and classified**, never assumed; a purchase approval is not automatically a payroll deduction.
- Notify requester/approver using existing notification infrastructure where available; audit all decisions. Prevent double approvals using transactions and concurrency checks.

**Done when:** A real request can be submitted, routed, reviewed, approved/rejected, reflected in the relevant module, and tracked end-to-end with correct authorization.

### 4.2 Leave

**Tabs**

- **My leave:** leave-type balances as cards/list, upcoming approved leave, request history, and **Request leave** action.
- **Who is out:** authorized team/workspace calendar or list showing employees absent today/this week/month. Respect privacy: show unavailable/away and dates without publishing confidential sick-leave reasons or medical attachments.
- **Team balances:** managers/HR with appropriate scope view employee balances, policies, accrued/used/pending days, and policy-controlled adjustments.

**Rules and actions**

- Define leave types per workspace: vacation, sick, statutory, unpaid, custom. Each has policy for eligibility, accrual, initial allocation, carryover, expiration, partial day, documentation, holidays/rest days, and whether it affects pay.
- Request by date range or half day, optional reason/documentation, approver routing; validate overlap and sufficient balance when policy requires.
- Calculate chargeable days against the **employee's actual scheduled workdays** and workspace holidays, not a naive inclusive date count.
- Provide balance ledger: opening, accrual, manual adjustments, approved deductions, reversals, and expiry. Do not derive balance solely from mutable totals.
- Approval or cancellation updates the ledger **exactly once** using transaction/idempotency handling. Avoid balance reduction both at creation and approval. Pending balances may be shown separately.
- Record whether approved leave is paid/unpaid for later payroll computation; do not equate every approved leave with a deduction.
- HR may make documented corrections; employee sees history and transparent balances.

**Done when:** Leave policy, request/approval, balance changes, calendar visibility, and payroll signals remain consistent for leave approval, rejection, cancellation, and amendment.

### 4.3 Attendance

**Tabs**

- **My attendance:** clock widget + current-month metrics + day-by-day timesheet.
- **Team attendance:** permission-gated employee/day matrix or list modeled on the PNG sample, filtered by month/department/employee/status; manager access is limited to direct/authorized reports.
- **Adjustments:** employee correction requests and manager/HR approvals for missed punches, unusual schedules, or wrong time entries. If the supplied sample has two tabs only, keep Adjustments as an action/subview rather than forcing a third tab.

**Clock actions**

- **Clock in**, **Start break**, **End break**, **Clock out** with valid state transitions, server-generated timestamps, and idempotent submissions.
- Persist raw punches as append-only audit events; derive/update a normalized daily timesheet with regular time, break time, overtime, late minutes, undertime, and status.
- Handle missing clock-out, overnight shifts, multiple breaks, rest-day work, holidays, sick/approved leave, duplicate requests, time-zone changes, and concurrent sessions. Never silently invent an end time for an unclosed shift.
- Late arrivals: configurable **15-minute grace period by default**, based on assigned schedule and workspace time zone. Explicitly define whether metrics count a late arrival only after grace; always retain actual clock-in time and actual minutes late for audit. Grace cannot change the source timestamp.
- Work calculation excludes unpaid break intervals; support configurable paid breaks. Overtime payable should require approval according to workspace policy, not just any extra logged minutes.

**Dashboard metrics, defaulting to current month**

- Days present
- Late arrivals (using the 15-minute default grace rule)
- Hours worked
- Absences

All metrics must be consistent with assigned schedules, approved leave, holidays, and rest days. An unscheduled day is not automatically an absence.

**Day-by-day table**

`Date | Scheduled | In | Out | Break | Worked | Late | Undertime | Overtime | Status | Actions`

- Populate **every calendar day** of selected month, including dates with no punches, with accurate statuses (present, absent, approved leave, incomplete, holiday, rest day, etc.).
- Month picker default current month; navigate months; CSV export with the same authorized, filtered data and user-friendly field formats.
- Prevent spreadsheet formula injection in CSV exports; ensure file name identifies workspace/module/month.
- Permissions for corrections, approvals, and exports must match the API.

**Done when:** Clock transitions and monthly totals are correct, rest days/holidays do not count as unjustified absences, authorized managers can inspect their team, and users can export consistent data.

### 4.4 Payroll

**Correct tab names — use exactly:**

1. **My Pay**
2. **Pay Runs**
3. **Employees**
4. **Settings**

#### My Pay

- Show the current employee's **published/finalized** payslips, payment periods, gross pay, deductions, net pay, payout status, and PDF/download where supported.
- **Take-home pay calculator:** clearly labeled *estimate*, using the selected pay period, employee pay profile, rates, deduction/tax rules, and workspace settings. Show line-item breakdown of earnings, statutory contributions, withholding, other deductions, and employer-only contributions separately.
- Employees must not see another employee's salary through query params, exported files, inferred IDs, cached responses, or direct object-storage URLs.
- Avoid revealing unreleased/draft payroll figures as official payslips.

#### Pay Runs

- For explicit authorized payroll operators only. List pay periods with `draft`, `calculated`, `under_review`, `approved`, `finalized`, `paid`, and `voided/adjusted` where applicable.
- Create period from workspace pay schedule and cutoff dates; take snapshots of employee compensation, attendance, approved overtime/leave, valid bonuses, deductions, and effective statutory rates.
- Review per-employee breakdown, totals, missing inputs, warnings, manual adjustments, validation failures, and calculation source references.
- Require explicit finalization, and optionally a second approver when configured (recommended for money-impacting actions). Marking paid must require appropriate capability and confirmation; no implied bank transfer.
- Generated payslip visibility starts on configurable publishing/finalization event. Generate reproducible exports (CSV; PDF payslips if existing PDF infrastructure supports them).
- Finalized pay runs are immutable. Corrections use controlled adjustment runs, void-and-reissue policy, or recorded subsequent-period corrections with audit trail.
- Design for idempotency: recalculating a draft must not create duplicate payslips, contributions, or line items.

#### Employees

- Restricted payroll roster: employees, employment status, pay type/frequency, monthly basic salary (or applicable base rate), employment dates, effective-dated compensation history, allowances, benefits, and payroll-specific settings.
- Collect only necessary government/statutory fields, with appropriate data minimization, encryption or equivalent protection, and masked presentation.
- Support salary updates with **effective date, reason, change history**, and editor identity. Salary is not stored in the public people-directory response.
- Permission controls by field and operation: people-directory access never implies payroll-roster access.

#### Settings

- **Workspace pay schedule:** monthly, semimonthly, and other supported frequencies; payout days, pay periods, attendance cutoff, timezone, currency, and payout reminders.
- **Payroll team:** assign/revoke payroll operator/accountant/reviewer permissions; only owner or separately authorized access administrator can grant or revoke *sensitive* payroll access. Avoid self-escalation.
- **Rates and policies:** working days/hours basis, overtime/holiday/rest-day multipliers, late/undertime policy, allowance/deduction configuration, contribution schedules, payroll rounding policy, effective dates, and calculation-version tracking.
- **Jurisdiction:** Philippines-first configuration, with extensibility for other countries later. Statutory contributions include SSS, PhilHealth, Pag-IBIG, and BIR compensation withholding where applicable. Display and store employee/employer portions separately.
- **Never hard-code guessed contribution rates**. Verify source tables/formulas against the latest official issuances, model effective start/end dates, and include deterministic fixtures and reviewer sign-off before payroll is permitted to be finalized as production-ready. Historical runs keep the rules in effect at that time.
- If statutory calculations are **not yet independently verified**, the calculator/run remains clearly *draft/estimate* and **finalization must be blocked or guarded by an explicit documented manual-verification process**. Do not present estimates as compliant payroll.
- Validate changes and audit who changed what, when, and effective date. Effective-dated settings must not rewrite closed runs.

**Payroll engine implementation requirements**

- Use a deterministic service with input snapshots and separated pure functions: earnings, paid/unpaid leave, attendance-based adjustments, deductions, statutory contributions, withholding, and net pay. Include transparent breakdowns.
- Define precise rounding rules, contribution caps/brackets, taxable/non-taxable categories, earned-period vs paid-period rules, cutoff logic, and policy precedence.
- Treat government contribution tables as **versioned configuration** maintained under validated rules, not arbitrary per-workspace inputs that can misrepresent legally required amounts. Let workspace admins configure business policies and approved adjustments but clearly distinguish statutory obligations.
- Support monthly salary and other explicit pay models only if fully accounted for in UI, schema, tests, and rate calculations.
- Keep payroll data isolated in backend services and restricted queries. Encrypt sensitive stored data where appropriate; do not place it in regular application logs or analytics.

**Done when:** A privileged payroll operator can configure an audited pay cycle, calculate/review a run using verified rules, finalize it, publish correct payslips to respective employees, and export records without exposing another employee's pay.

### 4.5 Onboarding

**Tabs**

- **My onboarding:** personalized progress checklist, assigned tasks, due dates, instructions, and required submissions.
- **Checklists:** HR/manager overview of onboarding assignments, owner/assignee, progress, blockers, and upcoming starts.
- **Templates:** authorized HR can build, reorder, edit, activate/archive, and assign reusable onboarding templates.

**Template content**

- Steps/groups (before day one, first day, first week, etc.)
- Checklist item description, due offset, assignee (employee, manager, HR, IT), required/optional, completion verification, attachments/links
- Optional example tasks: employee profile completion, policy acknowledgments, device/access requests, welcome meeting, payroll form collection, department onboarding

**Workflow**

- On invite/hire, assign a template to the workspace member or invited employee. Support pending invitation without violating current user/membership model.
- Checklist instances are **snapshots** of templates so future template edits do not silently rewrite existing employees' historical tasks.
- Allow assignees to complete tasks and authorized verifiers to approve required steps. Track completion history and notifications.
- Use existing secure Drive/storage and signed download patterns for attachments. Sensitive ID or financial documents are restricted to authorized HR/payroll staff; don't make them public workspace files.
- Onboarding and employment records may progress independently of workspace membership if access is not yet provisioned; no unauthenticated leakage.

**Done when:** HR creates a template, assigns an onboarding workflow, employees complete tasks, authorized staff verify and monitor progress, and workspace access stays secure.

### 4.6 People

**Tabs**

- **Directory:** member/employee cards and list with search, filters, presence/contact details as allowed, department, employment title, reporting manager, and employment status. **Invite people** action integrates existing workspace invitation flow.
- **Org chart:** manager/reporting structure grouped within the current workspace; hierarchy view with missing-manager and circular-report detection.
- **Departments:** department list, manager, employee count, assignment changes, add/edit/archive for authorized people managers.

**Identity and employment profile**

- Preserve existing platform `users` and `workspace_members` structure as auth/access control source of truth. Add workspace-scoped employee/employment details via an extension/entity rather than bloating the global `users` table with workspace-specific columns.
- Fields as needed: employee code, workspace ID, membership/user ID, department ID, job title, employment type, hire/start date, employment status, work location, manager membership ID, shift/schedule, optional contact/profile data. Keep optional fields optional.
- Distinguish **workspace role** (`owner`, `admin`, `member`, etc.), **job title** (e.g., Software Engineer), **department** (e.g., Engineering), and **HR permission grants** (e.g., `payroll.run.manage`). These are not interchangeable.
- Provide an authorized editing experience with validation, duplicate checks, appropriate field visibility, and separation between general and confidential employee records.
- Reuse invite, membership removal, profile display, messaging, and notification workflows. Treat termination/offboarding as an employment status transition; do not delete historical payroll, approvals, or audit entries.

**Done when:** A member can have a workspace-specific employment profile and org placement, while an ordinary directory viewer never receives payroll or private HR fields.

### 4.7 Optional supporting functionality

**HR Settings:** default workweek, office time zone, holidays, shifts and grace periods, leave categories/accrual, approval flows, allowed managers, permission assignments, and HR module access. Keep Payroll Settings in Payroll; link rather than duplicate.

**Reports & Analytics:** role-scoped headcount/department trends, leave usage, attendance exceptions, and payroll totals; aggregate payroll data restricted to payroll-capable roles. Default aggregated metrics should not leak small-group salary information to unauthorized users. Reuse existing exports and charts.

Implement these only after the six core sections are functional. Small settings needed by a core workflow belong in the core phase even if the optional page is deferred.

---

## 5. Permission architecture (highest priority)

### 5.1 Model

Evaluate a permission decision from **(authenticated user + active workspace membership + granted HR capabilities + target resource + relationship/scope + resource status)**. Deny by default. Jobs/department labels are **descriptive**, not authorization roles.

Recommended capability names (adapt existing conventions):

- `hr.people.read`, `hr.people.manage`, `hr.departments.manage`
- `hr.approvals.read_all`, `hr.approvals.manage`, `hr.approvals.decide_assigned`
- `hr.leave.read_team`, `hr.leave.manage_policy`, `hr.leave.adjust_balances`
- `hr.attendance.read_team`, `hr.attendance.correct`, `hr.attendance.manage_policy`
- `hr.onboarding.manage`, `hr.onboarding.verify`
- `hr.payroll.read_all`, `hr.payroll.compensation.manage`, `hr.payroll.runs.manage`, `hr.payroll.runs.approve`, `hr.payroll.settings.manage`, `hr.payroll.mark_paid`
- `hr.permissions.manage`, `hr.reports.read`, `hr.reports.payroll_read`

`*.own.read` access can be represented by authenticated relationship checks rather than granting global capabilities. Consider department/direct-report scope in addition to `workspace` scope. Reuse existing authorization infrastructure or make a small cohesive HR authorization layer.

### 5.2 Suggested default policy

| Feature or operation | Employee | Team manager | HR specialist | Payroll/accounting | Workspace owner |
|---|---|---|---|---|---|
| View/edit own basic profile (allowed fields) | Yes | Yes | Yes | Yes | Yes |
| Browse workspace directory | Yes | Yes | Yes | Yes | Yes |
| View own pay/published payslips | Yes | Yes | Yes | Yes | Yes |
| View **other employees' salaries** | No | **No** | **No by default** | **Yes, if granted** | Yes |
| Modify compensation | No | No | Only if separately granted | Only if granted | Yes |
| View own leave/attendance | Yes | Yes | Yes | Yes | Yes |
| View team leave/attendance | No | Assigned team only | Authorized scope | Only if granted | Yes |
| Approve requests | If assigned, not own | If assigned | If assigned | If assigned | If assigned/override |
| See `All requests` | No | Only if specifically granted/scoped | If granted | If granted | Yes |
| Manage leave/work schedules/onboarding | No | Scoped actions | If granted | No by default | Yes |
| View/manage pay runs | No | No | No by default | If granted | Yes |
| Edit payroll settings | No | No | No by default | If separately granted | Yes |
| Grant sensitive payroll permissions | No | No | No | No by default | Yes |

**Important:** A person may be both manager and payroll operator; capabilities combine explicitly, not through a job-title string. A generic workspace `admin` is **not** equivalent to `owner` and does not automatically obtain salary access. The owner may explicitly delegate sensitive HR/payroll capabilities, with logs and optional reauthentication for critical changes.

### 5.3 Enforcement checklist

- Resolve active workspace from authenticated membership, never trust a client-provided workspace ID without validation.
- Scope every lookup, join, `UPDATE`, `DELETE`, export, file, and background job by active workspace and authorized employee set; prevent cross-workspace IDOR.
- Use narrow DTOs/serializers: general directory payloads must omit salary, government IDs, tax details, sensitive leave reasons, or private document URLs.
- Recheck auth at every API action. Hide unauthorized tabs **and** block direct routes/endpoints and background/file export actions.
- One member cannot assign themselves payroll privileges, approve their own compensation change, access own unreleased payroll run, or bypass workflow states.
- Audit sensitive reads as feasible (especially exports) and all sensitive changes, including payroll permissions, salaries, payroll finalizations, time corrections, leave balance adjustments.
- Use short-lived authenticated file download URLs and storage key isolation; do not rely on a guessed object key as authorization.
- Test explicit deny cases with at least two workspaces and users with overlapping roles.

---

## 6. Database refactor and data model

### 6.1 Required schema-folder refactor

Replace the current single schema file with a **schema folder and logical TS files**, following the actual database package structure. This is a **structural refactor**, not permission to change existing tables inadvertently. Example only:

```text
packages/
  db/
    src/
      schema/
        index.ts
        users.ts
        workspaces.ts
        workspace-members.ts
        departments.ts
        employees.ts
        hr-permissions.ts
        approval-requests.ts
        approval-steps.ts
        leave-policies.ts
        leave-balances.ts
        leave-requests.ts
        attendance.ts
        payroll.ts
        onboarding.ts
        hr-audit.ts
      index.ts
      ...existing database code
```

- Preserve table definitions, exported names, relations, indexes, constraints, and existing application imports. `schema/index.ts` should re-export required table and relation definitions.
- Update ORM schema/glob configuration, schema entry points, relation imports, migration scripts, seed code, tests, and all dependent package exports. Ensure migration discovery loads **all** split files.
- Compare before/after generated SQL or schema diff for the refactor alone: it should be a **no-op for existing tables**. Do not let a moved definition trigger drop/recreate operations.
- Keep refactor as a separate reviewable change/commit from new HR feature migrations where practical.
- Run migrations against a safe development/test database; keep a migration rollback/recovery plan. Preserve existing records and associations.

### 6.2 Proposed HR tables/entities

Name and group these according to current conventions. Reuse shared IDs, timestamp strategy, enums, and foreign-key helpers.

| Area | Suggested entities | Critical details |
|---|---|---|
| People | `departments`, `employee_profiles`, `employment_status_history`, `work_schedules`, `employee_schedule_assignments` | `workspace_id`, `member_id`, manager relation; no globally scoped salary on `users` |
| HR auth | `hr_permission_grants`, `hr_permission_change_logs` | Grant subject, scope, capability, grantor, revoker, timestamp |
| Approvals | `approval_requests`, `approval_steps`, `approval_decisions`, `approval_comments`, `approval_attachments` | Type, canonical domain reference, sequential steps, typed details, immutable decision events |
| Leave | `leave_types`, `leave_policies`, `leave_balance_ledgers`, `leave_requests`, `holidays` | Accrual, adjustment transactions, overlap constraints, status and policy version |
| Attendance | `attendance_events`, `attendance_entries`, `attendance_adjustment_requests`, `attendance_breaks` | Raw punch event log, normalized shifts, breaks, timezone/schedule snapshots |
| Payroll | `employee_compensation`, `compensation_history`, `pay_schedules`, `payroll_settings`, `payroll_rule_versions`, `payroll_runs`, `payroll_run_employees`, `payroll_line_items`, `payslips`, `payroll_adjustments` | Effective dates, currency, employee/employer deductions, immutable snapshots, finalized state |
| Onboarding | `onboarding_templates`, `onboarding_template_steps`, `onboarding_instances`, `onboarding_tasks`, `onboarding_task_events` | Assignment snapshots, owner, assignee, due date, completion verification |
| Governance | `hr_audit_events`, optional `hr_file_attachments` | Workspace, actor, action, target, timestamp, safe metadata only |

**Design decisions:**

- Scope entities by `workspace_id`; add appropriate composite indexes and unique constraints, including `(workspace_id, member_id)` for employee mapping where relevant. Foreign keys must not permit linking a member/employee belonging to another workspace.
- Prefer reusing existing `workspace_members` rather than inventing a new identity mapping. For employees invited before account creation, use existing invitation IDs or a controlled prehire record.
- Separate general employee details from confidential compensation/IDs. Use encryption or equivalent protected storage for particularly sensitive values, and avoid selecting confidential columns on general queries.
- Effective-dated salary and statutory-rate records preserve history. Payroll run records carry a calculation snapshot and source references so results can be reproduced.
- Use a clear leave ledger with immutable events or controlled compensating transactions. Use transactions for approve/reject/cancel and recalculation flows.
- Introduce explicit numeric precision, constraints, and naming for monetary amounts, paid hours, durations, dates, statuses, and currency. Do not store salary as freeform text.
- Preserve auditability for status transitions and permission changes. Where possible, add check constraints, uniqueness, and concurrency protection at the DB level rather than UI only.
- Centralize reusable business rules in testable services; don't encode payroll or balance logic solely inside view components.

---

## 7. API and service boundaries

Use existing API/router validation and typed client patterns. The paths below are **logical examples, not mandated routes**; fit them into the actual repository.

| Area | Suggested operations |
|---|---|
| People | `GET /hr/people`, `GET/PATCH /hr/people/:id`, department CRUD, manager assignment, invite via existing workspace mechanism |
| Approvals | `GET/POST /hr/requests`, `GET /hr/requests/:id`, draft/submit, approve/reject/cancel, request history/comments/attachments |
| Leave | `GET /hr/leave/me`, `GET /hr/leave/team`, policies/balances, create request, cancel, authorized adjustments |
| Attendance | `GET /hr/attendance/me`, `GET /hr/attendance/team`, punch action, monthly detail, CSV, adjustment request/review |
| Payroll | `GET /hr/payroll/me`, privileged employees, run create/calculate/review/approve/finalize/publish/mark-paid, payslip download, pay estimate, settings |
| Onboarding | template CRUD/versioning, assign/checklist detail, task complete/verify, status |
| Configuration | workspace schedule/holiday/leave/approval policies, explicit HR capability grants, reports as authorized |

For each endpoint, implement validated inputs, workspace membership checks, record relationship checks, transactional service methods, stable pagination/filtering where appropriate, structured errors, audit events for sensitive operations, and tests. Minimize data sent to the client. Do not expose storage buckets, raw HR attachments, payroll templates, or salary history through general-purpose Drive/directory endpoints.

**Integration contract examples:**

- `createLeaveRequest` creates the canonical leave record and linked approval workflow; both screens render consistent status.
- `approveLeaveRequest` creates exactly one balance-ledger change, and the payroll service consumes an authorized, approved leave snapshot.
- `approveOvertime` exposes eligible approved overtime to payroll calculation; raw hours alone are not automatically payable.
- `requestAttendanceCorrection` preserves original punch events and creates a reviewed adjustment, not a silent overwrite.
- `generatePayrollRun` reads effective employment/pay settings + attendance + leave + approved adjustments and snapshots them for audit.
- `publishPayslip` exposes only that employee's record after release and verifies membership/identity for downloads.

---

## 8. Implementation phases and commit strategy

**Execute in dependency order.** Finish and test each phase before the next. Keep work reviewable; create separate commits for independent vertical slices with descriptive messages. Do not silently skip blocked subtasks.

### Phase 0 — Discovery and design mapping

- Map all PNGs to components/screens; review repo docs, schema, auth, workspace scoping, current UI, and service patterns.
- Produce concrete data model and permission-capability mapping.
- **Gate:** identified integration points and plan deviations recorded.

### Phase 1 — Schema structure + shared foundations

- Split `schema.ts` into `schema/` without destructive migration diff; update imports/tooling.
- Add HR permission layer and workspace-safe employee profile, departments, and policy primitives.
- Add shared validation/types, server guards, protected API clients, audit helpers, and baseline tests.
- **Gate:** existing app continues running; no existing data lost; cross-workspace forbidden-access tests pass.

### Phase 2 — People

- Build directory, profile, org chart, departments, invitation integration, manager hierarchy, and scoped CRUD.
- **Gate:** users can be assigned to departments/managers without modifying their workspace auth role; salary is absent from directory API payloads.

### Phase 3 — Approvals

- Typed request forms, assigned approver queues, lifecycle, comments, attachments, decisions, all-requests gating, and notifications.
- **Gate:** sequential and single approver workflow works; requester cannot self-approve; pending decisions are idempotent.

### Phase 4 — Leave

- Leave policies and balances, accrual/ledger, request form, approver linkage, who-is-out and team balances.
- **Gate:** approving/rejecting/cancelling affects balance correctly exactly once; schedule/holiday-aware day calculation tested.

### Phase 5 — Attendance

- Clock state machine, break tracking, work schedules, holiday/rest-day handling, metrics, month table, team view, adjustments, CSV export.
- **Gate:** standard, incomplete, overnight, late-grace, multi-break, and leave/rest-day scenarios pass tests.

### Phase 6 — Payroll (restricted delivery)

- Compensation roster/history, payroll settings and role grants, deterministic calculation engine, own-pay view, pay-run lifecycle, payslips, exports, and audit.
- Build and validate up-to-date Philippines-specific statutory configurations before production finalization; require formal review for unverified calculation rules.
- **Gate:** end-to-end pay run from attendance/approved leave to employee-visible released payslip is repeatable and permission-safe; no salary leakage to employee/manager/ordinary workspace admin.

### Phase 7 — Onboarding

- Template builder, steps/checklists, assignments, secure uploads, task verification, progress, invite integration.
- **Gate:** staff complete an assigned onboarding flow, with template snapshots and restricted attachments.

### Phase 8 — Integration, optional supporting UI, and hardening

- Add small HR Settings and Reports links/pages where useful; implement remaining notifications, filters, empty states, responsive UI, export consistency, audit viewer for authorized staff, and performance improvements.
- Compare implemented pages against actual PNG samples while preserving current design system.
- **Gate:** all six sections have functional primary workflows; no fake metrics, dead buttons, placeholder records, or duplicated state.

### Phase 9 — Verification, docs, and delivery

- Run format/lint/typecheck/unit/integration/E2E/build scripts already defined in repo (e.g., oxc/oxlint, Vitest, Playwright, Turborepo, if present).
- Test both **web and Electron desktop**, including navigation and session/workspace switching.
- Add/update module architecture docs, ER diagram or schema map, permission matrix, settings/reference guide, known limitations, API docs, migration notes, and local setup/dev seeds.
- Summarize committed changes, migration steps, test results, optional/deferred features, security decisions, and any statutory validation still needed.

---

## 9. Critical test scenarios

Write automated coverage at **unit (pure rules), integration (API/DB auth), and E2E (real flows)** levels. At minimum:

1. Employee A of Workspace X cannot view or export Employee B's payslip or compensation; Workspace Y's owner cannot access X's data even using known IDs.
2. Generic `workspace.admin` cannot browse payroll data or grant themselves payroll capabilities without explicit owner permission.
3. A manager can view **authorized direct reports'** attendance/leave but not their salaries and not other teams' protected records.
4. An HR specialist with people/leave permissions but no payroll grant cannot access Payroll Employees, Pay Runs, or Payroll Settings.
5. Only properly assigned approvers can decide a request; duplicate approve calls do not create duplicate leave-ledger entries.
6. Approved leave appears in Who is out and changes the correct balances; declined/cancelled leave does not consume entitlement, and confidential leave detail stays restricted.
7. Clocks reject impossible transitions; starting/stopping several breaks produces accurate worked minutes; server time is authoritative.
8. Grace: schedule at 08:00, clock-in at 08:15 is **not counted late** under a 15-minute grace rule, while 08:16 is. Exact source times are preserved.
9. Rest days, holidays, approved leave, and employees with no assigned shift are not all counted indiscriminately as absences.
10. Attendance overnight shifts have correct local workday attribution and correct total hours across midnight.
11. Payroll calculation snapshots use effective-dated compensation and statutory rule versions; past published runs don't change after rate updates.
12. A run cannot be finalized twice or while invalid/unverified; employee sees their own payslip only after publication.
13. All salary/config/permission changes show correct actor, timestamp, and prior/new values in protected audit records without exposing raw secrets.
14. Employee onboarding templates can change without retroactively altering assigned checklist history; attachments stay private.
15. Schema file split creates **zero** drop/recreate changes for existing tables; fresh setup and upgrade migration paths pass.
16. CSV exports match authorized on-screen rows and escape potentially malicious spreadsheet formulas.
17. Web and desktop render all tabs, state changes, forms, loading/error/empty states, and workspace switching correctly.

---

## 10. Philippine statutory and privacy verification

This is a **software implementation plan, not a certification that a payroll engine is legally compliant**. Prior to permitting production payroll finalization, verify effective rules, employee/employer contribution splits, caps, withholding/benefit handling, cutoff dates, and rounding with an authorized payroll/accounting reviewer using primary sources.

Useful official starting points (verify whether newer rules supersede them):

- SSS contributions and schedules: https://www.sss.gov.ph/pay-contribution/
- PhilHealth employer resources and circular/advisory archive: https://www.philhealth.gov.ph/ and https://www.philhealth.gov.ph/circulars/2026/archives.php
- Bureau of Internal Revenue compensation withholding: https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf and https://www.bir.gov.ph/
- Pag-IBIG official information: https://www.pagibigfund.gov.ph/
- Philippine Data Privacy Act and implementing rules: https://privacy.gov.ph/data-privacy-act/ and https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/

Include privacy notices, lawful-basis assessment, retention/access policies, encrypted/controlled data handling, and incident logging. Treat payroll, government identifiers, medical attachments, and personal HR records as restricted information. Government tables may change even when application code does not; build explicit effective-date/version updates and regression tests.

---

## 11. Definition of done

The implementation is complete only if:

- All six sections work on **web and desktop** with consistent navigation and UI, using the PNGs as visual references and existing LumoLynk design components.
- Payroll tabs are named **My Pay, Pay Runs, Employees, Settings**, in that order.
- Employees can create requests, request leave, clock attendance/breaks, see their own payslips, complete onboarding, and browse the permitted directory.
- Properly authorized managers, HR specialists, and accounting/payroll users can perform their assigned responsibilities without seeing more data than necessary.
- Workspace owner can configure HR/payroll access; **workspace admin and job title alone never grant access to salaries**.
- Payroll runs derive from validated, traceable effective-dated inputs; production finalization is gated on verified statutory rules, and finalized outputs remain auditable.
- The monolithic schema file is split into maintainable files **without destructive changes to existing tables**.
- All sensitive endpoints and exports have scope enforcement, audit logging, validation, and meaningful regression coverage.
- Existing workspace, auth, messaging, Drive, user management, and other modules still function correctly.
- No unimplemented buttons, mock-only dashboards, fabricated payroll figures, or silently skipped acceptance criteria remain.
