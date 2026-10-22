# Lumo: Platform-Wide UI/UX Enhancement and Messenger Redesign

**Type:** AI coding agent implementation plan  
**Platforms:** Web and Electron desktop (shared application UI)  
**Priority:** High, with Messenger as the primary deliverable  
**Status:** Ready for implementation after a live codebase and UI audit

## 1. Goals and constraints

Improve Lumo's entire UI so it feels modern, readable, consistent, and easy to use. Maintain a comfortable **neutral blue** primary brand color, but introduce restrained semantic accents so the interface is not merely blue, white, and gray. Improve **both light and dark themes**. Fix known workspace Settings layout and profile-photo upload problems. Most importantly, transform Messenger into a polished **Slack-like workspace messenger** that minimizes unnecessary manual actions.

Treat this as targeted modernization and feature completion, **not a rewrite**. Preserve Lumo's current logo, routing, authentication, channel permissions, persisted messages, APIs, attachments, and shared web/desktop architecture. Use `docs/ui_samples/messenger-slack-like-ui` as a visual reference, without cloning Slack or overriding Lumo's identity.

### Success criteria

- Text, controls, navigation, actions, and states are easy to distinguish in both themes.
- Shared spacing, typography, borders, radii, icons, focus, hover, disabled and active styles are consistent throughout the app.
- Known Settings and avatar defects are fixed end to end.
- Messenger is visually contemporary and compact, without giving up readability or accessibility.
- All requested messaging improvements are functional, secure, and tested, not merely mock UI.
- Web, Electron, keyboard, mouse, and touch interactions are verified.
- Implementation is split into **regular small, tested Conventional Commits**.

## 2. Existing repository context and key decisions

A preliminary repository inspection identified the following locations. Verify them again in the latest checkout before modifying code.

| Responsibility | Existing location |
| --- | --- |
| Shared web and Electron UI/screens | `packages/app` |
| Shared reusable components and Tailwind CSS v4 | `packages/ui` |
| Source-of-truth theme colors | `packages/ui/src/tokens.ts` |
| Generated theme adapter | `packages/ui/src/theme.css` |
| Messenger layout/routes | `packages/app/src/features/messenger/messenger-page.tsx` |
| Messages, reactions, thread views, composer | `packages/app/src/features/messenger/message-stream.tsx` |
| Messenger dialogs, client and realtime | `packages/app/src/features/messenger/` |
| Messenger backend | `apps/api/src/modules/messenger/` |
| Database and migrations | `packages/database` |
| Profile modal and form | `packages/app/src/features/auth/profile-dialog.tsx`, `profile-page.tsx` |
| Photo picker/crop/upload | `packages/app/src/features/auth/avatar-editor.tsx` |
| Avatar backend | `apps/api/src/modules/users/avatar.ts` |
| Workspace Settings | `packages/app/src/features/workspaces/settings-page.tsx` |
| Messenger design reference | `docs/ui_samples/messenger-slack-like-ui` |
| Current notes | `docs/messenger-implementation-notes.md` |
| Prior Messenger plan | `docs/implementation_plans/07-lumo-messenger-implementation-plan.md` |

**Do not recreate working Messenger features.** The current system already contains persisted channels, DMs/group DMs, reactions, threads, pins, uploads, search, mentions, realtime events and authorization. It currently has a six-emoji menu, a visible “Message actions” disclosure, and a separate checkbox-based “Mention” workflow. The README identifies **presence as pending**. The avatar editor uses its own **Save photo** action separate from **Save profile**, and the bug requires an actual end-to-end investigation rather than a cosmetic-only fix.

Recent Messenger work updated public-channel membership and channel-creation policy. Preserve those existing policies, including private-channel isolation and DM participant-only access. Do not reinstate obsolete public-channel browse/join flows or migrate back to another messaging provider.

Before starting substantial edits, read `AGENTS.md`, run `pnpm exec intent list`, and load applicable local Intent skills. Preserve existing uncommitted work. Use the repo's Oxfmt, Oxlint, Tailwind v4, pnpm/Turborepo, pinned dependencies, and Conventional Commit conventions.

## 3. Phase 0: Comprehensive product and code audit

**Objective:** Understand and reproduce issues before editing the UI.

1. Trace the shell, shared UI primitives, tokens, profile modal, avatar persistence, Messenger components, backend contracts, permissions, realtime infrastructure, and tests.
2. Run the app and inspect **every reachable page and important state** with Playwright MCP or agent-browser; screenshots and real interactions are required.
3. Include public/authentication/legal pages, workspace setup/switching/settings/members, profile, Messenger, Calendar, Meetings, People/Contacts/org chart, Drive/All Files, Docs/Sheets/Slides/Wiki, People & HR modules (Approvals, Leave, Attendance, Payroll, Onboarding), and any additional existing routes.
4. Inspect overlays, sidebars, menus, dialogs, form errors, empty/loading/denied states, long lists, search results, pagination, and dynamic content.
5. Test **light and dark modes** at desktop, narrower Electron window (approximately 600 x 540), tablet, and mobile-web viewports.
6. Check font sizes/weight, color contrast, border thickness, radius choices, focus rings, icons, alignment, scrollbars, truncation, responsiveness, hover/click affordances, action discoverability, and keyboard flow.
7. Compare actual Messenger screens with `docs/ui_samples/messenger-slack-like-ui`.
8. Produce a short audit document describing reproduced defects, affected routes, screenshots, severity, likely cause, and a resolution checklist. Distinguish observed failures from hypotheses.

**Deliverable:** Baseline screenshots and a prioritized UI/UX issue inventory. Do not use passing unit tests as a substitute for visual inspection.

**Commit:** `docs(ui): audit platform screens and messenger workflows`

## 4. Phase 1: Unified theme, contrast and design system

### Color and contrast

- Keep a calm neutral blue as the **primary action/brand** color.
- Refine background, surface, elevated surface, sidebar, text, muted text, borders, hover, pressed, selected and focus states together.
- Introduce purposeful semantic colors: green for success/online, amber for warning or pending, red for destructive/error/DND, and restrained teal or violet where a distinct informational/accent role improves clarity.
- Add subtle backgrounds, foregrounds, borders and state variations for each semantic color in both themes. Avoid random colors or a saturated interface.
- Make selected navigation, active tabs, unread badges, notifications, pinned message states and destructive actions visibly distinct.
- Never communicate a critical status through color alone. Include text, icons, tooltips or other indicators.
- Target WCAG AA: **4.5:1** for normal text, **3:1** for large text, and **3:1** for relevant non-text controls and focus/state indicators.
- Verify contrast against **actual** surfaces for default, hovered, selected, pressed, disabled and focused states.

Update `packages/ui/src/tokens.ts` first. Regenerate `theme.css` using the existing theme script; **do not hand-maintain generated CSS**. Avoid scattered hard-coded theme colors in features.

### Typography, dimensions and surface treatment

Standardize body, metadata, captions, headings, line heights, list-row density, field/control heights, button padding, icon sizes, card gutters, page widths, section spacing, dialog dimensions, borders, elevation and a small set of radius values. Aim for enterprise-grade compactness while keeping essential tap targets usable. Unify the shared `@lumo/ui` primitives first, then remove inconsistent per-screen styling.

### Decision on field outlines

**Do not remove all focus outlines.** Remove overly prominent borders/rings from controls **at rest** where subtle neutral boundaries or surface differences work better, but implement a clear `:focus-visible` indicator for keyboard navigation. Use sensible hover/pressed states. Retain visible field-validation states and forced-colors/high-contrast compatibility. Fully hiding keyboard focus is an accessibility regression.

**Exit:** Shared UI components are visually coherent; both themes pass contrast and focus checks.

**Commits:**
- `feat(ui): refresh semantic theme tokens for light and dark`
- `refactor(ui): standardize controls typography and focus styles`

## 5. Phase 2: Global layout fixes and Workspace Settings

### Workspace Settings: known defect

The settings form's outer section currently uses a constrained `max-w-3xl`, whereas the **Recent workspace activity** section uses a different width treatment. Reproduce the mismatch and align **both cards on the same responsive grid**. Prefer equal-width stacked sections or a deliberate responsive two-column grid. If the form itself needs a readable max-width, apply it **inside** the card without changing the outer card alignment. Standardize headers, padding, vertical rhythm and mobile stacking. Test empty/long activity lists.

### Entire-app consistency sweep

For all modules found in Phase 0:

- Fix misaligned headings, toolbars, filters, buttons, tables and cards.
- Apply consistent font scale, label formatting, icon sizing, rounded corners and borders.
- Fix clipping, overflow, awkward nested scrolling, tooltip/popover collisions, and residual scrollbar gutters.
- Improve visual hierarchy, selected tabs, empty states, loading skeletons and error feedback.
- Prefer information-dense lists/tables where large cards unnecessarily waste space.
- Verify Electron frameless header drag/non-drag regions and compact window behavior.
- Preserve every existing action and permission rather than removing functionality for visual simplicity.

**Exit:** Every major app screen is audited and obvious inconsistencies are corrected, not just the reported Settings card.

**Commits:** Small module-scoped commits, e.g. `fix(workspaces): align settings and activity panels`.

## 6. Phase 3: Profile photo bug and picker redesign

### Investigate actual root cause

Reproduce and trace the entire photo lifecycle:

1. Native file input and change event.
2. MIME, file size, image dimension and decode validation.
3. Preview and `createImageBitmap`/orientation/crop/zoom behavior.
4. Photo-save mutation and payload.
5. Avatar API, authentication, server-side validation and transformation.
6. Private object storage writes, persisted avatar reference, old-image deletion and errors.
7. Auth/session data, image URL resolution/versioning and React Query cache invalidation.
8. Display in profile modal, navigation, member lists and Messenger, including Electron.
9. Modal close/reopen, refresh, workspace switch, sign-out/in and desktop restart.

Do not assume that clicking **Save profile** saves a photo: the current implementation has a separate **Save photo** action. Identify whether the bug is in picker state, storage, request/response, image authorization, cache invalidation, or user-facing save-flow confusion. Fix the actual failure.

### Redesign the upload interaction

- Replace the duplicate **“Choose profile photo” + browser “Choose File / No file chosen”** presentation with a single styled, accessible picker button/dropzone backed by a visually hidden native file input.
- Keep helpful JPEG/PNG/WebP limits, preview, reposition/zoom/crop, change/remove, and cancel.
- Make the save behavior obvious. Either keep a clearly labeled separate **Save photo** flow or safely unify photo/profile submission. Do not leave two ambiguous save pathways.
- Provide pending, success, failure and retry feedback; prevent duplicate submissions.
- Maintain existing size, image re-encoding, private storage and authorization safeguards.

**Exit:** Upload, replace, remove and persistence pass real tests and the UI shows exactly one understandable file selection control.

**Commits:**
- `fix(profile): repair avatar upload and persistence`
- `feat(profile): simplify accessible photo selection and preview`

## 7. Phase 4: Messenger layout and contextual interactions (primary priority)

Build on the existing shared `MessengerPage`, `MessageStream`, APIs and components. The objective is **Slack-like interaction quality**, not a new messenger architecture.

### Overall visual structure

- Use all available main app content width/height.
- Keep a clean conversation sidebar, center timeline, sticky channel header, anchored composer, and optional thread sidebar.
- Ensure the timeline and navigation independently scroll without nested page overflow.
- Group consecutive messages by sender/time; preserve readable author context and accessible labels.
- Use refined row spacing, subdued separators, subtle hover backgrounds, high-contrast timestamps, appropriately sized avatars and distinct unread state.
- Keep search, pinned messages, shared files and settings easy to find from the header.
- Support narrow desktop/Electron and mobile-web layouts with clear back navigation.

### Replace “Message actions”

Remove the constantly visible, awkward **Message actions** text disclosure. Create a compact toolbar that appears on **message/thread reply hover**, on **keyboard focus/within**, and through a **touch-accessible overflow menu**. Suggested actions:

- Add reaction.
- Reply in thread, when relevant.
- Pin/unpin, subject to existing permissions.
- More menu: supported edit/delete/copy-link actions, visible only when permitted.

Position the toolbar safely near viewport/panel edges without covering message text. Use tooltips, accessible names, focus management and subtle transition. Do not hide essential operations from keyboard or touch users.

**Exit:** A clean message timeline with discoverable one-step actions, not an always-visible manual-action grid.

**Commit:** `feat(messenger): redesign timeline and contextual message actions`

## 8. Phase 5: Emoji, pinned messages, thread context and replies

### Full emoji picker

Replace the fixed six-emoji selection in both message composer and reaction action. **Recommended first candidate:** [`emoji-picker-react`](https://github.com/ealush/emoji-picker-react), with search, categories, skin tones, recent emojis, light/dark theming, keyboard support, customization and reaction mode. At implementation time confirm current version, maintenance, bundle impact, accessibility, React compatibility and license. Compare against `@emoji-mart/react` if needed; choose based on verifiable maintenance and performance.

- Lazy-load the picker to protect initial Messenger performance.
- Match its colors and dimensions to Lumo; support mobile/narrow layouts.
- Insert emoji at the current caret/selection, not automatically at the end.
- Preserve surrounding text, message length constraints, draft state and focus.
- Handle reaction toggle/counts, outside click, Escape, keyboard navigation and emoji variants correctly.

### Pinning

- Give pinned messages a **subtle semantic highlight**, e.g., narrow accent edge or tinted surface, plus pin icon/label. Use accessible text and theme-specific contrast.
- Replace the confusing filtered-view dead end with an explicit **Back to messages** or **All messages** control. Show which tab/view is active.
- Clicking pinned items should open/highlight the original timeline message. Preserve scroll context where feasible.
- Support pin/unpin updates and failed mutation rollback. Respect authorization.

### Thread sidebar

- Render the **original parent message at the top** of the thread sidebar, including author/avatar, body, timestamp and relevant permitted attachments.
- Separate parent context from reply list; do not double-count it.
- Show a thread-specific composer, working close/back, realtime updates, loading/error/deleted-parent states.
- On narrow screens, use an accessible dedicated thread view with an obvious return action.

### Reply previews

- Under messages with threads, show **avatars for up to the three most recent distinct people who replied** and the **total reply count**.
- Use small overlapping avatars, a friendly fallback for missing photos and clear accessible names/tooltips.
- Make the preview clickable to open that thread; optionally show latest reply time.
- Derive reply-participant summaries through a **batched or aggregated backend response**, not N+1 queries per message.

**Exit:** Emoji interaction is comprehensive; pinned views are navigable; thread parent context and reply previews are accurate and efficient.

**Commits:**
- `feat(messenger): add accessible searchable emoji picker`
- `feat(messenger): improve pin styling and navigation`
- `feat(messenger): display thread context and reply participants`

## 9. Phase 6: Direct messages, group DMs, presence and hover profiles

### Discoverable contacts and group messaging

- Populate the **Direct Messages** section with up to **10 suggested workspace members** for quick access, without removing the list of existing conversations.
- Use real recent-contact activity where available; otherwise deterministic ordering such as alphabetic. Do not invent an activity ranking.
- Show name, avatar and presence (when available); avoid duplicate entries in the same list.
- Keep member search and **New message** to reach people outside the first ten.
- Clicking a person must reuse an existing 1:1 conversation, not create duplicates.
- Clearly support **group direct messages** with multi-select member search/chips, valid participants and an intentional confirmation action.
- Preserve group DM privacy and current backend semantics; changes in participants must not expose earlier private history.
- Fetch suggestions with bounded API queries and paginate/search for larger workspaces.

### Online / DND / Offline presence

Use small status dots on applicable user avatars:

- **Green:** Online
- **Red:** Do Not Disturb
- **Gray:** Offline

Also provide human-readable labels/tooltips, not color alone. Show status in Messenger sidebar, timeline/threads, DM picker and hover profile, reusing a shared avatar/status component.

Implement presence using **Lumo's existing authenticated realtime foundation**, not a second chat service:

- Online means an active authenticated connection or unexpired heartbeat/lease, not merely a saved account.
- Support multiple tabs and simultaneous web/desktop sessions; one disconnect cannot mark a user offline if another session is still live.
- Handle heartbeat TTL, stale connection expiry, reconnect reconciliation, abrupt disconnects and stale UI state.
- Persist **DND as an explicit user preference**, while offline takes precedence if no live session exists. Notification suppression is separate behavior and must be documented/implemented only as supported.
- Decide the multi-instance coordination mechanism based on real deployment requirements. In-memory-only state is insufficient for multiple API servers; PostgreSQL notifications alone do not constitute durable expiring presence state.
- Scope presence broadcasts/queries to authorized shared-workspace contexts and avoid excessive event traffic or status flicker.
- Keep green/red/gray readable on varied avatar backgrounds and both themes.

### Member hover cards

For message author names and avatars, show a small, attractive member card on hover/focus with permitted photo, display name, role/job title if available, presence and **Message** action. Reuse in People/Contacts where appropriate. Support keyboard/touch, Escape, smart portal placement, scroll containers and accessible labels. Never expose private email, HR or unauthorized profile fields.

**Exit:** Users can identify a teammate, determine availability and begin 1:1/group messaging in very few steps.

**Commits:**
- `feat(messenger): improve dm discovery and group conversation creation`
- `feat(presence): add authorized online dnd and offline statuses`
- `feat(ui): add reusable member profile hover cards`

## 10. Phase 7: Natural inline @mention autocomplete

Replace the separate **Mention** checkbox selector as the main way to mention people.

- Typing `@` in a normal message or thread composer opens a suggestion popover beside the caret.
- Filter eligible members as characters are typed; display avatar, name, presence and potentially role.
- Support ArrowUp/Down, Enter/Tab, Escape, mouse/touch selection and correct focus restoration.
- Insert the chosen mention **at the caret**, preserve surrounding text and visually distinguish the mention token.
- Store/send **stable user IDs**, not only user-entered names. Keep mention IDs correct when editing/deleting tokens or pasting text.
- Handle duplicate names, multiple mentions, spaces/Unicode, IME composition, stale users, and unauthorized users.
- Only suggest people actually eligible to be mentioned in the active conversation. Preserve private channel/DM boundaries.
- Render mentions using safe escaping, never unsanitized HTML; optionally integrate member hover cards.
- Reuse established accessible combobox primitives if possible instead of introducing a full new editor platform.

**Exit:** Typing `@` feels natural and sends correct, authorized mention metadata without an extra manual mention mode.

**Commit:** `feat(messenger): add inline workspace member mention autocomplete`

## 11. Phase 8: Additional UX fixes from testing

Once the required work is stable, address other **observed** interaction problems, especially:

- Better grouped messages, date separators, timestamps, unread divider and Jump to latest.
- Clear loading, optimistic send, failure/retry, search result navigation and return paths.
- Correct scroll anchoring while history loads or realtime updates arrive.
- Consistent keyboard shortcuts, Enter/Shift+Enter and IME handling.
- Attachment upload feedback, removal, accessible file controls and safe previews where allowed.
- Popover/menu placement, tooltip readability, icon alignment and meaningful empty states.
- Clear authorization/revocation messaging when a member loses access mid-session.
- Navigation and filtering usable in large workspaces without overscrolling or wasteful cards.

Avoid speculative feature scope creep, framework replacements or backend redesigns that do not solve a confirmed problem. Retain existing security checks and data invariants.

## 12. Backend, data and security requirements

- Inspect current message, member, thread, reaction, pin, avatar and socket contracts **before** schema changes.
- Extend existing endpoints and DTOs minimally for reply participant previews, member suggestions and presence.
- Use aggregate/batched reads for latest respondents; never add a network request for every message row.
- Preserve stable pagination, message ordering, deduplicated send nonces and optimistic reconciliation.
- Define presence TTL, DND preference, workspace/session scope and reconnect semantics explicitly.
- Recheck workspace membership and private-channel/DM participant permissions on all new API and realtime operations.
- Preserve immediate access revocation, session expiration behavior, private attachment authorization and S3 object security.
- Do not expose private channel or DM content/metadata to unauthenticated or unauthorized users.
- Add database migrations/indexes only if needed, make them safe for populated databases, and inspect query plans/performance.
- Avoid inserting a new messaging provider, Socket.IO replacement or Redis solely to make a visual change. If a presence coordinator is required, document the actual scaling reason and trade-offs.

## 13. Testing and QA

Use repository scripts after verifying the current checkout. Existing documentation lists:

```sh
pnpm check:all
pnpm check:all:build
pnpm build
pnpm test:e2e
pnpm test:desktop
```

Run scoped checks after each commit-sized feature. Use an isolated `_test` database; never truncate development user data. Preserve existing coverage gates and lint/type rules.

### Required acceptance matrix

| Area | Tests that must pass |
| --- | --- |
| Themes | Light/dark, every major route and disabled/hover/focus states are legible |
| Accessibility | Visible keyboard focus, logical tab order, screen-reader labels and non-color-only status |
| Settings | Settings/activity cards align at desktop and narrow widths |
| Avatar | Choose/crop/save/reload/replace/remove; bad formats and backend failure; Electron persistence |
| Messenger layout | Full space used; correct independent scrolling; no unwanted horizontal overflow |
| Actions | Same permitted operations reachable via hover, keyboard focus and touch menu |
| Emoji | Search/categories/skin tones, correct caret insertion, reactions and focus handling |
| Pinned | Distinct message style, back-to-channel behavior, working timeline jump |
| Threads | Original parent message, live replies, close/back and deleted-parent fallback |
| Reply preview | Up to last 3 unique responders and exact total reply count |
| DMs | Suggested members, search, existing DM reuse, group DM privacy |
| Presence | Online/DND/offline; multi-session, reconnect, expiry, workspace revocation |
| Hover cards | Correct member, authorized data, keyboard/touch access |
| Mentions | `@` suggestions, filtering, keyboard choice, IDs, duplicate names and private scope |
| Realtime | Two-client delivery, idempotent retries, reconnect and access revocation |
| Regression | Existing messages, channel management, search, attachments and unrelated modules |
| Platforms | Web desktop/mobile and available Electron environments |

Use Playwright MCP/agent-browser not just for smoke tests but for **visual inspection and interactive testing**. Capture before/after screenshots in both themes and representative screen sizes, review alignment and popover collisions manually, and add automated accessibility checks where supported. Test long and empty states. Explicitly report Windows/macOS-specific behaviors that cannot be verified on the execution host.

**Never silently lower test coverage, skip checks, or weaken authorization to make tests pass.**

## 14. Implementation order, milestones and commits

| Order | Milestone | Priority |
| --- | --- | --- |
| 0 | Audit repository, routes, baseline screenshots and reproducible defects | P0 |
| 1 | Shared theme tokens, visual system, contrast, focus | P0 |
| 2 | Critical platform layout issues and workspace Settings alignment | P1 |
| 3 | Actual avatar bug fix and single clean picker | P0 |
| 4 | Modern Messenger layout and contextual actions | **P0** |
| 5 | Emoji picker, pins, parent-thread display and responder previews | **P0** |
| 6 | Contact/DM discovery, group DMs, presence, member cards | **P0** |
| 7 | Inline `@` mention autocomplete | **P0** |
| 8 | Other verified cross-module UX inconsistencies | P1 |
| 9 | Full visual, accessibility, regression, realtime and security tests | P0 |
| 10 | Updated documentation and implementation report | P1 |

After each coherent feature, run appropriate lint, formatting, typecheck and tests, then commit with a **specific Conventional Commit** message. Split independent DB/API/UI/test work sensibly. Do not wait for a single massive final commit. Record completed commit SHAs, changes and any known limits. Preserve existing user edits and do not commit secrets or sensitive screenshots.

## 15. Definition of done

- [ ] Whole platform audited, with major visual inconsistencies addressed.
- [ ] Neutral blue stays primary; restrained semantic accents improve hierarchy.
- [ ] Readable light/dark palette, consistent fonts, borders, radii, controls and focus states.
- [ ] Workspace Settings first card aligns with Recent workspace activity.
- [ ] Photo picker has a single clean control; upload, persistence, replacement and removal really work.
- [ ] Messenger looks and behaves like a modern workspace collaboration interface.
- [ ] Message actions appear contextually and remain accessible without hover.
- [ ] Full, searchable, customizable emoji picker works for composer and reactions.
- [ ] Pinned messages are distinct and the main timeline is easy to return to.
- [ ] Thread sidebar shows the original message above replies.
- [ ] Thread previews show up to three recent responders plus total reply count.
- [ ] Direct Messages offers ten suggested workspace members and accessible group creation.
- [ ] Avatar presence dots show green Online, red DND, gray Offline correctly.
- [ ] Member hover cards work on names and photos without leaking private data.
- [ ] `@` triggers filtered member suggestions and correctly tracks mention IDs.
- [ ] Web, Electron, responsive, realtime, authorization and regression checks pass, or limits are documented precisely.
- [ ] Changes are split into logical, tested commits, followed by a concise delivery report.

## 16. Instructions for the AI coding agent

Implement this plan in the Lumo repository. Start by inspecting `AGENTS.md`, loading the repository-local Intent skills, reviewing the existing Messenger implementation notes and reference screenshots, and reproducing the actual UI in a browser. Do not rebuild features that already work. Use `packages/ui` as the design system's source of truth and preserve shared web/Electron rendering. Prioritize the Messenger experience and broken avatar behavior over minor decorative changes. Perform the improvements phase by phase, use Playwright MCP or agent-browser to inspect live screens and interactions, add targeted tests, and run relevant checks after each milestone. **Commit regularly**, with detailed Conventional Commit messages. Finish with the implemented changes, commit SHAs, tests passed/failed/not run, screenshots or visual evidence where possible, and remaining limitations. Do not stop after writing another plan: implement and validate the requested changes.
