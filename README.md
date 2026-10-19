# Lumo

A workspace collaboration platform built with React, Vite, TanStack Router and Query, Hono, Better Auth, PostgreSQL, and Drizzle. Web and Electron share the account/workspace UI, contacts, invitations, Messenger, meetings and Drive.

## What works

- Email/password registration, sign-in, session restoration, sign-out, and email verification.
- An automatically created private personal workspace, provisioned atomically with each account.
- Three-step team workspace setup, workspace switching, remembered selection, and public discovery/joining.
- Private and invite-only workspaces, email-bound invitations, expiry, revocation, and single-use acceptance.
- Owner, admin, moderator, and member roles; member removal, role changes, ownership transfer, and leaving.
- Workspace settings, profile editing, a searchable member directory, and administrative audit events.
- Responsive dark UI based on the reference screenshots, with loading, error, empty, and access-denied states.

Presence, application notifications, Univer editors, work management, HR, SSO, Expo, workspace deletion/retention, join requests, and guest roles are pending. Their navigation is disabled where shown. Private workspaces currently use authorized invitations; they do not accept self-joins or join requests. Personal workspaces remain private and cannot transfer ownership. Workspace language and currency are saved preferences; UI translation and financial features are not implemented.

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

API integration and browser tests require `TEST_DATABASE_URL` pointing to a dedicated database whose name ends in `_test`. Each run creates and removes its own random PostgreSQL schema, applying the committed migrations with only the schema namespace rewritten. Tests never truncate development data. Browser tests use ports **3010/3011** and a separate local outbox at `.local/e2e-mail`; no mock API is used in Playwright. Readiness probes use IPv6 loopback to avoid WSL's delay when probing an unused IPv4 forwarded port.

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

## Production configuration

Set a strong `BETTER_AUTH_SECRET`, PostgreSQL `DATABASE_URL`, exact HTTPS `API_ORIGIN` and `WEB_ORIGIN`, `SMTP_URL`, a deliverable `MAIL_FROM`, and `HOST` as appropriate for the runtime. SMTP transport requires TLS in production. Development mail spooling is disabled in production. The server validates its environment before listening and closes HTTP and PostgreSQL connections during shutdown.

Serve the web build with an SPA fallback to `index.html`. Use a same-origin `/api` reverse proxy, or build with an explicit HTTPS `VITE_API_URL` and configure the API's exact `WEB_ORIGIN`. Turbo hashes browser configuration and forwards required server environment variables to development tasks. The environment example explicitly binds loopback; set `HOST=0.0.0.0` for WSL host access or containers.

Production rollout still requires deployment-specific TLS/proxy configuration, backups and recovery testing, mail delivery validation, monitoring, and capacity testing. Auth rate limiting uses the actual socket peer; a deployment behind a reverse proxy must account for shared peer limits at its trusted ingress. Client-supplied forwarding headers are intentionally ignored.

## Repository conventions

Use Oxlint and Oxfmt at the root. Husky installs staged source/format checks; commits follow Conventional Commits. Keep external dependencies pinned and run `pnpm install` after dependency changes. Add TanStack file routes in `packages/app/src/routes`; never edit `routeTree.gen.ts`. Type checking generates routes on a fresh checkout. The router Vite plugin stays before React, and tests disable automatic route splitting.

The version-scoped route-generator patch replaces its upstream formatter with Oxfmt. Review the patch, override, and package extension together when upgrading, and keep Oxfmt versions aligned. Planning material and screenshots under `docs/` remain unchanged.

The repository includes pinned Intent tooling for local skills. Before substantial edits, run `pnpm exec intent list` and load matching guidance with `pnpm exec intent load <package>#<skill>`. Knip excludes this agent-facing CLI from its static dependency analysis.

## Desktop and collaboration

`apps/desktop` builds Electron main, a sandbox-compatible preload, and a renderer with electron-vite. `packages/app` owns the shared TanStack router, views and query composition; `packages/ui` owns the shared Radix components, Tailwind v4 theme/styles and a DOM-free token export (see [Lumo UI](packages/ui/README.md)); `packages/api-client` provides an injectable, schema-validating transport; `packages/shared` contains platform-neutral identities, link validation and message reconciliation. Expo should reuse contracts/client/domain code and implement native presentation/media adapters; no empty mobile app has been created.

Desktop windows use frameless custom controls on Windows/Linux and a hidden title bar with native traffic lights on macOS. The application menu is removed. Desktop-only composition mounts controls in the shared `AppHeader`; routes without a header get a compact 32px drag strip. Window actions and state subscriptions pass through the sandboxed preload, with main-frame/origin validation in the main process. Header links, menus and controls are excluded from drag regions using Electron’s [custom window interaction guidance](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions).

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

Agora RTC uses the public project ID documented in `apps/api/.env.example`. Configure its server-only certificate with the authenticated Agora CLI, and quote the Chat App Key because `#` starts an unquoted dotenv comment. Chat is enabled for the supplied Lumo project at `https://a61.chat.agora.io`; credentials remain in the ignored server `.env`.

Contacts can start workspace DMs. Messenger creates private DMs/groups, loads paginated provider history, sends text, receives live messages, reconciles optimistic sends, retries, reports connection errors, and refreshes short-lived provider credentials. PostgreSQL owns membership and provider mappings; Agora owns message bodies. Group membership is rechecked before credential issuance; removing a member disables their workspace-scoped provider identity and removes private-group access. Provider outages block that operation safely. Product attachments, reactions, editing/search and full presence are future additions.

Meetings support immediate/scheduled creation, open-to-authenticated-guests and workspace-only access, shareable links, participant lists, muted-by-default joining, camera/mic toggles, device selection, separate screen-share credentials, leave and host-only end. Start times are stored as UTC instants with an IANA timezone. Reauthorization occurs on token refresh. Provider credentials last up to 60 seconds after an end/revoke; instantaneous provider ejection is not implemented. Physical camera/microphone permission flows and native screen sharing must still be verified on supported target machines.

Generated OpenAPI is served at [OpenAPI JSON](http://localhost:3001/api/openapi.json), with [Scalar](http://localhost:3001/api/reference) for interactive documentation. Interactive docs require a session in production; private operations always authenticate. Existing `/api/v1` endpoints remain compatible. Collaboration adds workspace conversation creation/listing/credentials/read routes, workspace meeting creation/listing, and authenticated `/api/v1/meetings/:meetingId` detail/token/leave/end operations. `0003_flowery_warstar.sql` adds relational conversation and meeting metadata with uniqueness, foreign keys and indexes. Invitations also support authenticated email-bound decline.

The Chat protocol codec is generated at build time to preserve strict Electron CSP; see [codec maintenance](packages/app/THIRD_PARTY_NOTICES.md). API secrets are scoped to the API Turbo task and are excluded from desktop test process environments.

Additional checks:

```sh
pnpm test --project desktop --project shared --project api-client
pnpm test:desktop
# Headless Linux/WSL: xvfb-run -a pnpm test:desktop
# Managed Linux display: also exercise native maximize/restore/fullscreen and minimize.
LUMO_NATIVE_WINDOW_TESTS=1 pnpm test:desktop
# Explicit live provider smoke (creates and cleans temporary provider records):
LUMO_LIVE_AGORA=1 pnpm --filter @lumo/api exec tsx --env-file=.env src/test/live-provider.ts
# Explicit browser/Electron live messaging integration:
LUMO_LIVE_AGORA=1 xvfb-run -a pnpm test:desktop
# Native screen capture: a supported graphical host must expose capture sources.
LUMO_LIVE_AGORA=1 LUMO_LIVE_SCREEN_CAPTURE=1 xvfb-run -a --server-args="-screen 0 1280x1024x24 +extension RANDR +extension RENDER" pnpm test:desktop
```

Native window state tests need a window manager; bare Xvfb skips them. The minimize test probes Electron directly and skips when the compositor ignores minimization (including the local WSLg host). Use `LUMO_PACKAGED_DESKTOP=apps/desktop/release/linux-unpacked/lumo` to run the same suite against the unpacked Linux build. Native drag/double-click behavior, Windows snapping and macOS traffic lights still need verification on their target desktops; custom maximize buttons do not provide Windows’ native Snap Layout hover menu.

Provider-dependent tests are gated and reported as skipped without explicit opt-in. Live tests distinguish synthetic camera/audio from native virtual-display capture. Capture tests report a skip when the graphical host exposes no sources. These checks do not prove physical device quality or Windows/macOS permissions. See [implementation evidence and limitations](docs/desktop-implementation-notes.md).

## Workspace Drive

Drive is available in the shared workspace navigation on web and Electron. It supports private S3 uploads with progress/cancel/retry, nested folders, inherited viewer/editor sharing, previews, search/sort/filter, grid/list views, stars, Trash/restore, recursive copy/move and ZIP downloads. PostgreSQL stores file references and permissions; object keys and AWS credentials stay on the API. API owners/admins manage workspace content through the existing roles.

Apply migration `0004_shiny_speed.sql` with `pnpm db:migrate`, set API-only `AWS_REGION`/`AWS_S3_BUCKET`, and configure the private bucket's IAM, encryption, CORS and lifecycle rules. See [Drive setup, permissions and operational limits](docs/drive-storage.md) for deployment instructions and test commands. Signature validation is implemented; comprehensive antivirus scanning and upload resume across page reloads are not included.
