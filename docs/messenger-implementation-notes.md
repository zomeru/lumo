# Messenger implementation record

## Audit and decisions

- Web and Electron render the same `@lumo/app` routes and UI. Electron forwards authenticated JSON API calls through its existing transport; downloads use a validated main-process bridge.
- The API is Hono with Zod contracts. Drizzle/Postgres owns workspace membership and conversations. Workspace writes serialize through `withAccess`, which locks the workspace before checking membership. Conversation membership has composite workspace foreign keys. Workspace admins currently have no implicit conversation access.
- Existing conversations are private direct/group conversations. Only provisioned conversations (`provider_group_id` present) have Agora history. There are no seeded general/random channels, message tables, reactions, attachments, search, or channel APIs. Preserve conversation IDs, provider group IDs and memberships for historical reference.
- Direct browser writes to Agora cannot enforce workspace/channel membership, archive, audit, attachment, and transactional nonce rules. New conversations use Postgres as their sole message authority and the existing `ws` + Postgres LISTEN/NOTIFY infrastructure pattern for delivery. The user explicitly requested complete removal of legacy Messenger. Provider-backed conversations are retired from active access, retaining historical IDs, membership and provider references. Their DM keys are released so participants can create fresh histories. There is no legacy UI, token endpoint, Chat SDK, codec, provider call or fallback. Agora remains used only for Meetings. External provider history is not deleted or imported.
- Channel records extend the existing conversation model. Only workspace owners, admins and moderators may create public or private channels; the creator gets explicit channel owner membership. Only channel owners/managers manage channels. Private channel owners must transfer ownership before leaving; public channel membership follows the workspace. Visibility conversion is prohibited. All current and future workspace members automatically join public channels. Public channels appear directly in their conversation list, so browsing and manual joining are unnecessary. Public channel members can mute notifications but cannot leave or be removed independently of workspace membership. Private channels/DMs return 404 to outsiders, including admins.
- Group DM participant sets are immutable: changing the group creates a new conversation, preventing accidental historical disclosure. Leaving revokes access. Re-creating a DM after removal creates a new history.
- Attachment storage reuses private S3, checksummed staged uploads, signature validation, immutable completion copies, cleanup intents, and 120-second signed downloads. Downloads always recheck conversation access. Files are unscanned and downloaded as attachments; do not claim malware scanning or E2EE.
- Read cursors advance only to an actual visible message. Realtime contains invalidations, never private message previews. Every delivery rechecks session and resource access; reconnect reloads durable state. No new runtime dependencies are needed.

## Phase checklist

- [x] 0: Read complete plan; audit architecture and document decisions.
- [x] 1: Additive schema, constraints, migration and populated-data regression.
- [x] 2: Channel/DM lifecycle, message authorization, history, threads, reactions, pins and search APIs.
- [x] 3: Authorized realtime, idempotent sends, reconnect reconciliation and durable unread state.
- [x] 4: Full-space shared responsive layout and reusable conversation UI.
- [x] 5: Channel discovery, creation, membership and settings UI.
- [x] 6: DM/group UI, search navigation, attachments, mentions and preferences.
- [x] 7: Authorization/integration/UI/web/Electron QA and complete checks.
- [x] 8: Rollout/recovery documentation, cleanup and final review.

## Verification and rollout

Record milestone checks and remaining limitations here as implementation proceeds. Integration tests use generated schemas in the dedicated `_test` database, never reset the development database. Deploy additive migrations before the new API/UI. Migration 0019 retires provider-backed conversations; deploy it together with removal of the legacy runtime. External history is retained and no new Chat credentials are issued. Keep the schema and message tables during recovery. A pre-Messenger binary cannot render new channel kinds or database message histories: use a Messenger-capable rollback build, or temporarily place Messenger in maintenance and roll forward. Never point an old writer at new database histories.

Phase 1: migration 0016 tested twice over populated legacy conversations; IDs, group references and memberships retained. Composite message/thread constraints and channel slug uniqueness verified. Database typecheck and scoped lint/format pass.

Phase 2: seven request/integration scenarios cover sessions, two-workspace ID substitution, public read/join-to-post, private admin denial, concurrency-safe DM and nonce deduplication, immutable DM sets, threads, reactions, pins, edits/deletes, cursor pagination, mentions, search, ownership and archive controls. Existing 25 collaboration tests still pass. Scoped API/contracts typecheck, lint and formatting pass. Attachment endpoints follow in phase 6.

Phase 3: ws gateway reuses the Wiki LISTEN connection and authenticates short-lived, session-bound tickets. Durable invalidations contain no private resource IDs or previews. Typing checks sender and recipient authorization. Migration 0017 invalidates on workspace membership deletion/demotion. Two live clients, Postgres notifications, durable resync, workspace removal, reauthorization and sign-out pass integration checks. Client reconciliation and optimistic sends are completed with the UI phase.

Phases 4–6: shared full-space split layout, mobile back navigation, channel browser/create/settings/member roles/archive, direct/group creation, bounded message history, sender edit/delete, reactions/pins/threads, search deep links, staged S3 uploads/downloads, mentions and notification preferences implemented. Existing shared UI tests (11), attachment API regression tests, scoped API/app typecheck and lint pass. Real Chromium flow passes with two accounts, public read/join-to-post, realtime replies, private membership, threads/search and DMs. Screenshot inspected for full-space layout.

## Storage, delivery and API operations

- Migrations `0016_left_golden_guardian`, `0017_messenger_revocation`, `0018_conscious_kitty_pryde`, and `0019_majestic_the_professor` extend existing conversations, add durable messages/reactions/attachments, publish membership revocations, and add private activity records. Migrations 0016–0019 were applied to local development; 0019 retains the provisioned conversation as retired history and clears its DM key. Populated upgrade tests preserve IDs, provider references and membership and rerun migrations safely.
- The conversation list defaults to DMs/groups for older clients. Updated clients request `includeChannels=true`. Retired records are excluded from all active access, search and notifications. The old credential and timestamp-read endpoints return 404. Updated clients use durable message cursors. Archival provider references are never returned in public DTOs.
- Database messages use increasing server sequences for stable cursors. A unique conversation/sender/nonce constraint and the existing workspace lock make retries and simultaneous DM creation safe. Unread calculations use actual message cursors; notification totals include all authorized conversations and honor all/mentions/muted preferences.
- The shared workspace shell owns one Messenger socket for web/Electron. Tickets bind workspace, actor, session and expiry. Every delivery rechecks session/workspace permissions; typing additionally checks conversation visibility/posting permissions. Workspace removal invalidates all API instances through Postgres. Idle sockets are checked every 15 seconds and renew their two-minute tickets by reconnecting. Clients reconcile persisted state on connection, coalesce invalidations, and never receive private message content in push payloads.
- Channel owners/managers may change settings/membership; only owners assign managers or transfer ownership. Workspace removal transfers ownership to the earliest remaining channel member, or archives an empty channel. That does not grant administrators private membership. Public/private conversion is prohibited. All joined, non-archived members may react and pin; only the sender may edit/delete.
- `GET /workspaces/:workspaceId/conversations/:id/activity` exposes scoped activity: channel managers or DM participants only. Private activity is stored separately from the general workspace feed so IDs do not leak through administrative activity views. It records mutations and ownership succession without storing message bodies in audit payloads.
- New endpoints are documented in `/api/openapi.json`. Channels use `/channels`; channel/DM messages and memberships use `/conversations/:id`; search, notification totals, socket sessions and attachment completion/downloads use `/messenger`.
- Attachments allow PNG/JPEG/WebP/PDF/plain text, up to 20 MiB and five per message. Uploads require a matching extension, size, MIME, SHA-256 and file signature. Completion copies to an immutable private key. Upload completion expires after one hour; abandoned uploads are cleaned after 24 hours. Sends and cleanup share the workspace lock. Deleting a message immediately denies downloads and schedules object cleanup after 24 hours. Signed download URLs expire within 120 seconds. Files are explicitly unscanned and download as attachments.

## Verification record and recovery

- API regression scenarios cover workspace and private-admin denial, idempotency, threads, reactions/pins, edits/deletes, scope-safe attachments/search/notifications, ownership succession, private audit access, and 1,000-message/100-channel pagination fixtures.
- Real two-client WebSocket tests cover durable notifications, typing permissions, forged tickets, removal, sign-out and reauthorization. Shared component tests cover failed-send retry with the same nonce, read visibility, settings, uploads, search navigation, history and notification paging.
- The real Messenger journey passes in Chromium, mobile Chromium and Electron, including two-account delivery and a 600×540 desktop window. Screenshot bounds verify the main-content area is filled without horizontal overflow.
- Live private-S3 validation passed checksums, immutable copying, signed downloads and cleanup. Existing CORS preflights passed for web/Electron. Browser upload tests must use an origin already allowed by the bucket, rather than widening a bucket policy for tests. The test harness supports `LUMO_E2E_API_ORIGIN` and `LUMO_E2E_WEB_ORIGIN` for this purpose; defaults remain 3011/3010.
- Optional live upload test: `LUMO_LIVE_MESSENGER_STORAGE=1 LUMO_E2E_API_ORIGIN=http://localhost:3001 LUMO_E2E_WEB_ORIGIN=http://localhost:3000 pnpm exec playwright test tests/e2e/web/messenger.spec.ts --project chromium -g 'live private S3'`. It uses an isolated test database and deletes its S3 objects on shutdown.
- During the full verification run, an existing CodeMirror toolbar test exceeded its default five-second timeout under parallel coverage; its isolated nine-test suite passed. Coverage is also checked with bounded workers; no thresholds are reduced.

## Legacy removal and retained history

The user requested complete removal of legacy Messenger. Migration 0019 adds `retired_at`, marks provider-backed conversations retired/archived and clears their unique DM key without deleting records. Tests verify populated upgrade preservation, repeated migration, denial of retired direct links, omission from lists/search/notifications and fresh DM identities. The Chat client, API credentials, provider REST calls, codecs, build shim, dependencies and configuration have been removed. Agora RTC Meetings remains supported.

The old externally stored message bodies have not been imported or deleted. Retired records are archival database references and are unavailable in the product. New conversations start fresh. This retirement is deliberate and does not represent a completed history import.

## Final plan review and operations

The sidebar includes bounded participant avatar previews, message previews and last activity. The conversation header includes member counts, pinned messages and a shared-files view. Shared files include attachments in replies; deleted messages are excluded. Filtered files/pins views do not advance read cursors. Consecutive messages retain date/unread/thread boundaries while grouping repeated senders. The composer supports emoji insertion at the current selection and restores input focus. These details use existing avatars, date helpers, controls and indexed message/attachment queries.

| Resource/action | Workspace member outside conversation | Joined member | Owner/manager |
| --- | --- | --- | --- |
| Public channel history/files/search | All workspace members automatically joined | Read/post | Read/post/manage |
| Private channel or DM content | No access, including administrators | Read/post | Channel management only for explicit roles |
| Edit/delete a message | No access | Sender only | Sender only |
| Archive/settings/membership | No access | No management | Channel owner/manager; owner alone assigns managers/transfers ownership |
| Retired provider conversation | No access | No access | No access |

Posting and message mutations require an unarchived conversation. Group participant changes start a fresh conversation.

Troubleshooting:

- If Messenger reports disconnected, check the API WebSocket upgrade, session cookie, allowed origin and workspace membership. The HTTP server must attach `app.messenger` and keep the shared Postgres listener running. Every API instance must listen to `lumo_messenger`; missed ephemeral invalidations are reconciled from persisted state on reconnect.
- If uploads fail, verify private S3 configuration and bucket CORS for the actual renderer origin. Do not widen allowed origins to fix a test. Inspect API error codes for MIME, checksum, size, signature or expired completion errors. Retry with a new upload after the one-hour completion window.
- Attachment URLs expire after 120 seconds. Request a new download through the authorized API. Removal or message deletion denies new URLs; previously issued URLs expire shortly.
- Apply migrations before starting the new API. Keep database backups and external historical exports. Recovery should roll forward or use a Messenger-capable build; never revive the removed Chat writer over a persisted Messenger destination.

## Final verification

- `VITEST_MAX_WORKERS=2 pnpm check:all` passed after the final UI changes: formatting, type-aware Oxlint, workspace boundaries, Syncpack, unused dependency analysis, fresh route generation/types, and all 62 test files / 580 tests. Coverage: statements 95.10%, branches 90.34%, functions 93.60%, lines 96.49%. Thresholds are unchanged.
- `pnpm build` passed all four tasks, including web and Electron production bundles. No legacy Chat chunk, SDK or generated codec remains.
- `pnpm exec playwright test tests/e2e/web/messenger.spec.ts --project chromium --project mobile-chromium` passed both persisted two-account journeys. The optional live-storage case is intentionally gated in this command and was executed separately.
- `xvfb-run -a pnpm test:desktop -g 'shared Messenger'` passed against the rebuilt Electron app, including web/Electron delivery, the shared-files control and narrow-window layout. The screenshot was visually inspected; dimensions also assert that Messenger fills the available main content with no horizontal overflow.
- Live S3 browser upload and download passed with `LUMO_LIVE_MESSENGER_STORAGE=1`, API port 3001 and the already-allowed web origin on port 3000. Private staging/completion, signatures/checksums, immutable copy, signed download and cleanup were verified. No bucket policy was broadened.
- Migration 0019 applied to the local development database. Populated upgrade tests retain IDs, membership and provider references, clear old DM keys, and rerun migrations safely. Retired API records, message history, search and notification access are denied. New same-pair DMs receive a fresh identity.
- Focused API/UI checks passed throughout each implementation milestone. Commits passed the repository lint/format and Conventional Commits hooks.

The complete browser suite was also attempted. Unrelated failures were recorded: shared loopback registrations exceeded the existing five-signups-per-minute policy; the public-page scrollbar resize fixture assumed a document height that no longer holds. A later isolated foundation run passed the updated Messenger dialog/focus checks and then timed out in onboarding while waiting for the Job title step after the form reset to company details. These failures do not occur in the standalone Messenger journeys. Production authentication limits and unrelated onboarding/scrollbar behavior were not changed to make the suite pass.

Remaining limits: files are explicitly unscanned (the existing safe-upload gating policy is enforced); old external provider bodies are retained outside the product and have not been imported; native Windows/macOS-specific testing was not available on this Linux host. No E2EE claim is made.

## Commit history

- `f0cf76e` — architecture audit and rollout decisions.
- `af79d9a` — durable schema and workspace constraints.
- `a5c5c05` — authorization and persisted messaging APIs.
- `66e3915` — authorized realtime and revocation.
- `04b7aa7` — full-space shared UI.
- `6c8281b` — scoped notifications and shared flow tests.
- `c4ae552` — private audit and attachment lifecycle.
- `892ce36` — safe retirement of provider conversations.
- `da5f14d` — complete legacy Chat runtime removal.
- `3e4f7fc` — avatar/activity previews, shared files, message grouping and emoji composer.

## Public channel membership and channel creation policy update

Public channel creation now inserts every workspace member in one set-based database operation. Migration `0020_messenger_public_membership` adds missing memberships to existing public channels, including archived channels, without overwriting owners/managers, read cursors or notification preferences. Retired conversations and private channels are excluded. A workspace-member insertion trigger enrolls future members, including invitation acceptance and public-workspace joining, and publishes the existing content-free realtime invalidation. The workspace lock serializes this with concurrent channel creation.

Only workspace owners, admins and moderators may create either kind of channel. The server rechecks the current role under the workspace lock, and the shared UI uses the same permission rule to hide creation controls for members. DM creation is unchanged. Public channel creation/settings omit the member picker; private channel creation/settings retain it. Browse channels and manual public join controls were removed. Public channels keep explicit channel roles for settings, ownership and archive operations; workspace administrators still gain no implicit private-channel access.

Tests cover public/private creation permissions and demotion, complete enrollment beyond 49 members, existing-data preservation, new member enrollment through actual invitation/join endpoints, concurrency with channel creation, private/retired exclusion, immediate posting and sidebar visibility, public membership protections, and matching UI controls for every workspace role.


Update verification: `VITEST_MAX_WORKERS=2 pnpm check:all` passes all 62 files / 588 tests, with 90.36% branch coverage. `pnpm build` passes all four tasks. The updated real Messenger journey passes in Chromium, mobile Chromium and Linux Electron; it checks automatic sidebar appearance for a connected second workspace member, immediate posting, hidden create controls for ordinary members, and the absence of public member-picker/Browse/Join controls. Migration 0020 is applied to the local development database. Existing roles, preferences, cursors, private membership boundaries and retired records are preserved.
