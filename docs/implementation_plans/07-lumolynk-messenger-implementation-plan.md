# LumoLynk Messenger: Workspace Channels and Slack-Like Messaging

**Document type:** AI agent implementation plan  
**Project:** LumoLynk (web + Electron desktop)\
**Status:** Ready for implementation, subject to repository audit  
**Primary objective:** Turn the existing Messenger module into a fully functional, workspace-scoped collaboration messenger with public/private channels, direct messages, secure realtime communication, and a full-available-space UI.

> **Important:** This plan describes required behavior and an implementation sequence; it does **not** claim the existing repository has any particular schema, endpoint, component, or feature. Audit the codebase before making changes. Preserve working behavior and the established architecture.

---

## 1. Context and goals

LumoLynk is a workspace-based collaboration platform with web and Electron desktop clients. Its Messenger UI currently shows channels and a direct-messages section, but the full channel model, permissions, conversation handling, and overall messaging experience need verification and improvement. The provided UI screenshot shows a global navigation sidebar, Messenger sidebar, and an empty conversation panel.

### Goals

1. Make Messenger behave like a Slack-style workspace messenger, not merely a generic chat page.
2. Support **public channels** that all workspace members can discover and read, and can join to participate.
3. Support **private channels** that only explicitly authorized channel members can discover, read, or post in.
4. Support workspace-scoped 1:1 and group direct messages.
5. Deliver reliable realtime messages, unread state, threads, reactions, attachments, and search.
6. Use **all available main-content width and height**, within LumoLynk's existing app shell, with independently scrolling areas.
7. Reuse existing shared components, libraries, API patterns, and monorepo tooling wherever possible.
8. Deliver incrementally with tests, migrations, and **frequent, logically grouped Git commits**.

### Non-goals

- Rebuilding LumoLynk's global navigation, authentication system, or design system.
- Replacing existing messaging/realtime providers without technical justification.
- Implementing end-to-end encryption merely to justify an existing UI claim.
- Cross-workspace chats or global direct messages unless LumoLynk already explicitly supports them.
- Large unrelated refactors.

### Guiding principles

- **Authorization is enforced on the server**, not just by hiding interface elements.
- **Workspace scope is a first-class boundary** on every relevant resource and operation.
- **One well-defined source of truth** for message persistence, ordering, and history.
- **Reuse before introducing dependencies.**
- **Preserve data and existing routes** where possible; migrations should be additive and reversible when practicable.
- **Commit after coherent, verified increments**, not only after completing the entire feature.

---

## 2. Repository discovery and design decisions (Phase 0)

**Start here. Do not implement until the existing architecture is understood.**

### Tasks

- [ ] Inspect the Turborepo apps, packages, scripts, shared UI package(s), API, database/auth packages, and existing Messenger implementations.
- [ ] Identify the actual frontend/router implementation for web and the Electron renderer; document how they share UI and state.
- [ ] Identify the current database/ORM/migrations, authentication, workspace membership and role authorization models.
- [ ] Trace channel, conversation, message, attachment, search, and notification models and endpoints from UI to storage.
- [ ] Identify realtime transport and current ownership of chat data (e.g., Agora Chat, Socket.IO, custom service), including permissions and persistence.
- [ ] Locate any existing S3 integration and shared upload/download authorization mechanisms.
- [ ] Inspect tests, fixtures, CI commands, lint/format/typecheck policies, and Git conventions.
- [ ] Reproduce the Messenger experience in both web and desktop and record current behaviors and regressions.
- [ ] Identify existing records requiring migration, including seeded `general` and `random` channels and any legacy DM representation.
- [ ] Locate the current Messenger empty-state claim that direct messages/private channels are end-to-end encrypted. **Remove or correct it unless independently verified to be true.**

### Decisions to document before Phase 1

1. **Message persistence owner:** existing backend DB vs. current chat provider; ensure no competing authoritative stores.
2. **Realtime delivery:** how authorization, channel subscriptions, reconnects, acknowledgements, and resync work with the actual transport.
3. **Workspace and channel role policy:** reuse established roles; channel owners/managers vs. regular members.
4. **Legacy schema migration:** mapping of old channels/DMs and preservation of message IDs/history.
5. **Attachment strategy:** reuse the existing private storage/S3 integration with scoped download authorization.
6. **Feature rollout:** safe migration and conditional enablement if needed.

**Deliverable:** A short audit and decision log in the repository documentation or implementation notes. Do not delay implementation for an unnecessary architecture rewrite.

**Suggested commit:** `docs(messenger): audit existing architecture and define migration approach` (if documentation changes are committed).

---

## 3. Functional and authorization contract

Before coding, establish behavior as explicit backend rules. Workspace administrators **must not** silently bypass private channel or DM content permissions.

### 3.1 Channel behavior

| Action | Workspace member, not a channel member | Public channel member | Private channel member | Authorized channel manager |
| --- | --- | --- | --- | --- |
| Discover public channel | Yes | Yes | Yes | Yes |
| Read public channel history | Yes | Yes | Yes | Yes |
| Post to public channel | No, join first | Yes | Yes, if joined | Yes, if joined |
| Join public channel | Yes | Already joined | Yes, if desired | Yes |
| Discover private channel | No, unless already a member/invited | No, unless also a member | Yes | Yes, if explicitly authorized |
| Read private history | No | No, unless also a member | Yes | Yes, if explicitly authorized |
| Post to private channel | No | No, unless also a member | Yes | Yes, if explicitly authorized |
| Manage channel members/settings | No | Only if role permits | Only if role permits | Yes, per permission matrix |

Notes:

- Public-channel visibility requires **workspace membership**, not global authentication alone.
- Private channel metadata (including names, descriptions, participants, attachments, and messages) must not leak to non-members via APIs, search, realtime, or notifications.
- Private channel invitations must be restricted to members of the same workspace; an invited person should become a channel member only in accordance with the established invite/accept policy.
- Channel owner or manager privileges must be explicitly recorded or derived from an approved existing permissions system.
- Do not treat `workspace_admin` as unconditional permission to read private content.
- Archive behavior should prevent new posts (unless a defined policy explicitly permits them), preserve authorized history, and be auditable.

### 3.2 Direct messages

- **1:1 DMs:** between two members in the same workspace; reuse an existing conversation rather than creating a duplicate for the same pair and workspace.
- **Group DMs:** between multiple members of one workspace; only participants can discover, access, or send messages.
- Add/remove participant behavior for group DMs must be deliberate: define whether membership changes create a new conversation or alter access to prior history; never expose previously private history accidentally.
- A participant leaving/being removed loses access to future messages and, by default, the conversation unless an explicit, tested history-retention policy exists.
- Workspace removal immediately revokes access to that workspace's channels and DMs, including active realtime subscriptions.

### 3.3 Membership/role edge cases

- Validate actors and targets by workspace and active membership status.
- Decide whether public channel memberships are auto-created for `general`; preserve current user expectations.
- Determine who may create public/private channels and whether any workspace setting limits this.
- Handle channel ownership transfer before removing an owner.
- Decide how to handle changing a public channel to private (and vice versa): prohibit unsafe conversion or implement a reviewed, auditable policy.
- Use an explicit `403`/`404` policy that avoids disclosing private resource existence to non-members.

---

## 4. Phase 1: Data model, constraints, and migrations

Adapt table/entity names to the existing database conventions. **Do not blindly create duplicate models.** The following is a conceptual target schema, not mandatory naming.

### Proposed logical entities

| Entity | Essential information | Notes |
| --- | --- | --- |
| `channels` | `id`, `workspace_id`, `name`, `slug`, `description`, `visibility`, `created_by`, `archived_at`, timestamps | Unique channel slug **within workspace** for active channels; visibility `public/private`. |
| `channel_members` | `channel_id`, `user_id`, role, `joined_at`, notification prefs, `last_read_*` | Compound uniqueness, membership integrity. |
| `conversations` | `id`, `workspace_id`, type (`direct/group`), optional title, timestamps | Clear separation from channels, or a documented unified-conversation model. |
| `conversation_members` | `conversation_id`, `user_id`, role, timestamps, `last_read_*` | Compound uniqueness; workspace membership validated. |
| `messages` | `id`, `workspace_id`, destination (`channel` or `conversation`), `sender_id`, body, `parent_id`, `edited_at`, `deleted_at`, `created_at` | Enforce exactly one destination and same-workspace parent/thread relationships. |
| `reactions` | `message_id`, `user_id`, emoji, timestamps | Unique per user/message/emoji. |
| `attachments` | `id`, `message_id`, workspace, storage key, original filename, media type, size, scan/status, metadata | Private access; no unauthenticated public object URLs. |
| `pins` | `message_id`, actor, timestamps | Authorized pin/unpin and listing. |
| `message_idempotency` (optional) | client nonce, sender/destination, resulting message ID | Or use an existing unique client request ID on messages. |

### Implementation tasks

- [ ] Align the proposed entities with the actual schema; extend existing tables where suitable.
- [ ] Add or update migrations **without erasing existing message/channel/DM data**.
- [ ] Define foreign keys, indexes, unique constraints, and destination integrity rules.
- [ ] Index channels by workspace/visibility, messages by destination + ordered cursor, thread replies, participants, and search as appropriate.
- [ ] Define stable server-side ordering (e.g., created timestamp + ID tie-breaker) for pagination and message cursors.
- [ ] Normalize user and membership identifiers consistently with the auth layer.
- [ ] Migrate existing seed channels such as `general` and `random` without duplicating them.
- [ ] Preserve old channel/message IDs or implement safe link redirects/remapping.
- [ ] Ensure workspace deletion or deactivation lifecycle respects retention requirements.
- [ ] Add seed/test fixtures covering two workspaces, public/private channels, DMs, and role combinations.

**Exit criteria:** migrations run on a representative populated development DB; existing messages remain accessible; constraints and multi-workspace isolation tests pass.

**Suggested commits:**

- `feat(messenger): add workspace-scoped channel and conversation models`
- `feat(messenger): migrate legacy conversations and add indexes`
- `test(messenger): cover data integrity and workspace isolation`

---

## 5. Phase 2: Backend services, APIs, and permission enforcement

Follow the established API conventions (expected to be Hono, **verify in repository**). Keep validation, authorization, service logic, and persistence clearly separated.

### Service boundaries

- `ChannelService`: discovery, membership, creation, update, archive, permissions.
- `ConversationService`: 1:1/group DM lifecycle, participant management.
- `MessageService`: create/edit/delete, history, threads, reactions, pins, unread state.
- `SearchService`: authorized channel/message search and pagination.
- `AttachmentService`: upload authorization, metadata, safe retrieval.
- `RealtimeGateway/Adapter`: authorized subscription and event delivery.

These are **logical responsibilities**, not a mandate to create one class/file per item.

### Representative routes / operations

Adapt to existing route naming and RPC conventions; do not expose redundant APIs.

```text
GET    /workspaces/:workspaceId/channels                # only discoverable/authorized channels
POST   /workspaces/:workspaceId/channels
GET    /workspaces/:workspaceId/channels/:channelId
PATCH  /workspaces/:workspaceId/channels/:channelId
POST   /workspaces/:workspaceId/channels/:channelId/join
POST   /workspaces/:workspaceId/channels/:channelId/leave
GET    /workspaces/:workspaceId/channels/:channelId/members
POST   /workspaces/:workspaceId/channels/:channelId/members
DELETE /workspaces/:workspaceId/channels/:channelId/members/:userId
POST   /workspaces/:workspaceId/channels/:channelId/archive
GET    /workspaces/:workspaceId/conversations
POST   /workspaces/:workspaceId/conversations           # 1:1 or group, idempotent 1:1
GET    /workspaces/:workspaceId/conversations/:conversationId
GET    /workspaces/:workspaceId/{channels|conversations}/:id/messages
POST   /workspaces/:workspaceId/{channels|conversations}/:id/messages
PATCH  /workspaces/:workspaceId/messages/:messageId
DELETE /workspaces/:workspaceId/messages/:messageId
GET    /workspaces/:workspaceId/messages/:messageId/replies
POST   /workspaces/:workspaceId/messages/:messageId/reactions
DELETE /workspaces/:workspaceId/messages/:messageId/reactions/:emoji
POST   /workspaces/:workspaceId/{channels|conversations}/:id/read
GET    /workspaces/:workspaceId/search
```

### Required backend checks

- [ ] Authenticate every operation; derive actor identity from the session/token, never a client-supplied sender ID.
- [ ] Verify active workspace membership for every workspace-scoped request.
- [ ] Check channel/DM access on **every message and attachment operation**, including history, search, previews, and unread queries.
- [ ] Keep public channel discovery separate from joined-channel navigation.
- [ ] Return private resources only to explicitly authorized members; filter aggregate counts/notifications too.
- [ ] Validate limits: channel name and slug, message size, attachments, group size, file type, pagination, reactions.
- [ ] Add service-level tests and request tests for denied access and cross-workspace ID substitution.
- [ ] Make 1:1 DM creation concurrency safe (avoid duplicate threads when both users initiate simultaneously).
- [ ] Restrict editing/deletion to the sender or explicit moderators; retain audit metadata as policy requires.
- [ ] Apply rate limiting/spam controls to message sends, channel creation, invitation, and search where supported.
- [ ] Implement cursor pagination; avoid fetching full histories or participant lists by default.

**Exit criteria:** all main operations work through the backend, and intentionally crafted unauthorized requests fail without information leakage.

**Suggested commits:**

- `feat(messenger): enforce channel and workspace access policies`
- `feat(messenger): implement channel membership and lifecycle APIs`
- `feat(messenger): implement scoped direct and group conversations`
- `feat(messenger): implement message, thread, and reaction APIs`
- `test(messenger): reject unauthorized and cross-workspace requests`

---

## 6. Phase 3: Realtime delivery, state reconciliation, and unread tracking

**Reuse existing transport infrastructure.** LumoLynk has discussed Agora for communication and Socket.IO for presence/notifications, but confirm the actual implementation. Do not maintain duplicate competing chat pipelines.

### Event design (illustrative)

```text
message.created
message.updated
message.deleted
reaction.added
reaction.removed
channel.updated
channel.membership_changed
conversation.updated
conversation.membership_changed
read_cursor.updated
typing.started / typing.stopped
```

### Implementation tasks

- [ ] Authorize connection identity **and each channel/conversation subscription**.
- [ ] Reauthorize on reconnect, membership change, workspace switch, and token/session expiration.
- [ ] Force-unsubscribe/revoke access immediately on workspace/channel/DM removal.
- [ ] Broadcast private events only to authorized participants.
- [ ] Make message writes durable before broadcasting success; use client-generated idempotency keys or equivalent deduplication.
- [ ] Support optimistic sending with pending/sent/failed states and retry without duplicated messages.
- [ ] On reconnect, fetch missed events/messages using stable cursors; handle out-of-order delivery.
- [ ] Define visibility-based read cursor updates; avoid marking messages read for hidden/offscreen conversations.
- [ ] Compute unread badges consistently from durable cursors; consider mention counts separately.
- [ ] Throttle/debounce ephemeral typing and presence events; do not persist them as normal messages.
- [ ] Verify multi-tab/multi-device synchronization and desktop/web parity.
- [ ] Ensure channel/archive/leave and role changes invalidate client caches and subscriptions.

**Exit criteria:** messages are correct under retries, reconnects, workspace switches, and access revocations; unread counts stay consistent.

**Suggested commits:**

- `feat(messenger): secure realtime subscriptions and broadcasts`
- `feat(messenger): add reliable message reconciliation and unread cursors`
- `test(messenger): cover reconnect, revocation, and duplicate sends`

---

## 7. Phase 4: Full-available-space UI and reusable conversation components

Use the attached Messenger screenshot as the **current-state reference**, not as a requirement to preserve its excess unused space. Keep the **global LumoLynk sidebar and top navigation**, original logo, professional blue/dark-blue palette, and existing UI design system.

### Target layout

```text
┌─────────────────┬──────────────────────────────────────────────────────┐
│ Global LumoLynk nav │ Global app toolbar / search                          │
│                 ├─────────────────┬────────────────────────────────────┤
│                 │ Messenger       │ Conversation header                │
│                 │ sidebar         ├────────────────────────────────────┤
│                 │                 │                                    │
│                 │ Channels        │ Message history (scrollable)       │
│                 │ DMs / Group DMs │                                    │
│                 │                 ├────────────────────────────────────┤
│                 │                 │ Sticky composer                    │
└─────────────────┴─────────────────┴────────────────────────────────────┘
```

### Layout requirements

- [ ] Messenger takes **100% of the usable main-content width/height** provided by the app shell; remove restrictive `max-width`, excess outer padding, and unnecessary cards around the module.
- [ ] Maintain appropriate minimum sizes, `min-width: 0`, `min-height: 0`, and overflow rules for flex/grid children.
- [ ] Channel sidebar and message history scroll **independently**; do not scroll the entire page when reading chat.
- [ ] Keep conversation header visible and composer docked at bottom.
- [ ] Allow a resizable Messenger sidebar on desktop if implementation remains straightforward; otherwise choose a comfortable responsive width.
- [ ] Avoid layout shifts and phantom scroll gutters in Electron and browsers.
- [ ] Preserve native window controls/drag regions if Electron uses custom chrome.
- [ ] Provide intentional empty state when no conversation is selected, but fill the conversation panel upon selection.
- [ ] Use compact, consistent spacing, avatars, type sizes, icons, and selection/hover states.

### Shared UI pieces (reuse existing components first)

- `MessengerLayout` / split view.
- `ConversationSidebar`, `ChannelSection`, `DMSection`.
- `ChannelRow`, `ConversationRow`, `UnreadBadge`.
- `ConversationHeader`, `MessageList`, `MessageItem`, `ThreadPanel`.
- `MessageComposer`, `AttachmentPicker`, `ReactionPicker`.
- `ChannelCreateDialog`, `ChannelSettingsDialog`, `MemberPicker`.
- `ChannelBrowser` and `ConversationSearch`.

### Interaction details

- [ ] Sidebar: search conversations, browse channels, clear public/private indicators, joined state, unread badges, collapsible sections, create buttons.
- [ ] Conversation area: display name, topic/description, member count/details, message grouping, date separators, edited markers, reactions, threads, pins, delivery states.
- [ ] Compose: multiline editor, Enter-to-send / Shift+Enter-newline (with accessible settings if already supported), attachments, emoji, keyboard focus and shortcuts.
- [ ] Dates: localized readable short dates (e.g., `Jan. 30, 2026`) and clear times (e.g., `10:30 PM`) where relevant; use existing date formatting conventions.
- [ ] Loading/error/permission-denied states, scroll-to-latest, unread divider, and history loading indicators.
- [ ] Use a shared design implementation for **web and desktop**; avoid independent visual forks.

### Responsive behavior

- **Wide desktop:** persistent Messenger sidebar + active conversation.
- **Narrow desktop/tablet:** adapt sidebar width or hide with a toggle; conversation remains usable.
- **Mobile:** conversation list first, then conversation detail with a back action.
- Test split view with sidebar collapsed, small windows, browser zoom, long names, and long messages.

**Exit criteria:** no wasted outer content width; no horizontal overflow; desktop/web both render and behave consistently; messages and composer remain usable in narrow windows.

**Suggested commits:**

- `refactor(messenger): create full-space responsive shell`
- `feat(messenger): build reusable channel and conversation sidebar`
- `feat(messenger): build message list, thread panel, and composer`
- `fix(messenger): handle desktop scrolling and narrow-window layout`

---

## 8. Phase 5: Channel discovery and management UX

### User journeys

1. Workspace member opens Messenger and sees joined channels and recent conversations.
2. Member opens **Browse channels**, sees public channels, searches descriptions/names, and joins one.
3. Member creates a public/private channel if permitted; required members may be invited during creation.
4. Member opens channel settings to edit details, view/manage members, or leave.
5. Authorized manager archives/unarchives channel, changes role assignments, or deletes if supported and safe.
6. Member accesses a private channel only after authorization; outsiders cannot find its name or metadata.

### Tasks

- [ ] Channel browse/search UI; include joined/not-joined state for public channels.
- [ ] Channel creation modal with name, description, public/private visibility, appropriate validation.
- [ ] Channel membership management; searchable workspace-member picker for private channels.
- [ ] Channel info panel with membership, topic/description, files, pinned messages, and settings where available.
- [ ] Inline join/leave actions, with confirmation where necessary.
- [ ] Channel archive states and clear archived labeling; permissions reflected in available actions.
- [ ] Deep links route to channel and display an appropriate result for no access, missing, archived, or another workspace.
- [ ] Keep currently selected and expanded sidebar sections persistent through ordinary navigation when possible.

**Suggested commits:**

- `feat(messenger): add public channel discovery and join flows`
- `feat(messenger): add private channel creation and member management`
- `feat(messenger): add channel settings and archive controls`

---

## 9. Phase 6: Direct messaging, search, attachments, and notifications

### DMs and group DMs

- [ ] Create/open 1:1 DM with idempotent backend behavior.
- [ ] Create group DM with workspace-member picker and validated membership.
- [ ] List recent conversations with previews, unread counts, avatar(s), and last activity.
- [ ] Support group title/membership behavior per documented backend policy.
- [ ] Limit who can see DM participant lists and message content.

### Search

- [ ] Search only within authorized workspace data; private channels/DMs strictly scoped.
- [ ] Support channel discovery and message search as distinct concerns or scoped modes.
- [ ] Add appropriate server-side pagination and filters (channel, author, date) as feasible.
- [ ] Highlight result and navigate to the message/thread, loading surrounding history as necessary.
- [ ] Ensure snippets and counts cannot reveal restricted content.

### Attachments and notifications

- [ ] Reuse LumoLynk's existing storage integration, preferably private objects with authorized signed upload/download flows.
- [ ] Validate maximum size, MIME/file extension, ownership, and upload completion.
- [ ] Integrate malware scanning or current safe-upload gating policy, without representing unscanned objects as trusted.
- [ ] Recheck channel/DM authorization before attachment download; revoke old links quickly or use a download proxy if needed.
- [ ] Implement mentions, unread notifications, and preferences without notifying non-participants.
- [ ] Do not deliver private message previews through channels or push payloads visible to unauthorized users.

**Suggested commits:**

- `feat(messenger): add scoped direct and group messaging flows`
- `feat(messenger): add authorized message search and navigation`
- `feat(messenger): support private message attachments and mentions`
- `feat(messenger): integrate unread notifications and preferences`

---

## 10. Phase 7: Test matrix and QA

Run existing monorepo lint, formatting, typecheck, unit, integration, and end-to-end commands. Use project-standard tooling (e.g., Vitest/Playwright if actually configured). Add missing tests where feasible; do not replace the test stack just for this module.

### Required security scenarios

| Scenario | Expected behavior |
| --- | --- |
| Non-workspace user requests public channel | Denied; no data returned |
| Workspace member browses public channels | Visible and readable by policy |
| Non-joined workspace member posts to public channel | Denied until joining |
| Private channel non-member guesses ID | Denied without metadata leaks |
| Workspace admin not in private channel requests history | Denied absent explicit authorization |
| User guesses another workspace's message/attachment ID | Denied |
| Removed member maintains open realtime subscription | Revoked; no new events received |
| DM non-participant requests history/search | Denied |
| Concurrent creation of same 1:1 DM | One effective conversation |
| Client retries same send after timeout | One persisted message |
| Attachment URL access after leaving private channel | Denied when new access is requested; short-lived prior URLs constrained |
| Search/notifications query private content | No restricted names, previews, counts, or results |

### Functional scenarios

- [ ] Create public/private channels; join/leave/invite/remove/manage roles.
- [ ] Public history visible before join; posting requires join.
- [ ] Private channels invisible to outsiders; members can read/post.
- [ ] Start 1:1 and group DMs; verify all participants and workspace scoping.
- [ ] Send, edit, delete, react, reply, attach files, pin/unpin, search.
- [ ] Reconnect, retry failed sends, reorder incoming messages, restore unread state.
- [ ] Restore selection and deep links; handle deleted/archived/missing conversations.
- [ ] Keyboard and focus navigation; input validation and screen-reader labels.
- [ ] UI on typical desktop width, narrow desktop/Electron window, tablet, and mobile.
- [ ] Verify web + Electron layout parity and no leftover scrollbar gutter.
- [ ] Measure long history and many channel items for pagination/performance issues.

### Minimum release gate

1. No known authorization bypasses or cross-workspace leaks.
2. Existing data retained; migrations tested and documented.
3. New channels and DMs usable end to end through persisted backend data.
4. Realtime and unread correctness verified across two browser sessions and/or web + desktop.
5. Reusable UI occupies available content space, with stable scroll and composer behavior.
6. Relevant automated checks pass; unrelated failures are recorded, not silently ignored.

**Suggested commits:**

- `test(messenger): add permissions and multitenancy regression suite`
- `test(messenger): add end-to-end public private and dm flows`
- `fix(messenger): address QA findings and performance issues`

---

## 11. Phase 8: Migration, rollout, cleanup, and handoff

- [ ] Verify migration on representative production-like data or backup; document rollback/recovery approach.
- [ ] Confirm old links and records either continue working or have well-defined redirects.
- [ ] Ensure storage, event subscribers, and caches work with old and new message IDs.
- [ ] If necessary, use an existing feature flag/rollout mechanism; do not introduce infrastructure solely for it.
- [ ] Remove obsolete Messenger UI, dead APIs, unused schema pieces, and duplicate realtime listeners **only after** verifying replacement paths.
- [ ] Verify current channel privacy labels; **do not show an end-to-end encryption claim without implemented, validated E2EE**.
- [ ] Add concise architecture documentation: data model, permission matrix, API/realtime events, migration, and operational troubleshooting.
- [ ] Run complete verification; review Git diff and final commit history.
- [ ] Provide implementation summary, changed modules, migration details, verification results, and known limitations.

**Suggested commits:**

- `docs(messenger): document access rules and messaging architecture`
- `refactor(messenger): remove superseded implementations`
- `chore(messenger): finalize verified rollout`

---

## 12. Execution and Git policy (mandatory)

1. **Read this entire document before implementation** and inspect the repo thoroughly.
2. Make a compact task checklist based on phases and keep it updated as work proceeds.
3. Execute phases sequentially unless a small dependency-driven reordering is justified and documented.
4. **Implement real features:** do not substitute placeholder UI, mock responses, or TODO-only endpoints for required flows.
5. Prefer minimal coherent changes; never rewrite working subsystems just to match proposed names.
6. **Commit incrementally as work is completed**, ideally after each tested schema/API/UI/user-flow slice. Never defer all commits until the end.
7. Use **Conventional Commits** consistent with repository rules; write detailed messages explaining behavior and reason, especially for migrations/security changes.
8. Before each commit, run appropriate targeted tests/typecheck/lint/format; run full checks at major milestones and at the end.
9. Avoid committing generated secrets, credentials, build outputs, or unrelated changes.
10. Never run destructive migrations/data resets or delete important user data without a safe migration and recovery approach.
11. If a feature requires credentials/services unavailable locally, implement testable abstractions and report the blocker honestly instead of pretending the feature works.
12. Do not claim completion unless functional, security, and UI acceptance checks have been performed.

### Recommended phase milestone updates from the agent

At minimum, report progress after: **audit**, **schema/security APIs**, **realtime**, **UI/channel flows**, and **final QA**. Include commit hashes, tests run, blockers, and next actions.

---

## 13. Final acceptance checklist

### Workspace and authorization

- [ ] Messenger data stays within the active workspace.
- [ ] Public channels are discoverable/readable to workspace members; joining is required to post.
- [ ] Private channels and their metadata are invisible to outsiders.
- [ ] DMs and group DMs are visible only to participants.
- [ ] APIs, events, search, notifications, and attachments enforce the same permissions.

### Messaging and user experience

- [ ] Channel create/join/leave/invite/settings/archives work end to end.
- [ ] 1:1 and group DMs work and prevent duplicate 1:1 conversations.
- [ ] Realtime sends/reconnects/retries and unread state are reliable.
- [ ] Editing, deleting, reactions, threads, pinned messages, attachments, and search are implemented or clearly documented as scoped follow-ups if explicitly approved.
- [ ] Full-width/full-height Messenger layout within existing app chrome.
- [ ] Independent sidebar/message scrolling and bottom-docked composer.
- [ ] Responsive and usable on web and Electron desktop without redesigning LumoLynk.
- [ ] Encryption claims accurately represent the real implementation.

### Engineering quality

- [ ] Existing data migrated/preserved safely.
- [ ] Relevant tests and type/lint/format checks pass.
- [ ] No duplicate subsystem or unnecessary new dependency introduced.
- [ ] Documentation and regular Git commits are complete.
- [ ] Final agent report includes remaining limitations, if any.

---

## 14. Suggested implementation order (quick reference)

1. **Audit:** inspect existing UI, backend, auth, workspace model, realtime transport, data, and tests.
2. **Data:** schema adjustments, integrity constraints, preserved migrations.
3. **Authorization/API:** channels, memberships, DMs, messages, security tests.
4. **Realtime:** secure subscriptions, delivery, deduplication, reconnection, unread sync.
5. **UI foundation:** full-space split layout, shared components, responsive behavior.
6. **Channels:** discovery, create/manage, public/private workflows.
7. **Messaging:** DMs/group DMs, history, threads, reactions, search, attachments, notifications.
8. **QA/rollout:** security, web/desktop E2E, performance, cleanup, docs, final report.

**Outcome:** A secure, maintainable, Slack-like Messenger for LumoLynk that uses all available main-content space, without sacrificing existing workspace boundaries, design consistency, or production data.
