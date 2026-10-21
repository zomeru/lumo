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
