# UI consistency and configurable payroll

## Review and decisions

Inspected shared `@lumo/ui` primitives, account/workspace screens and shell, Contacts,
Messenger, Meetings/Calendar, Drive, the shared Docs/Sheets/Slides/All Files inventory,
Office/Wiki editor layouts, all six HR screens and Electron chrome/transport boundaries.
The web and desktop render the same feature components from `packages/app`.

The existing blue theme, typography, cards, fields, menus, Radix dialogs and page heading
already provide a coherent baseline. Keep these and improve their shared primitives;
rebuilding each module would duplicate behavior and risk editor/meeting workflows.
Drive/file inventories used filled rounded pills; HR used separate square outlined
buttons over an underline. Neither selected treatment was consistent with the rest.

Use shared `ViewNavigation` / `ViewNavigationItem` for section views, with a quiet surface,
clear blue underline, visible focus, and horizontal scrolling on narrow screens. `ViewTabs`
composes that navigation for simple named views. This is navigation, not an ARIA tablist
with missing panels. Native button/link keyboard semantics and URL-backed state remain.
Shared `FilterBar` makes search/filter controls align and wrap consistently. Calendar's
view picker and Wiki's editor modes remain purpose-specific controls; pages without
multiple views gain no tabs. Office editors retain their full-height layout and native
Electron chrome keeps its drag/window-control boundary.

The shared heading now wraps actions on narrow screens; tables use surface backgrounds
and aligned numerals, buttons support touch manipulation, and dialogs contain overscroll.
HR icons are centralized and used by navigation and headings: Stamp, TreePalm, Clock,
Wallet, ListChecks and the existing Users icon. Logo and palette remain intact.

Review reference: [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).

## Payroll follow-through

The existing engine already calculates contributions, but reads one application-owned
configuration and only displays source references in Settings. Add explicit, immutable,
workspace-scoped effective configurations with structured contribution/table editors,
backend validation and calculation selection, source/evidence history and audit records.
Preserve existing finalized snapshots, capability boundaries and independent release review.
New settings change future calculations; saving a configuration performs no payment.

### Effective versions and calculation boundary

`GET/POST /api/v1/workspaces/:workspaceId/hr/payroll/statutory-configurations`
requires `hr.payroll.settings.manage`. Workspace owners have this capability; a
workspace admin, manager title or permission administrator does not acquire it implicitly.
Versions are append-only, with an effective month, review end date, source references,
change reason and explicit acknowledgement. No migration activates a configuration.
The returned template is a reference draft and must be reviewed and explicitly saved.

New payroll generation requires a saved configuration covering the entire period.
Saving a version returns affected open calculations to draft, increments their revision,
removes stale employee results and clears approval. A change affecting a finalized or
paid period is rejected; use the established subsequent-period adjustment/void workflow.
Run and employee snapshots store the full applicable configuration and its immutable ID.
Published historical payslips remain readable even if a current estimate has no coverage.

Amounts are integer centavos and rates are integer basis points. Products/divisions use
BigInt with selectable nearest, up or down centavo rounding. SSS has explicit salary
ranges, credits, regular/MPF rates and employer-only EC; Pag-IBIG has salary ranges,
rates and compensation/individual contribution caps. PhilHealth rounds the total premium
then assigns the employee share and employer remainder so their sum equals the premium.
BIR uses the configured monthly/semimonthly fixed-plus-marginal brackets.

Monthly basic, monthly salary plus allowances, and actual period remuneration are explicit
salary-base choices. Actual remuneration includes earnings and taxable/non-taxable manual
earnings, less approved unpaid leave and configured attendance deductions. Semimonthly
actual-remuneration contributions are collected at month-end using the finalized first
cutoff's immutable earnings plus the second cutoff; missing first-cutoff evidence blocks
release unless the employee joined in the second cutoff. Other contributions may split
the monthly amount, assigning an odd centavo to the second cutoff, or collect at month-end.
A departing employee's final first cutoff collects month-end-only contributions immediately;
proration still requires independent payroll verification. A cutoff used by finalized
month-end payroll cannot be voided independently.

Reference template sources (reviewed 2026-10-21; references do not certify applicability):

- [SSS Circular 2024-006, contribution table](https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf)
  and [SSS remuneration, MSC and EC guidance](https://www.sss.gov.ph/pay-contribution/).
- [PhilHealth Advisory 2025-0002](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf).
- [Pag-IBIG Circular 460, official DMW-hosted copy](https://dmw.gov.ph/archives/v1/resources/dsms/DMW/ISN-EXT/2025/DMW-ADVISORY-37-2025.pdf).
- [BIR RR 11-2018 Annex E, 2023 onward tables](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf).
