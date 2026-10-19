<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:

- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Lumo development guidance

- Stack: React + Vite + strict TypeScript, TanStack Router file-based routing, Tailwind CSS v4 via its Vite plugin.
- `apps/web` owns browser bootstrapping; `packages/app` owns shared web/desktop routes, screens, and query composition; `packages/ui` owns DOM primitives/styles. `packages/typescript-config` owns shared compiler settings. Add shared runtime packages only for actual reuse; do not scaffold future product features or applications.
- Use `@lumo/*` package names, declared package exports, and `workspace:*` internal dependencies. Never import another workspace's source through relative paths. Use package exports across boundaries and package-local relative imports within shared packages.
- Use Oxlint and Oxfmt exclusively. Their scripts, dependencies, and shared configs belong to the repository root; do not duplicate lint or format scripts in applications or packages. Root `pnpm lint` enables type-aware rules; staged hooks use fast source checks and formatting only. For a scoped check, run `pnpm exec oxlint --type-aware --deny-warnings apps/web` or `pnpm exec oxfmt --check apps/web` from the root.
- Install with `pnpm install`. Use `pnpm dev`, `pnpm build`, `pnpm check-types`, `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`, `pnpm deps:check`, `pnpm deps:unused`, and `pnpm boundaries`. `pnpm check:all` runs the complete CI gate.
- Scope package scripts with `pnpm --filter @lumo/web <script>` and Turbo commands with `--filter=@lumo/web`. Filter root tests with `pnpm test --project web`.
- Add shared web/desktop routes in `packages/app/src/routes`. Never edit `routeTree.gen.ts`: the Vite plugin and `routes:generate` generate it. It is Git/lint/format ignored and included by TypeScript. Type checking must work on a fresh checkout without starting Vite first.
- Keep the TanStack Router Vite plugin before the React plugin. Tests reuse Vite configuration with route splitting disabled in test mode.
- Colocate unit and integration tests as `*.test.{ts,tsx}`; React tests use Testing Library and jsdom. Workspaces own `vitest.config.ts`; root Vitest discovers projects and configures coverage. Avoid exporting components solely for testing.
- API configuration is validated through `@lumo/env/server` and documented in `apps/api/.env.example`; integration tests require a dedicated `TEST_DATABASE_URL` ending in `_test`. Browser configuration is optional and documented in `apps/web/.env.example`; expose only browser-safe `VITE_*` values. Vite loads frontend environment files; Turbo must hash variables and files affecting cached builds.
- Preserve existing user edits and planning material under `docs/`. README documents the current foundation; those documents describe future plans. Oxfmt excludes that material.
- Keep dependencies pinned and run `pnpm install` after Syncpack fixes. Commit messages must follow Conventional Commits; hooks are installed by Husky during installation.

- The TanStack route generator has a version-scoped pnpm patch to use Oxfmt internally. When upgrading it, review the patch, override, and package extension together; keep the extension’s Oxfmt version aligned with the root manifest.
