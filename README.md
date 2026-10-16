# Lumo

A workspace collaboration platform built with React, Vite, TanStack Router and Query, Hono, Better Auth, PostgreSQL, and Drizzle. The current MVP implements the account and workspace foundation.

## What works

- Email/password registration, sign-in, session restoration, sign-out, and email verification.
- An automatically created private personal workspace, provisioned atomically with each account.
- Three-step team workspace setup, workspace switching, remembered selection, and public discovery/joining.
- Private and invite-only workspaces, email-bound invitations, expiry, revocation, and single-use acceptance.
- Owner, admin, moderator, and member roles; member removal, role changes, ownership transfer, and leaving.
- Workspace settings, profile editing, a searchable member directory, and administrative audit events.
- Responsive dark UI based on the reference screenshots, with loading, error, empty, and access-denied states.

Messaging, Agora calls, presence, notifications, Drive, Univer editors, work management, HR, SSO, native clients, workspace deletion/retention, join requests, and guest roles are pending. Their navigation is disabled where shown. Private workspaces currently use authorized invitations; they do not accept self-joins or join requests. Personal workspaces remain private and cannot transfer ownership. Workspace language and currency are saved preferences; UI translation and financial features are not implemented.

## Packages

| Location                     | Responsibility                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/web`                   | Browser routes, UI, validated API calls, and workspace-keyed queries                             |
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

`check:all` runs formatting, type-aware linting, package boundaries, dependency checks, type checking, coverage, and production builds. Tests retain the 90% global coverage gate for lines, statements, functions, and branches. HTTP/bootstrap entry points are verified by migration/build/browser smoke tests instead of importing running servers into Vitest.

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

Serve the web build with an SPA fallback to `index.html`. Use a same-origin `/api` reverse proxy, or build with an explicit HTTPS `VITE_API_URL` and configure the API's exact `WEB_ORIGIN`. Turbo hashes browser configuration and forwards required server environment variables to development tasks. The default API listener is loopback; a container normally sets `HOST=0.0.0.0`.

Production rollout still requires deployment-specific TLS/proxy configuration, backups and recovery testing, mail delivery validation, monitoring, and capacity testing. Auth rate limiting uses the actual socket peer; a deployment behind a reverse proxy must account for shared peer limits at its trusted ingress. Client-supplied forwarding headers are intentionally ignored.

## Repository conventions

Use Oxlint and Oxfmt at the root. Husky installs staged source/format checks; commits follow Conventional Commits. Keep external dependencies pinned and run `pnpm install` after dependency changes. Add TanStack file routes in `apps/web/src/routes`; never edit `routeTree.gen.ts`. Type checking generates routes on a fresh checkout. The router Vite plugin stays before React, and tests disable automatic route splitting.

The version-scoped route-generator patch replaces its upstream formatter with Oxfmt. Review the patch, override, and package extension together when upgrading, and keep Oxfmt versions aligned. Planning material and screenshots under `docs/` remain unchanged.

The repository asks agents to use its installed Intent. Intent is currently unavailable (`pnpm exec intent list` reports that the command is missing); no replacement was downloaded.
