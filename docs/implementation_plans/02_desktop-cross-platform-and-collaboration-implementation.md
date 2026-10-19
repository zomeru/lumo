# 07 — Lumo Desktop, Shared Platform Architecture, Messenger, Contacts, Invitations & Meetings

> **Status:** Implementation plan and acceptance criteria for Codex  
> **Project:** Lumo (workspace-based collaboration platform)  
> **Primary deliverable:** Working `apps/desktop` using Electron + electron-vite, with shared web UI and functional collaboration features on **both** web and desktop.  
> **Future platform:** Expo / React Native, architected for but **not required to build in this iteration**.  
> **Prerequisite:** Complete and preserve the working foundation from `docs/implementation_plans/01_fullstack-foundation-implementation.md`.

## 0. Mission and non-negotiable rules

Implement this plan in the **existing** Turborepo. This is an implementation assignment, not an invitation to scaffold empty folders or replace the product with a demo.

- Preserve the current Lumo web app and its real authentication, database, workspace membership, permissions and API. **Do not rebuild these systems from scratch.** Inspect and extend them.
- Read `AGENTS.md` and **the numbered documentation files 2–5 (from TECH_STACK to WHY_HONO?) in `docs/`**, plus `docs/implementation_plans/01_fullstack-foundation-implementation.md`, **before changing code**. Discover actual filenames and read them completely. Documentation defines product behavior; this plan defines the next implementation increment.
- Inspect all PNGs under `docs/sample_ai_generated_ui_flow_from_claude/` to understand intended flows, but treat them as mockups, not an infallible product specification.
- Inspect the entire existing `apps/web` UI, especially authentication and workspace navigation. **The desktop app must look and behave like the current web application, not like a new, unrelated theme.** No marketing/landing page is included in desktop.
- Reuse existing monorepo scripts, toolchain, naming conventions, dependencies, design tokens and test patterns. **Do not introduce ESLint, Prettier, or redundant configuration; the repository uses oxlint and oxfmt (OXC).** Do not run a scaffold that replaces the root workspace or lockfile.
- Implement workspace-safe, accessible, responsive, tested functionality in production-quality code, using DRY, KISS, least privilege and clear module ownership. Favor a modular monolith over premature microservices.
- Prefer explicit, small interfaces at platform boundaries, not a “universal” package that imports Electron or Node APIs into browser/mobile code.
- Execute in the phase order below. After each phase, run the relevant checks, fix regressions and keep the repository runnable.
- Never commit secrets. Never treat the supplied Agora **App ID** as a secret; the **App Certificate, Chat credentials and token-signing authority are secrets** and belong on the server only.

## 1. Required research and repository audit

### 1.1 Internal reading

1. `AGENTS.md`, root README, root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, TS configs, lint/format/commit/test configs, CI, `.env.example`.
2. Numbered docs **2, 3, 4, 5**, then `01-fullstack-foundation-implementation.md`; identify decisions and any inconsistencies.
3. PNG screenshots under `docs/sample_ai_generated_ui_flow_from_claude`, in their intended order.
4. All current `apps/web`, `apps/api`, `packages/*` source relevant to auth, authorization, database, routing, UI, contracts, environment variables, API clients and tests.
5. Existing working features and behavior. Document what can be reused, what must be refactored, and what is still missing.

### 1.2 External technical references (check current official APIs/compatibility)

- [electron-vite repository](https://github.com/alex8088/electron-vite) and [getting started](https://electron-vite.org/guide/); use **electron-vite**, not an unrelated Electron starter.
- [electron-vite production build](https://electron-vite.org/guide/build) and [distribution](https://electron-vite.org/guide/distribution).
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security/) and [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation).
- [Hono best practices](https://hono.dev/docs/guides/best-practices), [middleware docs](https://hono.dev/docs/), [Zod OpenAPI](https://hono.dev/examples/zod-openapi), [Scalar](https://hono.dev/examples/scalar).
- [Agora overview](https://docs.agora.io/en/introduction), [SDK catalog](https://docs.agora.io/en/api-reference/sdks), [RTC web quickstart](https://docs.agora.io/en/realtime-media/rtc/get-started-sdk/web), [Chat overview](https://docs.agora.io/en/realtime-media/im), [Chat SDK quickstart](https://docs.agora.io/en/realtime-media/im/get-started-sdk), and [server-side RTC tokens](https://docs.agora.io/en/realtime-media/rtc/build/authenticate-users/deploy-token-server).
- Personal Hono style references (read, do not blindly transplant runtime-specific code): [zomlab Hono integration](https://github.com/zomeru/zomlab/tree/main/apps/web/src/integration/hono) and [portfolio API](https://github.com/zomeru/portfolio/tree/main/apps/api).
- Fidescript packages can also inform separation of auth, database, contracts, environment validation, and TypeScript configuration: https://github.com/zomeru/fidescript/tree/main/packages.

### 1.3 Required findings before implementation

Write a brief audit in the implementation notes: current features, reusable components, existing route and session behavior, library versions, platform compatibility, API conventions, and architectural conflicts. Prefer real code evidence over assumptions. Then **proceed with implementation**, not just a plan.

## 2. Target architecture and ownership

### 2.1 Suggested monorepo layout (adapt to current reality)

```text
lumo/
├── apps/
│   ├── api/                        # Hono API; authoritative auth, DB and workspace checks
│   ├── web/                        # React + Vite + TanStack Router web application
│   ├── desktop/                    # NEW: Electron + electron-vite (main/preload/renderer)
│   │   ├── src/
│   │   │   ├── main/               # windows, lifecycle, permissions, links, native integrations
│   │   │   ├── preload/            # narrow typed IPC/contextBridge API
│   │   │   └── renderer/           # shared React UI + desktop composition and routing
│   │   ├── resources/
│   │   ├── electron.vite.config.ts
│   │   └── package.json
│   └── mobile/                     # FUTURE Expo app; no implementation required now
├── packages/
│   ├── auth/                       # Existing auth; adapt for valid desktop flows
│   ├── database/                   # Existing PostgreSQL/Drizzle schema and migrations
│   ├── contracts/                  # Shared Zod/OpenAPI schemas and inferred types
│   ├── env/                        # Validated server/browser/desktop configuration
│   ├── typescript-config/
│   ├── shared/                     # NEW: platform-agnostic pure utils, types, domain rules
│   ├── ui/                         # NEW: shared React DOM components/tokens (web + Electron)
│   ├── app-core/                   # If justified: React hooks, providers, feature view models
│   ├── api-client/                 # If justified: typed requests, TanStack Query options
│   ├── realtime/                   # If justified: typed Agora adapters / event semantics
│   └── ui-native/                  # FUTURE: React Native-specific components
├── docs/
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

This is a **guide**, not permission to create every package immediately. Add `shared` and `ui` as requested. Add `app-core`, `api-client`, `realtime`, or other packages **only when concrete shared code justifies them**. Do not create empty, circular, or single-use abstraction packages.

### 2.2 Code sharing boundaries

- `packages/shared`: pure TypeScript only; no `electron`, `react-dom`, DOM globals, server-only code, secrets or platform-specific native modules. May later be used by Expo.
- `packages/contracts`: single source of truth for API request/response validation and OpenAPI schemas; safe, tree-shakeable exports.
- `packages/ui`: reusable **React DOM** components and styling for both `apps/web` and `apps/desktop/src/renderer`. Preserve current design tokens, Tailwind/style strategy, component primitives, icons, interactions and accessibility. Explicitly **not** directly importable by React Native.
- Shared feature modules, hooks and state should be split from route composition so web and desktop can render near-identical product screens. Use TanStack Query for remote state, with existing router/state choices intact.
- Mobile future: share contracts, domain logic, API client, validation, query logic and platform-neutral feature models. Create React Native UI via an adapter/`ui-native` layer when `apps/mobile` is implemented. Do not force DOM styles/components, web routing or Electron IPC into Expo.
- UI parity means shared source/components when possible, **not maintaining copied JSX** in both apps. Keep platform differences isolated in explicit adapters (navigation, notifications, media acquisition, secure credential/session handling, native dialogs).
- Respect dependency direction: UI/features -> contracts/shared/client; API -> contracts/database/auth/shared; desktop main/preload never leak into shared web/mobile packages. Use package exports maps and environment-specific entrypoints where necessary.

### 2.3 Frontend route/feature sharing

Refactor as needed toward product-level components and features, for example:

```text
packages/ui/src/
  components/          # buttons, inputs, dialogs, menus, layout primitives
  layouts/             # workspace shell, sidebars, nav, panels
  features/            # messenger, contacts, invites, meetings, login views
  styles/              # shared tokens and reusable style entrypoint

packages/app-core/src/ # ONLY if warranted
  auth/                # authenticated-user/session state
  workspaces/          # switching, membership-aware queries
  messenger/           # query hooks, state, typed actions
  contacts/
  invitations/
  meetings/

apps/web/src/          # web-specific routes, entry, web APIs
apps/desktop/src/renderer/ # desktop-specific routes, entry and adapters
```

Avoid moving TanStack Router file-route generated code into shared packages if it harms route generation. Instead share the rendered screens, layouts, service hooks and business logic. Keep both apps independently buildable.

## 3. Phase A — Bootstrap secure Electron desktop app

### 3.1 Starter setup

Create an app named **`desktop`** inside `apps/`, using the current supported electron-vite React + TypeScript template or equivalent minimal configuration from [electron-vite](https://electron-vite.org/guide/).

- Match existing pnpm/Turborepo setup, exact approved Node/TypeScript/Vite versions, repo scripts and OXC rules.
- Maintain separate Electron `main`, `preload` and React `renderer` builds.
- Ensure `pnpm --filter <desktop-package> dev`, build, typecheck, lint and tests work through root Turbo scripts; update names to the repository's conventions.
- Configure `electron-vite` path aliases, workspace package imports, bundling/externalization and renderer CSS in a way that works **both in development and packaged builds**.
- Do not install or keep scaffolded ESLint/Prettier configs/dependencies. Use existing `oxlint`, `oxfmt`, Husky, lint-staged, commitlint, Vitest and Playwright setups.
- Use a supported distribution tool (prefer `electron-builder` where compatible with this repo) and demonstrate at least one successful local development build plus packaged smoke test. Prepare Windows and macOS targets, with CI platform limitations documented. No claim that an OS artifact was tested without running it.
- Give the app a stable app ID, human-readable product name, app icon configuration and correct production resource paths; avoid fake “production ready” claims about signing/notarization before certificates exist.
- Desktop should connect to the existing remote/local Hono backend. **Do not bundle a duplicate local API server or local PostgreSQL instance into desktop.**

### 3.2 Security baseline — mandatory

- `nodeIntegration: false`, `contextIsolation: true`, renderer sandboxing enabled where supported, strict CSP, no `webSecurity: false`, no `allowRunningInsecureContent`.
- Use local bundled renderer content in production with a secure custom protocol if appropriate. Development URLs must be restricted to explicit local development hosts.
- Provide a narrow `contextBridge` API of explicit actions with runtime validation of sender and arguments; never expose raw `ipcRenderer`, filesystem, shell, operating-system commands, or secrets.
- Deny unneeded permissions by default. Explicitly approve microphone/camera/screenshare as required, scoped to the trusted application. Validate new-window/navigation/external-URL behavior using allowed protocols/hosts.
- Sanitize and constrain file paths and upload handles; prevent path traversal. No arbitrary shell execution, remote-code loading or unchecked navigation.
- Ensure external URLs use strict allowlisting/validation before `shell.openExternal`.
- Securely handle persisted configuration/session credentials; don't place long-lived tokens in `localStorage` or plaintext user files. Use an OS-protected store only where justified and compatible, or secure cookie-based/approved session exchange flows with proven behavior.
- Design deep-link authentication and login callback handling to reject replay, untrusted schemes and missing request correlation.
- Explicitly test secure development **and packaged production** behavior, particularly cookies and authentication after app restart.

## 4. Phase B — Shared UI and desktop/web parity

### 4.1 Exact user-visible behavior

- Desktop has **no landing/marketing page**. At cold start, an unauthenticated user sees **Login** first, with access to registration/recovery only if existing auth supports them.
- An authenticated user goes to the correct workspace/product page. When appropriate, restore their last authorized workspace. An inaccessible workspace must resolve to a safe selection/error state, not leak data.
- Reuse the current web login, workspace shell, sidebar, topbar, navigation, profile, menus, theme, icons, typography, responsiveness, empty states and accessibility.
- Desktop product UI must be nearly indistinguishable from web at equivalent window dimensions; only intentional OS chrome/native affordances differ.
- Loading, unauthorized, expired-session, empty, error and offline states must work. New product features must be integrated into the same shared layout rather than being isolated Electron demos.

### 4.2 Refactor strategy

1. Identify recurring web UI and reusable feature views.
2. Move truly shared React/DOM UI into `packages/ui` without altering appearance or functionality.
3. Extract platform-agnostic state/data logic into `shared` or narrowly scoped packages when reuse is real.
4. Keep web-specific entrypoints/routing/SSR-like assumptions separate from desktop-specific bootstrapping/navigation/IPC.
5. Preserve usable existing component APIs, form behavior, errors, tests and established naming.
6. Update imports, TS paths, Turbo build graphs, CSS scanning, export maps and package dependency declarations.
7. Verify parity with screenshot/visual checks where viable. Fix missing fonts/styles and broken asset paths in packaged Electron.
8. Avoid duplication of functional screens and avoid duplicating API request logic.

### 4.3 Authentication interoperability

- Inspect existing Better Auth setup and validate a secure login/session architecture for **Electron local/custom-protocol origins** and existing web browser origins.
- Do **not** assume same-origin browser cookies automatically work from Electron `file://` / custom protocol. Choose and implement a documented, testable flow: a safely handled trusted sign-in window or system-browser callback with session exchange, as appropriate to existing Better Auth capabilities.
- Restrict origins and redirect URIs, handle CSRF/OAuth state/PKCE where applicable, avoid credentials embedded in URLs or log output, support logout/invalidation across client sessions and reauthentication.
- Do not weaken global CORS, CSRF or trusted-origin checks to make desktop work.
- Never hard-code bypass authentication in desktop development.

## 5. Phase C — Hono API hardening and contracts

Extend `apps/api`, respecting existing auth/database packages and migration history. Follow [Hono best practices](https://hono.dev/docs/guides/best-practices): feature modules composed with `app.route()`, handlers with good type inference, typed middleware/contexts, service/repository boundaries only where useful. Don't reproduce a controller-heavy NestJS structure inside Hono.

### 5.1 API consistency and discoverability

- Use `@hono/zod-openapi` with Zod contracts where it fits existing patterns; keep OpenAPI generated from real source schemas rather than hand-maintained duplicates.
- Use **Scalar** at an appropriate development/docs endpoint (`/api/reference`) and serve the OpenAPI JSON (`/api/openapi.json`). Scalar is preferred over Swagger UI for this project; do not install both unless a clear requirement exists.
- Ensure private endpoints require real authentication even if displayed in interactive docs; optionally disable/restrict the docs UI in production.
- Define errors consistently with stable machine-readable codes, clear safe messages, request IDs and correct HTTP status codes.
- Include `/health` for basic process health and a distinct ready/dependency check if existing conventions permit; do not expose internal secrets or service metadata.
- Use typed input/output schemas, pagination/cursors, bounded payload sizes and safe file-handling interfaces.
- Respect any existing API versioning convention; avoid sweeping breaking changes for cosmetic structure.

### 5.2 Middleware/security (apply according to route type)

Review built-in Hono middleware and your Hono references. Appropriately configure:

- Request ID, structured redacted logging, optional tracing and timings.
- `secureHeaders`, safe CORS origin allowlist and credentials policy (no `*` with credentials), CSRF protection with actual session/cookie transport semantics, method/content-type checks.
- Rate limiting for login, invitations, messaging, token generation and abuse-prone endpoints. Choose storage suitable for deployment (not per-process in-memory for distributed production).
- Request/body limits, validation, consistent error boundaries, server timeouts where appropriate, and graceful shutdown.
- Proper `Cache-Control: private, no-store` for authenticated/private responses when warranted.
- Secure WebSocket/Socket.IO handshakes and authorization if used. Do not treat a successful socket connection as permanent authorization.
- Safe proxy/trusted IP handling. Never assume arbitrary client-supplied forwarded headers are authentic.

**Important nuance:** Hono's CSRF middleware covers specific unsafe content types; do not treat it as complete CSRF protection for every JSON/API/session scenario. Test exact request transports, origins and cookie `SameSite` behavior; add required origin/token checks accordingly.

### 5.3 Database and multi-tenancy

- Continue using existing PostgreSQL + Drizzle, local WSL PostgreSQL for dev, and existing migrations.
- Schema changes must be transactional/reversible where feasible, have proper foreign keys, indexes, unique constraints and referential cleanup policies.
- Model user identity separately from workspace membership and contacts. Workspace IDs belong on all workspace-scoped resources; direct messages may be workspace-scoped or global only as the product documentation explicitly specifies.
- Server-side checks must authorize every read/write, invite acceptance, conversation membership, message fetch, media token issuance and meeting join.
- Do not trust `workspaceId`, `role`, `senderId`, `conversationId`, `meetingId`, or `agoraUid` from client input without cross-checking authenticated membership/permissions.
- Limit N+1 queries; use pagination and cursor/index design for message history and member lists. Avoid large unbounded joins and eager loading.
- For critical concurrent flows (single-use invites, membership changes, conversation creation), use transactions and/or DB uniqueness/idempotency.
- Use least-privilege DB credentials, parameterized queries and no raw SQL string interpolation.
- If Row Level Security is applicable, treat it as additional defense; it does not replace application authorization.

## 6. Phase D — Contacts and workspace invitations

Implement the smallest complete, documented set of flows on **both web and desktop**, using the same shared UI and API logic.

### 6.1 Contacts

- Search people only within the visibility/privacy rules established by documentation.
- View contact directory and permitted user summaries.
- Send/accept/decline/remove contact requests if the documentation models contacts as explicit relationships; otherwise implement its prescribed model.
- Handle duplicates, mutual contacts, blocks/privacy restrictions if required by docs, pagination, pending states and permissions.
- Permit starting an authorized direct conversation from a contact profile.
- The API must return only permitted profile fields and must enforce visibility on search/detail, not just in the UI.

### 6.2 Workspace invitations

- Authorized owner/admin/moderator (according to docs) can invite by supported identifier (existing user/email/invite link as specified).
- Define invite state, expiry, revocation, acceptance and optional role assignment. Enforce least privilege and prevent role escalation.
- Links/tokens must use cryptographically random values; **store a hash of invite secrets** if token-based, validate expiry and intended workspace, and avoid exposing them in ordinary lists/logs.
- Handle duplicate/current-member invitations, pending requests, expiry, declines and invite acceptance atomically. Restrict the number/rate of invites.
- Joining makes membership active only through the authorized server-side flow. Switching into a new workspace works immediately after successful acceptance.
- If email delivery is not configured, implement only the invitation delivery mechanism supported by existing services; document the missing provider rather than claiming email was sent.
- Add member management/list/search and role-driven UI states if required for invite workflows; every action must be server-authorized.

## 7. Phase E — Messenger: DM and workspace group chat

### 7.1 Decide the exact Agora product integration first

The instruction is **“use Agora for Messenger and Meetings,”** but Agora offers distinct products:

- **Agora Chat SDK** for durable one-to-one/group messaging, chat history, receipts and offline handling.
- **Agora RTC SDK** for voice/video meetings and screen sharing.
- **Agora Signaling (RTM)** may be useful for transient coordination/presence but is **not automatically a replacement** for a durable chat system.

Before implementation verify that the selected Agora project/account has **Chat enabled** and obtain its Chat **App Key / service credentials**, if required. The provided RTC App ID alone does not establish Chat availability. If Chat is unavailable, isolate the provider integration and report the exact blocker; do not silently substitute an unrelated service or hard-code insecure temporary credentials. The user has Agora CLI available: inspect its installed capabilities/authorized account safely if useful, without dumping secrets.

### 7.2 Required messenger MVP

- Workspace-scoped channel/group conversations and direct messages as defined by docs.
- Create/list/open eligible conversations; enforce channel privacy and participant membership.
- Send, receive and load messages with real-time updates across web and desktop; stable ordering and paginated history.
- Manage optimistic sends, retries, deduplication, reconnect, offline/connection states and stale channel access.
- Display sender name/avatar/time, unread counts and clear empty/loading/error states.
- Conversation membership must be authoritative on the backend. A removed member loses authorization for new messages/history and tokens according to product policy.
- Use a canonical backend record mapping Lumo conversation IDs/users/memberships to Agora identifiers; never infer access solely from a client-provided Agora channel name.
- Store only appropriate metadata and/or canonical message records in PostgreSQL according to a deliberate source-of-truth decision. If Agora Chat holds the message body, document history, retention, deletion, consistency and disaster recovery responsibilities; do not implement two competing message sources of truth without reconciliation.
- Avoid XSS in rich text/message rendering; sanitize or render text safely. Validate attachments, media types, limits and authorization if attachments are in scope.
- Typing, read receipts, presence and attachments may be included if supported by product docs and available Agora capabilities; prioritize a fully working send/receive/history flow first.

### 7.3 Credentials and events

- Generate/provision **Agora Chat user credentials or tokens via the trusted backend** using the official, current token/account model. Never embed Chat management secrets in clients.
- Handle provider account mapping, membership synchronization, revocation, credential refresh, reconnect and cleanup.
- Web and Electron share a typed messenger service abstraction and UI. Future Expo should implement a platform-compatible adapter without rewriting conversation domain logic.
- Use idempotent event handling and optimistic UI reconciliation. Where webhooks or server callbacks are used, verify signatures and prevent replay.

## 8. Phase F — Meetings: Zoom-like core with Agora RTC

### 8.1 Scope: working MVP, not an entire Zoom clone

Implement **create, join, schedule where backed by docs, leave/end, participant list, audio/video toggle, device selection and screen sharing**. Support immediate open meetings and workspace-bound meetings as described by docs. If scheduling exists in scope, persist start time/timezone, organizer, status and allowed participants. Support shareable links with safe authorization checks.

- Meeting types: **open** versus **workspace-restricted**, following docs. Workspace-restricted meetings must reject nonmembers even if they possess the URL. Open meetings still need intentional guest policies and abuse controls.
- Permission model: host and participant roles, who can join, admit guests if needed, control media and end a meeting. Enforce server-side role checks for protected actions.
- Generate short-lived scoped RTC tokens **on the API**, after authenticating and authorizing the user and meeting. Manage expiration/refresh and stable authenticated UID mapping.
- Associate Agora channels with internal meeting records using collision-resistant, server-controlled identifiers. Do not allow arbitrary channel token requests.
- Camera/microphone permissions and clear pre-join permission/device checks; muted/disabled-by-default behavior should follow the product requirements.
- Meeting UI: pre-join, joining, active, participant grid, local preview, mute/unmute, camera, participant list, screen share, leave/end and appropriate errors.
- Room lifecycle: active/ended state, participants leaving, reconnect, invalid/expired token, host departure, network drop and cleanup of media tracks/listeners.
- Privacy: do not auto-record, upload screen content or silently enable devices. Recording/transcripts are out of MVP scope unless explicitly required by documentation.

### 8.2 Browser vs Electron RTC adapter

Start by assessing the current **Agora Web SDK (`agora-rtc-sdk-ng`) in Electron's Chromium renderer** for compatibility and shared UI, including camera/microphone acquisition and screen capture. Electron permission/capture sources can differ from a standard browser. Prove actual screen sharing with a local desktop smoke test.

- Reuse shared meeting UI, state transitions, contracts and permission checks.
- Keep media capture/device selection in a platform adapter; browser can use Web SDK browser APIs, Electron may need a **narrow, authorized main/preload capture-source bridge** or an official Electron RTC SDK integration if required for reliable OS capture.
- If using Agora's Electron SDK, explicitly handle supported Electron/Node/native module versions, rebuild/packaging and app signing; do **not** promise identical binaries or APIs.
- Never loosen Electron sandbox security to make screen sharing work. Test screen share on the actual supported OS and reject unsupported capture scenarios safely.
- Share RTC lifecycle logic where compatible, not native implementation details. Expo will use a React Native RTC adapter later.

### 8.3 Agora project configuration

Use the project with public **RTC App ID**:

```dotenv
AGORA_APP_ID=74840af2ab78410fbeb9e5de554b6689
```

Use an appropriate **server-only Agora App Certificate / token-signing credential** from the user's authorized project configuration. Do not ask the user to paste it into source code and never commit it. The Chat product may require a separate **App Key** and management credential that must be verified instead of guessed.

Token API must validate user, workspace, meeting state, membership/guest rules and intended channel/UID before signing. Add rate limits, audit logs where appropriate and deterministic unit tests with fakes. Never return an App Certificate to browser or Electron clients.

## 9. Phase G — Environment, scripts, builds and deployability

### 9.1 Environment variable strategy

Inspect existing `packages/env`, runtime loading and `.env.example`. Add **only real, documented variables** consistent with repo conventions. Validate at startup or relevant entrypoint with Zod; give clear errors and fail closed on missing server credentials. Never expose private values through `VITE_*`, renderer bundles, desktop packaged assets, logs or OpenAPI examples.

Suggested **names to reconcile with existing conventions**:

```dotenv
# API/server (reuse existing DB/Auth URLs and secrets; examples only)
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/lumo_dev
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=<server-only-random-secret>
API_PORT=3001

# Agora RTC (public App ID, private certificate)
AGORA_APP_ID=74840af2ab78410fbeb9e5de554b6689
AGORA_APP_CERTIFICATE=<server-only-secret>

# Agora Chat (only if Chat enabled; verify exact SDK/backend requirements)
AGORA_CHAT_APP_KEY=<chat-app-key-if-required>
AGORA_CHAT_CLIENT_ID=<server-only-if-required>
AGORA_CHAT_CLIENT_SECRET=<server-only-if-required>
AGORA_CHAT_REST_ORIGIN==<server-only-if-required>

# Public client configuration (names and values depend on existing app)
VITE_API_URL=http://localhost:3001
VITE_AGORA_APP_ID=74840af2ab78410fbeb9e5de554b6689

# Desktop: non-secret API URL only; avoid bundling secrets
DESKTOP_API_URL=http://localhost:3001
```

**These are illustrative keys, not instructions to replace existing files or copy placeholder secrets into executable configs.** Use safe development examples, no real credential values in logs or committed env files. Clarify development origin/host/port differences across web, Electron, WSL and production.

### 9.2 Tooling consistency

- Keep root `pnpm` scripts and Turbo task graph coherent for `dev`, `build`, `check-types`, `lint`, `format`, `test`, `test:e2e`, `db:migrate` and `desktop:package` if applicable.
- Keep `oxlint` and `oxfmt` as sole lint/format systems; remove any generated ESLint/Prettier configs and dependencies from the desktop starter.
- Ensure desktop package import/exports, native packaging, React versions, dependency deduplication and types are correct. Preserve commit hooks and GitHub Actions checks.
- CI should build/typecheck/lint/test cross-package changes, with OS-specific Electron packaging jobs when runner/platform availability permits. Don't run macOS signing jobs without credentials.
- Document local startup sequence and how to run **API + web + desktop** concurrently from the monorepo, including WSL database requirements.

## 10. Phase H — Tests and quality gates

Use existing **Vitest** structure, integration/database testing utilities and **Playwright**. Tests must exercise real security boundaries, not only happy-path UI mocks.

### 10.1 Unit tests

- Pure domain utilities, contracts and DTO validation.
- Workspace role/membership policies, invitation validity/revocation/expiry and idempotency.
- Message ordering/deduplication, mapping of app user ↔ Agora identity and reconnection logic.
- RTC state machine, permission decisions and token validation. Mock external Agora network operations deterministically.
- Electron IPC argument validation, sender authorization, URL allowlisting and external-link handling.

### 10.2 API/database integration tests

- Migration verification and representative queries against PostgreSQL or an existing realistic test DB strategy.
- Auth/session/authorization matrix across members, admins, outsiders and cross-workspace attempts.
- Unauthorized invitation, duplicate accept, revoked/expired invite, role escalation attempts.
- Cross-tenant conversation leakage via IDs, pagination, Agora token endpoints and meeting links.
- Token expiry/refresh/revocation cases, rate limiting and sanitized API errors.
- Database uniqueness, transactions, FK behavior and race conditions around membership/conversation creation.

### 10.3 Web + Electron end-to-end tests

- Web registration/login/workspace navigation remains operational.
- Desktop launches with **login**, never marketing page; correct login/restore/logout/expired-session flows.
- Shared UI renders consistently across web and desktop; routes and workspace switching work.
- Invite from one user, accept from another, then access newly joined workspace.
- DM/group message sent from web is received in desktop, and vice versa (provider sandbox or live integration tests with configured secrets).
- Meeting created on web can be joined from desktop with verified camera/mic permissions, mute/camera controls and leave/end lifecycle. Add authorized screenshare smoke tests on supported OS.
- Reject a nonmember joining a workspace-bound meeting even with a copied URL.
- Packaged Electron app loads assets, logs in, reaches API, handles navigation, and does not have unsafe IPC/Node exposure.
- Isolate live Agora integration tests behind explicit secrets/environment gates, with deterministic tests passing in normal CI. Never disguise skipped provider tests as successful end-to-end validation.

### 10.4 Definition of done

- `pnpm install --frozen-lockfile` (or repository-supported equivalent), format/lint/types/build/test all pass.
- Desktop runs locally and builds; at least one packaged smoke test is verified and platform gaps documented.
- No duplicated entire web app in desktop, no landing screen and no stale/mock actions for features marked complete.
- Messaging, contacts, invitations and meetings use real API calls and Agora where configured, with clear blocking status for unavailable third-party credentials.
- Existing web flows have no regressions.
- Security/auth/session behavior is verified on both clients. Multi-tenant access control is explicitly tested.
- Docs and `.env.example` accurately explain setup, scripts, known limitations and required Agora project services.

## 11. Implementation order and completion checkpoints

Follow this order, making meaningful functioning changes in each phase:

1. **Audit:** inspect docs (2–6), existing apps/packages, UI mock PNGs, and external references; capture compatibility gaps.
2. **Desktop starter:** create `apps/desktop`, wire electron-vite, OXC and Turbo, secure main/preload/renderer, basic packaged build.
3. **Sharing/UI:** create `packages/shared` and `packages/ui`, extract web design/features, achieve near-identical web/desktop login and authenticated workspace UI; no desktop landing page.
4. **Auth interoperability:** securely implement/test desktop login, session renewal, logout, account/workspace resolution.
5. **Hono API foundation:** OpenAPI + Scalar, safe modular route structure, rate limiting/security middleware, validated data contracts and database migrations.
6. **Contacts + invitations:** shared UI and full API/DB workflows with authorization tests.
7. **Messenger:** Agora Chat provision/token lifecycle where enabled, persisted metadata, real DM/group behavior and cross-platform UI.
8. **Meetings:** Agora RTC tokens, open/workspace-restricted meetings, live audio/video/screenshare and cross-platform behavior.
9. **Hardening:** end-to-end tests, packaged desktop smoke tests, error/reconnect/offline states, docs, env examples and CI updates.

At every checkpoint: run the existing relevant quality gates; fix errors before building additional functionality. If an environment secret, external service enablement or host capability is missing, implement all testable local components, preserve secure defaults, accurately describe the blocker and do not fake successful integration.

## 12. Final Codex deliverable and reporting

When done, report:

1. Implemented features grouped by phase and actual working platforms.
2. New/refactored apps and packages, including what is shared and what stays platform-specific.
3. API routes and OpenAPI/Scalar URLs, database migrations and auth changes.
4. Agora integrations used (Chat vs RTC), project/service configuration, token handling and any missing required settings.
5. Exact commands for local WSL PostgreSQL, API, web, desktop, tests and desktop packaging.
6. Concrete lint/typecheck/test/build/package results; distinguish verified from unverified.
7. Remaining tasks for the Expo app, OS-specific packaging/signing and future collaboration features.

**Final instruction:** implement the plan rather than returning only another plan. Preserve existing product behavior and visual identity, build the shared foundation once, and enforce authorization on every workspace-scoped operation.
