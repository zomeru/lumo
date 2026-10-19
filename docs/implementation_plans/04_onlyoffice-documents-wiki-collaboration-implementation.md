# 08 — Lumo Collaborative Documents & Wiki: ONLYOFFICE End-to-End Implementation

> **Status:** Implementation specification for Codex (not a completed implementation)
> **Project:** Lumo workspace collaboration platform
> **Repository:** `zomeru/lumo`
> **Recommended repository location:** `docs/implementation_plans/03_onlyoffice-documents-wiki-collaboration-implementation.md`
> **Last reviewed:** October 19, 2026
> **Primary deliverable:** Working, persistent, access-controlled, collaborative **Docs (.docx), Sheets (.xlsx), Slides (.pptx), and Wiki pages (.md)** in BOTH web and Electron desktop, integrated with the existing Lumo shell and backend.
> **Editor:** ONLYOFFICE Docs API, initially using the user's ONLYOFFICE Docs Cloud 30-day trial; keep a supported path to a self-hosted instance.
> **Explicitly out of scope:** General-purpose Drive, arbitrary file/folder explorer, HR, tasks, Expo/native mobile, unrelated architecture rewrites. Office-module binary persistence is **in scope** because the editor cannot save without it.

## 0. Objective and implementation mandate

Implement a complete vertical slice, not a mock, skeleton, static UI, unpersisted demo, or a documentation-only change. **The current user request is for this implementation plan; the coding agent running the plan must execute the actual feature end to end.** Do not confuse a working rendered editor with a working integrated collaboration product.

- Implement workspace document listing, creation, naming, opening, real editing, co-authoring, autosaving, reopening, permissioned sharing, version/recovery behavior, trash/restore, and appropriate error states.
- Implement a **Wiki** with a workspace-scoped hierarchical page tree, page operations, Markdown `.md` content and **collaborative editing**, not just a Markdown preview or plain text area.
- Use **ONLYOFFICE Docs API** as the editor for Docs/Sheets/Slides and the first-choice editor for native `.md` wiki pages. ONLYOFFICE Docs 9.0+ lists `.md` among supported document formats, and ONLYOFFICE describes native Markdown co-editing. **Verify the actual cloud trial version, live `.md` editability, callback format, round-trip fidelity, and multi-user behavior before treating this as production-ready.** If the trial's deployment cannot reliably edit and save Markdown with real-time co-editing, record the exact provider limitation and implement a separately approved Markdown-first collaborative editor (e.g., Milkdown + Yjs) *only for Wiki*. Do **not** silently save a `.docx` and call it `.md`, or introduce a second sync stack before proof of necessity.
- Do not implement a custom collaboration transport for Docs/Sheets/Slides. ONLYOFFICE owns their editing synchronization and in-editor collaborator experience. Lumo owns authorization, file persistence, document metadata, Wiki navigation, version records and audit logs.
- No general Drive feature is required. An **Office Documents** page and a **Wiki** page may use internally stored file objects, but must not pretend general Drive is implemented.
- Keep the current Lumo design system, layout, route conventions, responsive behavior, blue/navy professional theme, compact density, icons, accessibility and Electron custom window experience.
- The existing code and `AGENTS.md` override older *proposed* directory structures. Adapt the design to current packages; don't scaffold empty apps/packages or replace working code.
- No credentials, JWT shared secrets, private keys, storage access secrets, database URLs, session cookies, callback tokens or signed object URLs in logs/commits/browser environment variables. Never paste live credentials into example files.

## 1. Mandatory repository research before modifying code

Read **completely** and reconcile:

1. `AGENTS.md`, `README.md`, root/package manifests and `pnpm-workspace.yaml`, `turbo.json`, environment declarations, migrations, `packages/ui/README.md`, `apps/api/src/app.ts`, routing/layout and auth/workspace service implementations.
2. `docs/2_TECH_STACK.md`
3. `docs/3_CORE_FEATURES.md`
4. `docs/4_STRUCTURE.md` (actual filename; some requests call it `4_STRUCTURES`)
5. **`docs/5_WHY_HONO?.md`** (actual filename contains a literal question mark; quote the shell path)
6. `docs/implementation_plans/01_fullstack-foundation-implementation.md` and `docs/implementation_plans/02_desktop-cross-platform-and-collaboration-implementation.md`; related implementation notes.
7. **Every PNG/image and any accompanying text in `docs/ui_samples/documents_flow/`**. Use an image viewer, compare states and user journeys, and inventory the samples in the implementation notes. Reference images are direction, not a pixel-perfect or infallible specification. If the directory is inaccessible in the checkout, explicitly record which assets could not be inspected and continue based on existing UI without fabricating screenshot details.
8. Existing shared app routes/screens, workspace shell, navigation, auth, query keys, API-client transport, workspace isolation tests, desktop security/bridge, UI components and generated route tree rules.
9. Run `pnpm exec intent list` at repo root; load matching installed skills per `AGENTS.md`. Do not download substitute skills if missing. Follow installed Turbo documentation before editing Turbo config.

**Confirmed architectural context from the repository as of October 19, 2026:**

- `apps/web` boots the Vite/browser host; `apps/desktop` hosts Electron via electron-vite; `packages/app` contains shared TanStack routes/screens/query composition; `packages/ui` supplies shared Radix controls, Tailwind CSS v4 and semantic tokens.
- `apps/api` is Hono/Node with Better Auth and OpenAPI; `packages/database` is PostgreSQL/Drizzle; `packages/contracts` carries Zod contracts; `packages/env` validates server and browser configuration; `packages/api-client` is the shared client; `packages/shared` exists.
- Web and desktop render the **same** shared React product but Electron uses a restricted main-process HTTP transport for authentication; **do not assume embedded editor iframes can use browser or Electron's app auth cookies**.
- The currently working product has auth, workspace membership/roles, invitations, member directory, chat/meetings and a shared UI. Drive, office editors and wiki are not yet complete.
- `apps/api/src/app.ts` applies JSON-only/origin checks to `/api/*` and has an approximately 32-KiB body cap; **the ONLYOFFICE machine-to-machine callback and content-serving routes need narrowly scoped special handling without relaxing standard authenticated routes**.
- `AGENTS.md` mandates OXC (`oxlint`/`oxfmt`) instead of ESLint/Prettier; Husky/Conventional Commits; package exports, pinned packages, `workspace:*`, real tests and `pnpm check:all`.
- The numbered architecture docs still say **Univer** and sometimes describe older tooling; supersede only the Office technology selection with ONLYOFFICE. Preserve the other product/security principles. Update the relevant references in docs 2–5, root README and diagrams/feature tables, clearly preserving historical rationale when useful rather than sweeping text replacement.

Write `docs/onlyoffice-implementation-notes.md` with baseline audit, reference-image inventory, discovered constraints, chosen API paths, experimental `.md` findings and final verification evidence. **Then implement.**

## 2. Official APIs and preflight proof

Review the current official references and actual cloud tenant feature set before coding against guessed fields:

- Docs API overview: https://api.onlyoffice.com/docs/docs-api/get-started/basic-concepts/
- Cloud installation: https://api.onlyoffice.com/docs/docs-api/get-started/installation/cloud/
- React component: https://api.onlyoffice.com/docs/docs-api/get-started/frontend-frameworks/react/
- Configuration: https://api.onlyoffice.com/docs/docs-api/usage-api/config/
- Document settings: https://api.onlyoffice.com/docs/docs-api/usage-api/config/document/
- Editor settings: https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/
- Editor events: https://api.onlyoffice.com/docs/docs-api/usage-api/config/events/
- Callback semantics: https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/
- Save lifecycle: https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/saving-file/
- Co-editing/key rules: https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/co-editing/
- Security/JWT: https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/security/
- Supported Markdown discussion: https://www.onlyoffice.com/blog/2024/04/how-to-edit-md-files-in-onlyoffice
- React wrapper: https://github.com/ONLYOFFICE/document-editor-react
- Licensing / cloud vs self-hosted: verify contract, limits, API compatibility, and allowed distribution before release. A 30-day trial is **not** permanent no-cost production infrastructure.

Confirm this is **ONLYOFFICE Docs Cloud / Document Server**, not DocSpace JavaScript SDK. `@onlyoffice/document-editor-react` is the intended browser integration; `@onlyoffice/doceditor-types` for types if useful. The public editor server URL may be exposed to browser; JWT secret must remain only on the backend. **Do not use ONLYOFFICE DocSpace REST/SDK endpoints in place of the Docs API.**

### 2.1 Cloud preflight checklist (must pass before large feature implementation)

- Obtain cloud Document Server public HTTPS URL from the tenant console, and a usable matching Docs API JWT signing secret. Don't request or leak the secret in chats/commits.
- Confirm `.../web-apps/apps/api/documents/api.js` loads and the React editor can render, including inside Electron's renderer/CSP.
- Confirm document type mappings: Word → `documentType: 'word', fileType: 'docx'`; Sheets → `'cell'/'xlsx'`; Slides → `'slide'/'pptx'`; Wiki Markdown → `'word'/'md'` only after actual version-specific proof.
- Create a valid blank file per type, serve it over a protected *externally reachable HTTPS* content route, open via a **server-signed** config, and confirm ONLYOFFICE downloads it.
- Configure `editorConfig.callbackUrl` to a reachable HTTPS backend endpoint, test status callbacks (`1`, `2`, `4`, `6`, `7`), and confirm new bytes are stored and reopen properly. A successful editor render does not prove saving.
- Open the **same file and document key in two distinct accounts/browsers**, confirm live collaboration; open a different key and confirm independence.
- Save/reopen `.md` and inspect actual bytes. Check plain Markdown syntax, headings, lists, code fences, links and Unicode survive a round trip. Confirm collaboration and versions work without DOCX conversion. If not, capture precise limitation and use the documented fallback gate.
- Validate actual trial entitlements/capacity, expiry behavior, relevant API options and self-host compatibility. Never encode vendor trial expiry as a product feature or assume free cloud hosting after trial.
- Confirm cloud egress requirements and local WSL development with a **stable HTTPS development tunnel** for the backend callback and file download; `localhost` and a private-only WSL address will not be reachable by the hosted service. Tunnel credentials and URLs must not be committed.
- Validate the CSP, frame ancestors/iframe settings and Electron navigation policy required by this **specific** cloud domain, using a narrowly scoped allowlist.

**Gate:** If no real cloud editor, signed config, public document download, callback and two-person collaboration are functional, do not fake persistence or declare integration complete. Implement and test missing prerequisites first.

## 3. Product scope and UX

### 3.1 Documents landing page (no Drive)

Create/update the existing **Documents** navigation item inside the current workspace shell. Do not introduce a separate theme or general Drive route.

- Workspace-scoped list of Docs, Sheets, Slides and optionally standalone Markdown documents; tabs/filter by type and **My documents / Shared with me / Recent / Trash** where the data model supports it.
- Primary `New` action offering **Document**, **Spreadsheet**, **Presentation**, and **Wiki page** (Wiki redirects to Wiki hierarchy/creation); allow minimal office-file import only if included in this feature's acceptance criteria, but **never a generic Drive upload UI**.
- Search by authorized filename/title; sort by updated time; show type icon, owner/creator, last edited, collaborator/permission indication, status and contextual actions.
- Loading, empty, error, access-denied, expired-trial and retry states; no placeholder fake examples after real data loads.
- Rename, duplicate/copy (if supported with clean metadata/version semantics), delete to trash, restore, share, copy authorized deep link and open. Guard deletion/restore while active co-editing sessions exist.
- Optimistic updates only where rollback/conflict recovery is correct. Responsive keyboard navigation, focus states and precise tooltip/menu behavior.

### 3.2 Document editor view

- Open in the existing Lumo workspace context (web and Electron), via shared route/layout. Compact top bar: back/navigation breadcrumbs, editable title, doc type, save/sync status, permissions/Share, collaborator presence as supported, history and contextual menu. Editor fills remaining height without double scrollbars, browser-style gutters or clipped footer.
- The ONLYOFFICE component owns office content editing, formatting, formulas, slide controls and in-editor co-authoring. Do not rebuild a fake Word/Excel/PowerPoint ribbon with Lumo controls.
- Allow viewer vs editor mode based on actual server-granted role. Disable controls that would imply elevated privileges. Implement close/unmount cleanup and lifecycle-aware navigation warning where appropriate; do not suggest all edits persist instantly just because bytes remain in ONLYOFFICE's cache.
- Preserve Lumo header/sidebar behavior and Electron drag regions/window buttons. Do not let ONLYOFFICE script or iframe gain Node/Electron IPC privilege. Handle script load failure, expired signing token, offline state, stale document key, permission revocation, callbacks failing and provider outage.
- Track save completion from **backend version state**, not only from `onDocumentStateChange`; the latter reflects editor state/changes sent to editing service, not necessarily durable Lumo storage.

### 3.3 Wiki (Markdown)

- Workspace-bound **Wiki** landing, separate from Documents list but backed by shared `office_documents`/storage/permissions and ONLYOFFICE editor integration.
- Navigation: hierarchical page tree with expandable nested pages; create top-level/child page; edit title; move/reorder with cycle prevention; breadcrumbs; active selection; page menu; search within authorized workspace pages; empty-state onboarding.
- Page rendering/editing uses **a canonical `.md` file**, not generic unstructured HTML disguised as Markdown. Implement appropriate `# Untitled\n` starter and make new-page interactions clear.
- Markdown source/preview behavior should match what the verified Docs 9.x integration actually supports. Don't promise features unavailable in the tenant; if using the wiki-specific fallback, provide WYSIWYG or rich editing with faithful Markdown serialization, **Yjs-based real-time editing, authenticated websocket**, persisted snapshots and multi-user cursors.
- Wiki page-level ACL defaults and inheritance must be explicit: inherited access from workspace/wiki parent until overridden if implemented; do not unintentionally grant access by knowing a page URL. Moving pages across restricted parents must recalculate effective access, preserve audit trail and reject cyclic moves.
- Links to wiki pages use **stable IDs**, and slug/title changes must not silently break internal links. Treat Markdown raw HTML, external links and embedded media as untrusted. Sanitize rendered preview and prevent stored XSS. Attachments/embedded images are **out of scope** unless an existing safe upload mechanism exists.
- Hierarchy/tree metadata and search live in PostgreSQL; `.md` bytes in the same Office storage adapter. Version snapshots and restore follow the Office document rules.

### 3.4 Sharing and collaboration

- Share to **specific existing active workspace members** with `owner`/`editor`/`viewer`/`none` levels. Owner can manage grants; editor can edit; viewer can view; no-access cannot fetch bytes/open editor. Access policy may permit owner/admin-managed overrides only if product rules explicitly require them.
- Every document and wiki page has **exactly one workspace ID**. Do not create public/anonymous share links unless specifically approved; copy-link creates a link that still requires login and access.
- Stable provider user IDs and display names only, never emails or auth tokens in third-party editor config unless required by an explicitly approved feature.
- ONLYOFFICE provides live co-editing/commenting where the plan supports it. Lumo retains permissions/audit. No cross-workspace sharing in this iteration.
- Membership removal/role change revokes future API/file/editor sessions. Design an active-session revocation strategy: provider command service disconnect/terminate if supported by tenant, short-lived scopes/configs, deny future file access and downloads, and document any remaining provider session/cache window. **Do not claim instantaneous revocation without a tested provider mechanism.**

## 4. Integration architecture

```text
                              ┌─────────────────────────────────────┐
                              │ Lumo Web / Electron Renderer        │
                              │ packages/app: routes + editor UI    │
                              │ packages/ui: controls/tokens        │
                              └──────────────────┬──────────────────┘
                                                 │ authenticated requests
                              ┌──────────────────▼──────────────────┐
                              │ packages/api-client + contracts     │
                              └──────────────────┬──────────────────┘
                                                 │
                        ┌────────────────────────▼───────────────────────┐
                        │ apps/api (Hono, Better Auth)                    │
                        │ office REST service + workspace/ACL policy     │
                        │ editor-config signer / metadata/version APIs   │
                        │ ONLYOFFICE callback + signed content endpoint  │
                        └────────────┬──────────────────┬────────────────┘
                                     │                  │
                  ┌──────────────────▼──┐    ┌──────────▼─────────────────┐
                  │ PostgreSQL / Drizzle│    │ Private blob storage       │
                  │ doc, grant, version,│    │ dev local / prod S3 or R2 │
                  │ wiki tree + audit   │    │ .docx/.xlsx/.pptx/.md      │
                  └─────────────────────┘    └──────────▲─────────────────┘
                                                        │
                  ┌─────────────────────────────────────┴───────────┐
                  │ ONLYOFFICE Docs Cloud (trial) / self-hosted      │
                  │ separate editing & real-time co-authoring svc   │
                  │ GET signed source URL / POST signed callback    │
                  └─────────────────────────────────────────────────┘
```

- API/backend is the **authoritative document manager and document storage service** for the ONLYOFFICE integration. ONLYOFFICE is *not* the Lumo database or authoritative long-term file repository.
- `packages/app` for shared UI/routes; `packages/ui` for reusable controls; `packages/api-client` for typed client; `packages/contracts` for shared schemas; `apps/api/src/modules/office` for API/service/repository/provider adapter; `packages/database` for schema/migrations; `packages/env` for config. Add `packages/onlyoffice` or `packages/office-editor` **only if** a clearly reusable framework-specific client adapter is worth a separate package. Prefer a small feature-local component initially to avoid redundant scaffolding.
- Keep provider config/signer/callback processing **server-only**. Client SDK integration can expose a typed `OfficeEditor` component, with no dependency from native Electron main into DOM packages.
- Retain existing web vs desktop client authentication transports. Use the authenticated API request abstraction for `GET editor-config`; the iframe will fetch content via **scoped signed URL** that does not rely on app cookies.
- Represent provider configuration behind an explicit minimal interface (editor server URL, config signing, callback parser, command operations) to make cloud → self-hosted deployment a config change, not a rewrite. Do not generalize into multiple hypothetical office providers.

## 5. Database and storage design

Use current `packages/database/src/schema.ts`, Drizzle migration practices and naming conventions. Confirm actual tables/indexes first; proposed tables/fields below are a logical contract, not an instruction to duplicate existing models.

### 5.1 Core document tables

`office_documents`
- `id uuid pk`, `workspace_id uuid not null fk`, `kind enum('document','sheet','slide','wiki')`.
- `title text not null`, `file_type enum/string ('docx','xlsx','pptx','md')`, `mime_type`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` nullable.
- `current_version integer not null`, `current_object_key text`, `current_sha256 text`, `bytes bigint`.
- `active_editor_key text nullable`, `active_editor_generation integer`, `editor_session_state` or equivalent lifecycle state, `last_saved_at`, and concurrency/lock semantics.
- DB constraints: kind/type consistency; compound workspace queries; impossible parent references rejected; soft-delete behavior documented; never publicly expose object keys.

`office_document_permissions`
- document/workspace/user scoped unique grant with `owner`/`editor`/`viewer`; explicit resource policy. Enforce membership as an additional mandatory check. Owner may be represented by `created_by` plus uniqueness constraint; avoid conflicting duplicate owner authorities.

`office_document_versions`
- immutable `(document_id, version_number)` unique record; object key, checksum, byte count, created/saved time, editor key/generation, actor when known, source (`initial`/`final-save`/`forcesave`/`restore`/`import`), optional provider history metadata; no overwriting a saved version in place.

`office_callback_events` or a reliable equivalent
- provider event idempotency/dedupe fingerprint, document key, status, processing state, stored revision reference, timestamps, failure/retry metadata. Bound retention for operational events; **never store raw secret-bearing callback URLs**.

`wiki_pages`
- `id`/`document_id` 1:1 to an office doc of kind wiki; workspace ID; `parent_page_id` nullable; `sort_order` or stable ordered rank; page flags; updated timestamps. Validate same-workspace parent, no loops and proper authorization on move. Decide one tree per workspace or explicitly model `wiki_spaces`; do not overdesign multiple spaces without a sample/user requirement.

Extend existing `audit_events` with create/rename/share/revoke/delete/restore/version-restore/move events; use existing event semantics.

### 5.2 Binary persistence

- Store files under private per-environment/per-workspace/per-document/per-revision keys, e.g. `office/<env>/<workspaceId>/<documentId>/v000001.docx`; metadata in Postgres. Never rely on filename from user request for object key.
- Implement `OfficeBlobStorage` with narrowly scoped `put/get/delete/head` primitives, bounded streaming, size/type/checksum validation, and dev/prod adapters:
  - Local development: private filesystem rooted under gitignored `.local/office/` (not served as static assets) **only when explicitly selected**.
  - Production: S3-compatible private object storage, e.g. S3 or R2 (not general Drive), configured via server-only env. Do not silently fall back to local disk in production or after object-storage failures.
- For ONLYOFFICE source-file requests, expose a controlled **server HTTPS streaming route** with short-lived signed read scope, or use carefully constrained object-store presigned GET URLs. Choose based on cloud reachability and signature/security requirements; both must remain workspace/document/version scoped and non-listable.
- For outbound callback URL downloads, stream and check bytes, content type/extension, length cap, SHA-256; avoid unbounded buffering. Validate the remote hostname/domain, TLS and resolved address, deny redirects to private/loopback/link-local/metadata networks, reject invalid schemes and untrusted hosts. Avoid blind `fetch(callback.url)` (SSRF).
- For create, use committed known-good minimal Office OOXML starter files or server-generated valid OOXML; don't write plain text into `.docx/.xlsx/.pptx` extensions. Markdown starter is UTF-8 `.md`. Validate files by signature/ZIP structure and size, not extension alone.
- Update DB after successful object write; use idempotent transaction/reconciliation so a DB failure cannot expose a partially saved “current” version. Retain last known-good bytes, retry on provider/network failure, and garbage-collect orphaned blobs in a controlled job or operator command.
- **Scope restriction:** these primitives serve Documents/Wiki only. Do not create generalized Drive folders, file browser, upload endpoints for arbitrary file types or broad object-store permissions.

## 6. ONLYOFFICE session lifecycle: correctness requirements

### 6.1 Opening an editor

1. User authenticates through the existing browser/Electron API client and requests a document inside an explicit workspace context.
2. Hono rechecks active workspace membership **and** document-level permission; rejects deleted/missing/mismatched resource with sanitized 403/404.
3. Backend selects/pins current active co-editing generation and ONLYOFFICE `document.key` in a transaction or serialized state transition. **All concurrent editors of the same generation receive the SAME key.** Different workspace/documents and independent later saved generations must have different keys.
4. Backend returns server-signed, schema-validated ONLYOFFICE config: `document.title`, `document.fileType`, unique `document.key`, scoped `document.url`, `document.permissions`, `documentType`, `editorConfig.mode`, `editorConfig.user` and `editorConfig.callbackUrl`.
5. Browser/desktop loads `@onlyoffice/document-editor-react` with cloud document server URL. React key/component ID are distinct from ONLYOFFICE's document key; component recreated only when the editor session actually changes.
6. Error handling covers missing/invalid JWT, inaccessible source URL, CORS/CSP/embed rejection, editor provider downtime and stale access. Avoid displaying SDK secrets or signed URLs.

**Keys:** Use a globally scoped deterministic-safe key such as a hash of `environment + workspace_id + document_id + active_generation` with only permitted characters, length ≤ 128. No hard-coded key. Do **not** regenerate key for title changes, browser refresh, another collaborator joining, or `status=6` forcesave during an active co-editing session. Rotate only at a safe final save / next session boundary, based on official Docs key rules and validated rejoin behavior.

**JWT:** Sign the complete editor config **on the Hono backend** using the cloud tenant's correct secret and algorithm/headers. Never use demo signing code inside Vite to ship production credentials. Validate incoming callback JWT, depending on cloud server configuration, *before* trusting payload. File URL authorization and callback authorization are independent of browser cookies.

### 6.2 Callback lifecycle and durable saves

Implement a callback handler following ONLYOFFICE's documented body/status/error/acknowledgement contract:

- `status=1`: editing active, optionally update session activity; do not invent durable save.
- `status=2`: final saved file available. Validate JWT and document key, download new bytes with outbound SSRF protection, verify/persist object and metadata immutably, advance durable current version, mark generation complete; rotate key for **later** editing session, never interrupt stale concurrent callback clients. Respond `{"error":0}` only when durably accepted according to provider contract; for failures, return correct error/retry semantics and never acknowledge lost data.
- `status=3`: provider save error; record/recoverable warning, preserve old version; no false successful-save UI.
- `status=4`: closed without changes; update session state, no new snapshot by default.
- `status=6`: forcesave while session continues. Save an immutable snapshot and update current durable version **without rotating active document key**, per official co-editing rules.
- `status=7`: forcesave error; record and surface actionable status, preserve old snapshot.
- Unknown/malformed/unauthorized statuses fail safely. Include stable callback response shape and size limits.

Concurrency:
- Idempotently handle duplicate and out-of-order callbacks, retries, overlapping status=2/status=6, and concurrent users; serialize per document+key using DB locking/optimistic revision guard as appropriate.
- Ignore/reject callbacks for stale or foreign keys that could overwrite a newer generation; keep a bounded safe recovery process for delayed legitimate events.
- Distinguish **provider edit state**, **persisted revision state**, and **displayed last saved timestamp**. Test graceful close vs crash, network loss, upload failure, callback outage, retries and permanent provider failure.
- Optional force-save command integration requires proper authenticated backend authorization and official supported cloud command service; never assume forced save is included in trial plan.
- Version history UI may use Lumo-stored immutable snapshots even if advanced ONLYOFFICE in-editor history API is unavailable. When ONLYOFFICE's history events are implemented, provide the exact provider's revision metadata/URLs as documented; no guessed methods or misleading timeline.

### 6.3 Permissions and revocation on active editors

- Validate authorization before every config creation, manual read/write metadata operation, version download and restore. Signed content URLs must include document/version scope and expiry and be validated without user-cookie assumptions.
- A previously granted editor iframe session is **not** equivalent to perpetual authorization. On membership/ACL revocation, deny future editor config, signed file downloads and future API calls; revoke issuance, coordinate active editor disconnect through officially supported command operations if available, and document any unavoidable latency while a cloud session/cache remains.
- ACL update, workspace switching, user sign-out, direct editor links and deleted documents must all produce correct safe states. Explicitly test user A's URL/key cannot open workspace B's document.
- Never put bearer credentials or a reusable read endpoint into a public cache, analytics event, referrer, browser console or application logs.

## 7. API, routing and contract blueprint

Follow existing `/api/v1` naming, auth middleware, `AppError`, Zod schemas, `OpenAPIHono`, OpenAPI+Scalar docs and test patterns. Endpoints below are **suggested** and should be reconciled with current paths and route convention rather than blindly copied.

### 7.1 Authenticated Office APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/workspaces/:workspaceId/documents` | List/search/filter authorized office documents |
| POST | `/api/v1/workspaces/:workspaceId/documents` | Create valid typed blank office document |
| GET | `/api/v1/workspaces/:workspaceId/documents/:documentId` | Metadata + effective permission |
| PATCH | `/api/v1/workspaces/:workspaceId/documents/:documentId` | Rename/metadata (with concurrency guard) |
| DELETE | `/api/v1/workspaces/:workspaceId/documents/:documentId` | Soft-delete to trash |
| POST | `/api/v1/workspaces/:workspaceId/documents/:documentId/restore` | Restore from trash |
| GET | `/api/v1/workspaces/:workspaceId/documents/:documentId/permissions` | Member access list |
| PUT | `/api/v1/workspaces/:workspaceId/documents/:documentId/permissions/:userId` | Grant/change/revoke per-document access |
| POST or GET | `/api/v1/workspaces/:workspaceId/documents/:documentId/editor-config` | Server-generated signed config; authenticated/no-cache |
| GET | `/api/v1/workspaces/:workspaceId/documents/:documentId/versions` | Immutable version list |
| GET | `/api/v1/workspaces/:workspaceId/documents/:documentId/versions/:versionId` | Revision metadata or secure authenticated download |
| POST | `/api/v1/workspaces/:workspaceId/documents/:documentId/versions/:versionId/restore` | Restore by creating a new immutable revision after safe session checks |
| GET | `/api/v1/workspaces/:workspaceId/wiki/pages` | Authorized hierarchical wiki tree |
| POST | `/api/v1/workspaces/:workspaceId/wiki/pages` | Create `.md` page, optional parent |
| PATCH | `/api/v1/workspaces/:workspaceId/wiki/pages/:pageId` | Rename/reparent/reorder with cycle/permission safeguards |
| DELETE | `/api/v1/workspaces/:workspaceId/wiki/pages/:pageId` | Soft-delete subtree according to explicit policy |

Use a separate authorized binary download response if desired. If exposing file imports, restrict to approved Office formats and quarantine/scan before opening; no generic Drive API. Type errors and conflict errors (`409`) consistently. Cursor/offset pagination for list, deterministic ordering and search scoped at SQL query level to authorized resources.

### 7.2 Dedicated machine-to-machine endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/internal/onlyoffice/files/:documentId/:versionId` | Scoped HTTPS source URL: signed claim, expiry, matching doc+generation, streamed private bytes |
| POST | `/api/internal/onlyoffice/callback/:documentId/:generation` | JWT/authenticated callback, strict body schema, idempotent save |

`/api/internal/onlyoffice/*` must be **deliberately excluded from the normal authenticated user session/origin/JSON middleware**, then protected by stronger appropriate signed provider/file URL checks. The existing `apps/api/src/app.ts` applies JSON/origin/body-cap checks under `/api/*`; register/mount these routes **before or outside that middleware scope** or use precise matching/exemptions and dedicated request limits. Do not exempt `/api/v1/*` wholesale. An inbound callback is not a browser-origin request; don't require a user session or arbitrary browser Origin header.

Set predictable response headers, no-store, safe download filenames, restrictive `Content-Type` and `Content-Disposition`, length caps, and no cross-tenant CDN caching. Review OPTIONS/GET/HEAD as needed for vendor behavior. **Never make a file route unauthenticated without verifying a separate signed access token**.

### 7.3 Frontend routes and navigation

Use `packages/app/src/routes`, generate route tree through existing scripts and never edit generated `routeTree.gen.ts`. Suggested screen intent (adapt to actual workspace route convention):

- `/workspaces/$workspaceId/documents` — document manager.
- `/workspaces/$workspaceId/documents/$documentId` — ONLYOFFICE editor shell.
- `/workspaces/$workspaceId/wiki` — wiki index/first-page route.
- `/workspaces/$workspaceId/wiki/$pageId` — wiki tree + editor.

Reuse existing layout, auth guard, workspace context, query factory, toast/dialog components, light/dark tokens, compact typography and app scrollbar behavior. Maintain URLs within browser and Electron, deep-link handling as currently supported, and strong back-navigation semantics.

## 8. Web & desktop integration details

- Add one feature module in `packages/app` with a `DocumentsPage`, `DocumentEditorPage`, `WikiPage`, `WikiTree`, `ShareDialog`, `VersionsPanel`, `DocumentToolbar`, `DocumentActionMenu`, loading/error views and API/query hooks. Prefer composition over a single giant page component.
- `@onlyoffice/document-editor-react` should be lazy-loaded at the editor route to avoid increasing auth/chat/meetings startup bundle. Pin versions and use `@onlyoffice/doceditor-types` when compatible.
- Use `packages/ui` existing `Button`, `Dialog`, `DropdownMenu`, `Tabs`, `Input`, `Tooltip`, `ScrollArea`, `Toast`, etc. Don't add a duplicate design system; don't add broad CSS outside Tailwind v4 except small justified third-party SDK integration fixes.
- Editors must own a bounded `min-height:0` flex container, with appropriate viewport resize and no permanently reserved scrollbar gutter. Apply theme adaptations ONLY where supported by the SDK; not via fragile DOM shadow/iframe style injection.
- Provide a visible action state when document is still in provider editing cache vs saved durably. Preserve a last known durable revision even after editor load fails.
- Electron main/preload security remains intact: `nodeIntegration:false`, isolated/sandboxed renderer, no `remote`, no arbitrary URL/IPC bridge. Its signed-config API call uses existing bounded main-process request bridge. Third-party editor iframe must not be allowed to navigate Lumo's top-level window, download unsafe URLs, or invoke application privilege; narrowly allow provider origin in CSP/connect/frame policies and validate `setWindowOpenHandler` / navigation as existing security architecture requires.
- Verify asset loading, clipboard, keyboard shortcuts, printing/download permissions and OS behavior on desktop. Do not expose cookies by forcing web-authentication into a third-party iframe.
- Avoid frame/embed access to private local backend. Cloud editor receives signed file URL + callback URL only.
- On workspace switch, cancel stale API requests, remove workspace queries and unmount prior editor; **never** display previous workspace document contents or keep an iframe visible with stale access.

## 9. Cloud config and local development

Add server-only validated configuration to `@lumo/env/server` and `apps/api/.env.example` using exact project naming conventions. Example keys (adapt and document):

```dotenv
# Only public Docs Cloud Document Server endpoint (not DocSpace)
ONLYOFFICE_DOCUMENT_SERVER_URL=https://YOUR-TENANT-DOCSERVER.example
# Secret only in apps/api/.env / deployment secret manager
ONLYOFFICE_JWT_SECRET=replace-with-secret-manager-value
# External base URL reachable by ONLYOFFICE Cloud, not localhost in WSL
ONLYOFFICE_PUBLIC_API_BASE_URL=https://YOUR-HTTPS-TUNNEL.example
# cloud | self-hosted
ONLYOFFICE_MODE=cloud
# local | s3
OFFICE_STORAGE_DRIVER=local
OFFICE_LOCAL_STORAGE_DIR=.local/office
# Optional S3-compatible production config (server only)
# OFFICE_S3_BUCKET=
# OFFICE_S3_REGION=
# OFFICE_S3_ENDPOINT=
# OFFICE_S3_ACCESS_KEY_ID=
# OFFICE_S3_SECRET_ACCESS_KEY=
```

- Validate HTTPS host/origin and no trailing path surprises; provide safe, distinguishable startup errors. Never allow a production default weak JWT secret, unknown URL scheme or unsafe local fallback.
- Determine from actual cloud tenant whether secret is shared for browser/inbox/outbox and configure accordingly. Avoid assuming identical secrets if deployment separates them.
- `ONLYOFFICE_PUBLIC_API_BASE_URL` must point to a public ingress forwarding the **backend**, including `/api/internal/onlyoffice/*`; test service-to-service networking both ways. WSL localhost URLs only serve browser/desktop locally; a cloud editor cannot reach them. Use a tunnel during local development; no in-repo credentials.
- Public editor script URL is not a secret. If the client needs it, send validated URL with signed editor-config response or expose only that public endpoint through a browser-safe env; don't accidentally expose `ONLYOFFICE_JWT_SECRET` via `VITE_`.
- Configure request timeout, callback download caps, provider host allowlist, and explicit connect/frame origin allowlist. Avoid provider-side mixed content errors.
- Include a sample **mock ONLYOFFICE adapter** for deterministic CI tests; live cloud trial must not be required for every CI run.
- Documentation must explain how to migrate to Docker/self-hosted ONLYOFFICE after cloud trial ends: set new docserver URL/secrets, configure HTTPS, check licensing and concurrency, run smoke tests against existing stored files. Preserve document storage and IDs. Update firewall/CSP origin policies with tested values.

## 10. Phased implementation sequence (do not stop after planning)

### Phase 0 — Audit + screenshots + cloud spike

- Read required files, inventory UI screenshots, inspect current packages and running auth/desktop transport. Record migration strategy from Univer and every conflict with old docs.
- Complete a real signed opening, cloud file GET, POST callback and multi-user `.docx/.xlsx/.pptx/.md` smoke test, including Markdown round-trip.
- Record tenant plan limitations and rollback plan. Document decision on `.md` fallback if necessary.

**Exit:** Evidence of cloud connectivity and a documented, valid data path; no claims based only on an editor iframe rendering.

### Phase 1 — Data and private binary storage

- Add schema, indexes, migration, repositories, storage adapter and blank typed templates. Reuse audit/membership policies and existing DB transaction patterns.
- Test workspace isolation, immutable versions, file checksum, untrusted format, and DB↔blob reconciliation failures.

**Exit:** Create/load immutable bytes without provider; no user outside authorized workspace can read file metadata or bytes.

### Phase 2 — REST APIs, ACL and share workflow

- Implement typed Office/Wiki contracts, Hono routes/services, list/create/rename/share/delete/restore and file version API. Enforce resource ACL in SQL/service layers and membership checks on every request.
- Add audit records; initial document owner/editor/viewer behavior; policy for deleted pages and parent moves.

**Exit:** Complete API contract tests and negative authorization tests. No UI placeholders.

### Phase 3 — ONLYOFFICE Cloud provider adapter + secure callback

- Integrate config signing, fixed key/session lifecycle, temporary file download route, incoming callback parsing/verification, immutable saved versions and cloud command operations if supported.
- Add status handling 1/2/3/4/6/7, duplicate callback idempotency, content download SSRF protection, provider failure/retry and telemetry.
- Verify save persists and reopening reflects changes; concurrent editors share key; forcesave does not rotate key.

**Exit:** Two distinct users edit one document in real time; saved file round-trips back into Lumo; no arbitrary URL fetch.

### Phase 4 — Documents UI + web/desktop

- Implement shared Documents list/filters/create flows; editor shell; rename/share/history/trash/restore; loading/errors; accessible dialogs and keyboard interaction.
- Embed React editor lazily and configure web/Electron origin security. Verify workspace switching, reload and desktop fullscreen/resizing/scroll.

**Exit:** Full production-style document lifecycle works on both web and Electron against real backend and cloud editor.

### Phase 5 — Wiki hierarchy + Markdown collaboration

- Implement tree persistence, child page creation, move/reorder/cycle prevention, breadcrumbs, search, rename and deletion, `md` templates, stable page links, Wiki-specific UX from screenshots.
- Reuse ONLYOFFICE editor if `.md` cloud test passes. Otherwise explicitly implement the approved fallback with authenticated Yjs websocket, persistent Yjs update log/snapshots, Markdown serialization and reconciliation. A raw Markdown text area with no co-editing is not a pass.

**Exit:** Two users co-edit same wiki page, move it within authorized tree, reload and see the same `.md` text; no loss of code fences/links.

### Phase 6 — History, resilience, observability and hardening

- Harden audit/version restore against active editors, backup/restore data, final/force save race, callback replay, expired access, document deletion, provider downtime, upload failure, stale session and malformed files.
- Add structured counters/timing for callback latency, failed saves, retry counts, version generation, provider outage, editor load errors. Redact tokens/URL query params/body contents from traces and error reports.
- Finish runbooks for trial expiration, config rotation, self-host cutover, recovery of pending edits and user-visible degraded mode.

**Exit:** Fault-injection tests and operator notes prove no acknowledged data loss and safe rollback to prior good version.

### Phase 7 — Acceptance, documentation and commits

- Run relevant targeted tests each phase and full checks, fix regressions, run web Playwright and Electron smoke, provider live collaboration test in explicitly configured environment.
- Update tech-stack, core features, structure, Hono rationale diagrams mentioning Univer (replace with ONLYOFFICE where it describes the current choice; preserve old historical notes as context). Do not claim Drive is implemented.
- Deliver an implementation report: implemented files, architecture diagram, required env vars (names only), migrations, commands, evidence of four editor types + two-user collaboration, screenshots/flows tested, remaining known limitations, cloud-to-selfhost steps.
- Keep unrelated edits and sensitive files untouched; create logically scoped Conventional Commits if the coding workflow is expected to commit. Never commit `.env`, document uploads, screenshots containing private data, presigned URLs or tokens.

## 11. Test matrix and quality gates

Use the current repo test systems: Vitest unit/integration, existing API test DB (`TEST_DATABASE_URL` must end with `_test`), Testing Library/jsdom, Playwright browser E2E, Electron tests and CI workflow. Follow the repo's 90% global coverage gate; no mock-only UI as evidence of a live provider.

| Test | Expected result |
|---|---|
| Create four content types | Valid .docx, .xlsx, .pptx, .md persisted to scoped storage |
| Open editor in browser | Signed config, correct type, real editor loads |
| Open editor in Electron | Same Lumo experience, CSP/bridge intact, no Node access by iframe |
| 2 editors same doc | Same active key, co-editing and stable saves |
| 2 editors different docs | Isolated sessions, no content crossover |
| Close/save/reopen | New durable version, exact persisted edits after reload |
| Force-save status 6 | New revision with active co-edit key unchanged |
| Final-save status 2 | Durable bytes, next safe generation key, no lost edits |
| Duplicate/out-of-order callbacks | Idempotent, no overwritten current version |
| Provider failures and network loss | Last good snapshot intact, retry or visible degraded state |
| Wiki tree operations | Child pages, breadcrumb, move, reorder, cycle prevention, soft delete |
| Wiki Markdown roundtrip | Code fences, headings, lists, links, Unicode survive saves |
| Wiki 2-user collaboration | Live updates and durable `.md` content |
| Workspace A vs B | Metadata, editor config, callback, file byte URL and search isolated |
| Viewer vs editor | Viewer cannot issue editor edit rights or write/share |
| Nonmember via guessed IDs | 403/404, no byte disclosures or editor config |
| Membership revoked during session | New access denied and provider active-session policy exercised |
| Revoked/exposed signed URL | Scope and expiry enforced; no perpetual public file URL |
| Callback JWT forgery/replay | Rejected or idempotently ignored, audit-safe |
| Callback SSRF (private IP/redirect) | Denied before any network fetch to restricted address |
| MIME/size/ZIP abuse | Format validation, quotas/limits enforced |
| Simultaneous rename/delete/restoration | Conflict-safe, audit recorded, no invisible data loss |
| Cross-workspace switch | Old editor unmounted and query cache removed |
| Trial expiration/outage | Clear UI error; stored documents remain recoverable |
| Accessibility/small screens | Proper labels, focus, keyboard, viewport resize, scrollbars |

### CI / manual checks

```bash
pnpm install
pnpm db:generate  # review migration; do not substitute schema push
pnpm db:migrate
pnpm check:all
pnpm check:all:build
pnpm test:e2e
pnpm test:desktop
```

Use actual existing scripts/flags: first confirm each command from `package.json`; do not assume undocumented commands exist. Live provider test is an **explicit** opt-in using an isolated workspace and test tenant; it creates/cleans test documents and does not use production data or run on every PR. Explicitly inspect screenshots from `docs/ui_samples/documents_flow/` during manual UX review.

## 12. Important failure modes and architectural traps

1. **Cloud instance can't reach localhost.** Use HTTPS public API endpoint/tunnel for its callbacks and source GETs.
2. **JWT token is signed in frontend.** Incorrect; server-only, dynamically signed config.
3. **ONLYOFFICE JWT replaces Lumo permissions.** Incorrect; ACL and workspace checks are authoritative in Hono.
4. **No callback means no persistence.** Never report saved just because users can type.
5. **Recreate key for every user/open.** Splits co-editing; reuse key within active generation.
6. **Rotate key after status=6.** Breaks current co-editing; don't rotate.
7. **Force-save overwritten by delayed status=2.** Protect via key generation and version ordering.
8. **Untrusted callback `url` is fetched unrestricted.** SSRF risk; validate and stream with caps.
9. **Expose private static document directory.** Never mount private bytes as static public files.
10. **Hono global Origin/JSON middleware rejects callbacks.** Isolate callback routing, do not disable CSRF globally.
11. **Electron iframe gets app credentials/IPC.** Must never happen.
12. **SDK scripts globally loaded across all routes.** Lazy-load only editor views.
13. **Old docs/Univer architecture blindly followed.** Current repo source and corrected selection take precedence.
14. **Cloud trial called 'free forever'.** License/trial is temporary; self-host strategy required.
15. **Wiki `.md` treated as DOCX.** Verify native Markdown real save; use wiki-specific fallback if necessary.
16. **Drive implemented accidentally.** Only office-specific binary persistence now; general Drive remains pending.
17. **Committing secrets or user uploaded files.** Do not commit credentials, binaries with private content, or local storage.
18. **Tests bypassing authorization with provider fake.** Mock provider only below actual ACL; test auth independently.

## 13. Definition of done

Do not mark complete unless **all** conditions below hold:

- [ ] `AGENTS.md`, numbered docs 2–5, previous plans and screenshots read; audit recorded.
- [ ] Correct ONLYOFFICE cloud Docs API (not DocSpace) integrated; server-generated valid JWT config; real editor renders.
- [ ] Backend securely serves original file and reliably processes signed callbacks into private durable revisions.
- [ ] Four real content types, including `.md`, create/edit/coedit/save/reopen as verified; approved wiki fallback only if native `.md` fails.
- [ ] Documents list/create/open/share/rename/delete/restore/version access and Wiki hierarchy complete in the actual UI.
- [ ] Web and Electron both supported using existing shared `packages/app` architecture.
- [ ] Workspace membership and document ACL enforced for metadata, editor sessions, source URLs, versions and callbacks.
- [ ] Collaboration across two real user accounts works; separation across workspaces proven.
- [ ] Callback statuses, key generation, duplicate/racing saves, network failures and durable recovery tested.
- [ ] No general Drive implementation or unrelated UI/design rewrite.
- [ ] README/env examples, migration notes and cloud-to-selfhost procedure accurate; old Univer selection updated.
- [ ] All relevant build/typecheck/lint/unit/integration/e2e/desktop checks pass; no regressions or secret leaks.
- [ ] Implementation notes report actual completed work, evidence, limitations and exact next steps.

## 14. Agent execution prompt (short launcher)

> Read `docs/implementation_plans/03_onlyoffice-documents-wiki-collaboration-implementation.md` completely and implement it end to end in the existing Lumo repository. First inspect `AGENTS.md`, docs 2–5 (note actual filenames `4_STRUCTURE.md` and `5_WHY_HONO?.md`), previous implementation plans, all screenshots in `docs/ui_samples/documents_flow/`, existing `packages/app`/`packages/ui`/`apps/api`/`packages/database`/Electron architecture, and official ONLYOFFICE Docs API docs. Replace the previous Univer decision with ONLYOFFICE Docs Cloud, using backend-signed configs, secure file URLs, reliable callback persistence and real two-user collaboration for DOCX/XLSX/PPTX and Markdown Wiki. Build workspace-safe UI + APIs + data schema + local/S3 storage adapter + tested revision/share/restore flows for web and Electron. General Drive is out of scope. Follow existing Tailwind v4/OXC/pnpm tooling and design; do not replace functioning systems or introduce ESLint/Prettier. Verify all critical flows with tests, document actual results and keep credentials out of git. Don't stop at a plan or a mockup; implement working features.
