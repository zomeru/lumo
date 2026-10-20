# ONLYOFFICE appearance integration

## Current behavior

Docs, Sheets and Slides now open with the signed `editorConfig.customization.uiTheme = "theme-system"` setting. Lumo's existing theme CSS sets `color-scheme: light` or `dark` on the page; the browser exposes that scheme to the embedded editor's `prefers-color-scheme` query, including across origins. This follows Lumo's Light, Dark and System choices on web and Electron.

The editor configuration remains static throughout an editing session. Appearance changes do not fetch a fresh configuration, replace the iframe, restart coediting, or clear undo/selection/drafts. This is intentional: the official React wrapper recreates its editor when the serialized configuration changes. No CSS injection, undocumented provider commands or cross-origin DOM access were added.

If a user previously selected a specific theme inside ONLYOFFICE itself, its saved preference takes precedence over `uiTheme`. Select the system-following option in the editor's View → Interface Theme menu to let Lumo control appearance again. Lumo does not erase the provider's per-user preferences.

The active Cloud editor uses its built-in light/dark palettes. The supported API alone does **not** give this application server access to install an exact Lumo palette. Consequently, the current result matches appearance mode; toolbar backgrounds and accents are not yet an exact match for Lumo's brand colors.

## Exact Lumo palette files

Generated from the existing semantic palette in `packages/ui/src/tokens.ts`:

- `packages/ui/onlyoffice/theme-lumo-light.json`
- `packages/ui/onlyoffice/theme-lumo-dark.json`

These map the platform's surfaces, primary colors, text, icons, borders, focus rings, hover/pressed states, editor workspace, rulers and scrollbars to ONLYOFFICE's documented theme keys. The document/page background remains white; interface customization does not change stored document formatting.

Regenerate both the existing CSS and these files with:

```sh
pnpm --filter @lumo/ui theme:generate
pnpm exec oxfmt --write packages/ui/src/theme.css packages/ui/onlyoffice
```

The existing UI type-check task checks that generated Office files still match the design tokens. No separate palette or dependency was introduced.

ONLYOFFICE documents theme installation in the document server's `web-apps/apps/common/main/resources/themes` directory. Whether this Cloud plan permits custom-theme installation, and who could perform it, has not been confirmed. This application cannot perform that filesystem operation through Docs API. For a controlled self-hosted deployment, the same directory is available inside the server/container.

The installed theme identifiers are `theme-lumo-light` and `theme-lumo-dark`. They must not be selected in production configurations before installation and validation on the actual tenant. Selecting a specific custom identifier is different from the current system-following mode; coordinated light/dark selection must be verified with the tenant's supported capabilities before replacing the live-switching integration. No Cloud settings, hosting model or licenses were changed by this work.

## References

- [ONLYOFFICE theme configuration and preference precedence](https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding#uitheme)
- [ONLYOFFICE custom theme files and supported color keys](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/customizing-themes)
- [Browser color-scheme inheritance for cross-origin iframes](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme#embedded_elements)

## Verification

- `pnpm check:all`: passed formatting, type-aware lint, package boundaries, dependency checks, all workspace type checks, and **356 tests in 39 files**. Existing coverage thresholds remain satisfied (95.75% statements, 90.04% branches, 95.33% functions, 97.34% lines). The Office integration regression verifies that the theme is present in both the returned configuration and the signed JWT.
- `pnpm build`: passed production API, web and Electron builds. Existing upstream Agora bundler advisories remain unrelated to Office appearance.
- `pnpm test:e2e`: **13 passed, 1 skipped** across desktop/mobile Chromium. An initial run hit the existing mobile workspace-navigation timing issue; an unchanged clean rerun passed. The skipped mobile case requires a classic native scrollbar.
- `xvfb-run -a pnpm test:desktop`: **4 passed, 5 skipped**. Native window-manager controls and opt-in Agora/RTC/capture cases remain gated by the test environment.
- Actual Cloud document, sheet and presentation editors switched light → dark → light through Lumo's appearance menu. Their toolbar colors changed from the built-in `#FFFFFF` to `#404040` and back. The exact iframe and editor instances remained unchanged. Browser OS preference emulation also verified Lumo's System mode; explicit-mode inheritance was tested without a browser-wide forced media override.
- A document was edited before appearance changes and a subsequent force-save advanced its durable version. The compiled Electron application opened a shared Cloud spreadsheet, switched both ways and retained its original editor instance. Screenshots and the live comparison log are in ignored `.local/office-theme-*` artifacts.
- Guarded cleanup removed only the synthetic acceptance fixtures: **2 users, 3 workspaces, 3 files and 8 exact S3 keys**. Browser sessions and the isolated Electron profile were closed. Existing development servers, user files, Cloud tenant settings and storage configuration were preserved.

Exact Lumo theme-file deployment has **not** been performed or claimed as verified. It requires document-server access; Cloud availability remains unconfirmed. The generated JSON files are ready for installation on a supported server and validation. Development continues on the existing Cloud trial while a production quote is pending; no hosting or license change has been made.
