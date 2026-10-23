# Transactional email

`@lumolynk/auth` renders verification content in `verification-email.ts` and keeps authentication rules in `server.ts`. Delivery goes through the `EmailProvider.send` interface. `createEmailProvider` selects a provider strictly from the validated `NODE_ENV`; there is no provider override.

| Environment | Provider | Behavior |
| --- | --- | --- |
| `production` | `ResendEmailProvider` | Sends through the official Resend SDK over HTTPS. Invalid settings prevent startup; delivery failure propagates an actionable error. Never writes an outbox or falls back to files. |
| `development` (default) | `FileEmailProvider` | Writes JSON previews locally. Never calls Resend, even with credentials configured. |
| `test` | `FileEmailProvider` | Uses the same file delivery as development. Integration tests use temporary directories; browser/native acceptance tests use `.local/e2e-mail`. |

## Production configuration

Set these variables only in the API runtime's secret/environment configuration:

```dotenv
NODE_ENV=production
RESEND_API_KEY=<your sending API key>
EMAIL_FROM=noreply@notify.lumolynk.com
EMAIL_FROM_NAME=LumoLynk
```

`RESEND_API_KEY` must be nonempty and `EMAIL_FROM` must be a plain email address at `lumolynk.com` or one of its subdomains, such as `noreply@notify.lumolynk.com`. Verify the actual sending domain in Resend; local validation only checks the address and domain boundary, not provider verification status. The display name defaults to `LumoLynk` and rejects header characters. HTTPS `API_ORIGIN` and `WEB_ORIGIN`, `DATABASE_URL`, and `BETTER_AUTH_SECRET` remain required. `MAIL_DIR` is ignored in production. Credentials are read at runtime and must never be placed in `VITE_*` variables, frontend/desktop environment files, source code, logs, or committed `.env` files. Create a sending-only Resend key scoped to the verified domain when possible.

The API bundles the pinned Resend SDK; only `@lumolynk/auth` declares it as a runtime dependency. The Turbo API development task allows the new server variables through without exposing them to frontend tasks.

## Domain and DNS setup

1. Open the [Resend Domains dashboard](https://resend.com/domains) for the production team and confirm that the actual sender domain (`notify.lumolynk.com` for the example above, or `lumolynk.com` for a root-domain sender) is verified for **sending**. If it is not already present, add the domain in your chosen region.
2. In the domain's **Records** tab, copy every required record exactly into the authoritative DNS provider, including its type, host, value, TTL and MX priority where shown. Values depend on your domain, region and account; do not substitute example keys or endpoints.
3. Verify the records in Resend and wait until sending is verified. Create a sending API key for that domain and configure the API runtime. Verification is an operator step; startup validation checks local configuration and sending errors reveal revoked keys or domain issues.
4. Deploy and perform a controlled signup/verification smoke test with an inbox you own. Confirm delivery and the callback to `/workspaces`. Check the Resend dashboard for acceptance and delivery; API acceptance alone does not guarantee inbox delivery.

Resend's [current domain documentation](https://resend.com/docs/dashboard/domains/manage-domains) describes two possible sets of DNS records:

| Purpose | Records to configure |
| --- | --- |
| DKIM | The domain-specific TXT record shown by Resend, typically at `resend._domainkey.lumolynk.com`, with its generated public key. |
| SPF and return-path feedback | For legacy setups, the displayed SPF TXT and bounce/complaint MX records at the return-path subdomain (typically `send.lumolynk.com`). Domains created after August 2026 may instead receive CNAME records; copy the exact set shown in the dashboard. |
| DMARC (recommended) | Review the existing TXT policy at `_dmarc.lumolynk.com` and ensure it matches your organization's authentication policy. Follow [Resend's DMARC guide](https://resend.com/docs/dashboard/domains/dmarc); avoid creating duplicate policies. |

Keep existing root-domain MX records for your mailbox provider. Sending does not require enabling Resend receiving or moving inbound mail. Keep authentication-link click tracking disabled to avoid rewriting verification URLs.

## Development, previews, and tests

No Resend account or key is needed in development, test or CI; an unused blank key is also allowed. Sender-domain restrictions apply only when `NODE_ENV=production`; local previews can use any valid sender email address. `MAIL_DIR` defaults to `../../.local/mail`, resolved relative to the API working directory (`apps/api`). Directories are created with mode `0700` and files with mode `0600` on POSIX. Each email gets a timestamp/UUID JSON filename. Previews retain `to`, `subject` and the action `url` used by existing debugging and acceptance tests, and also include `from`, `text`, and optional `html`.

Read a JSON file in that directory to preview the content and open its `url` to complete verification. The outbox is never served by HTTP and contains live tokens, so keep it private and out of source control. Filesystem failures report `MAIL_DIR`/permission guidance without echoing content.

The verification email includes a personalized HTML template using the same platform-independent colors, typography and radii exported by `@lumolynk/ui/tokens`. It mirrors the platform's `lumolynk.` wordmark, surface cards and primary action, with a one-hour expiry notice and a copyable fallback link. Inline styles and presentation tables provide a baseline for mail clients; supported clients also receive responsive spacing and the platform's dark palette. It requires no remote images, fonts, React renderer or Tailwind runtime. Names and links are escaped in HTML, and the existing plain-text body and JSON `url` remain available. To inspect the design locally, extract the JSON's `html` into a private `.html` file and open it in a browser; never publish previews containing real tokens.

Unit tests exercise the real Resend SDK with an intercepted `fetch` transport and synthetic credentials. Every provider request is intercepted, including retries and failures. Normal application integration tests explicitly use `NODE_ENV=test` and local files. Run `pnpm test --project auth --project env` for focused coverage, or the repository's full `pnpm check:all` gate.

## Failure handling

Each send allows at most three attempts, with a ten-second timeout per request, exponential backoff and jitter. Network failures, request timeouts, server errors, rate limiting, and concurrent idempotent requests can retry. Retries reuse one random idempotency key and the same payload to prevent duplicates; separate sends receive separate keys. See [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

`Retry-After` seconds and HTTP dates are respected within a 30-second delay budget. A longer requested wait fails explicitly so the operator/caller can retry later. Invalid credentials, unverified domains, invalid payloads, idempotency conflicts and daily/monthly quota errors fail without retries. Check the key, domain status, configured sender and sending quota for permanent failures, and [Resend status](https://resend-status.com/) for service failures. There is no durable queue or automatic retry after the call has failed.

Structured warning/error logs contain only the provider, attempt number, numeric status and retryability. Provider response messages, original exceptions, recipients, bodies, action links, tokens and API keys are excluded. Application mail errors use fixed actionable messages.

## Existing workflow scope

Account verification is currently the only generated email: signup and verification resends use the same existing subject, plain-text content, one-hour token expiry and trusted `/workspaces` callback. Workspace invitations remain manually shared, email-bound links; password-reset endpoints are not enabled by the API. This migration preserves those workflows. Any future transactional email should render its content in business logic and call the same provider interface, which supports plain text, optional HTML and local preview links.
