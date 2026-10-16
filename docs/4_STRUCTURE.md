# Turborepo Monorepo Architecture & Folder Structure

**Project:** Internal Collaboration & Productivity Platform  
**Document:** `docs/MONOREPO_STRUCTURE.md`  
**Version:** 1.0  
**Status:** Proposed Repository Architecture  
**Last Updated:** October 16, 2026

---

## 1. Overview

This document defines the recommended monorepo structure, application boundaries, shared packages, module organization, and development conventions for our workspace-based collaboration platform.

The architecture is designed to support:

- Web, iOS, Android, Windows, macOS, and Linux.
- A shared React and TypeScript application.
- Multiple isolated workspaces per user.
- Agora Chat and RTC.
- Socket.IO presence and notifications.
- Univer Docs, Sheets, and Slides.
- Drive and file storage.
- People and HR management.
- Tasks and project management.
- A modular Hono backend.
- Independent testing, building, and deployment.

### Core Technologies

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Package manager | pnpm |
| Language | TypeScript |
| Shared frontend | React + Vite |
| Mobile | Capacitor |
| Desktop | Electron |
| Backend | Node.js + Hono |
| Database | PostgreSQL + Drizzle |
| Cache and queues | Redis + BullMQ |
| Chat | Agora Chat |
| Calls | Agora RTC |
| Presence | Socket.IO |
| Notifications | Socket.IO + push providers |
| Office suite | Univer |
| Storage | S3-compatible object storage |
| Testing | Vitest, Playwright, Appium |
| CI/CD | GitHub Actions |

---

## 2. Architectural Approach

### 2.1 Monorepo Philosophy

We will use a single repository containing:

1. Deployable applications.
2. Shared frontend and backend packages.
3. Infrastructure configuration.
4. Automated tests.
5. Engineering documentation.
6. Development scripts and tooling.

Turborepo will coordinate builds, tests, type checking, linting, and task caching.

pnpm Workspaces will manage dependencies between applications and packages.

### 2.2 Primary Architecture

```text
                      MONOREPO
                         |
        +----------------+----------------+
        |                |                |
      APPS            PACKAGES          INFRA
        |                |                |
   Web / Mobile       Shared UI       Docker
   Desktop            Features        Deployment
   API                Contracts       CI/CD
   Realtime           Database
   Workers            Integrations
```

### 2.3 Frontend Reuse Strategy

The main React application lives in `packages/app`.

The web application provides the browser entry point.

The mobile application packages the web build through Capacitor.

The desktop application packages the web build through Electron.

```text
                  packages/app
                  Shared React App
                        |
                  packages/features
                        |
          +-------------+-------------+
          |             |             |
       apps/web     apps/mobile   apps/desktop
          |             |             |
       Browser       Capacitor      Electron
          |             |             |
         Web       iOS / Android   Win / Mac / Linux
```

The objective is to maximize UI and business logic reuse while isolating native platform integrations.

**Important:** Electron and Capacitor may require different navigation, storage, notification, file-system, and permission implementations.

---

## 3. Complete Repository Structure

The following represents the **target repository structure**, not a requirement to create every directory immediately.

```text
collaboration-platform/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy-web.yml
│   │   ├── deploy-api.yml
│   │   ├── release-mobile.yml
│   │   ├── release-desktop.yml
│   │   └── security.yml
│   ├── CODEOWNERS
│   └── pull_request_template.md
│
├── apps/
│   │
│   ├── web/
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   └── manifest.webmanifest
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── styles.css
│   │   │   └── vite-env.d.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── mobile/
│   │   ├── android/
│   │   ├── ios/
│   │   ├── resources/
│   │   │   ├── icon.png
│   │   │   └── splash.png
│   │   ├── scripts/
│   │   │   └── prepare-web-assets.ts
│   │   ├── capacitor.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── desktop/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── index.ts
│   │   │   │   ├── windows.ts
│   │   │   │   ├── protocols.ts
│   │   │   │   ├── ipc/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── files.ts
│   │   │   │   │   ├── notifications.ts
│   │   │   │   │   └── system.ts
│   │   │   │   └── services/
│   │   │   │       ├── auto-updater.ts
│   │   │   │       ├── deep-links.ts
│   │   │   │       └── tray.ts
│   │   │   └── preload/
│   │   │       ├── index.ts
│   │   │       └── types.ts
│   │   ├── resources/
│   │   │   └── icons/
│   │   ├── electron.vite.config.ts
│   │   ├── electron-builder.yml
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── config/
│   │   │   │   ├── env.ts
│   │   │   │   └── constants.ts
│   │   │   ├── middleware/
│   │   │   │   ├── authentication.ts
│   │   │   │   ├── workspace-context.ts
│   │   │   │   ├── authorization.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── workspaces/
│   │   │   │   ├── memberships/
│   │   │   │   ├── invitations/
│   │   │   │   ├── contacts/
│   │   │   │   ├── messenger/
│   │   │   │   ├── meetings/
│   │   │   │   ├── office/
│   │   │   │   │   ├── docs/
│   │   │   │   │   ├── sheets/
│   │   │   │   │   └── slides/
│   │   │   │   ├── drive/
│   │   │   │   ├── people-hr/
│   │   │   │   │   ├── people/
│   │   │   │   │   ├── departments/
│   │   │   │   │   ├── approvals/
│   │   │   │   │   ├── leave/
│   │   │   │   │   ├── attendance/
│   │   │   │   │   └── hiring/
│   │   │   │   ├── work/
│   │   │   │   │   ├── tasks/
│   │   │   │   │   └── projects/
│   │   │   │   ├── notifications/
│   │   │   │   ├── search/
│   │   │   │   └── audit/
│   │   │   ├── integrations/
│   │   │   │   ├── agora/
│   │   │   │   ├── univer/
│   │   │   │   ├── storage/
│   │   │   │   └── push/
│   │   │   └── lib/
│   │   │       ├── errors.ts
│   │   │       ├── logger.ts
│   │   │       └── pagination.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── realtime/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── server.ts
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   │   └── socket-auth.ts
│   │   │   ├── rooms/
│   │   │   │   └── workspace-rooms.ts
│   │   │   ├── modules/
│   │   │   │   ├── presence/
│   │   │   │   └── notifications/
│   │   │   ├── adapters/
│   │   │   │   └── redis.ts
│   │   │   └── events/
│   │   │       ├── client-events.ts
│   │   │       └── server-events.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   └── worker/
│       ├── src/
│       │   ├── index.ts
│       │   ├── queues/
│       │   │   ├── notifications.queue.ts
│       │   │   ├── files.queue.ts
│       │   │   ├── meetings.queue.ts
│       │   │   └── maintenance.queue.ts
│       │   ├── jobs/
│       │   │   ├── send-push.ts
│       │   │   ├── process-upload.ts
│       │   │   ├── generate-preview.ts
│       │   │   ├── meeting-reminder.ts
│       │   │   └── cleanup-expired.ts
│       │   ├── processors/
│       │   └── config/
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
│
├── packages/
│   │
│   ├── app/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── router/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── routes.tsx
│   │   │   │   └── guards.tsx
│   │   │   ├── layouts/
│   │   │   │   ├── AuthLayout.tsx
│   │   │   │   ├── WorkspaceLayout.tsx
│   │   │   │   └── SettingsLayout.tsx
│   │   │   ├── providers/
│   │   │   │   ├── AppProviders.tsx
│   │   │   │   ├── QueryProvider.tsx
│   │   │   │   ├── AuthProvider.tsx
│   │   │   │   ├── WorkspaceProvider.tsx
│   │   │   │   └── PlatformProvider.tsx
│   │   │   └── components/
│   │   │       ├── AppSidebar.tsx
│   │   │       ├── WorkspaceSwitcher.tsx
│   │   │       └── GlobalCommandMenu.tsx
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── features/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── workspace/
│   │   │   ├── messenger/
│   │   │   ├── contacts/
│   │   │   ├── meetings/
│   │   │   ├── office/
│   │   │   │   ├── docs/
│   │   │   │   ├── sheets/
│   │   │   │   └── slides/
│   │   │   ├── drive/
│   │   │   ├── people-hr/
│   │   │   │   ├── people/
│   │   │   │   ├── approvals/
│   │   │   │   ├── leave/
│   │   │   │   ├── attendance/
│   │   │   │   └── hiring/
│   │   │   ├── work/
│   │   │   │   ├── tasks/
│   │   │   │   └── projects/
│   │   │   ├── notifications/
│   │   │   └── settings/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   └── ...
│   │   │   ├── patterns/
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── ConfirmDialog.tsx
│   │   │   ├── hooks/
│   │   │   ├── styles/
│   │   │   └── index.ts
│   │   ├── components.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── endpoints/
│   │   │   ├── queries/
│   │   │   ├── mutations/
│   │   │   └── errors.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── contracts/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── workspace/
│   │   │   ├── messenger/
│   │   │   ├── meetings/
│   │   │   ├── office/
│   │   │   ├── drive/
│   │   │   ├── people-hr/
│   │   │   ├── work/
│   │   │   ├── notifications/
│   │   │   └── realtime/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── schema/
│   │   │   │   ├── users.ts
│   │   │   │   ├── workspaces.ts
│   │   │   │   ├── memberships.ts
│   │   │   │   ├── conversations.ts
│   │   │   │   ├── meetings.ts
│   │   │   │   ├── office.ts
│   │   │   │   ├── drive.ts
│   │   │   │   ├── people-hr.ts
│   │   │   │   ├── work.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   └── audit.ts
│   │   │   ├── repositories/
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   ├── seeds/
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── auth/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── session.ts
│   │   │   └── sso.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── permissions/
│   │   ├── src/
│   │   │   ├── roles.ts
│   │   │   ├── actions.ts
│   │   │   ├── policies/
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── messenger.ts
│   │   │   │   ├── meetings.ts
│   │   │   │   ├── office.ts
│   │   │   │   ├── drive.ts
│   │   │   │   ├── hr.ts
│   │   │   │   └── work.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── platform/
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── context.tsx
│   │   │   ├── web/
│   │   │   ├── capacitor/
│   │   │   └── electron/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agora-client/
│   │   ├── src/
│   │   │   ├── chat/
│   │   │   ├── rtc/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── univer/
│   │   ├── src/
│   │   │   ├── core/
│   │   │   ├── docs/
│   │   │   ├── sheets/
│   │   │   ├── slides/
│   │   │   ├── collaboration/
│   │   │   └── persistence/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── utils/
│   │   ├── src/
│   │   │   ├── dates.ts
│   │   │   ├── strings.ts
│   │   │   ├── files.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/
│       ├── typescript/
│       │   ├── base.json
│       │   ├── react.json
│       │   └── node.json
│       ├── vitest/
│       └── package.json
│
├── tests/
│   ├── e2e/
│   │   └── web/
│   │       ├── auth.spec.ts
│   │       ├── workspace.spec.ts
│   │       ├── messenger.spec.ts
│   │       ├── meetings.spec.ts
│   │       ├── office.spec.ts
│   │       └── drive.spec.ts
│   ├── mobile/
│   │   ├── ios/
│   │   └── android/
│   ├── desktop/
│   │   ├── windows/
│   │   ├── macos/
│   │   └── linux/
│   ├── integration/
│   ├── load/
│   └── security/
│       └── workspace-isolation/
│
├── infra/
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   ├── realtime.Dockerfile
│   │   ├── worker.Dockerfile
│   │   └── compose.dev.yml
│   ├── pulumi/
│   ├── monitoring/
│   └── deployment/
│
├── scripts/
│   ├── bootstrap.ts
│   ├── check-env.ts
│   └── clean.ts
│
├── docs/
│   ├── TECH_STACK.md
│   ├── CORE_FEATURES.md
│   ├── MONOREPO_STRUCTURE.md
│   ├── ARCHITECTURE.md
│   ├── API_GUIDELINES.md
│   ├── SECURITY.md
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT.md
│   └── adr/
│
├── .changeset/
├── .env.example
├── .gitignore
├── .npmrc
├── biome.json
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.json
├── renovate.json
└── README.md
```

**Note:** Directories such as `collaboration/`, `persistence/`, and `infra/pulumi/` represent integration boundaries or future capabilities. Their exact contents depend on the chosen provider APIs and deployment requirements.

---

## 4. Applications

### 4.1 `apps/web`

**Responsibility:** Browser entry point for the shared React application.

This application should remain intentionally small.

It owns:

- HTML entry point.
- Vite configuration.
- Browser-specific initialization.
- Global CSS entry point.
- Web application manifest.
- Browser environment configuration.

It imports the main application from `packages/app`.

```text
apps/web/src/main.tsx
    |
    v
packages/app/src/App.tsx
    |
    v
packages/features
    |
    v
packages/ui + api-client + integrations
```

**Rule:** Do not implement Messenger, Drive, or HR business features directly inside `apps/web`.

### 4.2 `apps/mobile`

**Responsibility:** Capacitor native shell.

It owns:

- Capacitor configuration.
- iOS native project.
- Android native project.
- Native app icons and splash screens.
- Native permissions.
- Native build and signing configuration.
- Mobile-specific integration setup.

The mobile app uses the built assets from `apps/web`.

Example configuration:

```ts
// apps/mobile/capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.company.collaboration",
  appName: "Collaboration Platform",
  webDir: "../web/dist",
};

export default config;
```

The actual application ID will be decided before release.

**Build order:**

1. Build `apps/web`.
2. Synchronize Capacitor assets.
3. Build the iOS or Android application.

Mobile-specific functionality should be exposed through `packages/platform`.

### 4.3 `apps/desktop`

**Responsibility:** Electron application shell.

It owns:

- Electron main process.
- Electron preload process.
- Native window management.
- System tray.
- Desktop notifications.
- Desktop file dialogs.
- Screen capture integration.
- Deep links.
- Auto-updates.
- Application packaging and signing.

**Renderer strategy:** Reuse the compiled `apps/web` frontend rather than maintain a second React application.

Development:

```text
Electron main process
        |
        v
Web Vite development server
        |
        v
Shared React application
```

Production:

```text
Electron application
        |
        v
Packaged web assets
        |
        v
Shared React application
```

Use `electron-vite` for Electron main/preload development and builds, and `electron-builder` for packaging.

The desktop release pipeline must package the web assets alongside Electron.

A secure custom application protocol is preferred over relying on unrestricted `file://` navigation. Router history, content security policy, and asset paths must be configured accordingly.

**Security requirements:**

- `contextIsolation: true`.
- `nodeIntegration: false`.
- Sandboxed renderer where supported.
- Minimal preload API.
- Validated IPC messages.
- No direct database credentials in the renderer.
- No backend or Agora server secrets in the application bundle.

### 4.4 `apps/api`

**Responsibility:** Main Hono backend.

It owns:

- HTTP routes.
- Authentication endpoints.
- Workspace authorization.
- Business rules.
- Database operations.
- File access authorization.
- Agora credential issuance.
- Meeting access validation.
- Office document metadata.
- HR workflows.
- Task and project operations.
- Audit logging.

The API should follow a modular monolith structure.

Example module:

```text
apps/api/src/modules/workspaces/
├── workspace.routes.ts
├── workspace.controller.ts
├── workspace.service.ts
├── workspace.repository.ts
├── workspace.policy.ts
└── workspace.test.ts
```

Responsibilities:

| File | Purpose |
|---|---|
| Routes | Register HTTP endpoints |
| Controller | Parse requests and produce responses |
| Service | Business logic |
| Repository | Database access |
| Policy | Authorization rules |
| Test | Module behavior |

For smaller modules, controller and service layers may be combined when that reduces unnecessary boilerplate.

### 4.5 `apps/realtime`

**Responsibility:** Socket.IO server for presence and application notifications.

It owns:

- Authenticated Socket.IO connections.
- Workspace room authorization.
- Presence tracking.
- Notification event delivery.
- Redis-backed Socket.IO scaling.
- Reconnection handling.

**It does not own Agora Chat message transport or Agora RTC media sessions.**

Suggested room names:

```text
workspace:{workspaceId}
user:{userId}
```

Room names are routing identifiers, not authorization mechanisms.

The server must verify membership before joining a workspace room.

### 4.6 `apps/worker`

**Responsibility:** Asynchronous background processing.

It owns:

- Push notification delivery.
- Meeting reminders.
- File processing.
- Preview generation.
- Scheduled cleanup.
- Retryable background operations.

Workers should consume BullMQ jobs backed by Redis.

Long-running work should not block normal API requests.

---

## 5. Shared Packages

### 5.1 `packages/app`

**Responsibility:** Application composition.

Contains:

- Main React application.
- Router.
- Application layouts.
- Global providers.
- Workspace switcher.
- Navigation.
- Authentication guards.
- Global command menu.

This package combines feature modules into one application.

It should not contain the internal implementation of every feature.

### 5.2 `packages/features`

**Responsibility:** Frontend business features.

Contains all product-facing modules.

Recommended structure for each feature:

```text
packages/features/src/workspace/
├── components/
├── pages/
├── hooks/
├── queries/
├── mutations/
├── stores/
├── utils/
├── types.ts
└── index.ts
```

Example:

```text
packages/features/src/messenger/
├── components/
│   ├── ConversationList.tsx
│   ├── ConversationView.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   └── MessageComposer.tsx
├── pages/
│   └── MessengerPage.tsx
├── hooks/
│   ├── useConversations.ts
│   └── useMessages.ts
├── queries/
├── mutations/
├── stores/
│   └── messenger-ui.store.ts
└── index.ts
```

**Rules:**

- Components contain presentation logic.
- Hooks coordinate feature behavior.
- Queries use TanStack Query.
- Stores use Zustand for local UI state.
- Backend communication goes through `packages/api-client` or a dedicated integration package.
- Shared UI primitives belong in `packages/ui`.
- Feature modules must not directly access database connections or server secrets.

### 5.3 `packages/ui`

**Responsibility:** Shared design system.

Contains:

- shadcn/ui components.
- Radix-based primitives.
- Reusable dialogs.
- Tables.
- Form components.
- Loading states.
- Empty states.
- Layout primitives.
- Theme tokens.

The UI package should be domain-independent.

A generic `DataTable` belongs here.

An `EmployeeAttendanceTable` belongs in the People & HR feature.

### 5.4 `packages/api-client`

**Responsibility:** Typed communication with the Hono backend.

Contains:

- HTTP client configuration.
- Request helpers.
- Error normalization.
- API endpoint functions.
- TanStack Query helpers.
- Mutation helpers.

Every workspace-scoped request must include an explicit workspace context.

Example query key:

```ts
[
  "workspace",
  workspaceId,
  "projects",
  projectId,
]
```

Never use the same cache key for data from different workspaces.

### 5.5 `packages/contracts`

**Responsibility:** Shared runtime schemas and types.

Contains:

- Zod request schemas.
- Zod response schemas.
- Domain DTOs.
- Shared enums.
- Socket.IO event contracts.
- API error contracts.

Both frontend and backend may import this package.

**Rule:** Contracts must not depend on the database implementation or browser-specific APIs.

### 5.6 `packages/db`

**Responsibility:** Database schema and persistence infrastructure.

Contains:

- Drizzle schemas.
- Database client.
- Migrations.
- Seeds.
- Shared repository helpers.

Only server-side applications and packages may import this package.

**Never import `packages/db` into frontend code.**

Workspace-scoped tables must include appropriate workspace ownership and relational constraints.

### 5.7 `packages/auth`

**Responsibility:** Server-side authentication infrastructure.

Contains:

- Better Auth configuration.
- Session handling.
- SSO configuration.
- Authentication utilities.

Frontend code should consume authenticated API endpoints and shared session contracts, not server authentication internals.

### 5.8 `packages/permissions`

**Responsibility:** Authorization definitions and reusable policy logic.

Contains:

- Role definitions.
- Permission names.
- Workspace policies.
- Resource-level policies.

Examples:

```text
workspace:manage
workspace:invite
messenger:read
meeting:join
office:edit
drive:upload
hr:leave:approve
work:project:create
```

The backend is the authoritative enforcement point.

Frontend permission checks may improve the UI but must never replace backend authorization.

### 5.9 `packages/platform`

**Responsibility:** Cross-platform native capability abstraction.

Example interface:

```ts
interface PlatformAdapter {
  openExternalUrl(url: string): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
  selectFiles(): Promise<File[]>;
  getPlatform(): "web" | "ios" | "android" | "desktop";
}
```

Implementations:

```text
packages/platform/src/
├── types.ts
├── context.tsx
├── web/
├── capacitor/
└── electron/
```

The correct adapter is injected by the application host.

**Important:** Platform-specific dependencies must be isolated so the browser bundle does not unintentionally include Electron or native-only modules.

### 5.10 `packages/agora-client`

**Responsibility:** Frontend Agora integration.

Contains:

- Agora Chat client.
- Agora RTC client.
- Connection management.
- Call state helpers.
- Device handling.
- React hooks.

Example:

```text
packages/agora-client/src/
├── chat/
│   ├── client.ts
│   ├── conversations.ts
│   └── messages.ts
├── rtc/
│   ├── client.ts
│   ├── devices.ts
│   └── screen-share.ts
└── hooks/
```

**Security:** Agora server credentials and token-signing secrets belong exclusively in backend services.

### 5.11 `packages/univer`

**Responsibility:** Univer editor integration.

Contains:

- Univer initialization.
- Docs editor integration.
- Sheets editor integration.
- Slides editor integration.
- Editor configuration.
- Supported collaboration adapters.
- Supported persistence adapters.

Example:

```text
packages/univer/src/
├── core/
│   ├── create-editor.ts
│   └── editor-config.ts
├── docs/
├── sheets/
├── slides/
├── collaboration/
└── persistence/
```

Univer collaboration, storage, and import/export capabilities must be implemented according to the supported SDK, plugins, and licensing.

Do not build an unsupported collaboration protocol merely to fit this folder structure.

### 5.12 `packages/utils`

**Responsibility:** Small, pure, reusable utilities.

Examples:

- Date formatting.
- String formatting.
- File size formatting.
- Shared validation helpers.
- General-purpose utilities.

Avoid placing domain-specific business logic here.

### 5.13 `packages/config`

**Responsibility:** Shared tooling configuration.

Contains:

- TypeScript configurations.
- Vitest base configuration.
- Other reusable development configuration.

Root-level Biome configuration remains in `biome.json`.

---

## 6. Workspace-First Folder Organization

Workspace isolation must be reflected in both frontend and backend architecture.

### 6.1 Frontend Routing

Suggested route structure:

```text
/
├── login
├── register
├── onboarding
├── workspaces
└── w/:workspaceId
    ├── overview
    ├── messenger
    │   └── :conversationId
    ├── contacts
    ├── meetings
    │   └── :meetingId
    ├── docs
    ├── sheets
    ├── slides
    ├── drive
    │   └── :folderId
    ├── people
    │   ├── directory
    │   ├── approvals
    │   ├── leave
    │   ├── attendance
    │   └── hiring
    ├── work
    │   ├── tasks
    │   └── projects
    └── settings
```

This is a conceptual route structure.

For Electron, use a navigation strategy compatible with packaged assets, such as a secure custom protocol or an appropriate hash-history configuration.

### 6.2 Workspace Context

The active workspace should be represented explicitly.

Example:

```ts
type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  membershipRole: string;
};
```

The frontend workspace context is for navigation and user experience.

It is not proof of authorization.

### 6.3 Backend Workspace Middleware

Every workspace-scoped API request must:

1. Authenticate the user.
2. Resolve the requested workspace.
3. Verify active membership.
4. Verify the required action permission.
5. Verify resource-level access.
6. Execute the authorized operation.

Example API structure:

```text
/api/v1/workspaces/:workspaceId/members
/api/v1/workspaces/:workspaceId/conversations
/api/v1/workspaces/:workspaceId/documents
/api/v1/workspaces/:workspaceId/drive
/api/v1/workspaces/:workspaceId/employees
/api/v1/workspaces/:workspaceId/projects
```

The API must not trust a client-provided workspace ID without checking membership.

### 6.4 Cross-Workspace Data Isolation

Required rules:

- All workspace-scoped database queries must be properly scoped.
- Resource IDs must not bypass workspace checks.
- Agora conversations must map to authorized workspace contexts.
- Univer collaboration sessions must validate document permissions.
- Socket.IO rooms require authorized membership.
- Drive downloads require authorization.
- Search results must respect workspace and resource permissions.
- HR records require additional role-based restrictions.
- Membership revocation must invalidate future access.

Consider PostgreSQL row-level security as defense in depth, but do not rely on it as the only authorization layer.

---

## 7. API Module Organization

Use consistent module structure where complexity warrants it.

Example:

```text
apps/api/src/modules/drive/
├── drive.routes.ts
├── drive.controller.ts
├── drive.service.ts
├── drive.repository.ts
├── drive.policy.ts
├── drive.schemas.ts
├── drive.errors.ts
└── drive.test.ts
```

### Responsibilities

**Routes**

- Define endpoints.
- Attach middleware.
- Connect handlers.

**Controller**

- Read validated request data.
- Invoke services.
- Format HTTP responses.

**Service**

- Implement business rules.
- Coordinate repositories and integrations.
- Manage transactions when required.

**Repository**

- Execute database queries.
- Apply workspace scoping.
- Manage persistence.

**Policy**

- Enforce permissions.
- Verify resource access.

**Schemas**

- Define module-specific validation.
- Prefer shared contracts for public API boundaries.

**Tests**

- Verify success and failure scenarios.
- Include authorization and workspace-isolation cases.

---

## 8. Package Dependency Rules

### Allowed Dependency Direction

```text
apps/web
apps/mobile
apps/desktop
       |
       v
packages/app
       |
       v
packages/features
       |
       +--> packages/ui
       +--> packages/api-client
       +--> packages/agora-client
       +--> packages/univer
       +--> packages/platform
       +--> packages/contracts


apps/api
       |
       +--> packages/auth
       +--> packages/permissions
       +--> packages/db
       +--> packages/contracts


apps/realtime
       |
       +--> packages/permissions
       +--> packages/contracts


apps/worker
       |
       +--> packages/db
       +--> packages/contracts
```

### Rules

1. Applications may import shared packages.
2. Shared packages must not import application code.
3. Frontend packages must not import server-only packages.
4. Contracts should remain lightweight and platform-neutral.
5. UI components must not import database clients.
6. Server secrets must not be included in frontend bundles.
7. Avoid circular dependencies.
8. Prefer public package exports over deep internal imports.

---

## 9. Workspace Configuration

### 9.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tests/*"
```

Nested directories inside a package do not automatically become independent workspace packages.

### 9.2 Root `package.json`

Illustrative root scripts:

```json
{
  "name": "collaboration-platform",
  "private": true,
  "packageManager": "pnpm@<pinned-version>",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "clean": "turbo run clean",
    "db:generate": "pnpm --filter @company/db db:generate",
    "db:migrate": "pnpm --filter @company/db db:migrate"
  },
  "devDependencies": {
    "turbo": "<pinned-version>",
    "typescript": "<pinned-version>",
    "@biomejs/biome": "<pinned-version>"
  }
}
```

Replace placeholder versions with verified compatible releases and commit the lockfile.

### 9.3 `turbo.json`

Illustrative configuration:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", "out/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

Platform packaging tasks should have explicit dependencies on the web build.

In particular:

```text
Web build
   |
   +--> Capacitor sync
   |       |
   |       +--> iOS / Android native build
   |
   +--> Electron packaging
           |
           +--> Windows / macOS / Linux release
```

These dependencies must be represented in Turborepo task configuration or in reliable package-level scripts.

Do not depend on an accidental build order.

### 9.4 Package Naming

Use consistent scoped package names.

Examples:

```text
@company/web
@company/mobile
@company/desktop
@company/api
@company/realtime
@company/worker

@company/app
@company/features
@company/ui
@company/api-client
@company/contracts
@company/db
@company/auth
@company/permissions
@company/platform
@company/agora-client
@company/univer
@company/utils
@company/config
```

Replace `@company` with the project's chosen package scope.

### 9.5 Workspace Dependencies

Use the pnpm workspace protocol.

Example:

```json
{
  "dependencies": {
    "@company/ui": "workspace:*",
    "@company/contracts": "workspace:*"
  }
}
```

This prevents accidentally resolving internal packages from the public npm registry.

---

## 10. Environment Configuration

Environment variables should be scoped to the application or service that needs them.

### Frontend

```text
apps/web/.env.example
```

Example variables:

```dotenv
VITE_API_URL=
VITE_REALTIME_URL=
VITE_AGORA_APP_ID=
```

Only public configuration may use the `VITE_` prefix.

**Never expose Agora App Certificates, token-signing secrets, database credentials, or object storage secrets in frontend variables.**

### Backend

```text
apps/api/.env.example
```

Example:

```dotenv
DATABASE_URL=
REDIS_URL=
BETTER_AUTH_SECRET=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

### Realtime

```text
apps/realtime/.env.example
```

Example:

```dotenv
REDIS_URL=
AUTH_VERIFICATION_CONFIG=
```

### Worker

```text
apps/worker/.env.example
```

Example:

```dotenv
REDIS_URL=
DATABASE_URL=
PUSH_PROVIDER_CONFIG=
```

All environment values must be validated at startup.

Use a managed secret store in production.

---

## 11. Testing Folder Strategy

Tests should be located close to the code they validate when practical.

### Unit Tests

Colocate tests with source files:

```text
workspace.service.ts
workspace.service.test.ts
```

### Integration Tests

Use application-level or shared integration test directories:

```text
tests/integration/
```

Examples:

- Database migrations.
- Workspace creation.
- Membership revocation.
- Drive permissions.
- HR approval workflows.

### Browser E2E

```text
tests/e2e/web/
```

Use Playwright.

### Mobile E2E

```text
tests/mobile/
```

Use Appium and WebdriverIO.

### Desktop E2E

```text
tests/desktop/
```

Use Playwright Electron support.

### Security Tests

```text
tests/security/workspace-isolation/
```

Mandatory scenarios:

- Unauthorized workspace access.
- Cross-workspace resource ID access.
- Unauthorized Agora group access.
- Unauthorized meeting access.
- Unauthorized Univer document access.
- Unauthorized Socket.IO room subscriptions.
- Unauthorized Drive downloads.
- HR permission violations.
- Access after membership revocation.

---

## 12. Infrastructure Organization

### Local Development

Use Docker Compose for:

- PostgreSQL.
- Redis.
- MinIO.
- Optional development observability tools.

The React frontend and Node.js applications can run directly on the host machine for fast development.

### Production

Deploy independently:

- Web frontend.
- Hono API.
- Socket.IO service.
- BullMQ worker.
- PostgreSQL.
- Redis.
- Object storage.

Electron and Capacitor releases follow separate distribution pipelines.

### Infrastructure as Code

If needed, place Pulumi TypeScript infrastructure definitions under:

```text
infra/pulumi/
```

Do not introduce Kubernetes or complex infrastructure orchestration unless justified by actual operational requirements.

---

## 13. Development Commands

Illustrative commands, assuming the corresponding package scripts are configured:

### Install Dependencies

```bash
pnpm install
```

### Start Web

```bash
pnpm --filter @company/web dev
```

### Start Backend

```bash
pnpm --filter @company/api dev
```

### Start Realtime Server

```bash
pnpm --filter @company/realtime dev
```

### Start Worker

```bash
pnpm --filter @company/worker dev
```

### Build Web

```bash
pnpm --filter @company/web build
```

### Sync Mobile

```bash
pnpm --filter @company/mobile exec cap sync
```

The web build must exist before syncing.

### Run Tests

```bash
pnpm test
```

### Type Check

```bash
pnpm typecheck
```

### Build All Applications

```bash
pnpm build
```

Native platform builds and signed desktop releases require additional platform-specific commands and credentials.

---

## 14. CI/CD Workflow Organization

Recommended workflows:

| Workflow | Responsibility |
|---|---|
| `ci.yml` | Lint, typecheck, unit tests, integration tests |
| `deploy-web.yml` | Build and deploy web application |
| `deploy-api.yml` | Deploy API, realtime, and workers |
| `release-mobile.yml` | Build and distribute iOS/Android apps |
| `release-desktop.yml` | Build and distribute Electron apps |
| `security.yml` | Dependency and security scanning |

### Pull Request Checks

Required:

- Biome.
- TypeScript.
- Unit tests.
- Integration tests.
- Relevant browser E2E tests.
- Dependency/security checks.

### Release Requirements

- Versioned builds.
- Environment-specific configuration.
- Database migration review.
- Platform-specific signing.
- Smoke tests.
- Monitoring.
- Rollback procedures.

---

## 15. Repository Conventions

### Naming

- Directories: `kebab-case`.
- React components: `PascalCase.tsx`.
- Hooks: `useSomething.ts`.
- Zustand stores: `*.store.ts`.
- Services: `*.service.ts`.
- Repositories: `*.repository.ts`.
- Routes: `*.routes.ts`.
- Policies: `*.policy.ts`.
- Tests: `*.test.ts` or `*.spec.ts`.

### Imports

Prefer package imports:

```ts
import { Button } from "@company/ui";
```

Avoid reaching into another package's private implementation.

### Feature Boundaries

Each feature should own its UI and feature-specific logic.

Examples:

- Workspace switcher: `packages/app`.
- Messenger UI: `packages/features/src/messenger`.
- Agora Chat integration: `packages/agora-client`.
- Meeting access validation: `apps/api/src/modules/meetings`.
- Univer editor initialization: `packages/univer`.
- Drive file authorization: `apps/api/src/modules/drive`.
- Attendance business rules: `apps/api/src/modules/people-hr/attendance`.

### Database Boundaries

Only backend code may import database infrastructure.

Frontend code must communicate through authorized APIs.

### Workspace Security

Every workspace-scoped backend module must include tests proving that non-members cannot access its protected resources.

---

## 16. Recommended Implementation Order

Do not create every module at the beginning.

### Stage 1: Monorepo Foundation

Create:

```text
apps/web
apps/api
packages/app
packages/ui
packages/contracts
packages/db
packages/auth
packages/permissions
packages/config
```

Set up:

- pnpm.
- Turborepo.
- TypeScript.
- Biome.
- PostgreSQL.
- Drizzle.
- Authentication.
- Basic CI.

### Stage 2: Workspace Foundation

Create:

```text
packages/features/src/workspace
apps/api/src/modules/workspaces
apps/api/src/modules/memberships
apps/api/src/modules/invitations
```

Implement:

- Default personal workspace.
- Workspace switching.
- Membership.
- Roles.
- Workspace authorization.
- Isolation tests.

### Stage 3: Platform Shells

Create:

```text
apps/mobile
apps/desktop
packages/platform
```

Validate:

- Shared React rendering.
- Authentication.
- Navigation.
- Native permissions.
- Notifications.
- File access.

### Stage 4: Communication

Create:

```text
apps/realtime
packages/agora-client
packages/features/src/messenger
packages/features/src/meetings
packages/features/src/contacts
```

Implement:

- Agora Chat.
- Agora RTC.
- Socket.IO presence.
- Notifications.
- Workspace-bound meeting access.

### Stage 5: Drive and Office

Create:

```text
packages/univer
packages/features/src/drive
packages/features/src/office
apps/api/src/modules/drive
apps/api/src/modules/office
```

Implement:

- File storage.
- Folder management.
- Document metadata.
- Docs, Sheets, and Slides.
- Collaboration and persistence.
- Permission checks.

### Stage 6: Work and HR

Create:

```text
packages/features/src/work
packages/features/src/people-hr
apps/api/src/modules/work
apps/api/src/modules/people-hr
```

Implement:

- Tasks.
- Projects.
- People.
- Approvals.
- Leave.
- Attendance.
- Hiring.

### Stage 7: Production Hardening

Complete:

- Cross-platform testing.
- Security reviews.
- Monitoring.
- Backups.
- CI/CD.
- App signing.
- Performance testing.
- Production rollout.

---

## 17. Final Architecture Decisions

| Decision | Selection |
|---|---|
| Repository model | Single monorepo |
| Package manager | pnpm |
| Build orchestration | Turborepo |
| Frontend architecture | Shared React application |
| Web entry point | Vite |
| Mobile shell | Capacitor |
| Desktop shell | Electron |
| Backend architecture | Modular Hono monolith |
| Realtime service | Socket.IO for presence and notifications |
| Messaging | Agora Chat |
| Calls | Agora RTC |
| Office editing | Univer |
| Drive | Custom application module |
| Primary database | PostgreSQL |
| ORM | Drizzle |
| Background processing | BullMQ |
| Cache | Redis |
| File storage | S3-compatible object storage |
| Authentication | Better Auth |
| Authorization | Workspace-scoped RBAC and resource policies |
| Testing | Vitest, Playwright, Appium |
| CI/CD | GitHub Actions |

---

## 18. Architecture Rules

1. The shared React application is the single source of truth for frontend product features.
2. Mobile and desktop applications are platform shells, not independent product implementations.
3. Frontend business features belong in `packages/features`.
4. Shared design-system components belong in `packages/ui`.
5. Server-side business logic belongs in `apps/api`.
6. Database access is restricted to server-side code.
7. Agora owns chat transport and RTC; Socket.IO owns presence and application notifications.
8. Univer integration is isolated behind a dedicated package.
9. All workspace-scoped resources require server-side membership and permission checks.
10. HR-sensitive resources require additional authorization.
11. Shared contracts must remain independent of application-specific implementations.
12. Native integrations must be isolated behind platform adapters.
13. Production services should be independently deployable without prematurely introducing microservices.
14. Builds and releases must use explicit dependency ordering.
15. Security, maintainability, and cost efficiency take priority over unnecessary abstraction.

**Final architectural direction:**

> A workspace-first, TypeScript-based Turborepo monorepo with one shared React application, Capacitor mobile shells, Electron desktop shells, a modular Hono backend, and dedicated integrations for Agora, Socket.IO, and Univer.