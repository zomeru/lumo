# Lumo

A workspace collaboration platform built with React, Vite, TanStack Router and Query, Hono, Better Auth, PostgreSQL, and Drizzle. Web and Electron share the account/workspace UI, People directory, invitations, Messenger, meetings, Drive, Office, Wiki and People & HR.

## What works

- Email/password registration, sign-in, session restoration, sign-out, and email verification.
- An automatically created private personal workspace, provisioned atomically with each account.
- Three-step team workspace setup, workspace switching, remembered selection, and public discovery/joining.
- Private and invite-only workspaces, email-bound invitations, expiry, revocation, and single-use acceptance.
- Owner, admin, moderator, and member roles; member removal, role changes, ownership transfer, and leaving.
- Workspace settings, an account dialog that preserves the current module, a compact People directory with messaging, and administrative audit events.
- A connected organization tree with search, expand/collapse, zoom, pan and profile access, built from existing manager assignments.
- Calendar as the single meeting scheduling interface; Meetings retains the meeting list, links and joining controls.
- Drive (All Files) unifies file inventory, uploads, organization and creation while Docs, Sheets, Slides and Wiki retain their specialized screens. Legacy Contacts, All Files and Profile URLs redirect to their current destinations.
- Collaborative Docs, Sheets and Slides through ONLYOFFICE Docs Cloud, with server-signed sessions, private Drive files and immutable version history.
- Collaborative Markdown Wiki with CodeMirror 6 + Yjs, inherited Drive access, hierarchical pages and durable Markdown snapshots.
- Integrated Approvals, Leave, Attendance, Payroll, Onboarding and People with explicit HR capabilities, private documents, auditable workflows and shared web/Electron screens.
- Responsive light and dark UI based on the reference screenshots, with loading, error, empty, and access-denied states.

General application notifications, work management, SSO, Expo, workspace deletion/retention, join requests, and guest roles are pending. Their navigation is disabled where shown. Private workspaces currently use authorized invitations; they do not accept self-joins or join requests. Personal workspaces remain private and cannot transfer ownership. Workspace language and currency are saved preferences; UI translation is not implemented. Payroll currently supports PHP monthly salaries and requires independent verification for every run.

## Packages

| Location                     | Responsibility                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/web`                   | Browser entry and Vite host for the shared application                                           |
| `apps/api`                   | Hono HTTP boundary, authentication middleware, feature services, authorization, and audit events |
| `packages/database`          | PostgreSQL pool, Drizzle schema, and committed migrations                                        |
| `packages/auth`              | Better Auth server factory, secure cookies, verification mail, and persistent auth rate limits   |
| `packages/contracts`         | Zod request/response schemas, DTOs, and reusable role policies                                   |
| `packages/env`               | Separate server and browser configuration validation                                             |
| `packages/typescript-config` | Strict shared TypeScript configuration                                                           |

The shared package boundaries follow [Fidescript](https://github.com/zomeru/fidescript/tree/main/packages), adapted to local PostgreSQL and this Vite application. Internal packages use source exports and `workspace:*` dependencies. The API build bundles internal source; runtime server dependencies remain installed. Browser code never imports server packages.

## Local development in WSL

Use Node **24.21.0+**, pnpm **11.25.0**, and PostgreSQL **18** (other supported modern PostgreSQL releases should also work). No Neon, Docker, Redis, Agora, or SMTP account is needed for this foundation.

Install dependencies:

```sh
pnpm install
```

Create a dedicated local role and databases using your PostgreSQL administrator account. These commands do not change existing databases:

```sh
sudo -u postgres createuser --pwprompt lumo
sudo -u postgres createdb --owner=lumo lumo
sudo -u postgres createdb --owner=lumo lumo_test
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` and `TEST_DATABASE_URL` with that role's password. Generate `BETTER_AUTH_SECRET` with `openssl rand -hex 48`. Keep the secret in `apps/api/.env`; never prefix server credentials with `VITE_`. This workspace has already been configured with private local credentials and migrated databases.

```sh
pnpm db:migrate
pnpm dev
```

Open [Lumo](http://localhost:3000). The API listens on [port 3001](http://localhost:3001/health). Vite forwards `/api` to `127.0.0.1:3001`, so no browser environment file is required. If a Vite server is already running, start only the API:

```sh
pnpm --filter @lumo/api dev
```

Register at `/register`. Registration opens the personal workspace immediately; subsequent sign-ins restore the last authorized workspace. Use **New workspace** for team setup or **Browse & create workspaces** for discovery. Account settings and sign-out are available through **Your profile & account**.

### Profile photos and display dates

Open **Your profile & account** to edit your profile over the current workspace. Profile photos accept JPEG, PNG and WebP up to 5 MiB (configurable with `AVATAR_MAX_BYTES`, capped at 5 MiB). Crop, zoom and reposition before saving. Images are limited to 8192 pixels per side and 16 megapixels; the API validates and re-encodes a 256-pixel WebP without source metadata. Avatars use the existing private S3 storage and versioned identifiers; authenticated URL requests require the owner or a shared workspace membership. Electron resolves images through its authenticated API transport. Replacing or removing a photo removes the previous storage object.

The shared date utilities display dates as `Jan. 30, 2026` and timestamps as `Jan. 30, 2026, 10:30 PM`. Instants follow the viewer’s timezone unless a workflow specifies the workspace/scheduling timezone; calendar-only values such as leave dates retain their original day. Forms and chronological sorting continue using machine-readable values.

### Verification mail and invitations

Development verification mail is written to `.local/mail/*.json` (permissions restricted to the local user). Open the `url` from the file addressed to your account to verify it. Resend from **Your profile** if needed. Mail is never exposed through an HTTP inbox.

Owners, admins, and moderators can create invitation links in **Members**, subject to role limits. Copy the link and share it with the intended colleague. Invitation delivery is manual in this MVP. The colleague signs in with the invited email, verifies it, and accepts the link. An invitation cannot elevate an existing member's role; role changes require a separate authorized action. Demoting or removing the inviter invalidates their remaining invitation authority.

### Database changes

```sh
pnpm db:generate
pnpm db:migrate
pnpm --filter @lumo/database db:studio
```

Review generated SQL before applying it. The custom `0001_personal_workspace.sql` trigger provisions the personal workspace, owner membership, preferences, and initial audit event in the same transaction as the user insert. Do not replace migrations with schema push. The role/visibility enums, membership uniqueness, foreign keys, private-personal-workspace constraint, and one-owner index enforce database invariants.

## Security model

Every workspace read checks membership. Every workspace write locks the workspace and then rechecks membership and policy inside the transaction; revocation, promotion, invitation acceptance, joining, and ownership transfer use the same lock. Knowing a workspace, member, or invitation ID does not grant access. Member DTOs omit email and authentication fields. HR data is not part of the member directory.

Sessions use HTTP-only, SameSite=Lax cookies, with Secure required in production. Session cookie caching is disabled so server revocation is checked on each request. Authentication responses expose no session tokens. Write requests require JSON and an exact allowed Origin, including non-browser clients. Use `Origin: <WEB_ORIGIN>` when testing mutations with curl. CORS uses an exact origin with credentials; body limits, security headers, persistent PostgreSQL rate limits, request IDs, and sanitized errors are enabled. Logs omit bodies, cookies, query strings, invitation links, and raw database errors.

Invitation tokens contain 256 random bits and only their SHA-256 hashes are stored. Acceptance requires a matching verified email, a live invitation, and current inviter authority. Ordinary members cannot promote themselves or others. Admins cannot grant admin/owner roles; moderators can invite and remove regular members. Only owners can transfer ownership, and owners must transfer before leaving.

Workspace query keys include the workspace ID. Switching cancels in-flight requests and removes workspace caches. Protected views stop rendering after failed session or membership refresh; background polling and focus/reconnect refetches revalidate access. The API remains authoritative on every request.

## Verification

```sh
pnpm check:all
pnpm exec playwright install chromium
pnpm test:e2e
```

`check:all` runs formatting, type-aware linting, package boundaries, dependency checks, type checking, and coverage. Use `pnpm check:all:build` to include production builds. Tests retain the 90% global coverage gate for lines, statements, functions, and branches. HTTP/bootstrap entry points are verified by migration/build/browser smoke tests instead of importing running servers into Vitest.

API integration and browser tests require `TEST_DATABASE_URL` pointing to a dedicated database whose name ends in `_test`. Each run creates and removes its own random PostgreSQL schema, applying the committed migrations with only the schema namespace rewritten. Tests never truncate development data. Run browser projects separately (`pnpm test:e2e --project=chromium` and `pnpm test:e2e --project=mobile-chromium`); each invocation receives a fresh test database. Tests build and preview the production Web bundle, pace registrations for Better Auth’s quiet-minute reset, and pause long journeys at workflow boundaries to respect the real API limit. Browser tests use ports **3010/3011** and a separate local outbox at `.local/e2e-mail`; no mock API is used in Playwright. Browser readiness probes use IPv6 loopback to avoid WSL's delay when probing an unused IPv4 forwarded port. Native acceptance uses a dedicated IPv4 loopback API and startup-output readiness so Node HTTP, issued socket URLs and the Desktop connection policy share the same origin.

Useful scoped commands:

```sh
pnpm test --project web
pnpm test --project api
pnpm test --project contracts --project env --project auth
pnpm test:watch
pnpm test:coverage
pnpm check-types
pnpm lint
pnpm format:check
pnpm deps:check
pnpm deps:unused
pnpm boundaries
pnpm build
pnpm --filter @lumo/api start
pnpm --filter @lumo/web preview
```

Root Vitest discovers package projects. React tests use Testing Library and jsdom; API tests exercise real PostgreSQL. Playwright runs desktop and mobile Chromium flows. CI provides PostgreSQL and runs the complete gate and browser tests on Linux, with tooling, types, unit/UI tests, and builds on Windows.

The web and desktop renderers share dependency handling in `packages/app/vite.config.ts`. RTC uses Agora's modular `/esm` entry and separate dependency chunks; Wiki syntax highlighting also has its own chunks. The RTC core still exceeds Vite's default 500 kB warning threshold as an individual vendor module. It loads on demand; the warning remains enabled because chunk settings cannot split an individual module.

## Production configuration

For the browser frontend, follow the [Cloudflare Workers deployment guide](docs/deployment-web.md). It covers local preview, Wrangler deployment, custom domains, and web-only CI builds. Run `pnpm web:deploy` from the repository root after configuring the public API origin.

Set a strong `BETTER_AUTH_SECRET`, PostgreSQL `DATABASE_URL`, exact HTTPS `API_ORIGIN` and `WEB_ORIGIN`, `SMTP_URL`, a deliverable `MAIL_FROM`, and `HOST` as appropriate for the runtime. SMTP transport requires TLS in production. Development mail spooling is disabled in production. The server validates its environment before listening and closes HTTP and PostgreSQL connections during shutdown.

Serve the web build with an SPA fallback to `index.html`. Use a same-origin `/api` reverse proxy, or build with an explicit HTTPS `VITE_API_URL` and configure the API's exact `WEB_ORIGIN`. Turbo hashes browser configuration and forwards required server environment variables to development tasks. The environment example explicitly binds loopback; set `HOST=0.0.0.0` for WSL host access or containers.

Production rollout still requires deployment-specific TLS/proxy configuration, backups and recovery testing, mail delivery validation, monitoring, and capacity testing. Auth rate limiting uses the actual socket peer; a deployment behind a reverse proxy must account for shared peer limits at its trusted ingress. Client-supplied forwarding headers are intentionally ignored.

## Repository conventions

Use Oxlint and Oxfmt at the root. Husky installs staged source/format checks; commits follow Conventional Commits. Keep external dependencies pinned and run `pnpm install` after dependency changes. Add TanStack file routes in `packages/app/src/routes`; never edit `routeTree.gen.ts`. Type checking generates routes on a fresh checkout. The router Vite plugin stays before React, and tests disable automatic route splitting.

The version-scoped route-generator patch replaces its upstream formatter with Oxfmt. Review the patch, override, and package extension together when upgrading, and keep Oxfmt versions aligned. Planning material and screenshots under `docs/` remain unchanged.

The repository includes pinned Intent tooling for local skills. Before substantial edits, run `pnpm exec intent list` and load matching guidance with `pnpm exec intent load <package>#<skill>`. Knip excludes this agent-facing CLI from its static dependency analysis.

## Desktop and collaboration

`apps/desktop` builds Electron main, a sandbox-compatible preload, and a renderer with electron-vite. `packages/app` owns the shared TanStack router, views and query composition; `packages/ui` owns the shared Radix components, Tailwind v4 theme/styles and a DOM-free token export (see [Lumo UI](packages/ui/README.md)); `packages/api-client` provides an injectable, schema-validating transport; `packages/shared` contains platform-neutral identities, link validation and message reconciliation. Expo should reuse contracts/client/domain code and implement native presentation/media adapters; no empty mobile app has been created.

Desktop windows use frameless custom controls on Windows/Linux and a hidden title bar with native traffic lights on macOS. The application menu is removed. The minimum window size is 960 × 640. Desktop-only composition mounts controls in the shared `AppHeader`; routes without a header get a compact 32px drag strip. Window actions and state subscriptions pass through the sandboxed preload, with main-frame/origin validation in the main process. Header links, menus and controls are excluded from drag regions using Electron’s [custom window interaction guidance](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions).

Start PostgreSQL in WSL (`sudo service postgresql start` where supported), configure `apps/api/.env`, and run `pnpm db:migrate`. Start API, web and desktop together with `pnpm dev`, or independently:

```sh
pnpm --filter @lumo/api dev
pnpm --filter @lumo/web dev
pnpm --filter @lumo/desktop dev
pnpm build
pnpm desktop:package
```

Desktop packaging produces an unpacked app under `apps/desktop/release/`. `pnpm --filter @lumo/desktop dist` builds the configured native installer (Linux AppImage, Windows NSIS, macOS DMG). Run Windows/macOS builds on their respective native runners. Releases still require signing/notarization credentials and a configured update service. No unsigned artifact is described as a signed release.

Copy `apps/desktop/.env.example` to its `.env` to set public main-process build origins. Runtime main-process overrides are `DESKTOP_API_URL` and `DESKTOP_WEB_ORIGIN`. Use exact HTTPS origins in deployment; loopback HTTP is allowed for development. No API/Agora server secrets belong in desktop environment files or `VITE_*` variables. The desktop starts at Login, restores a session when an OS-protected key store is available, and restores the last authorized workspace through `/me`. Unavailable key stores use memory only. Paste invitation/meeting links from the configured web origin into the workspace picker to open them in desktop.

Agora RTC uses the public project ID documented in `apps/api/.env.example`. Configure its server-only certificate with the authenticated Agora CLI. Messenger uses PostgreSQL and the existing API WebSocket infrastructure; Agora is used only for Meetings.

Contacts can start workspace DMs. Messenger supports public/private channels, direct/group conversations, persisted history, realtime delivery, retry reconciliation, threads, reactions, pins, sender edits/deletes, mentions, scoped search, durable unread counts and notification preferences. Public channels automatically include all current and future workspace members. Only workspace owners, admins and moderators can create channels. Private channels require explicit membership; workspace administrators do not gain access to private content. Private S3 attachments use validated, immutable uploads and short-lived authorized downloads and image/GIF/MP4/WebM previews. The shared media gallery supports navigation, native video playback, Escape, download and external open; other recognized formats show type icons and metadata. Files are explicitly unscanned. Web and Electron use the same full-space responsive UI.

Messenger now includes a lazy searchable emoji picker, inline member mentions, contextual message actions, pinned-message navigation, persistent thread context, recent-responder previews, suggested contacts, group participant chips and shared member profile cards. Availability uses authenticated workspace connections with durable PostgreSQL leases and a stored Do Not Disturb preference. Apply additive migration `0021_stale_wonder_man.sql` before deploying this version. DND displays availability; notification suppression is not implemented. See the [UI/UX audit](docs/ui-ux-audit.md) and [delivery report](docs/ui-ux-delivery-report.md) for behavior, verification and host limits. The [Messenger/Desktop fixes](docs/messenger-desktop-fixes.md) record color emoji with normal text digits, icon attachment actions, reply-only placeholders/avatars and media acceptance.

Apply Messenger migrations `0016`–`0020` with `pnpm db:migrate`. Migration `0019` retires the old provider conversations while retaining their IDs, memberships and provider references, and releases DM keys for fresh conversations. The old Chat UI, SDK, credentials and transport have been removed. Old provider history is retained externally and is not imported into the new Messenger. See [Messenger implementation and operations](docs/messenger-implementation-notes.md).

Connect Calendar is the shared workspace scheduling entry point on web and desktop, with month/week/day views, a responsive agenda, organizer edits/cancellation, timezone validation and soft conflict warnings. Apply migration `0007_neat_phantom_reporter.sql` with `pnpm db:migrate`; see [Calendar behavior, API and permissions](docs/calendar.md).

Meetings support immediate/scheduled creation, open-to-authenticated-guests and workspace-only access, shareable links, participant lists, muted-by-default joining, camera/mic toggles, device selection, separate screen-share credentials, leave and host-only end. Start times are stored as UTC instants with an IANA timezone. Reauthorization occurs on token refresh. Provider credentials last up to 60 seconds after an end/revoke; instantaneous provider ejection is not implemented. Physical camera/microphone permission flows and native screen sharing must still be verified on supported target machines.

Generated OpenAPI is served at [OpenAPI JSON](http://localhost:3001/api/openapi.json), with [Scalar](http://localhost:3001/api/reference) for interactive documentation. Interactive docs require a session in production; private operations always authenticate. Collaboration adds workspace conversation creation/listing and durable message routes, workspace meeting creation/listing, and authenticated `/api/v1/meetings/:meetingId` detail/token/leave/end operations. `0003_flowery_warstar.sql` adds relational conversation and meeting metadata with uniqueness, foreign keys and indexes. Invitations also support authenticated email-bound decline.

API secrets are scoped to the API Turbo task and are excluded from desktop test process environments.

Additional checks:

```sh
pnpm test --project desktop --project shared --project api-client
pnpm test:desktop
# Headless Linux/WSL: xvfb-run -a pnpm test:desktop
# Managed Linux display: also exercise native maximize/restore/fullscreen and minimize.
LUMO_NATIVE_WINDOW_TESTS=1 pnpm test:desktop
# Explicit RTC signing smoke (prints no credentials):
LUMO_LIVE_AGORA=1 pnpm --filter @lumo/api exec tsx --env-file=.env src/test/live-provider.ts
# Explicit browser/Electron live Meetings integration:
LUMO_LIVE_AGORA=1 xvfb-run -a pnpm test:desktop
# Native screen capture: a supported graphical host must expose capture sources.
LUMO_LIVE_AGORA=1 LUMO_LIVE_SCREEN_CAPTURE=1 xvfb-run -a --server-args="-screen 0 1280x1024x24 +extension RANDR +extension RENDER" pnpm test:desktop
```

Native window state tests need a window manager; bare Xvfb skips them. The minimize test probes Electron directly and skips when the compositor ignores minimization (including the local WSLg host). Use `LUMO_PACKAGED_DESKTOP=apps/desktop/release/linux-unpacked/lumo` to run the same suite against the unpacked Linux build. Native drag/double-click behavior, Windows snapping and macOS traffic lights still need verification on their target desktops; custom maximize buttons do not provide Windows’ native Snap Layout hover menu.

Provider-dependent tests are gated and reported as skipped without explicit opt-in. Live tests distinguish synthetic camera/audio from native virtual-display capture. Capture tests report a skip when the graphical host exposes no sources. These checks do not prove physical device quality or Windows/macOS permissions. See [implementation evidence and limitations](docs/desktop-implementation-notes.md).

## Workspace Drive

Drive is available in the shared workspace navigation on web and Electron. It supports private S3 uploads with progress/cancel/retry, nested folders, inherited viewer/editor sharing, previews, search/sort/filter, grid/list views, stars, Trash/restore, recursive copy/move and ZIP downloads. PostgreSQL stores file references and permissions; object keys and AWS credentials stay on the API. API owners/admins manage workspace content through the existing roles.

Apply migration `0004_shiny_speed.sql` with `pnpm db:migrate`, set API-only `AWS_REGION`/`AWS_S3_BUCKET`, and configure the private bucket's IAM, encryption, CORS and lifecycle rules. See [Drive setup, permissions and operational limits](docs/drive-storage.md) for deployment instructions and test commands. Signature validation is implemented; comprehensive antivirus scanning and upload resume across page reloads are not included.

## Office and Wiki

Office editor appearance follows Lumo's Light/Dark/System mode without reopening active documents. Exact brand-color theme files and the Docs Cloud provisioning limitation are described in [Office theming](docs/onlyoffice-theming.md).

Configure the server-only ONLYOFFICE settings in `apps/api/.env.example`, apply `pnpm db:migrate`, and include `office/*` in the existing bucket role's object permissions. No second bucket or storage credentials are used. Hosted Docs Cloud requires publicly reachable HTTPS callbacks and source URLs; keep development tunnel addresses out of commits. Run `pnpm --filter @lumo/api onlyoffice:check` for a safe reachability diagnostic.

Docs, Sheets and Slides reuse Drive uploads, sharing, copy, trash and restore. All Files unifies the authorized inventory; My Files includes owned and shared items with ownership filters. Dedicated modules constrain creation and uploads to their own formats. Wiki provides Edit, Preview and Split modes with a formatting toolbar. See [file management and Markdown editor results](docs/file-management-improvements.md). Wiki shares parent-page access through its Drive container. Close all editors before moving, deleting or restoring active content; history restoration creates a new revision. See [implementation, verification and operations](docs/onlyoffice-implementation-notes.md) for the tested Cloud version, trial limits, Wiki fallback evidence, migration/recovery procedures and self-hosted cutover.

## People & HR

Apply additive migrations `0008`–`0014` with `pnpm db:migrate`. Configure employment and managers in People, effective schedules/holidays in Attendance, leave policies in Leave, and routing in People → HR administration. The owner grants specific capabilities; ordinary workspace admins and job titles do not grant salary access. Private attachments reuse the existing bucket with restricted `hr/*` permissions.

Payroll views are My Pay, Pay Runs, Employees and Settings. Authorized payroll staff configure effective SSS/MPF/EC tables, Pag-IBIG thresholds/caps, PhilHealth premiums/shares and BIR brackets in Settings; new calculations require a reviewed saved version. See the [shared UI and statutory configuration guide](docs/architecture/ui-consistency-and-payroll-configuration.md). Published payslips are employee-scoped; runs retain effective inputs and immutable calculation history. Every run requires the [documented independent payroll verification](docs/architecture/payroll-verification.md) before finalization. Recording paid performs no transfer. See the [architecture, permissions, API, setup and migration guide](docs/architecture/people-hr.md) and [privacy operations](docs/architecture/people-hr-privacy.md).

## Registration and public information

Registration requires matching passwords (12–128 characters) and explicit acceptance of the current
Terms of Use and Privacy Policy. Each document opens in a keyboard-accessible reader; users must reach
its end and acknowledge it before the agreement checkbox becomes available. Reopening an acknowledged
document preserves that state and the registration form for the current visit.

The auth boundary validates the same shared contract for HTTP and direct Better Auth calls. Migration
`0015_pink_sunfire.sql` adds the initially accepted terms/privacy versions and a server-generated
acceptance timestamp to the user row, written during account creation. Apply it with `pnpm db:migrate`
before deploying the updated API. Existing users retain null fields; no acceptance is inferred and
sign-in remains unchanged. These audit fields are not accepted from clients or returned in auth
responses. Repeated sign-in or duplicate registration does not rewrite them. Browser scrolling is a
review aid; an API can enforce explicit acceptance of current versions, not prove human reading.

The public routes `/about`, `/contact`, `/privacy`, `/terms`, `/cookies` and `/security` share the landing
page’s compact footer. Legal content is a **draft requiring Philippine legal review**. Contact addresses
use the reserved `.example` domain at the product owner’s request and are clearly marked as unmonitored;
replace them with verified support, privacy and security contacts before launch. Finalize the operator’s
identity, lawful bases, vendors/locations, retention schedule and rights/incident procedures as listed
in the documents. The privacy draft references the Philippine National Privacy Commission’s
[Data Privacy Act](https://privacy.gov.ph/data-privacy-act-/) and
[data subject rights](https://privacy.gov.ph/data-subject-rights/).

Published document text is versioned in `packages/app/src/features/public/legal-documents/` and the
current identifiers live in `@lumo/contracts/legal`. For a revision, retain the prior file, add a new
versioned file, update the active content and identifiers together, and deploy API and clients together.
Stale registration payloads fail with a review message. Never relabel old user records as accepting a
new version; a future renewed-consent workflow must preserve the initial registration acceptance.

Unknown client routes render Lumo’s branded 404 without redirecting the unknown URL. Authenticated
users receive a Dashboard recovery link; anonymous users receive Home. The root unexpected-error view
uses the same presentation and retries route loading. Workspace permission-denied states already use
the shared UI primitives, and session-expiry handling continues to hide protected content. This is a
Vite client-rendered application: the static host controls document HTTP status, while API not-found
responses retain HTTP 404. A static SPA fallback can return HTTP 200; configure route-aware hosting or
SSR if document-level HTTP 404 is required. No wildcard redirect or catch-all success route was added.

Focused browser verification: `pnpm exec playwright test tests/e2e/web/public-registration.spec.ts`
(runs desktop and mobile Chromium against the isolated integration database).
