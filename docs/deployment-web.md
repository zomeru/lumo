# Deploy the web frontend to Cloudflare Workers

This guide deploys only `apps/web`: the React + Vite SPA and its static assets.
Cloudflare serves **https://lumolynk.com**. The existing API runs on a separate
host (for example, DigitalOcean) at **https://api.lumolynk.com**. This deployment
does not build, migrate, or deploy the API, database, or Electron app.

## Configuration

- `apps/web/wrangler.jsonc` defines the Worker `lumo-web`, the custom domain
  `lumolynk.com`, and the SPA fallback to `index.html`. There is no Worker API
  entrypoint or server binding. `workers.dev` and version preview URLs are disabled.
- `apps/web/vite.config.ts` adds the Cloudflare Vite plugin after the framework
  plugins. TanStack route generation stays before React. Test mode excludes the
  Cloudflare plugin.
- The browser TypeScript configuration uses DOM types. Keep Wrangler-generated
  `worker-configuration.d.ts` out of `tsconfig.app.json`: Workers runtime globals
  conflict with browser DOM declarations such as `Element`. This asset-only
  frontend does not need Worker runtime types; future Worker code should use a
  separate TypeScript configuration.
- `vite build` writes the frontend and generated `wrangler.json` to `apps/web/dist`.
  The plugin determines the assets directory; do not add a manually maintained
  `assets.directory` to the source Wrangler config.
- `.wrangler/deploy/config.json` points Wrangler to the generated configuration.
  Turbo caches it with `dist/**` for the web build. Local Worker state and
  `.dev.vars*` files are Git-ignored.
- `pnpm-workspace.yaml` pins the plugin's Miniflare runtime to the newer workerd
  patch also used by Wrangler, which fixes local preview startup in this setup.
  Recheck that version-scoped override when upgrading the Cloudflare plugin.

The plugin/Wrangler configuration and build-before-deploy/dry-run commands follow
the conventions in [zomlab](https://github.com/zomeru/zomlab/tree/main/apps/web),
adapted to Lumo's client-rendered frontend.

## Prerequisites

Use Node **24.21.0+** and the repository's pinned pnpm **11.25.0**. Run every
command below from the repository root.

```sh
pnpm install --frozen-lockfile
```

The Cloudflare account must have the `lumolynk.com` DNS zone active and permission
to deploy Workers and manage the custom domain. If the apex already has a DNS
record or another Worker attached, review that existing configuration before
deploying. Wrangler configures the custom domain and its certificate on deploy.

## Set the public API origin

Create `apps/web/.env.production.local` (Git-ignored) containing:

```dotenv
VITE_API_URL=https://api.lumolynk.com
```

Alternatively, set `VITE_API_URL` in the build environment. It must be an exact
origin without a path or trailing slash. This browser-visible value is embedded
by Vite at **build time**. Rebuild and redeploy after changing it; Wrangler `vars`
or dashboard runtime variables cannot change an already built browser bundle.
Never put database credentials, API secrets, or Cloudflare tokens in `VITE_*`.

The Vite `/api` proxy points to localhost during development only. It is not
deployed. With an empty `VITE_API_URL`, a standalone frontend would send API calls
to `lumolynk.com/api`, where this asset-only deployment has no API handler.

On the separately hosted API, coordinate these existing settings:

```dotenv
NODE_ENV=production
API_ORIGIN=https://api.lumolynk.com
WEB_ORIGIN=https://lumolynk.com
```

The API host must serve HTTPS at `api.lumolynk.com` and allow the exact web origin
with credentials. Keep its existing server secrets and database configuration on
that host. Both HTTPS hostnames are same-site, so Lumo's `SameSite=Lax`, Secure,
HTTP-only session cookies work with credentialed requests. The API cookie can
remain host-only; it does not need a shared `.lumolynk.com` domain. The API's
WebSocket ingress must also support upgrade requests for realtime features.

The API can run on DigitalOcean or another suitable host; this guide does not
provision it. Authentication and data features require that API to be available.

## Build and preview locally

```sh
pnpm --filter @lumo/web build
pnpm --filter @lumo/web preview --host 127.0.0.1 --port 4173
```

Preview runs the built assets locally through Cloudflare's tooling. Check the
home page and directly open `/login`, `/register`, and `/workspaces` to verify SPA
fallbacks. Stop preview with Ctrl+C.

A production bundle points to the production API. Authentication from the local
preview origin will be rejected by the production API's exact-origin policy;
verify authenticated flows on the deployed domain. Normal local development
continues to use `pnpm --filter @lumo/web dev` and the localhost API proxy.

Validate deployment without uploading or changing a Cloudflare deployment:

```sh
pnpm --filter @lumo/web cf:deploy:check
```

This command type-checks, builds, and runs `wrangler deploy --dry-run`. It does
not validate account permissions, DNS ownership, or API reachability.

## Deploy from your machine

Authenticate with the account containing `lumolynk.com`:

```sh
pnpm --filter @lumo/web exec wrangler login
pnpm --filter @lumo/web exec wrangler whoami
pnpm web:deploy
```

`web:deploy` invokes the web package's `deploy` script, which type-checks and
builds before running Wrangler. It publishes Worker `lumo-web` and attaches
`lumolynk.com` using the committed custom domain configuration. Check the reported
domain and certificate status in Workers & Pages before testing the live site.

The shortcut uses `pnpm --filter @lumo/web run deploy`. Keep the explicit `run`:
`pnpm --filter @lumo/web deploy` can invoke pnpm's built-in deployment command
instead and fail with `ERR_PNPM_INVALID_DEPLOY_TARGET`. To validate the complete
root shortcut without publishing, run:

```sh
VITE_API_URL=https://api.lumolynk.com pnpm web:deploy --dry-run
```

## Cloudflare Workers Builds or another CI system

Connect this repository to **Workers Builds**, select the production branch,
and keep the build root at the **repository root**, so pnpm can resolve the
workspace packages and lockfile. The Cloudflare project name must match
`lumo-web` in `apps/web/wrangler.jsonc`.

| Setting | Value |
| --- | --- |
| Root directory | Repository root (`/`) |
| Node version | `24.21.0` or newer supported Node 24 release |
| pnpm version | `11.25.0` (from `packageManager`) |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @lumo/web build` |
| Deploy command | `pnpm --filter @lumo/web exec wrangler deploy` |
| Build environment variable | `VITE_API_URL=https://api.lumolynk.com` |

Workers Builds may perform installation automatically; configure its package
manager/install settings to use the frozen lockfile command above. Use its Node
version setting or `NODE_VERSION` build variable to match the repository engine.
These commands need no API secrets, database, migration, or desktop build.

For external CI, run the same install/build/deploy commands and provide
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through the CI secret store.
Use an account-scoped token with Workers Scripts Edit and the zone permissions
required for custom domain management; see Cloudflare's
[Wrangler authentication documentation](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/).
Never commit credentials or expose them as Vite variables. Workers Builds manages
its own deployment credentials.

This configuration has one production domain. Disable non-production branch
builds for this Worker. If you later add staging, give it a separate Worker, domain and
API origin, and align that API's allowed origin and cookie site.

## Verify and operate

After deployment:

1. Open `https://lumolynk.com` and refresh a deep link such as `/workspaces`.
2. In browser network tools, confirm API requests use `https://api.lumolynk.com`
   and receive JSON rather than the SPA document.
3. Sign in, refresh to restore the session, and sign out. Check that credentialed
   CORS requests and realtime WebSocket connections succeed.
4. Open an unknown application path. Lumo should show its branded not-found page;
   SPA document fallback can return HTTP 200 while the UI displays a 404 view.

For failed sign-in, check the built `VITE_API_URL`, API HTTPS certificate,
`WEB_ORIGIN`, and cookie settings. For old frontend assets, confirm a new build
was deployed. For missing generated configuration, rebuild from the workspace
root before invoking Wrangler from the web package.

To roll back, use the Cloudflare dashboard's deployment history or run
`pnpm --filter @lumo/web exec wrangler rollback` and review its confirmation.
Coordinate client/API compatibility when rolling back. Asset-only traffic does
not execute application Worker code, so browser network tools and API host logs
are the primary debugging sources for application errors.

## References

- [Cloudflare React + Vite guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Vite plugin static assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
