# Connect Calendar

Calendar is a workspace schedule over the existing Meetings domain. Web and Electron use the same route, components, API transport and meeting room at `/meetings/:meetingId`. There is no separate event table, conferencing provider or invitation delivery service.

## Integration decisions

Discovery found shared Connect navigation in `packages/app/src/features/workspaces/workspace-shell.tsx`, a combined immediate/scheduled form in `features/meetings/meetings-page.tsx`, meeting/participant records in `packages/database`, and Hono collaboration routes backed by `meeting.service.ts`. Workspace writes already serialize through `withAccess`, and workspace switches cancel/remove workspace queries. Calendar reuses those boundaries and the existing title, description, host, start instant, IANA timezone, duration, invitees and access fields.

The established authorization policy allows all current members to create meetings, but only the host can administer them. Calendar follows that policy; admin status alone does not grant editing. Public links have always required a signed-in Lumo account. Anonymous participation remains unsupported. Open-link access never grants workspace membership or Calendar access.

## User flow

- Open **Connect → Calendar** (`/w/:workspaceId/calendar`). Week is the default; month/day, Today and previous/next controls change the range. Narrow windows show an agenda for that range; month agendas list days with meetings to avoid long runs of empty cards. Schedule meeting still allows choosing any date.
- **Meetings → Schedule meeting** opens `/w/:workspaceId/calendar?compose=true` with the same composer used by calendar dates/hour slots. Meetings retains immediate creation, joining by link, pagination and Agora media controls.
- Title, description, future start, duration (5–1440 minutes), scheduling timezone, access policy and existing workspace invitees are supported. Ownership always comes from the session. End is derived as start plus elapsed duration; a separate end column is unnecessary.
- Calendar displays local dates/times, including events that overlap midnight or the range boundary. Details show the original scheduling timezone. Editing interprets the entered wall time in that timezone. DST gaps and repeated wall times produce correction messages; for an ambiguous time choose UTC to select the intended instant explicitly.
- Availability warns about the organizer and selected invitees' overlapping meetings in the current workspace. It does not reserve workspace time or block saving. Unrelated parallel meetings are allowed. Choose another start/duration to check an alternative; availability outages do not prevent scheduling.
- A save updates Calendar and Meetings caches and offers View meeting/Copy link. Organizer edits preserve the meeting ID and URL. Only uncompleted scheduled meetings can be edited; active rooms use the existing host End action. Canceling a scheduled meeting preserves it as a subdued event and denies subsequent media tokens. Destructive deletion is not introduced.

Persisted `active` rooms stay “In progress” until the host ends them. Other scheduled records become “Upcoming”, “In progress”, or “Completed” from their start/duration. Ended records display “Completed”; canceled records display “Canceled”. Expired scheduled rooms cannot issue new tokens. UI state labels refresh every 30 seconds.

## API and privacy

All operations require the existing session. New OpenAPI operations under `/api/v1`:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/workspaces/:workspaceId/meetings/calendar?from=…&to=…&offset=…&limit=…` | Membership checked; UTC overlap query, ordered by start/ID, at most 62 days, pages of at most 200 |
| POST | `/workspaces/:workspaceId/meetings/availability` | Membership checked; `{from,to,participantIds?,excludeMeetingId?}`, at most 24 hours; organizer/invitee soft conflicts |
| GET | `/workspaces/:workspaceId/meetings/:meetingId` | Workspace membership and matching meeting/workspace required; details plus organizer name |
| PATCH | `/workspaces/:workspaceId/meetings/:meetingId` | Host and current membership required; full scheduled meeting input, including invitees |
| POST | `/workspaces/:workspaceId/meetings/:meetingId/cancel` | Host and current membership required; scheduled state only |

Creation still uses `POST /workspaces/:workspaceId/meetings`. Calendar fetches every page for the bounded visible range. Query keys include workspace/range, and Calendar errors suppress retained data. Workspace switches cancel/remove caches; membership/session refresh stops rendering protected views. Mutations invalidate Calendar, availability, details and Meetings; 15-second polling plus focus/reconnect refresh picks up other members' changes. There is no Meetings-domain realtime channel to extend.

Updates, cancellations, token issuance and membership changes serialize on the workspace lock. Edit/create validates invitee membership in the transaction; no hard conflict constraint exists. Lifecycle changes create audit events. Public `/meetings/:meetingId` detail/token endpoints remain narrowly scoped and omit workspace ID, calendar contents and member directory. UUID meeting links and provider identities remain unchanged. Workspace-only links recheck membership before tokens. Existing provider tokens may last up to 60 seconds after end/revocation; immediate provider ejection, lobby/admission, recording and anonymous guest accounts are not implemented by the existing system.

## Migration and verification

Run `pnpm db:migrate` before using the new API. `0007_neat_phantom_reporter.sql` extends the existing meeting status constraint with `canceled` and adds `(workspace_id, starts_at)` indexing. Existing records, fields and URLs are preserved, including readable legacy fixed-offset timezones; new or edited schedules require an IANA identifier. `starts_at + duration_minutes` remains the authoritative scheduled end; `ended_at` records terminal cancellation/end time. No credentials, new environment variables or dependencies are required.

Tests cover real PostgreSQL migration/authorization, workspace-scoped lists/details/conflicts/mutations, revoked membership, signed-in public-link isolation, invalid input, concurrency, overnight ranges, expired/canceled token denial, and shared UI navigation/creation/edit/cancel/cache behavior. Time utilities cover cross-date and fractional offsets, leap years, DST gaps/ambiguity and state labels. A common Playwright Calendar lifecycle runs against real web/mobile and Electron/API environments.

```sh
pnpm check:all
pnpm build
pnpm test:e2e
xvfb-run -a pnpm test:desktop
```

External calendar synchronization, recurrence, reminders, automatic email invitations and cross-workspace personal availability are outside this feature. Physical camera/microphone quality and Windows/macOS native permissions still require target-host verification.

## Verified on 2026-10-21

| Check | Result |
| --- | --- |
| `pnpm check:all` | Passed formatting, type-aware lint, boundaries, dependency checks, types and all 374 tests across 41 files |
| Coverage | 95.67% statements, 90.22% branches, 95.12% functions, 97.17% lines; original 90% gates retained |
| `pnpm build` | API, shared routes, web and Electron production builds passed |
| `pnpm desktop:package` | Linux unpacked application built successfully |
| `pnpm test:e2e` | 13 passed, 1 expected mobile mouse-drag skip; real Calendar create/edit/cancel flows passed in desktop and mobile Chromium |
| `LUMO_PACKAGED_DESKTOP=apps/desktop/release/linux-unpacked/lumo xvfb-run -a pnpm test:desktop` | 4 passed, 5 gated skips; Calendar lifecycle passed inside the packaged application |
| `pnpm db:migrate` | Migration applied to the configured local development database; isolated test schemas also applied all migrations successfully |

The five Electron skips are two opt-in native-window tests and three opt-in live Agora/media tests. Live provider calls, physical media quality, native screen capture and Windows/macOS host behavior were not verified by this run. The Chromium mobile mouse-drag skip is unrelated to Calendar. Production builds retain upstream Agora bundle/eval warnings.

Run route-generating quality checks/builds before starting browser/Electron E2E suites: sharing route-generation output with a running Vite test server can reload its pages during a test. The shared Calendar E2E helper waits for the workspace shell before navigating; workspace-switch assertions account for the mobile drawer closing after selection.
