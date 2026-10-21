# People & HR

## Discovery (phase 0)

The implementation specification is `docs/implementation_plans/05-people-hr-implementation-plan.md`.
All 16 PNGs were opened and inspected before implementation:

| Sample directory | Files | Mapping |
| --- | --- | --- |
| `1_Approvals` | `1_Approvals_Page.png`, `2_New_Request_Page_(But it should be a modal).png` | Three queues; request-type picker inside a Radix dialog |
| `2_Leave` | `1_Leave_Page.png`, `2_Who_is_out_page.png`, `3_Team_balances_Page.png` | Balance cards, absence calendar/list, team balance table |
| `3_Attendance` | `1_Attendance_Page.png`, `2_Attendance_Page_(Clock in is clicked).png` | Clock states, four monthly metrics, full month timesheet |
| `4_Payroll` | `1_Payroll_My_Pay_tab_page.png`, `2_Payroll_Pay_runs_tab_page.png`, `3_Payroll_Employees_tab_page.png`, `4_Payroll_Settings_tab_page_part-1.png`, `5_Payroll_Settings_tab_page_part-2.png`, `6_Payroll_Settings_tab_page_part-3.png` | Payslips and estimate, runs, confidential roster, schedule/access/rules settings |
| `5_Onboarding` | `1_Onboarding_My_Steps_tab_page.png`, `2_Onboarding_Checklists_tab_page.png` | Personal tasks, checklist progress, template builder |
| `6_People` | `1_People_page.png` | Searchable directory cards, org hierarchy; add departments per specification |

### Existing integration points

- Better Auth uses `users`; membership identity is the composite `(workspace_id, user_id)` in `workspace_members`, not a synthetic membership ID.
- `apps/api/src/modules/workspaces/workspace.service.ts` owns membership, invitations, and the shared workspace transaction lock. HR reuses it, including checks after lock acquisition.
- Hono handles authenticated `/api/v1` routes, JSON/origin validation, no-store responses, sanitized errors and rate limits. HR lives under `/workspaces/:workspaceId/hr` in `apps/api/src/modules/hr`.
- Drizzle lives in `packages/database`; existing monolithic schema is split with unchanged definitions and exports before feature migrations.
- Shared Zod inputs/DTOs and capability names live at `@lumo/contracts/hr`. No browser imports server code.
- `packages/app/src/features/hr` owns all six screens and TanStack Query composition. File routes use the existing authenticated workspace layout. Web and Electron consume these same screens and the platform transport.
- `@lumo/ui` supplies dialogs, fields, selects, tables, cards, progress, avatars, errors, buttons, and theme tokens. Keep the current logo and light/dark blue theme, responsive shell and desktop header.
- Drive storage exposes verified presigned uploads and short-lived downloads. Restricted HR files use isolated keys and independent relationship authorization; they must never enter general Drive listings or inherit workspace-wide sharing.
- Existing audit events have no before/after payload; a protected HR audit stream adds safe structured change history. There is no general application-notification service (only Wiki invalidation); HR uses durable recipient-scoped inbox records.
- Integration tests use real PostgreSQL, isolated random schemas on `TEST_DATABASE_URL` ending `_test`; Playwright covers browser and Electron.

### Data and authorization boundaries

Employment profiles extend workspace membership; job titles and global user profiles never grant authority. Owner has all HR capabilities. All other roles, including admin, need explicit grants. Grants can be workspace-wide or direct-report scoped for team attendance/leave; own access is a relationship check. Sensitive access administration forbids self-escalation. Salary queries, exports and audit records have dedicated guards and narrow serializers.

Canonical approval requests carry validated discriminated details for all seven types; leave/overtime reuse their status rather than copying workflow state into another table. Leave ledger entries reference that canonical request. Ordered steps and immutable decision events preserve history. Daily attendance retains raw punches plus reviewed corrections. Payroll snapshots effective compensation, rules, attendance, approved leave/overtime and classified adjustments; closed runs remain immutable. Onboarding assignments snapshot templates and retain task events.

### Deliberate adaptations

- Sample attendance copy says device clock; authoritative punch time comes from the server.
- Sample payroll copy grants admins payroll access; generic admin has no payroll access here.
- Sample leave figures and payroll rates are illustrative only. No fabricated entitlements or salaries are seeded.
- Payroll tabs use the specification's exact capitalization: My Pay, Pay Runs, Employees, Settings.
- Only explicitly supported pay models/frequencies are selectable. Statutory validation and reviewer sign-off are separate from software implementation; estimates cannot bypass finalization checks.
- PDF infrastructure is absent; reproducible authenticated CSV/printable payslip output is used.

## Delivery log

- Phase 0: repository and PNG discovery complete; data/permission boundaries recorded above.
