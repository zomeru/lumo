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
- Shared TypeScript logic, a React web/desktop application, and a React Native + Expo mobile application.
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
| Web/desktop frontend | React + Vite |
| Mobile | React Native + Expo + Metro + Expo Router |
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

The React web/desktop application lives in `packages/app`; `apps/web` provides its Vite entry point and Electron packages its compiled assets.

`apps/mobile` owns native React Native screens, Expo Router layouts, and Expo configuration. Metro bundles the mobile application independently of Vite.

```text
apps/web + apps/desktop --> packages/app --> packages/features/web + packages/ui
apps/mobile (Expo Router) --> packages/features/native + packages/ui-native
                                     |
                  shared feature logic / api-client / contracts
                                     |
                     platform and Agora web/native adapters
```

Share contracts, API clients, query definitions, compatible hooks, and domain logic. Keep DOM components, browser routing, and native UI/navigation in explicit platform entry points. Shared tokens define visual consistency; shadcn/ui and Radix components remain web/desktop-only.

Electron and Expo require separate navigation, storage, notification, file-system, and permission implementations. The mobile client must not import `packages/app`, browser UI, or the Univer DOM implementation. Mobile office editing uses an authenticated hosted editor WebView after validation, with an approved preview/browser fallback if needed.

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
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   └── w/
│   │   │   │       └── [workspaceId]/
│   │   │   ├── providers/
│   │   │   └── integrations/
│   │   │       └── office-webview.tsx
│   │   ├── assets/
│   │   │   ├── icon.png
│   │   │   └── splash.png
│   │   ├── plugins/
│   │   ├── app.config.ts
│   │   ├── eas.json
│   │   ├── metro.config.js
│   │   ├── .env.example
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
│   │   │   ├── tokens/
│   │   │   ├── styles/
│   │   │   └── index.ts
│   │   ├── components.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui-native/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── index.ts
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
│   │   │   ├── expo/
│   │   │   └── electron/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agora-client/
│   │   ├── src/
│   │   │   ├── web/
│   │   │   │   ├── chat/
│   │   │   │   └── rtc/
│   │   │   ├── native/
│   │   │   │   ├── chat/
│   │   │   │   └── rtc/
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

**Mobile layout:** Native projects (`ios/`, `android/`) are generated with Expo Prebuild from app configuration and config plugins under Continuous Native Generation (CNG). Keep native customizations reproducible through plugins; do not rely on edits to ignored generated projects. The mobile app owns Expo Router route files; shared feature modules expose separate `web/` and `native/` entry points alongside platform-neutral logic. Keep design tokens in a DOM-free `packages/ui/tokens` export that both UI packages can consume. Metro configuration extends Expo defaults; validate pnpm workspace resolution and a compatible single React/React Native runtime.

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

**Responsibility:** React Native + Expo application for iOS and Android.

It owns native screen composition, Expo Router routes/layouts, global mobile providers, app lifecycle handling, deep links, and configuration for native permissions, icons, splash screens, signing, and releases. Route files delegate to native feature components and shared domain/query logic.

Illustrative app configuration:

```ts
// apps/mobile/app.config.ts
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Collaboration Platform",
  slug: "collaboration-platform",
  scheme: "collaboration",
  ios: { bundleIdentifier: "com.company.collaboration" },
  android: { package: "com.company.collaboration" },
  plugins: ["expo-router", "expo-secure-store", "expo-notifications"],
};

export default config;
```

Identifiers, universal/app links, permission strings, push credentials, and validated Agora native configuration/plugins must be finalized before release. This example does not provide a complete Agora or push setup.

Use Expo development builds with `expo-dev-client` for native Agora Chat/RTC; Expo Go cannot supply arbitrary native modules. Use CNG/config plugins to generate native projects and EAS Build / Submit or equivalent local native tooling for signed binaries. Rebuild the development client when native dependencies or configuration change.

**Build order:**

1. Build shared package outputs where required and validate Expo/React Native dependency compatibility.
2. Generate native projects from Expo configuration/plugins (during EAS Build or local Prebuild).
3. Compile and sign the iOS or Android binary, then install and smoke-test it.

Mobile has no dependency on `apps/web/dist`. The hosted office editor must be deployed separately before testing its WebView integration. Native capabilities belong behind `packages/platform` Expo entry points; Agora uses dedicated web/native adapters.

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
- Authentication endpoints and authenticated push device registration/update/removal.
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

- Push notification delivery directly to APNs/FCM using native device tokens, with retry handling and invalid-token cleanup.
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

**Responsibility:** Web/desktop application composition.

Contains:

- Main React application.
- Router.
- Application layouts.
- Global providers.
- Workspace switcher.
- Navigation.
- Authentication guards.
- Global command menu.

This package combines web feature modules into the web/desktop application. Mobile composes its own providers and Expo Router layouts in `apps/mobile`; it shares compatible feature logic instead of importing this package.

It should not contain the internal implementation of every feature.

### 5.2 `packages/features`

**Responsibility:** Shared frontend feature logic and platform-specific presentation.

Contains all product-facing modules. Each feature separates platform-neutral hooks, queries, mutations, and domain state from `web/` DOM components/pages and `native/` React Native components/screens. Export those entry points explicitly; avoid a barrel that imports both native and browser SDKs. Keep route files and global navigation composition in the respective application host.

Recommended structure for each feature:

```text
packages/features/src/workspace/
├── web/
│   ├── components/
│   └── pages/
├── native/
│   ├── components/
│   └── screens/
├── hooks/
├── queries/
├── mutations/
├── stores/
├── utils/
├── types.ts
└── index.ts
```

Example web presentation (native equivalents live under `messenger/native/`):

```text
packages/features/src/messenger/web/
├── components/
│   ├── ConversationList.tsx
│   ├── ConversationView.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   └── MessageComposer.tsx
├── pages/
│   └── MessengerPage.tsx
└── index.ts
```

Compatible hooks such as `useConversations` and `useMessages`, queries, mutations, and stores live alongside `web/` and `native/` at the feature root; presentation imports them through explicit platform-neutral exports.

**Rules:**

- Components contain presentation logic.
- Hooks coordinate feature behavior.
- Queries use TanStack Query.
- Stores use Zustand for local UI state.
- Backend communication goes through `packages/api-client` or a dedicated integration package.
- Web UI primitives belong in `packages/ui`; native primitives belong in `packages/ui-native`. Shared hooks must not require DOM APIs or browser storage; inject platform capabilities.
- Feature modules must not directly access database connections or server secrets.

### 5.3 `packages/ui`

**Responsibility:** Web/desktop design system and platform-neutral design tokens.

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

### Mobile Design System: `packages/ui-native`

Own React Native primitives, forms, loading/empty states, accessible controls, and native layouts. Use React Native StyleSheet and consume only the DOM-free `packages/ui/tokens` export for shared colors, spacing, and typography. Do not import shadcn/ui, Radix, CSS, or browser components. Native icons must use a React Native compatible implementation.

### 5.4 `packages/api-client`

**Responsibility:** Typed communication with the Hono backend.

Contains:

- HTTP client configuration.
- Request helpers.
- Error normalization.
- API endpoint functions.
- TanStack Query helpers.
- Mutation helpers.

The client must run in browsers and React Native without DOM or localStorage assumptions. Inject base URLs, authenticated session handling, and upload adapters from each host. Configure TanStack Query focus/reconnection handling for React Native AppState and network changes.

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

Frontend code should consume authenticated API endpoints and shared session contracts, not server authentication internals. Mobile validates Better Auth’s Expo client integration, system-browser SSO and callback scheme, trusted origins, and expo-secure-store session persistence. Test cold-start callbacks, expiry, logout cleanup, and server-side revocation; native clients must not rely on browser cookie/localStorage behavior.

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
type SelectedFile = {
  name: string;
  mimeType: string;
  size?: number;
} & (
  | { kind: "web"; blob: Blob }
  | { kind: "native"; uri: string }
);

interface PlatformAdapter {
  openExternalUrl(url: string): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
  selectFiles(): Promise<SelectedFile[]>;
  getPlatform(): "web" | "ios" | "android" | "desktop";
}
```

Implementations:

```text
packages/platform/src/
├── types.ts
├── context.tsx
├── web/
├── expo/
└── electron/
```

The correct adapter is injected by the application host through explicit package exports. Expo adapters use expo-secure-store, expo-notifications, document/media pickers, file-system, and sharing modules as needed. Upload implementations consume either a browser Blob or native URI; native flows must not require DOM File objects. Include secure storage, downloads/sharing, permissions, and deep-link handling in the capability contracts as implemented.

**Important:** Platform-specific dependencies must be isolated so the browser bundle does not unintentionally include Electron or native-only modules.

### 5.10 `packages/agora-client`

**Responsibility:** Frontend Agora integration with separate web and React Native SDK entry points.

Contains:

- Agora Chat client.
- Agora RTC client.
- Connection management.
- Call state helpers.
- Device handling.
- React hooks.

Example:

```text
packages/agora-client/src/web/
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

Provide a separate `src/native/` implementation using Agora React Native Chat/RTC SDKs and shared contracts/state where compatible. Validate Expo SDK/React Native compatibility, required native plugins, device permissions, screen-sharing extensions/services, audio routing, app lifecycle, and background incoming-call limitations in development and signed release builds. Mobile must not bundle browser Agora SDKs.

**Security:** Agora server credentials and token-signing secrets belong exclusively in backend services.

### 5.11 `packages/univer`

**Responsibility:** Web/desktop Univer editor integration and the hosted mobile editor route contract.

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

Mobile does not import this DOM package. Its `office-webview.tsx` opens an authenticated hosted editor route using react-native-webview. Validate touch/keyboard behavior, performance, persistence, short-lived scoped authorization, origin/navigation allowlists, and typed bridge messages with server-side document authorization. If unsuitable, mobile offers an authorized preview with explicit browser editing handoff; confirm the capability limit before rollout.

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

This is a conceptual route structure. TanStack Router owns web/desktop routes; Expo Router maps mobile equivalents to file routes such as `apps/mobile/src/app/w/[workspaceId]/`. Keep native screens in native feature entry points, validate external link destinations, and authenticate/authorize before opening workspace resources, including from a cold start.

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
apps/web + apps/desktop
       |
       v
packages/app --> packages/features/web --> packages/ui

apps/mobile (Expo Router)
       |
       +--> packages/features/native
       +--> packages/ui-native --> packages/ui/tokens (DOM-free export)

Both presentation layers
       |
       +--> packages/features (platform-neutral logic)
       +--> packages/api-client
       +--> packages/agora-client (explicit web/native entry points)
       +--> packages/platform (explicit web/expo/electron entry points)
       +--> packages/contracts

Web/desktop and hosted editor route --> packages/univer
Mobile editor WebView --> authorized hosted editor URL

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
9. Mobile must not import `packages/app`, DOM UI, browser Agora SDKs, or `packages/univer`; browser bundles must not import native SDKs.
10. Shared feature logic and API contracts must remain independent of both browser and native presentation.
11. `packages/ui-native` may consume only the DOM-free token export of `packages/ui`, never its component entry point.

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

Electron packaging must explicitly depend on the web build. Mobile native builds depend on their shared package outputs and Expo configuration, independently of Vite.

```text
Shared package outputs --> Web build --> Electron packaging --> Desktop release
Shared package outputs --> Expo Prebuild --> Native compile/sign --> Mobile release
Web hosted editor build --> Deploy editor route --> Mobile editor integration tests
```

Represent dependencies in Turborepo tasks or reliable package scripts. Expo Metro development servers are persistent, uncached tasks. Native builds, signing, store submission, and EAS remote jobs should use dedicated uncached tasks with explicit platform/environment inputs; do not treat a generic cached `build` result as a signed release. Keep required build prerequisites explicit when using EAS cloud workers, which must build or resolve shared workspace packages themselves.

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
@company/ui-native
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

### Mobile

```text
apps/mobile/.env.example
```

```dotenv
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_REALTIME_URL=
EXPO_PUBLIC_AGORA_APP_ID=
EXPO_PUBLIC_EDITOR_URL=
```

`EXPO_PUBLIC_` values are bundled public configuration, never secrets. Native devices need reachable HTTPS service URLs; host `localhost` is not a physical device backend. Validate environment-specific app identifiers, callback schemes, editor origins, and push projects. Keep signing credentials and provider secrets in CI/EAS secret management or backend services, never app config or client bundles.

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

Use Appium and WebdriverIO against Expo development/release binaries for native flows and the editor WebView. Use React Native Testing Library with jest-expo for native component tests; keep Vitest for platform-neutral logic and web tests. Include physical-device push/cold-start tests, SSO callbacks, token lifecycle, permissions, file URI transfers, Agora calls, accessibility with VoiceOver/TalkBack, and workspace revocation on resume.

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

Electron and Expo mobile releases follow separate distribution pipelines. Mobile uses EAS Build / Submit or equivalent local native builds and store tooling. Native dependency/configuration changes require a new signed binary; any future EAS Update workflow must enforce runtime compatibility and rollback controls.

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

### Start Mobile Metro Server

```bash
pnpm --filter @company/mobile exec expo start --dev-client
```

Install a development build containing the required native SDKs first.

### Build and Run Mobile Locally

```bash
pnpm --filter @company/mobile exec expo run:android
pnpm --filter @company/mobile exec expo run:ios
```

Run the command for the target platform; local iOS builds require macOS/Xcode. These generate native projects as needed and compile the app independently of the web build.

### Build Mobile with EAS

```bash
pnpm --filter @company/mobile exec eas build --platform android --profile development
pnpm --filter @company/mobile exec eas build --platform ios --profile production
```

These examples assume a pinned `eas-cli`, configured EAS project, `eas.json` profiles (development includes a development client), and signing credentials. Run EAS from the mobile package. Production submission and distribution are separate release steps.

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
| `release-mobile.yml` | Validate Expo/native dependencies, build shared packages, build/sign with EAS or local native tooling, device smoke tests, and submit iOS/Android apps |
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

- Workspace switcher: web composition in `packages/app`, mobile composition in `apps/mobile`, and shared membership/query logic in `packages/features/src/workspace`.
- Messenger UI: `packages/features/src/messenger/web` and `packages/features/src/messenger/native`.
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

- Shared web/desktop React rendering and independent Expo native screen rendering.
- Metro workspace resolution, compatible React/React Native versions, and native SDK development builds.
- Platform-specific feature exports without DOM/native dependency leakage.
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
| Frontend architecture | Shared TypeScript logic; React web/desktop UI and React Native mobile UI |
| Web entry point | Vite |
| Mobile application | React Native + Expo + Expo Router |
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

1. Share platform-neutral product logic, contracts, and API clients across React web/desktop and React Native mobile clients.
2. Electron reuses the web application; Expo owns native presentation and navigation while preserving shared product behavior.
3. Frontend business features belong in `packages/features`.
4. Web design-system components belong in `packages/ui`; native components belong in `packages/ui-native` with shared DOM-free tokens.
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

> A workspace-first, TypeScript-based Turborepo monorepo with shared domain logic, a React web/desktop application, a React Native + Expo mobile application, an Electron desktop shell, a modular Hono backend, and platform-specific integrations for Agora, Socket.IO, and Univer.

## 19. Expo Integration References

Verify compatibility against the SDK version selected at implementation time:

- [Expo development workflow and CNG](https://docs.expo.dev/workflow/overview/).
- [Custom native code and development builds](https://docs.expo.dev/workflow/customizing/).
- [Expo Router](https://docs.expo.dev/router/introduction/).
- [Expo monorepo setup](https://docs.expo.dev/guides/monorepos/).
- [EAS Build in monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/).
- [expo-notifications and native device tokens](https://docs.expo.dev/versions/latest/sdk/notifications/).
