# Messenger implementation record

## Audit and decisions

- Web and Electron render the same `@lumo/app` routes and UI. Electron forwards authenticated JSON API calls through its existing transport; downloads use a validated main-process bridge.
- The API is Hono with Zod contracts. Drizzle/Postgres owns workspace membership and conversations. Workspace writes serialize through `withAccess`, which locks the workspace before checking membership. Conversation membership has composite workspace foreign keys. Workspace admins currently have no implicit conversation access.
- Existing conversations are private direct/group conversations. Only provisioned conversations (`provider_group_id` present) have Agora history. There are no seeded general/random channels, message tables, reactions, attachments, search, or channel APIs. Preserve conversation IDs, provider group IDs, memberships, and links.
- Direct browser writes to Agora cannot enforce the new public read/join-to-post, archive, audit, attachment, and transactional nonce rules. New conversations use Postgres as their sole message authority and the existing `ws` + Postgres LISTEN/NOTIFY infrastructure pattern for delivery. Agora remains the sole authority for already-provisioned legacy conversations; their existing adapter stays available. No dual writes or automatic destructive provider migration. A provider-history migration requires a verified export and is a rollout limitation, not permission to discard history.
- Channel records extend the existing conversation model. All workspace members may create channels; creator gets explicit owner membership. Only owners/managers manage channels, with owner transfer required before leaving. Visibility conversion is prohibited. Public channels are readable by workspace members and require membership to post. Private channels/DMs return 404 to outsiders, including admins.
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
- [ ] 7: Authorization/integration/UI/web/Electron QA and complete checks.
- [ ] 8: Rollout/recovery documentation, cleanup and final review.

## Verification and rollout

Record milestone checks and remaining limitations here as implementation proceeds. Integration tests use generated schemas in the dedicated `_test` database, never reset the development database. Deploy additive migrations before the new API/UI. Keep old provider credentials and history until a separately verified provider export is available. Keep the schema and message tables during recovery. A pre-Messenger binary cannot render new channel kinds or database message histories: use a Messenger-capable rollback build, or temporarily place Messenger in maintenance and roll forward. Never point an old writer at new database histories.

Phase 1: migration 0016 tested twice over populated legacy conversations; IDs, group references and memberships retained. Composite message/thread constraints and channel slug uniqueness verified. Database typecheck and scoped lint/format pass.

Phase 2: seven request/integration scenarios cover sessions, two-workspace ID substitution, public read/join-to-post, private admin denial, concurrency-safe DM and nonce deduplication, immutable DM sets, threads, reactions, pins, edits/deletes, cursor pagination, mentions, search, ownership and archive controls. Existing 25 collaboration tests still pass. Scoped API/contracts typecheck, lint and formatting pass. Attachment endpoints follow in phase 6.

Phase 3: ws gateway reuses the Wiki LISTEN connection and authenticates short-lived, session-bound tickets. Durable invalidations contain no private resource IDs or previews. Typing checks sender and recipient authorization. Migration 0017 invalidates on workspace membership deletion/demotion. Two live clients, Postgres notifications, durable resync, workspace removal, reauthorization and sign-out pass integration checks. Client reconciliation and optimistic sends are completed with the UI phase.

Phases 4–6: shared full-space split layout, mobile back navigation, channel browser/create/settings/member roles/archive, direct/group creation, bounded message history, sender edit/delete, reactions/pins/threads, search deep links, staged S3 uploads/downloads, mentions and notification preferences implemented. Existing shared UI tests (11), attachment API regression tests, scoped API/app typecheck and lint pass. Real Chromium flow passes with two accounts, public read/join-to-post, realtime replies, private membership, threads/search and DMs. Screenshot inspected for full-space layout.

## Storage, delivery and API operations

- Migrations `0016_left_golden_guardian`, `0017_messenger_revocation`, and `0018_conscious_kitty_pryde` extend existing conversations, add durable messages/reactions/attachments, publish membership revocations, and add private activity records. Applied successfully to the local development database; the existing provisioned direct conversation remains present. Populated upgrade tests preserve IDs, provider references and membership and rerun migrations safely.
- The conversation list defaults to DMs/groups for older clients. Updated clients request `includeChannels=true`. Existing provisioned provider conversations keep the legacy transport. The credential endpoint refuses to provision a provider group over a populated database history and tells older clients to update.
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

## Remaining provider migration limitation

The existing Agora history has not been copied into Postgres or deleted. Its original conversation, group and message IDs remain under the working legacy adapter. New threads/reactions/pins/search/attachments and durable unread notifications apply to database-backed conversations. The [official historical-message export](https://docs.agora.io/en/api-reference/api-ref/im/message-management.md) is hourly, delayed, rate limited and subject to account retention. Credentials alone do not establish that a complete historical export exists. Upgrading the existing provider conversation requires a complete export, a verified final write cutoff and an ID mapping before enabling the new writer. Do not advertise that legacy upgrade as complete or silently replace its history with an empty conversation.
