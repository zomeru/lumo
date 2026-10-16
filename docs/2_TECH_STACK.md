# Technology Stack & Architecture

**Project:** Internal Collaboration & Productivity Platform  
**Document:** `docs/TECH_STACK.md`  
**Version:** 1.0  
**Last Updated:** October 16, 2026  
**Status:** Core technology stack selected; integration details pending validation

---

## 1. Project Overview

We are building an internal, cross-platform collaboration and productivity platform to replace the features of Lark/Feishu currently used by our company.

The primary objective is to reduce long-term software subscription costs while maintaining a reliable, secure, and user-friendly employee collaboration experience.

### Target Platforms

| Platform | Technology |
|---|---|
| Web | React + Vite |
| iOS | React Native + Expo |
| Android | React Native + Expo |
| Windows | Electron |
| macOS | Electron |
| Linux | Electron |

### Core Product Modules

- **Chat:** Direct messages, group conversations, channels, and message history.
- **Calls:** Voice and video calling.
- **Presence:** Online, offline, away, and activity status.
- **Notifications:** In-app, desktop, and mobile notifications.
- **Docs:** Collaborative document editing.
- **Sheets:** Collaborative spreadsheet editing.
- **Slides:** Collaborative presentation editing.
- **Drive:** File storage, folders, sharing, permissions, and version history.
- **Tasks & Approvals:** Internal task management and business workflows.
- **Administration:** Users, teams, departments, roles, and permissions.

---

## 2. Core Technology Stack

### 2.1 Development Foundation

| Category | Technology | Purpose |
|---|---|---|
| Programming language | TypeScript | Primary application language |
| JavaScript runtime | Node.js LTS | Backend and development tooling |
| Package manager | pnpm | Package management |
| Monorepo | Turborepo | Build orchestration and caching |
| Version control | Git + GitHub | Source control and collaboration |
| IDE | VS Code | Primary development environment |
| Code formatting/linting | Biome | Code quality and consistency |
| Git hooks | Lefthook | Pre-commit quality checks |
| Dependency updates | Renovate | Automated dependency updates |

### 2.2 Web and Desktop Frontend

| Category | Technology | Purpose |
|---|---|---|
| Framework | React | Application UI |
| Build tool | Vite | Development server and production builds |
| Language | TypeScript | Type safety |
| Routing | TanStack Router | Web/desktop client-side navigation |
| Server state | TanStack Query | API fetching, caching, and mutations |
| Client state | Zustand | Local UI and application state |
| Styling | Tailwind CSS | Utility-first styling |
| UI components | shadcn/ui + Radix UI | Accessible and customizable components |
| Forms | React Hook Form | Form management |
| Validation | Zod | Runtime and form validation |
| Icons | Lucide React | Application icons |
| Component documentation | Storybook | Component development and testing |

Web and Electron share the React + Vite application. iOS and Android use a separate React Native application built with Expo and Metro.

Share TypeScript domain logic, contracts, API clients, query definitions, and compatible hooks across platforms. Mobile screens use React Native components and Expo Router; browser DOM components, TanStack Router, Tailwind CSS, shadcn/ui, and Radix UI remain in the web/desktop layer. Use React Native StyleSheet with shared design tokens for mobile styling.

### Mobile Frontend

| Category | Technology | Purpose |
|---|---|---|
| Framework / tooling | React Native + Expo + Metro | Native iOS and Android application |
| Navigation | Expo Router | Native navigation and deep links |
| Shared state / validation | TanStack Query + Zustand + Zod | Reuse platform-neutral logic |
| UI / styling | React Native components + StyleSheet | Native screens with shared design tokens |
| Native integrations | Expo modules + platform adapters | Secure storage, files, permissions, and notifications |
| Development runtime | Expo development builds + expo-dev-client | Native SDK integration testing |
| Build / distribution | EAS Build / Submit or local native builds | Signed application releases |

Use development builds for native Agora integrations; Expo Go is insufficient for custom native SDKs. Pin compatible Expo, React Native, React, and native dependency versions after validation.

### 2.3 Cross-Platform Applications

| Platform | Technology | Additional Tooling |
|---|---|---|
| Web | React + Vite | PWA support where useful |
| iOS | React Native + Expo | Xcode, iOS Simulator, physical iPhone |
| Android | React Native + Expo | Android Studio, Android Emulator, physical Android |
| Windows | Electron | electron-vite, electron-builder |
| macOS | Electron | electron-vite, electron-builder |
| Linux | Electron | electron-vite, electron-builder |

**Desktop decision:** Electron is the selected desktop runtime. Tauri is no longer part of the planned stack.

Electron provides a consistent Chromium rendering environment and access to Node.js in its main process, making it a practical choice for a JavaScript/TypeScript-focused team.

Electron security requirements include:

- Context isolation enabled.
- Node integration disabled in renderer processes.
- Sandboxing enabled where supported.
- A minimal, explicitly defined preload API.
- Validated IPC messages and authorization checks.
- Signed application releases and secure update delivery.

### 2.4 Backend

| Category | Technology | Purpose |
|---|---|---|
| Runtime | Node.js LTS | Backend runtime |
| Framework | Hono | HTTP APIs |
| API validation | Zod | Request/response validation |
| API documentation | OpenAPI + Scalar | API specifications |
| Authentication | Better Auth | Sessions and authentication |
| Enterprise login | OIDC / SSO | Company identity integration |
| Authorization | RBAC + resource-level permissions | Access control |
| Real-time application events | Socket.IO | Presence and notifications |
| Background jobs | BullMQ | Asynchronous processing |
| Cache / queue infrastructure | Redis | Cache, presence, and job queues |
| Logging | Pino | Structured application logs |

The backend will initially use a **modular monolith architecture**.

Features should be organized into well-defined modules instead of being deployed as separate microservices from the beginning.

---

## 3. Collaboration Technology

### 3.1 Chat and Calls: Agora

**Selected provider: Agora**

| Capability | Technology |
|---|---|
| Direct messaging | Agora Chat |
| Group messaging | Agora Chat |
| Chat history | Agora Chat, subject to configured retention |
| Voice calls | Agora RTC |
| Video calls | Agora RTC |
| Call signaling | Agora-supported signaling/integration, with backend orchestration as needed |
| Call access authorization | Hono backend |
| User presence | Socket.IO |
| In-app notifications | Socket.IO |

Agora Chat and Agora RTC serve different purposes.

**Agora Chat** is responsible for message transport and chat functionality. **Agora RTC** is responsible for real-time audio and video communication.

Our backend will manage user identities, access policies, application metadata, and secure issuance of provider credentials.

We should avoid storing duplicate authoritative message histories in both Agora and PostgreSQL. If message mirroring is required for compliance, search, or migration, it must have a clearly defined synchronization and retention policy.

**Integration requirements:**

- Validate Agora Chat and RTC React Native SDKs in Expo development builds, including required config plugins/native configuration; validate web SDKs separately in browsers and Electron.
- Implement secure, short-lived provider credentials.
- Verify group membership and permissions server-side.
- Define message retention, export, deletion, and backup requirements.
- Validate data residency, pricing, and expected usage.
- Test reconnection, device switching, microphone permissions, and camera permissions.

### 3.2 Presence and Notifications: Socket.IO

**Selected technology: Socket.IO**

Socket.IO will be used for:

- Online/offline/away presence.
- Heartbeat and connection tracking.
- In-app notification delivery.
- Application activity events.
- Relevant lightweight real-time UI updates.

Redis will support shared presence state and multi-instance Socket.IO deployments.

**Important:** Socket.IO is not the only notification mechanism.

When a mobile application is suspended or closed, Socket.IO cannot reliably deliver background notifications. The notification architecture must also support:

| Notification Type | Technology |
|---|---|
| In-app, while connected | Socket.IO |
| iOS push | APNs via expo-notifications with native device tokens |
| Android push | FCM via expo-notifications with native device tokens |
| Browser push | Web Push |
| Desktop notification | Electron Notification API |
| Notification persistence | PostgreSQL |
| Notification processing | BullMQ |

The backend worker delivers directly to APNs/FCM using registered native device tokens. Expo Push Service is an optional alternative requiring an explicit transport decision; do not mix Expo push tokens with native provider tokens. Handle token rotation, logout/unregistration, notification permissions, and authorized deep-link navigation. Background incoming calls require separate validation of native call UI, VoIP push, and OS restrictions; ordinary push does not guarantee a live incoming-call experience.

PostgreSQL will be the durable source of truth for notification records. Socket.IO is the real-time delivery channel.

---

## 4. Collaborative Office Suite

### Selected Technology: Univer

**Univer** is the selected editor technology for Docs, Sheets, and Slides.

| Module | Technology | Responsibility |
|---|---|---|
| Docs | Univer | Document editing |
| Sheets | Univer | Spreadsheet editing |
| Slides | Univer | Presentation editing |
| Drive | Custom React / React Native + Hono | File management and storage |

### 4.1 Docs

Planned functionality:

- Create and edit documents.
- Rich-text formatting.
- Document sharing.
- Access permissions.
- Document persistence.
- Revision history.
- Real-time collaboration.

### 4.2 Sheets

Planned functionality:

- Create and edit spreadsheets.
- Cell formatting.
- Formulas and calculations.
- Multiple sheets.
- Import/export where supported.
- Spreadsheet persistence.
- Real-time collaboration.

### 4.3 Slides

Planned functionality:

- Create and edit presentations.
- Slide management.
- Text and visual elements.
- Presentation layouts.
- Import/export where supported.
- Presentation persistence.
- Real-time collaboration.

### 4.4 Univer Integration Requirements

Univer will be integrated into the web/desktop React application through a dedicated editor module. Mobile opens an authenticated hosted editor route in react-native-webview, subject to a touch/keyboard/performance proof of concept. Univer is a web editor, so its DOM implementation must not be imported into native screens. If the proof of concept fails, mobile offers an authorized preview and an explicit browser handoff for editing; this capability limit must be approved before rollout. The WebView bridge must validate messages and allowed origins, use short-lived scoped authorization, and enforce the same workspace/document permissions without exposing long-lived credentials.

**The following must be validated before production implementation:**

1. Docs, Sheets, and Slides capabilities in the selected Univer version.
2. Real-time collaborative editing support for each editor type.
3. Whether collaboration requires paid Univer services, plugins, or separate infrastructure.
4. Document persistence and recovery.
5. Import/export compatibility with DOCX, XLSX, and PPTX.
6. Licensing and commercial deployment requirements.
7. Editor performance with large documents and spreadsheets.
8. Mobile editor WebView compatibility on iOS and Android, including authentication, keyboard input, touch interactions, and file handling.
9. Compatibility with Electron.
10. Conflict handling, revision history, and permissions.

**Architectural rule:** Do not assume that installing Univer automatically provides a production-ready collaborative editing backend for all three editor types.

The collaboration and persistence architecture must follow Univer's supported APIs, capabilities, and licensing model.

---

## 5. Drive and File Storage

Drive will be a custom-built module integrated with the backend and the collaborative office suite.

### Selected Technologies

| Component | Technology |
|---|---|
| File management UI | React (web/desktop) + React Native (mobile) |
| File/folder APIs | Hono |
| Metadata database | PostgreSQL |
| ORM | Drizzle |
| File storage | S3-compatible object storage |
| Production storage options | Amazon S3 / Cloudflare R2 |
| Local development storage | MinIO |
| Background processing | BullMQ |
| Cache | Redis |
| Search | PostgreSQL full-text search |

### Planned Drive Features

- Files and folders.
- File uploads and downloads.
- File sharing.
- User and team permissions.
- Folder hierarchy.
- File version history.
- Trash and restore.
- File search.
- Storage usage tracking.
- File previews.
- Integration with Univer Docs, Sheets, and Slides.

### Storage Architecture

**PostgreSQL stores:**

- File metadata.
- Folder hierarchy.
- Ownership.
- Access permissions.
- File versions.
- Sharing records.
- Activity and audit logs.
- References to stored objects.

**Object storage stores:**

- Uploaded files.
- Document snapshots.
- Media attachments.
- Exported documents.
- File versions and binary assets.

Files must be private by default.

Uploads and downloads should use appropriately scoped, short-lived signed URLs or authenticated backend streaming.

The backend must enforce permissions independently of frontend visibility.

### Office Editor Integration

Drive will manage the lifecycle of Univer documents.

Expected flow:

1. User creates or opens a document from Drive.
2. Backend validates the user's permissions.
3. Frontend initializes the appropriate Univer editor.
4. Document content is loaded using the selected Univer persistence integration.
5. Changes are saved through the supported persistence/collaboration mechanism.
6. Drive updates document metadata and revision information.

The exact document serialization and collaborative persistence approach must be validated against Univer's supported APIs.

---

## 6. Database and Persistence

### Primary Database: PostgreSQL

**Selected ORM: Drizzle ORM**

PostgreSQL will store application data such as:

- Users.
- Teams and departments.
- Roles and permissions.
- Workspaces.
- Tasks and approvals.
- Drive files and folders.
- File permissions and sharing.
- Document metadata and revisions.
- Notifications.
- Audit logs.
- Application settings.
- Agora integration metadata.

Agora Chat remains the selected messaging provider. PostgreSQL should not automatically become a second authoritative message store.

### Redis

Redis will support:

- Presence state.
- Socket.IO scaling.
- Caching.
- Rate limiting.
- BullMQ queues.
- Temporary application state.

### Search

Start with **PostgreSQL full-text search** for application-owned metadata and content that is available for indexing.

Evaluate Meilisearch later if search requirements exceed PostgreSQL's capabilities.

Search across Agora messages and Univer documents requires explicit indexing integrations and access-control enforcement.

---

## 7. Authentication and Authorization

### Authentication

**Selected technology: Better Auth**

Requirements:

- Company SSO through OIDC where supported.
- Secure session management.
- User provisioning and deprovisioning.
- Account and device session management.
- Role-based access control.
- Resource-level authorization.

### Authorization Rules

All sensitive actions must be authorized by the backend.

This includes:

- Opening shared documents.
- Joining Agora chat groups.
- Starting or joining protected calls.
- Accessing Drive files.
- Downloading attachments.
- Receiving restricted notifications.
- Managing organization members.

Agora credentials must be issued only after backend authorization.

Electron must use appropriate secure credential storage. Mobile must validate Better Auth’s Expo client integration, system-browser SSO callbacks and deep links, trusted origins, session expiry/revocation, and expo-secure-store persistence. Browser cookies and localStorage must not be assumed to work as native session storage.

---

## 8. Monorepo Structure

The project will use **pnpm Workspaces + Turborepo**.

### Applications

- `apps/web`: Shared React + Vite application.
- `apps/mobile`: React Native + Expo application for iOS and Android, with Expo Router and native screens.
- `apps/desktop`: Electron application, including main and preload processes.
- `apps/api`: Hono backend.
- `apps/realtime`: Socket.IO service for presence and notifications.
- `apps/worker`: BullMQ background workers.

### Shared Packages

- `packages/app`: Web/desktop React composition and routing.
- `packages/ui`: Web/desktop React components and shared design tokens.
- `packages/ui-native`: React Native design-system components consuming shared tokens.
- `packages/api-client`: Platform-neutral typed API client and query helpers.
- `packages/features`: Shared feature logic with explicit web and native presentation entry points.
- `packages/univer`: Univer integration and editor abstractions.
- `packages/agora-client`: Agora Chat and RTC integration.
- `packages/features/src/drive`: Drive feature logic with web/native presentation.
- `packages/db`: Drizzle schemas and migrations.
- `packages/contracts`: Zod schemas and API contracts.
- `packages/auth`: Authentication and authorization utilities.
- `packages/platform`: Web, React Native + Expo, and Electron adapters.
- `packages/config`: Shared TypeScript and tooling configuration.

### Infrastructure and Testing

- `infra/docker`: Local and production container definitions.
- `infra/pulumi`: Optional infrastructure as code.
- `tests/e2e`: Browser end-to-end tests.
- `tests/mobile`: Mobile end-to-end tests.
- `tests/desktop`: Electron end-to-end tests.
- `docs`: Architecture and engineering documentation.

The frontend must not directly depend on Electron or React Native + Expo APIs inside shared business components. Platform-specific behavior should be exposed through the platform adapter package.

---

## 9. Development Tooling

| Category | Tool |
|---|---|
| IDE | VS Code |
| Package management | pnpm |
| Monorepo | Turborepo |
| Linting and formatting | Biome |
| Type checking | TypeScript |
| Git hooks | Lefthook |
| Dependency automation | Renovate |
| UI development | Storybook |
| API testing | Bruno |
| API documentation | OpenAPI + Scalar |
| Database inspection | Drizzle Studio / TablePlus |
| Local services | Docker Compose |
| Design | Figma |
| Source control | GitHub |

Use a consistent project-wide formatting and type-checking configuration.

Avoid introducing redundant tools without a clear technical requirement.

---

## 10. Testing Strategy

### Automated Testing

| Testing Category | Technology |
|---|---|
| Unit testing | Vitest |
| Web component testing | React Testing Library + Vitest |
| Native component testing | React Native Testing Library + jest-expo |
| API mocking | MSW |
| Backend integration testing | Vitest + Testcontainers |
| Web end-to-end testing | Playwright |
| Mobile end-to-end testing | Appium + WebdriverIO |
| Electron end-to-end testing | Playwright Electron support |
| Accessibility testing | axe-core (web) + VoiceOver / TalkBack (mobile) |
| Load testing | k6 |
| Security testing | OWASP ZAP + CodeQL |

### Actual Platform Testing

| Platform | Testing Environment |
|---|---|
| Web | Chrome, Firefox, Edge, Safari |
| iOS | Xcode Simulator + physical iPhone |
| Android | Android Emulator + physical Android device |
| Windows | Windows 11 physical device or VM |
| macOS | Apple Silicon Mac; Intel where required |
| Linux | Ubuntu LTS environment |

### Critical Integration Tests

Before production rollout, validate:

- Univer document, spreadsheet, and presentation editing.
- Concurrent editing and conflict recovery.
- Large spreadsheet and document performance.
- Agora Chat messaging and reconnection.
- Agora voice/video calls on every supported platform.
- Microphone, camera, and screen-sharing permissions.
- Socket.IO presence reconnection.
- Expo development and release builds with native Agora modules.
- Mobile deep links, SSO callbacks, secure session persistence, and revocation.
- Mobile editor WebView authorization, bridge validation, and browser handoff.
- Native file picking, URI-based uploads, downloads, and sharing.
- Mobile background push notifications, token lifecycle, and foreground/resume recovery.
- Electron desktop notifications.
- Drive file uploads, downloads, and permissions.
- App startup, memory usage, and long-running sessions.
- Electron updates and code signing.
- Offline behavior and network recovery.

Automated tests should be complemented by testing on real mobile and desktop devices.

---

## 11. CI/CD and Deployment

### CI/CD

**Selected technology: GitHub Actions**

Pull requests should run:

- Formatting and lint checks.
- Type checking.
- Unit tests.
- Integration tests.
- Browser end-to-end tests.
- Security and dependency checks.

Release workflows should additionally build and validate mobile and desktop applications. Mobile uses EAS Build / Submit or equivalent local native builds, independently of the Vite build. Only the hosted mobile editor route requires deployed web assets. Native dependency/configuration changes require a new signed binary; any future EAS Update rollout must match the native runtime and include rollback controls.

### Deployment

| Component | Deployment |
|---|---|
| Web | Cloudflare Pages or equivalent static hosting |
| Hono API | Docker-based Node.js hosting |
| Socket.IO | Long-running Node.js service |
| BullMQ workers | Separate worker process |
| PostgreSQL | Managed PostgreSQL |
| Redis | Managed Redis |
| File storage | S3 / R2 |
| iOS | TestFlight, then approved company distribution |
| Android | Google Play internal/managed distribution |
| Windows | Signed Electron installer |
| macOS | Signed and notarized Electron application |
| Linux | Electron installer/package |

### Desktop Packaging

**Selected tools: electron-vite + electron-builder**

Evaluate `electron-updater` for application updates.

Desktop release requirements:

- Windows code signing.
- macOS code signing and notarization.
- Secure update distribution.
- Release versioning.
- Crash reporting.
- Rollback strategy.

---

## 12. Monitoring and Security

### Observability

| Category | Technology |
|---|---|
| Error monitoring | Sentry |
| Distributed tracing | OpenTelemetry |
| Structured logging | Pino |
| Metrics and dashboards | Grafana Cloud or equivalent |
| Background job monitoring | BullMQ monitoring integration |

### Security Requirements

- HTTPS/TLS for all network communication.
- Server-side authorization for every protected resource.
- Secure session and provider-token management.
- Private object storage by default.
- Short-lived signed file URLs.
- Rate limiting.
- Audit logging.
- Malware scanning for uploaded files.
- Encryption at rest.
- Automated backups.
- Tested disaster recovery.
- Dependency vulnerability scanning.
- Secure Electron IPC and renderer isolation.
- Defined retention and deletion policies.
- Review of Agora and Univer data handling, licensing, and compliance.

---

## 13. Architectural Principles

1. **Share code by default.** Reuse the React UI across web/desktop and platform-neutral TypeScript business logic across all clients; implement native mobile presentation separately.
2. **Keep native APIs behind adapters.** Platform-specific integrations should not leak into shared feature components.
3. **Use the right service for each responsibility.** Agora handles chat and calls; Socket.IO handles presence and in-app notifications; Univer handles office editing.
4. **Avoid duplicate sources of truth.** Each data domain must have a clearly designated authoritative system.
5. **Enforce permissions on the backend.** Never trust frontend-only access checks.
6. **Build a modular monolith first.** Extract services only when scale or operational needs justify them.
7. **Use managed infrastructure where practical.** Minimize operational overhead.
8. **Validate native compatibility early.** Web functionality does not guarantee React Native, Expo, editor WebView, or Electron compatibility.
9. **Track total cost of ownership.** Include Agora usage, Univer licensing, infrastructure, engineering, and maintenance.
10. **Prioritize the company's actual workflows.** Avoid unnecessary feature development.

---

## 14. Decisions Requiring Validation

The following are selected technologies, but their production integration details remain open:

| Decision | Validation Required |
|---|---|
| Univer collaboration | Multi-user editing availability and licensing for Docs, Sheets, and Slides |
| Univer persistence | Supported storage format, autosave, snapshots, and recovery |
| Office import/export | DOCX, XLSX, PPTX compatibility and licensing |
| Agora Chat | Retention, export, history, data residency, and usage pricing |
| Agora RTC | Mobile/Electron SDK compatibility and media permissions |
| Socket.IO scaling | Redis adapter, reconnection, and multi-instance behavior |
| Mobile notifications | expo-notifications, direct APNs/FCM delivery, token lifecycle, background behavior, and incoming-call limitations |
| Expo native SDKs | Agora Chat/RTC compatibility, config plugins, native runtime, and signed development/release builds |
| Mobile authentication | Better Auth Expo integration, secure storage, trusted origins, SSO callbacks, and revocation |
| Mobile office editing | Authorized WebView editor, mobile usability, and preview/browser fallback |
| Electron distribution | Signing, notarization, updates, and deployment policy |
| Offline support | Scope of offline reading, drafts, and synchronization |
| Search | Indexing and permission-aware search across multiple providers |

These should be resolved through targeted proofs of concept before committing to a production rollout.

---

## 15. Implementation Priorities

### Phase 1: Foundation

- Monorepo and development tooling.
- Shared web/desktop React application and platform-neutral feature logic.
- React Native + Expo mobile application and Electron desktop shell.
- Hono backend.
- PostgreSQL and Drizzle.
- Authentication and permissions.
- CI/CD and local Docker environment.

### Phase 2: Communication

- Agora Chat integration.
- Agora voice/video calls.
- Socket.IO presence.
- In-app notifications.
- Mobile and desktop notification integrations.

### Phase 3: Drive

- File and folder management.
- Object storage integration.
- Sharing and permissions.
- Upload/download workflows.
- Versioning and audit logs.

### Phase 4: Office Suite

- Univer Docs integration.
- Univer Sheets integration.
- Univer Slides integration.
- Drive-to-editor integration.
- Collaborative editing and persistence.
- Import/export validation.

### Phase 5: Company Workflows

- Tasks and approvals.
- Departments and administration.
- Search.
- Additional workflows currently used in Lark.

### Phase 6: Production Readiness

- Cross-platform testing.
- Load and performance testing.
- Security review.
- Monitoring and alerting.
- Backup and recovery testing.
- Employee pilot.
- Data migration.
- Gradual production rollout.

---

## 16. Final Technology Summary

| System | Final Selection |
|---|---|
| Language | TypeScript |
| Monorepo | pnpm + Turborepo |
| Frontend | React + Vite |
| Routing | TanStack Router (web/desktop); Expo Router (mobile) |
| State | TanStack Query + Zustand |
| UI | Tailwind CSS + shadcn/ui + Radix UI (web/desktop); React Native + StyleSheet (mobile) |
| Mobile | React Native + Expo |
| Desktop | Electron |
| Backend | Node.js + Hono |
| Database | PostgreSQL + Drizzle |
| Cache and queues | Redis + BullMQ |
| Authentication | Better Auth + SSO |
| Chat | Agora Chat |
| Voice and video calls | Agora RTC |
| Presence | Socket.IO |
| In-app notifications | Socket.IO |
| Mobile push | APNs + FCM |
| Docs | Univer |
| Sheets | Univer |
| Slides | Univer |
| Drive | Custom React / React Native + Hono |
| File storage | S3-compatible object storage |
| Search | PostgreSQL full-text search |
| Testing | Vitest + jest-expo + Playwright + Appium |
| CI/CD | GitHub Actions |
| Infrastructure | Docker |
| Monitoring | Sentry + OpenTelemetry |

**Architecture:** Cross-platform TypeScript monorepo with shared web/desktop React UI, a native Expo mobile client, a modular Node.js backend, managed communication services, a dedicated office editor integration, and custom Drive functionality.

**Primary goal:** Maximize code reuse and development efficiency while minimizing long-term operating and maintenance costs.
