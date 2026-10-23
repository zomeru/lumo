# LumoLynk rollout

The product name is **LumoLynk**. Lowercase identifiers use **lumolynk** and workspace packages use **@lumolynk/**. The logo and desktop icon artwork are unchanged.

## Hosted configuration

- Update DigitalOcean App Platform build/start commands to use `@lumolynk/api`, for example `pnpm --filter @lumolynk/api build` and `pnpm --filter @lumolynk/api start` from the repository root.
- Set an explicitly configured email sender display name to `EMAIL_FROM_NAME=LumoLynk`. Keep the verified sending address and provider credentials.
- The Cloudflare Worker configuration now names the Worker `lumolynk`. Coordinate the existing `lumolynk.com` custom-domain binding when deploying the renamed Worker. The API remains at `https://api.lumolynk.com`.
- Update the Spaces CORS rule for packaged desktop clients to allow `lumolynk://app`, with `PUT`, `GET`, `HEAD` and the required request headers. Keep `https://lumolynk.com` allowed. See [the production rule](drive-cors.production.json).
- Custom ONLYOFFICE themes now use the `theme-lumolynk-light` and `theme-lumolynk-dark` IDs and filenames. Update any document-server theme provisioning to the files in `packages/ui/onlyoffice/`.
- Automation and test integrations now use the `LUMOLYNK_*` environment-variable prefix. The existing `VITE_*`, `MAIN_VITE_*`, `DESKTOP_*` and API configuration variable names remain unchanged.

Source edits do not rename provisioned databases, storage buckets or hosted resources. Keep connection settings pointed at the existing resources unless migrating them separately. No database schema or stored workspace content changes are required.

## Desktop builds

The desktop product is `LumoLynk`, the application ID is `com.lumolynk.desktop`, the executable is `lumolynk`, and the renderer origin is `lumolynk://app`. The preload bridge and IPC channels use the same lowercase identifier.

Build with public production origins before packaging:

```sh
MAIN_VITE_API_URL=https://api.lumolynk.com MAIN_VITE_WEB_ORIGIN=https://lumolynk.com pnpm --filter @lumolynk/desktop build
pnpm --filter @lumolynk/desktop dist
```

Build the installer on its target operating system. The new application identity may use a separate OS profile and require signing in again. This release does not move an existing desktop profile or preserve the previous protocol as an alias.
