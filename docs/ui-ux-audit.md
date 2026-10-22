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
