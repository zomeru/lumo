# UI/UX audit and implementation record (2026-10-22)

Scope: shared Web/Electron renderer, plan 08. Baseline uses real authenticated API requests in a generated schema inside the dedicated `_test` database. No development user data is changed. User-provided plan/reference files remain unmodified.

## Baseline evidence

Agent-browser captured public landing/about/contact/security/legal pages, workspace selection/setup, home, Settings, Members, Messenger, Calendar, Meetings, People, Drive/file modules and HR pages. Screenshots, accessibility snapshots and overflow measurements are retained locally in `.local/ui-audit/before` (synthetic accounts only). Light/dark and compact viewport follow-up results are recorded below as completed. Contacts redirects to People; Documents/Files aliases reuse the existing file modules. Reference: `docs/ui_samples/messenger-slack-like-ui/Slack-adds-threads-sidebar.jpg`.

## Prioritized inventory

| Priority | Finding | Evidence/cause | Resolution |
| --- | --- | --- | --- |
| P0 | Messenger actions occupy timeline rows even at rest | Live timeline and `MessageItem` disclosure; six hard-coded reaction buttons | Context toolbar, accessible overflow and searchable picker |
| P0 | Threads lack original context | Thread renders reply-only history | Return parent in authorized history response; separate context region |
| P0 | No online/DND state | No durable presence model; sockets already authenticated per workspace | Expiring PostgreSQL connection leases; stored DND; bounded authorized queries |
| P0 | Mention workflow requires separate checkbox mode | Composer appends names and independent IDs | Inline autocomplete with tracked ranges, stable IDs and private scope |
| P0 | Avatar picker duplicates label/native controls | Profile editor renders visible native file field | One styled picker, explicit separate photo save, actual persistence investigation |
| P1 | Settings/activity outer widths differ | Screenshot `before/light_w_*_settings`; form section alone has `max-w-3xl` | Equal-width outer cards; constrain readable form inside |
| P1 | Pin view has no explicit return/jump | Filter replaces timeline/composer | Active view, Back to messages and original-message link |
| P1 | Reply previews omit participants | DTO only returns count | Batched latest three distinct responders |
| P1 | DM sidebar only lists existing chats | No member suggestions; group selection lacks selected chips | Bounded suggestions and clearer selection/confirmation |
| Investigate | Contacts alias triggered one CDP evaluate timeout | Browser recovered in new tab; no confirmed application failure yet | Recheck alias and browser errors |

Existing safeguards to retain: auto-enrolled public channels, privileged channel creation, participant-only DMs/private channels, immutable group membership, sender-only editing, nonce deduplication, authorized private attachments, escaped message text and authenticated avatar URL resolution through Electron transport.

## Validation ledger

Implementation milestones, exact commands, screenshots, commits and host limitations will be recorded here. Baseline screenshots establish observations; static findings above are identified separately from visually reproduced failures. Windows/macOS native behavior cannot be validated on this Linux host.

## Completed work

- **Phases 1–2:** neutral blue brand, semantic success/warning/error/information palettes, selected/pressed states, readable metadata, shared compact controls/cards and visible keyboard/forced-colors focus. Settings and activity now share full-width outer cards; readable form width is constrained inside. Empty activity is explicit.
- **Phase 3:** one visible photo chooser, separate Save photo guidance, crop controls locked during submission, same-file retry after decode failure, immediate session identity refresh and workspace invalidation after save/removal. The hidden input stays out of the keyboard tab order. Private upload, re-encoding and authorization remain intact.
- **Phases 4–5:** grouped timeline, contextual actions and touch overflow, lazy searchable emoji in composer/reactions, pin highlight/back/original-message navigation, independently bounded thread parent and replies, and three recent distinct respondent avatars with exact reply totals.
- **Phase 6:** bounded alphabetical DM suggestions, existing-conversation reuse, explicit group selection/chips, durable multi-session availability, DND preference and shared accessible member cards in Messenger and People.
- **Phase 7:** caret-positioned inline mention suggestions in messages/replies, keyboard/touch selection, stable IDs and range tracking, safe rendering and server-side edit authorization.
- **Phase 8:** compact thread back navigation, touch/hover collision prevention, keyboard access to profile-card actions, caret race correction, and recoverable session-refresh errors without falsely requiring sign-in, plus availability-preference error/retry feedback.

### Avatar investigation: observation versus hypothesis

The existing private upload did succeed against real S3 before the redesign. A storage write defect was **not** reproduced. Two confirmed problems were the duplicate chooser/unclear separate-save flow and stale cached identity after successful mutation. The implementation addresses those problems, adds content-free cross-client invalidation and tests storage/persistence instead of claiming an unobserved storage root cause. Tests cover bad type/size/decode, failed save/retry, crop, cancellation, upload, replacement and removal. Real storage acceptance additionally covers reload, workspace switching, sign-out/sign-in and Electron restart. On Linux without an OS-protected keyring, the existing secure policy requires signing in again after restart; the photo persists after that authentication.

### Additional observed defects resolved

| Finding | Resolution/evidence |
| --- | --- |
| Hover cards intercepted a nearby touch action | Enable automatic hover only for actual mouse/hover-capable inputs; explicit touch activation |
| Profile card opened on keyboard focus but its Message action was hard to reach | Enter/Space/ArrowDown enter the card; Escape and Tab/Shift+Tab restore or advance focus |
| Deferred textarea selection could overwrite rapid typing | Restore caret before paint with layout effects; retry/send regression passes |
| Thread parent vanished when scrolling or crowded replies at 600×540 | Separate bounded parent region and a dedicated compact thread header; parent and reply visually inspected together |
| Hidden underlying timeline could advance read state on mobile thread view | Check actual visibility before recording reads |
| Session refresh failure offered misleading sign-in recovery | Connection interrupted state retries the existing session; real 401 still clears/redirects |
| Contacts alias stalled one browser automation evaluation | Rechecked successfully; Contacts redirects to People; no application alias defect reproduced |
| Long automated journeys exhausted real API/signup limits | Test-only pacing at workflow boundaries; production limits and authorization unchanged |
| Scrollbar resize fixture depended on changing About-page content height | Hide only the page root inside that synthetic fixture; retain real document scroll/resize/navigation checks |

## Visual and accessibility evidence

Agent-browser recorded **216 workspace/public route snapshots**, plus **16 sign-in/registration captures**: 27 routes in light/dark at 1440×1000, 600×540, 820×1100 and 390×844. This includes landing, About, Contact, Security, three legal pages, workspace selection/setup/home/settings/members, Messenger, Calendar, Meetings, People, Drive, Docs/Sheets/Slides/Wiki and all five HR screens. Contacts/file aliases were checked separately. Screenshots and snapshots are in `.local/ui-audit/after`; the additional auth matrix also covers both themes and all four sizes. Desktop contact sheets were visually reviewed; Settings, crop, emoji/skin tone, pins, threads and member overlays were interacted with directly. Captures that initially reached the API rate limit were repeated at a sustainable pace. The final route measurements have no horizontal overflow or error-only pages.

Representative local evidence (ignored artifacts with synthetic test identities):

- `after/settings-aligned-light/screenshot-1792647500674.png`: equal Settings/activity card edges.
- `after/settings-aligned-compact/screenshot-1792647539639.png`: equal card edges at compact width.
- `after/emoji-tone-dark/screenshot-1792647154529.png`: searchable dark picker and skin-tone interaction.
- `after/thread-compact-final-dark/screenshot-1792648360494.png`: parent and reply remain readable at 600×540.
- `.local/ui-audit/desktop-results`: native Electron Messenger, pins, threads and compact light/dark captures.

Measured Settings cards: desktop left 280/width 1120 for both; compact left 16/width 568 for both. Automated axe 4.12 checks on sign-in, Settings and the open thread reported **zero violations**; Settings/thread each retained one manual-review item. These checks supplement keyboard interaction and token contrast tests; they are not a whole-product accessibility certification.

## Operations and delivery

Migration `0021_stale_wonder_man` is additive and must be deployed before the new API. It has been exercised in fresh isolated test schemas; this task does not migrate a production database. DND advertises availability only and does not suppress notifications. PostgreSQL is the durable multi-instance presence coordinator; notifications are invalidation hints, never the source of truth. See `docs/messenger-implementation-notes.md` for lease, privacy and performance details and `docs/ui-ux-delivery-report.md` for final commands, results and commit history.

Linux Web/mobile emulation and Electron were available. Native Windows/macOS window, keychain and rendering behavior remains unverified on this host. Optional live Agora/native screen capture tests retain their explicit opt-ins. No private bucket policy or production authentication limit was widened for testing.
