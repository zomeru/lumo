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
- [ ] 4: Full-space shared responsive layout and reusable conversation UI.
- [ ] 5: Channel discovery, creation, membership and settings UI.
- [ ] 6: DM/group UI, search navigation, attachments, mentions and preferences.
- [ ] 7: Authorization/integration/UI/web/Electron QA and complete checks.
- [ ] 8: Rollout/recovery documentation, cleanup and final review.

## Verification and rollout

Record milestone checks and remaining limitations here as implementation proceeds. Integration tests use generated schemas in the dedicated `_test` database, never reset the development database. Deploy additive migrations before the new API/UI. Keep old provider credentials and history until a separately verified provider export is available. Rollback application code without dropping added columns/tables.

Phase 1: migration 0016 tested twice over populated legacy conversations; IDs, group references and memberships retained. Composite message/thread constraints and channel slug uniqueness verified. Database typecheck and scoped lint/format pass.

Phase 2: seven request/integration scenarios cover sessions, two-workspace ID substitution, public read/join-to-post, private admin denial, concurrency-safe DM and nonce deduplication, immutable DM sets, threads, reactions, pins, edits/deletes, cursor pagination, mentions, search, ownership and archive controls. Existing 25 collaboration tests still pass. Scoped API/contracts typecheck, lint and formatting pass. Attachment endpoints follow in phase 6.

Phase 3: ws gateway reuses the Wiki LISTEN connection and authenticates short-lived, session-bound tickets. Durable invalidations contain no private resource IDs or previews. Typing checks sender and recipient authorization. Migration 0017 invalidates on workspace membership deletion/demotion. Two live clients, Postgres notifications, durable resync, workspace removal, reauthorization and sign-out pass integration checks. Client reconciliation and optimistic sends are completed with the UI phase.
