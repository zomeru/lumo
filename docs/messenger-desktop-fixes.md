# Messenger and Desktop fixes

Date: 2026-10-22. This follow-up completes the six requested fixes after plan 08. Web and Desktop share the implementation; no runtime dependencies or database migrations were added.

## Changes and root causes

| Issue | Cause and resulting behavior | Main files |
| --- | --- | --- |
| Outline emoji / different numbers | Linux has Noto Color Emoji installed, but text presentation/fallback could choose monochrome glyphs. The initial `font-variant-emoji: emoji` fix also routed ASCII digits through that font. `unicode` now respects Unicode presentation: plain numbers use DejaVu Sans on this host; emoji sequences use Noto Color Emoji. The native picker has its own explicit color-font stack. | `packages/ui/src/styles.css`, `tests/emoji-flow.ts` |
| Generic attachments | The old message row rendered every attachment as a download link; video and most document MIME types were not accepted. Shared format metadata now covers supported images, GIF, MP4/WebM, PDF, text, Office documents and archives. Cards show thumbnails or type icons, name, type, size, download and the existing unscanned label. | `packages/contracts/src/messenger-attachments.ts`, `packages/app/src/features/messenger/attachment-list.tsx` |
| Media gallery | Shared dialogs now display images/GIFs and native video controls, previous/next buttons and arrow keys, Escape/focus return, download and external open. Errors have a retry that reauthorizes; video recovery retains playback position. Long names wrap; layouts fit mobile and minimum-size Electron. | `packages/app/src/features/messenger/media-viewer.tsx` |
| Private previews | The new preview action reuses the immutable storage lifecycle and download authorization. It requires a ready file posted to an accessible, undeleted message. Only supported media receive inline disposition; documents/archives remain downloads. Electron resolves external destinations in the main process and validates their HTTPS S3 host. | `apps/api/src/modules/messenger/messenger-files.ts`, `apps/desktop/src/main/drive-download.ts` |
| Desktop minimum | The existing 600 × 540 minimum was enforced by Electron on this host, but left little space for Messenger. It is now 960 × 640; a real native resize request to 250 × 200 clamps to that minimum. Existing custom window controls/state handling are retained. | `apps/desktop/src/main/index.ts`, `tests/desktop/desktop.spec.ts` |
| Thread placeholder | Both contexts reused the same placeholder. The composer now chooses `Reply...` from its existing parent-message context; main messages retain `Message your team · @ to mention`. | `packages/app/src/features/messenger/message-stream.tsx` |
| Reply-summary presence | Summary avatars used the presence-aware member avatar. They now use the existing plain avatar with the same sizing/arrangement. Author, member-list and profile presence remain available. | `packages/app/src/features/messenger/message-item.tsx` |
| Attachment action | Both composers now use an icon button matching Emoji, with the shared `Attach file` tooltip, accessible name and focus styles. The file input has its distinct `Choose attachment` label. | `packages/app/src/features/messenger/message-stream.tsx` |

## Verification

- `VITEST_MAX_WORKERS=2 pnpm check:all`: **630 tests in 68 files passed**, including formatting, type-aware lint, boundaries, dependency/unused checks and all workspace types. Coverage: **94.93% statements, 90.14% branches, 93.19% functions, 96.34% lines**; thresholds unchanged.
- `pnpm build`: **all four production tasks passed**, including Web and Electron.
- Focused API/contracts/signature checks: **24 tests passed**. Viewer/composer/Desktop boundary checks: **36 tests passed**. Tests cover unsupported formats, failed media, reauthorization/retry, video resume, native-control arrow handling, gallery navigation, focus return, private outsiders/admins, wrong workspace, unposted/deleted attachments and external destination rejection.
- Live private storage acceptance: actual PNG, generated two-frame looping GIF, synthetic VP8 WebM and H.264 MP4 uploads, decoded thumbnails, gallery navigation, video playback, light/dark themes and card/gallery downloads passed in desktop Chromium, mobile Chromium and isolated Linux Electron. Desktop ran at **960 × 640**, verified native saved bytes and the main-process external-open handoff. The final native journey also requires a connected Messenger socket.
- Agent-browser inspected a real uploaded attachment, numbers/emoji in a persisted message, native picker, attachment tooltip and a long filename at **393 × 852**. The gallery had no horizontal overflow. axe 4.12.1 reported **zero WCAG A/AA violations** and three manual-review categories. The unsupported ARIA label on the generic message-action wrapper was removed; individually named controls remain. Modal focus guards and image-overlaid contrast were reviewed in the actual layouts.
- Actual Chromium glyph selection was inspected through CDP, rather than inferring it from CSS font names. Plain `0123456789` used the text font; `😀👍🎉☕❤️🇵🇭👩🏽‍💻1️⃣` used the emoji font. Shared browser and Electron acceptance retain this regression check.

| Broader acceptance | Result |
| --- | --- |
| `pnpm test:e2e --project chromium` | 10 passed; three live-storage cases opt in separately |
| `LUMO_LIVE_AVATAR_STORAGE=1 pnpm test:e2e --project mobile-chromium` | 10 passed; two Messenger storage cases separate; mouse thumb dragging inapplicable to touch |
| `LUMO_LIVE_AVATAR_STORAGE=1 xvfb-run -a pnpm test:desktop` | 7 passed; four native window-manager/live-RTC opt-ins unrun; private media passed separately |
| Private media journeys | One passing journey each in Web, mobile Chromium and Electron, both themes; additional focused reruns during implementation |

## Reproduction and local evidence

Run normal projects separately with `pnpm test:e2e --project chromium`, `pnpm test:e2e --project mobile-chromium`, and `xvfb-run -a pnpm test:desktop`. Native/live-provider opt-ins remain explicit. Run the new private-storage journeys with `LUMO_LIVE_MESSENGER_STORAGE=1` and `-g 'live private media thumbnails'` (Web) or `-g 'private Messenger media plays'` (Desktop).

Use an origin already allowed by the bucket. Web live-storage runs use the existing allowed `http://localhost:3000` / `http://localhost:3001` origins with isolated IPv6 listeners and `--host-resolver-rules=MAP localhost [::1]` in the ignored `.local/messenger-fixes/playwright.media.config.ts`.

Desktop uses a dedicated explicit IPv4 loopback API for both Node HTTP and advertised sockets; readiness waits for the test server's startup output. Its normal port is 3011. For native live storage, use `LUMO_E2E_WEB_ORIGIN=http://localhost:3000`, `LUMO_E2E_API_ORIGIN=http://localhost:3021` and `.local/messenger-fixes/playwright.media-desktop.config.ts`. Port 3021 keeps the IPv4 development API on 3001 untouched. The bucket already permits `lumo://app`; no CORS change is needed. The test bootstrap permits only IPv4/IPv6 loopback hosts.

A launcher-isolation mistake was found during broad native acceptance: this WSL hosts file resolves Node's `localhost` only to IPv4, so earlier media checks reached the development API. Those results were rerun against the isolated API. Exactly three synthetic accounts, their three sole-member personal workspaces, 13 attachments and 26 staging/content objects were identified and removed; absence of the accounts was verified afterward. Unrelated development data was preserved. DNS-order changes alone did not solve this host setup. Explicit, consistent loopback origins now prevent both wrong-server access and socket/CSP mismatch. Test shutdown cleans the isolated schemas and their synthetic storage objects.

Logs, a11y details and inspected screenshots remain ignored under `.local/messenger-fixes`; synthetic accounts and auth data are not committed. Representative captures include `screenshots/browser-message-numbers.png`, `screenshots/browser-emoji-picker.png`, `screenshots/browser-long-filename.png` and `screenshots/mobile-gallery-dark.png`.

## Limits

Native Windows/macOS rendering and window-manager behavior were unavailable on this Linux/Xvfb host. Existing native maximize/minimize/fullscreen and live RTC/screen-capture opt-ins are distinct from these media-file checks. External-open acceptance verifies a fresh authorized URL reaching Electron's shell boundary; it substitutes the shell operation rather than launching an uncontrolled external browser. Unit tests cover shell failures and destination validation.

Supported codecs depend on the host Chromium/OS; unsupported playback shows a recoverable error and retains download/external open. Uploaded videos have no separate caption track; native controls remain keyboard accessible. Files remain explicitly unscanned. Previously issued private URLs can remain usable for their existing 120-second lifetime after revocation. Existing large Office/RTC bundle warnings remain.

## Commits

- `e6a3671` — context-aware replies, plain summary avatars and icon attachment actions.
- `05c1c02` — usable Electron minimum dimensions and native resize checks.
- `eeca847` — color emoji presentation and native-picker font configuration.
- `d1ae9ad` — preserve normal digits with Unicode emoji presentation and actual-font checks.
- `076eeeb` — shared attachment formats and authorized private media previews.
- `78508b1` — bounded Desktop media external-open bridge and video CSP.
- `c2f6750` — shared attachment cards, gallery, failure recovery and component tests.
- `f94924a` — wrap long gallery filenames on narrow screens.
- `b7f8446` — real private-media and composer acceptance on Web/mobile/Electron.

- `b27a547` — remove the unsupported generic-wrapper ARIA label found in manual review.
- `f42c31f` — consistent, isolated native loopback API/socket configuration and startup readiness.
- `0ba0c2d` — decoded video thumbnails and original card/gallery download acceptance.
