# Lumo Connect: Calendar Implementation Plan

## Objective

Implement **Calendar** as a new section under **Connect**, integrated with **Meetings**. Calendar becomes the single place for scheduling meetings and viewing meeting schedules in the active workspace.

**Key rule:** Calendar visibility is workspace-restricted, but a meeting's join policy remains independent. A **public-link meeting** can still be joined by someone outside the workspace if they have its valid meeting link. That access must never grant visibility into the workspace calendar or unrelated meetings.

## 1. First, inspect the existing codebase

Before making changes:

1. Read the existing project documentation, particularly the business flows, architecture, routing, shared UI patterns, authorization, workspace membership, and meeting flow.
2. Inspect the **Connect** navigation and **Meetings** UI on web and desktop, including shared packages and responsive layouts.
3. Trace current meeting create, schedule, join, cancel, update, and authorization flows from UI to API to database.
4. Identify the existing meeting model, workspace scoping, authentication/authorization middleware, realtime/event mechanisms, and testing conventions.
5. Reuse the existing architecture, design system, database patterns, and meeting provider. Do not create duplicate meeting models, parallel scheduling APIs, or a separate calendar store if scheduled meetings can be the source of truth.
6. If details below differ from the actual repository, adapt to the established conventions and explain the differences in the implementation summary.

Implement working functionality, not a UI-only mockup.

## 2. Navigation and ownership

Add **Calendar** under **Connect**, alongside **Meetings**, for both web and desktop wherever Connect is present.

- Follow existing route and sidebar conventions. Illustrative route only: `/workspaces/:workspaceId/connect/calendar`.
- Clearly distinguish the active **Meetings** and **Calendar** items; no simultaneous active highlights.
- Respect the selected workspace. Switching workspaces changes the displayed Calendar data and must never carry over schedules from the previous workspace.
- Use the app's existing shared UI components, Tailwind v4 styling conventions, Lucide icons, and professional blue/dark-blue visual direction. Keep web and desktop visually and functionally consistent.
- Include loading, empty, error, offline/retry (if supported), and unauthorized states.

## 3. Meetings-to-Calendar scheduling flow

### Meetings page

- Keep the existing meeting functionality, including **New meeting / Start now**, **Join meeting**, and meeting lists/details as appropriate.
- Replace the existing inline/modal/standalone **Schedule meeting** creation flow with a **Schedule meeting** action that navigates to **Calendar**.
- Opening Calendar through this action must open the scheduling composer automatically, preferably with the active workspace and a suitable initial date/time selected.
- Remove the old scheduling form and any duplicated schedule-creation logic from Meetings. Preserve other meeting features.
- A user returning from Calendar to Meetings should see the newly scheduled meeting through the existing meeting list, without reloading manually when the app supports cache invalidation/realtime updates.

### Calendar page

- Users can click **Schedule meeting** or select a date/time slot directly on the calendar to open the same scheduling composer.
- Provide **month, week, day** views; default to **week** unless the codebase already uses a preferred calendar pattern. Include **Today**, previous/next navigation, and a visible current date range.
- Show all scheduled meetings belonging to the **currently active workspace**, including meetings created by other members, subject to any existing explicitly defined role-based restrictions. Do not silently hide others' meetings just because the viewer is not their organizer.
- Differentiate upcoming, in-progress, completed, and canceled meetings visually where useful. Canceled meetings can be shown subdued or excluded by a documented filter, but their handling must be consistent.
- Selecting an event opens meeting details: title, date, start/end time, organizer, description if permitted, join policy, and meeting actions authorized for the viewer.
- Display date/time in the user's local timezone while preserving the original meeting timezone for editing and user clarity.
- Ensure responsive behavior in web and desktop window sizes. Prefer a useful agenda/list alternative at narrow widths rather than squeezing a dense grid.

## 4. Schedule meeting form

Reuse existing meeting form fields and validation when available. At minimum support:

- Meeting title (required).
- Description/agenda (optional).
- Date, start time, and end time or duration (required).
- Clearly labeled timezone (default to the user's effective timezone; use an IANA timezone ID).
- Organizer/creator, derived from the authenticated user (never trusted from arbitrary client input).
- Meeting access policy, preserving existing semantics:
  - **Workspace-only:** only authorized current workspace members can access/join.
  - **Anyone with link / Public link:** valid-link holders may access/join the specific meeting without joining the workspace.
- Optional participants/invitees only if the current Meetings implementation supports them; don't introduce a new invitation system as a prerequisite.

Behavior:

- Selecting a calendar slot pre-fills the date/time. The user can change it before saving.
- Validate all fields client-side for feedback and server-side for enforcement: end after start, valid timezone, reasonable duration, valid meeting state, and permission to schedule in that workspace.
- Show availability and conflicts based on relevant existing meetings. **Do not block an entire workspace time slot merely because another meeting exists:** simultaneous meetings can be legitimate. At minimum flag conflicts for the organizer; include participant conflicts if participant membership/attendance data already exists. If the product has explicit shared resource limits, enforce those separately.
- Make conflict rules and any available-slot suggestions clear in the UI; prevent invalid submissions and support correction.
- Use an atomic server-side create/update operation so simultaneous requests cannot bypass a hard conflict constraint if one exists. Treat soft conflict warnings as warnings, not fabricated hard restrictions.
- After successful creation: persist the meeting, show it immediately in Calendar, offer **View meeting** and **Copy link**, and make it visible from Meetings.
- Retain the existing provider integration and meeting link generation; never generate predictable, easily enumerable guest access tokens.

## 5. Workspace membership, privacy, and public meeting links

**Calendar access and meeting join access are two different permissions.** Implement and test them independently.

| User / situation | View active workspace Calendar | Schedule/edit workspace meetings | Join a workspace-only meeting | Join a public-link meeting |
| --- | --- | --- | --- | --- |
| Authenticated workspace member | Yes | According to established workspace/meeting roles | Yes, subject to existing meeting controls | Yes, with valid link |
| Authenticated user who is not a member | No | No | No | Yes, with valid link |
| Unauthenticated guest | No | No | No | Yes, with valid link, if existing guest-join policy allows |

Security requirements:

1. Enforce workspace membership in the API for **all Calendar list/detail/availability endpoints**, not only the sidebar or client route guard.
2. Filter every calendar event query by active workspace ID and verify membership. Reject cross-workspace IDs and forged mutations.
3. Limit calendar editing, rescheduling, cancellation, and deletion to the existing authorized organizer/admin/role policy. A member's ability to view all events does **not** automatically mean they can edit all events.
4. Keep public/private **meeting join policy** separate from **calendar listing visibility**. A public meeting is **not** a publicly browsable calendar event.
5. Preserve the current public meeting link flow for external guests. A link can grant access to its single meeting and the minimal information needed to join, but **not** the Calendar, other workspace meetings, workspace member lists, or unrelated metadata.
6. Workspace-only meeting links must still enforce workspace membership server-side, even if someone knows the URL.
7. On workspace switch or membership revocation, invalidate cached calendar queries and ensure server requests are reauthorized.
8. Do not expose workspace calendar content in unauthenticated API responses, realtime channels, search, previews, or public metadata.
9. Retain existing lobby, admission, participant controls, expiry, and recording protections where implemented. Do not regress provider-side authorization.

## 6. Data model and API design

**Prefer extending the existing Meetings domain**. Calendar is a view and scheduling entry point, not a second event database.

Inspect existing fields before adding migrations. Scheduled meetings generally need:

- `id`, `workspaceId`, `organizerId`
- `title`, `description`
- `startsAt`, `endsAt` (persist as UTC instants)
- `timeZone` (IANA identifier used for scheduling/display intent)
- `status` (compatible with existing immediate/scheduled/live/completed/canceled states)
- `accessPolicy` or existing equivalent (`workspace_only` / `public_link`)
- existing meeting provider references and secure join-link/token handling
- standard audit timestamps and actor metadata

Do not rename or duplicate these fields if the project already models them differently. Create migrations only when necessary, including indexes for workspace + time-range queries. Preserve existing meeting records and meeting URLs.

Expected backend capabilities, adapting route names to existing conventions:

- List meetings for the active workspace within a requested date range (bounded and paginated where appropriate).
- Return availability/conflict information for scheduling, scoped to the authorized workspace and relevant attendees.
- Create a scheduled meeting using the existing meeting creation service.
- View, reschedule, cancel, or edit a scheduled meeting, subject to existing permission rules.
- Keep **public guest meeting join** accessible through the existing narrowly scoped join flow without opening Calendar endpoints.

Use secure input validation, authenticated workspace context, reasonable date-range limits, database-level consistency, and server-derived ownership. Avoid N+1 queries. Prevent stale event data after mutation through the project's established query invalidation and/or realtime infrastructure.

For times and dates:

- Store instants consistently in UTC, display in the user's timezone, and retain the scheduling timezone when applicable.
- Handle cross-day meetings and timezone differences correctly.
- Handle daylight saving time gaps/ambiguous local times and prevent invalid timestamps.
- Derive event state consistently from persisted status and current time; avoid conflicting UI/API classifications.

## 7. Live updates and integration

- Calendar updates should appear in Meetings, and existing Meeting updates should appear in Calendar. Both consume the same underlying records.
- If the application already has a realtime event system, publish appropriately scoped schedule-created/updated/canceled events to authorized workspace members. Do not expose workspace event payloads to public guests.
- If realtime is not present for this domain, use the project's existing query refresh/invalidation approach. Avoid adding new infrastructure solely for this feature.
- Refresh calendar views after switching workspaces, creating/updating/canceling meetings, and regaining connectivity where supported.
- Opening a Calendar event should navigate to or reuse existing meeting details and join flows rather than implementing an alternate video/voice meeting UI.

## 8. Suggested delivery phases

**Phase 1: Discovery and design**
- Map existing Connect navigation, Meetings schedule/join flows, workspace access controls, data schema, backend endpoints, and shared UI patterns.
- Write a concise integration plan based on actual files and decide which components/services to reuse.

**Phase 2: Domain/API foundation**
- Add only required schema changes/migrations.
- Implement authenticated, workspace-scoped calendar queries and schedule operations using the existing Meetings domain.
- Preserve separate public-link guest join access and workspace-only enforcement.
- Add backend validation and permission tests before exposing new UI actions.

**Phase 3: Calendar UI**
- Add the Connect > Calendar navigation and route.
- Implement responsive month/week/day/agenda views, events, event details, and scheduling composer using existing design-system components.
- Implement slot selection, date/time availability/conflict indication, loading/empty/error states, and timezone display.

**Phase 4: Meetings integration**
- Wire **Meetings > Schedule meeting** to Calendar with composer opened.
- Remove duplicated scheduling UI from Meetings, keeping immediate-start and join behaviors.
- Integrate creation/update/cancellation, links, navigation, and cross-page refresh.

**Phase 5: QA, security, and documentation**
- Run project lint, formatting, typecheck, unit/integration tests, and available E2E suites.
- Add tests for membership boundaries, public links, scheduling, navigation, and realtime/cache consistency.
- Update project documentation for the Connect business flow, routes, permissions, and Calendar behavior.
- Commit logically related changes in separate commits with clear, detailed commit messages when practical.

## 9. Acceptance criteria / test scenarios

The feature is only complete when the following pass:

1. **Entry point:** Clicking **Schedule meeting** in Meetings navigates to Calendar and opens the scheduling form; the old duplicate form no longer schedules directly from Meetings.
2. **Scheduling:** A workspace member creates a scheduled meeting from Calendar, it persists, appears on the correct date/time in Calendar, and appears in Meetings.
3. **Shared visibility:** A different member of that same workspace sees the scheduled meeting on the shared workspace Calendar.
4. **Workspace isolation:** A member of workspace A cannot see workspace B events by switching route parameters, calling APIs directly, inspecting cached data, or listening to realtime channels.
5. **Guest restriction:** A nonmember/guest cannot view any workspace Calendar page, listing, availability, or workspace-wide event metadata.
6. **Public-link regression:** An outsider with a valid **public-link meeting** URL can still join that specific meeting according to the established guest policy, without joining the workspace.
7. **Workspace-only regression:** An outsider with a **workspace-only meeting** URL is denied entry server-side.
8. **Public-link isolation:** Opening a public meeting link does not grant access to Calendar or to other events, and does not expose unnecessary workspace metadata.
9. **Organizer permissions:** Unauthorized members cannot edit or cancel another organizer's meeting unless the existing role policy explicitly allows it.
10. **Rescheduling:** Authorized changes appear in both Meetings and Calendar; date/time edits work across timezones and day boundaries.
11. **Conflicts:** An organizer sees useful conflict feedback; unrelated concurrent meetings are not incorrectly blocked unless there is an established shared-resource rule.
12. **Workspace switch:** Switching workspaces immediately switches event data, and revoked membership prevents future access.
13. **Regression:** Start-now, join, video/voice call, screen sharing, existing meeting URLs, and applicable guest admission flows still work.
14. **Parity:** Web and desktop have equivalent navigation, Calendar interactions, and responsive layouts.
15. **Quality:** All applicable checks pass; no mock-only CRUD, hardcoded workspace identifiers, or bypassed server authorization remain.

## 10. Out of scope unless already available in the codebase

- Google Calendar / Outlook sync or importing external calendars.
- A company-wide public calendar.
- A separate general-purpose event management system unrelated to Meetings.
- New email invitation/delivery infrastructure or complex recurrence rules.
- An entirely new conferencing provider or meeting room implementation.

If any of these is required by existing established functionality, preserve it; otherwise document it as a possible future enhancement rather than expanding this implementation.

## 11. Final instructions for the implementing AI agent

- **Inspect first, then implement end to end.** Follow the repository's actual technologies, structure, and patterns; do not assume illustrative paths/endpoints are exact.
- Treat the existing Meetings service as the source of truth; Calendar is its workspace-scoped schedule view and the single scheduling entry point.
- Do not compromise workspace data isolation to preserve publicly joinable meetings. **Public meeting link != public workspace calendar.**
- Reuse shared components to keep web/desktop consistent; avoid unrelated redesigns and unnecessary dependencies.
- Ship working migrations/API/UI/tests/docs as needed, not placeholders.
- In the final implementation summary, report what changed, migration steps, tests run/results, and any remaining limitations. Separate changes into meaningful commits when practical.
