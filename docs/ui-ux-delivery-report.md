# Plan 08 delivery report

Date: 2026-10-22. Platforms exercised: Chromium Web, mobile Chromium and Linux Electron. Shared implementation remains in `packages/app` and `packages/ui`; existing authorization, routes, attachments and persisted Messenger data are retained.

## Completed requirements

| Plan phase | Delivered behavior | Evidence |
| --- | --- | --- |
| 0: audit | Code/contract/reference review, real baseline interactions and complete route follow-up | `docs/ui-ux-audit.md`, ignored `.local/ui-audit/before` and `after` captures |
| 1: design system | Neutral blue, semantic light/dark palettes, consistent compact controls, selected/pressed/focus and forced-colors states | Generated theme adapters, token contrast and shared interaction tests |
| 2: layouts | Equal Settings/activity cards, clear empty activity and compact shared screens | Measured equal outer bounds; four-viewport route sweep |
| 3: photo lifecycle | Single chooser, explicit Save photo, crop/cancel/pending/retry, immediate cached identity and cross-client refresh | Validation/failure tests; real private-storage replacement/removal, reload, switching, login and Electron restart |
| 4: Messenger | Full-space split layout, grouped messages, hover/focus toolbar, touch overflow and narrow back navigation | Web/mobile/Electron real two-account journeys and native 600×540 screenshots |
| 5: messaging detail | Lazy full emoji search/tones, caret/selection insertion, reactions, distinct pins, back/jump, persistent thread parent and latest three distinct responders | Real picker interactions, API aggregation and reply-count tests, query-plan inspection |
| 6: discovery | Up to ten deterministic suggestions, reuse existing direct conversations, group selection chips, authorized public member cards | Shared UI tests, real DM reuse and keyboard/touch interaction |
| 6: availability | Durable per-connection leases, multi-session behavior, saved DND, offline precedence, bounded workspace queries and labeled dots | Service/API expiry and authorization tests; actual gateway heartbeat renewal; two-client DND |
| 7: inline mentions | Caret-positioned filtered autocomplete, keyboard/touch/IME guards, duplicate-name identity, stable IDs, edit range tracking and safe rendering | Mention range/input tests, real thread mention, private membership/edit authorization tests |
| 8: related fixes | Pre-paint caret recovery, profile-card keyboard entry/exit, compact thread parent visibility, hidden timeline read protection, retryable transient session errors | Focused regressions and real UI inspection |
| Verification | Complete repository gate, production builds, broad Web/mobile and Electron acceptance, live storage and visual/accessibility review | Results below |
| Delivery | Audit, operational notes, current README, commit history and this report | Tracked documentation; original plan/reference remain untouched |

## Verification results

| Check | Final result |
| --- | --- |
| `VITEST_MAX_WORKERS=2 pnpm check:all` | PASS: 66 files / 622 tests; formatting, type-aware lint, boundaries, dependency checks and types |
| Coverage (unchanged 90% gates) | Statements 94.96%, branches 90.13%, functions 93.15%, lines 96.38% |
| `pnpm build` | PASS: all four Web/Electron/API/shared-app production tasks |
| `LUMOLYNK_LIVE_AVATAR_STORAGE=1 pnpm test:e2e --project chromium` | PASS: 11 passed; one separately executed live attachment opt-in |
| `LUMOLYNK_LIVE_AVATAR_STORAGE=1 pnpm test:e2e --project mobile-chromium` | PASS: 10 passed; live attachment separate, mouse thumb dragging inapplicable to touch |
| `LUMOLYNK_LIVE_AVATAR_STORAGE=1 xvfb-run -a pnpm test:desktop` | PASS: 7 passed; four existing native-WM/live-RTC opt-ins unrun |
| Live attachment with the existing allowed S3 origin | PASS: private S3 upload, immutable completion, signed download and isolated cleanup |
| Agent-browser visual review | 216 route snapshots plus 16 sign-in/registration captures; two themes × four viewports; no final horizontal overflow/error-only captures |
| axe 4.12: sign-in, Settings, open thread | Zero violations; one manual-review item each on Settings/thread |
| Reply aggregate `EXPLAIN (ANALYZE, BUFFERS)` | Existing thread index; three rows; no temporary writes; 0.044 ms on the integration fixture |

After the loopback-listener adjustment, the fresh real Messenger/photo subset passed again in Chromium and mobile Chromium (two passed per project). The live attachment run used API/Web origins `http://localhost:3001` / `http://localhost:3000`, `NODE_OPTIONS=--dns-result-order=ipv6first`, and `.local/ui-audit/playwright.storage.config.ts` to direct the browser to isolated IPv6 listeners beside the existing IPv4 development server. The bucket policy and running development server were unchanged. The empty schema from the earlier failed port-binding attempt was identified from its generated migration directory, verified to contain no users/workspaces, and removed.

Final logs are local ignored artifacts under `.local/ui-audit`. Tests create isolated schemas inside the dedicated `_test` database and clean their synthetic storage objects. No development user data is reset. Earlier failed runs exposed rate-limit pacing, route-generator dev reloads and incorrect scrollbar fixture assumptions; the harness now respects Better Auth's quiet-minute reset, checkpoints long workflows and tests a fresh production preview. Production limits, coverage thresholds and permission rules were not weakened.

## Visual evidence

- [Compact Electron thread, dark](../.local/ui-audit/desktop-results/desktop-shared-Messenger-c-7b835-d-messages-work-in-Electron-desktop/messenger-compact-dark.png)
- [Compact Electron thread, light](../.local/ui-audit/desktop-results/desktop-shared-Messenger-c-7b835-d-messages-work-in-Electron-desktop/messenger-compact-light.png)
- [Settings alignment, desktop](../.local/ui-audit/after/settings-aligned-light/screenshot-1792647500674.png)
- [Settings alignment, compact](../.local/ui-audit/after/settings-aligned-compact/screenshot-1792647539639.png)
- [Compact dark registration](../.local/ui-audit/after/auth-compact-dark-register/screenshot-1792651230112.png)
- [Mobile light sign-in](../.local/ui-audit/after/auth-mobile-light-login/screenshot-1792651233929.png)
- [Dark emoji and skin-tone inspection](../.local/ui-audit/after/emoji-tone-dark/screenshot-1792647154529.png)

The full screenshot matrix and accessibility snapshots remain local to avoid committing test identities or bulky media. The audit explains the actual avatar findings: storage failure was not reproduced; save-flow ambiguity and stale identity caches were confirmed and corrected.

## Rollout and remaining host limits

Apply additive migration `0021_stale_wonder_man.sql` before starting the new API. Fresh isolated migrations pass; a production migration/deployment was not performed. Keep the existing message/history tables when rolling back and use a Messenger build that understands Unicode reactions and current mention tokens; older six-reaction clients may reject new histories. Coordinate API/UI rollout and prefer rolling forward. Presence data is additive and ephemeral except for the DND preference.

DND communicates availability only. Existing conversation notification preferences remain authoritative; suppression is not implemented. Availability requires a live authorized connection in that workspace. Expiry, polling and reconnect grace are documented in `docs/messenger-implementation-notes.md`.

Native Windows/macOS testing was unavailable. This Linux/Xvfb host lacks a managed window system and protected keyring: native maximize/minimize/fullscreen cases require their existing opt-in, and session persistence intentionally falls back to sign-in after restart. The real saved photo is checked after that authentication. Live Agora/native capture cases retain their explicit opt-ins. Existing large Office/RTC chunks produce build size warnings; the new picker is lazy and approximately 44 kB gzip. Attachment scanning limitations and private-storage policies remain unchanged.

## Logical commits

The following implementation commits are followed by this delivery-documentation commit. Each feature milestone used scoped checks and Conventional Commit hooks; final broad verification is recorded above.

- `c681277` — docs(ui): audit platform screens and messenger workflows.
- `8d5dd44` — feat(ui): refresh semantic theme tokens for light and dark.
- `743bd9a` — refactor(ui): standardize controls typography and focus styles.
- `7821a01` — fix(workspaces): align settings and activity panels.
- `584e578` — fix(profile): simplify photo selection and refresh saved avatars.
- `1f74aea` — feat(messenger): return thread context and recent responders.
- `2bab24d` — feat(presence): coordinate authorized availability with postgres leases.
- `1e1bcc0` — feat(messenger): add lazy searchable emoji picker.
- `2773465` — feat(messenger): redesign timeline actions and thread context.
- `8c77392` — feat(presence): batch visible member availability in shared ui.
- `a7664d2` — feat(messenger): improve contacts groups and member profiles.
- `94a563f` — feat(messenger): add inline member mention autocomplete.
- `95c2de2` — fix(profile): propagate avatar updates and exercise persistence.
- `8b7753c` — feat(ui): reuse member cards across messenger and people.
- `2361913` — fix(ui): resolve focus touch layout and conversation regressions.
- `34e30e7` — fix(messenger): retain thread context and avoid touch hover collisions.
- `42e1765` — fix(app): stabilize caret recovery and compact conversations.
- `f0be567` — fix(messenger): make member card actions keyboard reachable.
- `2568b77` — test(messenger): cover enhanced web and desktop journeys.
- `6d7cb10` — fix(ui): clarify picker recovery and keep photo focus visible.
- `f2e3cae` — test(presence): verify gateway renewal and inspect reply query plans.
- `1da005a` — test(e2e): stabilize production browser acceptance within real limits.
- `c630ab9` — fix(presence): recover failed availability preference requests.
- `a1e4117` — test(ui): align native scrollbar and presence fixtures with real behavior.
- `b214d89` — test(e2e): restrict the isolated API to IPv6 loopback.
