# LumoLynk Drive storage

Drive is implemented in `packages/app` and shared by the web and sandboxed Electron renderer. Hono owns authorization and metadata workflows; PostgreSQL owns the folder tree, workspace-scoped grants, stars, upload state and durable storage cleanup. `apps/api/src/storage/storage.ts` defines the storage interface; the production adapter uses AWS SDK v3 for AWS S3 and DigitalOcean Spaces. Other modules can store a Drive item UUID as a file reference and call this service with the authenticated actor. They must not accept object keys or issue storage URLs independently. The same adapter stores avatars, Messenger attachments, HR files and immutable Office/Wiki revisions.

## Enable Drive

1. Run `pnpm install` and `pnpm db:migrate`. Migration `0004_shiny_speed.sql` adds the Drive tables and cross-workspace foreign keys. Apply migrations before starting the updated API.
2. Select `STORAGE_PROVIDER=aws` (default) or `digitalocean` using the examples below. Both use the existing `AWS_REGION` and `AWS_S3_BUCKET` variable names. In AWS mode these are optional together; without them, metadata operations work and storage operations return `STORAGE_UNAVAILABLE`. Production DigitalOcean mode requires all connection settings. Development, test and CI can leave storage disabled with either provider. Never use `VITE_*` for credentials.
3. Use a dedicated **private** bucket. For AWS S3, enable Block Public Access, bucket-owner-enforced Object Ownership, default server-side encryption and HTTPS-only access. The service leaves encryption selection to the bucket default; SSE-KMS also needs the role's narrowly scoped KMS permissions. For Spaces, restrict listing and object access, create a bucket-scoped Read/Write/Delete key, and use the regional HTTPS origin. AWS IAM roles and bucket-level encryption settings do not apply to Spaces. No public read/write policy or runtime ACL operation is needed for either provider.
4. Configure the CORS and lifecycle rules below. Set `DRIVE_MAX_FILE_BYTES` if needed (default 1 GiB; configurable up to 5 GiB), and optionally `DRIVE_ALLOWED_MIME_TYPES` as comma-separated MIME types or `image/*` style patterns. `*` accepts attachment formats subject to signature validation. The size limit applies per file; this release has no workspace storage quota.
5. Start the API with `pnpm --filter @lumolynk/api dev`, or `pnpm dev`. Storage maintenance runs every minute while the API process is running. Each batch attempts 50 due cleanup intents with exponential backoff. Monitor the `storage_cleanup` backlog and the API's cleanup failure counts; logs exclude filenames, URLs, object contents and credentials.

The bucket can remain unversioned. If versioning is enabled, S3 DeleteObject creates a delete marker: configure noncurrent-version expiration according to your retention policy. This release does not enumerate and erase historical object versions or support Object Lock retention overrides. Do not enable bucket-wide expiration on `drive/` or `office/`, which contain retained files, Office revisions and Trash contents.

## Provider configuration

All settings belong in the API environment (`apps/api/.env` locally). Restart the API after changing them. No frontend credentials or application code changes are needed to select either provider.

AWS S3 (existing configuration continues to work without `STORAGE_PROVIDER`):

```dotenv
STORAGE_PROVIDER=aws
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-drive-bucket
```

Leave `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` unset for the SDK's normal AWS endpoint and credential chain: IAM/ECS/web identity roles in production or `AWS_PROFILE`/SSO locally. API-only `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and optional `AWS_SESSION_TOKEN` also continue to work.

DigitalOcean Spaces:

```dotenv
STORAGE_PROVIDER=digitalocean
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-space
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_ACCESS_KEY_ID=your-spaces-access-key
S3_SECRET_ACCESS_KEY=your-spaces-secret-key
S3_FORCE_PATH_STYLE=false
```

The Spaces location comes from `S3_ENDPOINT`; `AWS_REGION` is the SDK signing region. Use `us-east-1` as in DigitalOcean's JavaScript SDK example. The legacy `AWS_REGION`/`AWS_S3_BUCKET` names describe S3 protocol settings and are deliberately retained for backward compatibility. Use a Spaces access key, not a DigitalOcean control-plane API token. Dedicated `S3_*` credentials override the AWS chain and exclude unrelated AWS session tokens.

The endpoint must be an origin without a path, credentials, query, fragment or trailing slash. Production DigitalOcean mode accepts a regional HTTPS Spaces origin or a bucket origin matching `AWS_S3_BUCKET`; CDN and website endpoints are rejected. Outside production, local HTTP S3-compatible endpoints are allowed with either provider, and dedicated Spaces credentials are optional. Settings supplied together must still be consistent (bucket/region and credential pairs). For example, `AWS_S3_BUCKET=lumolynk-prod` with `S3_ENDPOINT=https://lumolynk-prod.sgp1.digitaloceanspaces.com` is normalized to `https://sgp1.digitaloceanspaces.com` before configuring the SDK, so it adds the bucket exactly once. URLs are signed and returned unchanged: for example, `https://your-private-space.nyc3.digitaloceanspaces.com/drive/...`. With `S3_FORCE_PATH_STYLE=true`, URLs use `https://nyc3.digitaloceanspaces.com/your-private-space/drive/...`. The default is virtual-hosted addressing; use a DNS-compatible bucket name without dots for Spaces. Production endpoints require HTTPS.

`STORAGE_PROVIDER` accepts only `aws` and `digitalocean`. Both use the same adapter and finalization checks. The provider selector also avoids AWS-only additional-checksum options on Spaces server writes, copies and multipart initialization. AWS mode also accepts an explicit endpoint for other S3-compatible services, but their feature support requires separate validation. Electron's native download/external-open host checks and media/PDF CSP currently support AWS and Spaces origin domains; arbitrary custom domains require an explicit desktop policy change.

Selecting a different bucket does not move objects. Existing database references continue to refer to keys in the selected bucket, so their bytes must already exist there to remain readable. This change does not alter the configured provider, provision buckets or migrate files. Rollouts involving existing content need a separately planned migration or routing strategy.

## Compatibility review

The original adapter lacked explicit endpoint/credential configuration, and Electron restricted native downloads, external attachment opens and media/PDF previews to AWS domains. These gaps are fixed. The audit covered every production storage caller, frontend transfers, cleanup and connectivity checks; no additional storage SDK or independent URL builder is used outside this adapter.

| Feature | AWS S3 and Spaces behavior |
| --- | --- |
| Single PUT, Messenger/HR attachments | SigV4 URLs bind length, MIME type and SHA-256. Finalization checks size/type and compares the requested SHA-256 to the provider checksum or a streamed hash of the actual stored bytes, then conditionally copies to an immutable key. |
| Drive multipart | Part URLs bind length and SHA-256. AWS requires ListParts checksums; Spaces may omit them, so completion uses provider ETags and sizes, and finalization hashes the completed object when HEAD has no SHA-256. ETags are never treated as SHA-256 hashes. |
| Download/preview | Presigned GET includes response MIME, disposition and no-store overrides; range reads support signature validation and previews. No public object URL is constructed. |
| Copy/delete/cleanup | Copies stay within one configured bucket and use source ETag conditions. DeleteObject and AbortMultipartUpload use the same client/endpoint. Versioned historical objects are not purged. |
| Avatars, Office/Wiki revisions, ZIPs | Streams use GetObject and SDK-managed uploads, including multipart for larger output. AWS additional SHA-256 options are omitted on Spaces; stat computes SHA-256 from stored bytes when the provider omits it. |
| Access permissions | Application authorization remains in PostgreSQL/API. Objects stay private; no runtime bucket administration, IAM API, ACL mutation, ARN, KMS key or storage class is required. |
| Bucket operations | Configure CORS, prefix-based expiration and incomplete multipart cleanup outside the application. AWS-specific IAM/encryption examples require the Spaces equivalents. |

DigitalOcean documents the [required S3 commands and checksum headers](https://docs.digitalocean.com/reference/api/spaces/), [SDK endpoints and credentials](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/), and [compatibility restrictions](https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/). Providers may omit additional checksums from HEAD/ListParts. When HEAD omits SHA-256, stat streams the object through SHA-256 with an If-Match ETag condition and checks the byte count. It does not trust client-supplied metadata or use multipart ETags as whole-file hashes. This fallback uses bounded memory but adds a full object read for each stat without a provider checksum, including staging and promoted-object verification. Automated mocks cannot establish all live provider behavior; verify the upload and copy contracts in an isolated Spaces bucket before production use.

Spaces does not support cross-region/cluster copies; the adapter only copies within its one bucket. Its lifecycle support is time/prefix based; the application does not require tag filters. The compatibility guide does not support AWS bucket-level encryption configuration; this adapter does not implement SSE-C or port AWS KMS policies. Private presigned content should use origin URLs: the Spaces CDN offers no caching benefit for these transfers. See DigitalOcean's [SDK guidance](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/).

## S3 CORS

Use exact origins for your deployed web application and desktop renderer. Remove development origins in production. The packaged Electron application uses `lumolynk://app`; its development renderer uses `http://127.0.0.1:5174`. CORS controls browser access, not authorization. All objects remain private.

```json
[
  {
    "AllowedOrigins": ["https://app.example.com", "lumolynk://app", "http://localhost:3000", "http://127.0.0.1:5174"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length", "x-amz-checksum-sha256", "range"],
    "ExposeHeaders": ["ETag", "x-amz-checksum-sha256", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 600
  }
]
```

See [AWS CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html) and [presigned URL behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html). ETags and part checksums are obtained server-side during finalization; they are never trusted from the browser.

## IAM scope and lifecycle

For AWS, scope the API role to its bucket and these prefixes: `drive/*`, `drive-staging/*`, `drive-archives/*`, `office/*`, `avatars/*`, `messenger/*` and `hr/*`. Required object actions are `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload`, and `s3:ListMultipartUploadParts`. Copy uses GetObject on the source and PutObject on the destination. No bucket listing, ACL writes, bucket administration or public access is required at runtime. A bucket policy denying requests with `aws:SecureTransport = false` enforces TLS. Configure the bucket separately with an infrastructure operator role. For Spaces, use a key scoped to this private bucket with Read/Write/Delete (Objects); CORS, policy and lifecycle administration require a separate privileged operator key. Apply the same CORS rule above through Spaces' S3-compatible CORS API, and keep all objects private. Keep `avatars/`, `hr/`, `messenger/` and `office/` out of blanket expiration rules because they also contain retained content.

Add lifecycle rules to abort incomplete multipart uploads after one day on both `drive-staging/` and `drive-archives/`. Expire objects under `drive-staging/` after two days and under `drive-archives/` after one day. These rules provide a backstop when the API is stopped or an S3 response is lost before an upload ID can be persisted. PostgreSQL cleanup normally removes completed/canceled staging objects sooner and ZIPs after one hour. Use a lifecycle rule with `Filter.Prefix`, `Status: Enabled`, and `AbortIncompleteMultipartUpload.DaysAfterInitiation: 1` (plus a separate `Expiration.Days` where applicable).

Uploads at least 16 MiB use 8 MiB parts. The client runs at most two file uploads with three part transfers each, hashes each part with SHA-256, reports progress, and retries transient failures. Small uploads use checksum-bound presigned PUTs. URLs expire after 120 seconds; refreshed URLs require reauthorization. Upload sessions expire after 24 hours. Finalization checks S3's part list, count, sizes, checksums and metadata; validates the file signature; and conditionally copies from a temporary key to an immutable final key. Late writes through a temporary URL cannot modify the accepted file. Finalization is idempotent and retries recover when S3 completion succeeded but metadata promotion failed.

Direct S3 upload/download and multipart traffic incur normal S3 request, storage and data-transfer charges. Verification adds a HEAD, a bounded GET and a server-side COPY per file. ZIP downloads stream through the API to temporary S3 storage, adding API bandwidth and S3 requests; lifecycle cleanup limits their retention. See [S3 pricing](https://aws.amazon.com/s3/pricing/) for region-specific rates.

## Permissions and behavior

- Files start private to the uploader. Workspace owners/admins have management access; moderators use normal file grants. Every operation rechecks workspace membership in the backend. Mutations and URL issuance share the existing workspace lock with membership changes.
- Viewer grants allow browsing, preview, download, starring and copying content the user can download. Editors additionally upload/create children, rename and move items to Trash. Item/ancestor owners and workspace admins manage sharing, move items between permission boundaries, restore and permanently delete. Access is additive and inherited; a child viewer grant cannot downgrade an inherited editor grant.
- My Files shows owned root items; Recent, Starred and Shared With Me expose the corresponding accessible items. Shared With Me lists direct grants as entry points into inherited folder access. Search only returns authorized metadata. Breadcrumbs omit inaccessible ancestors.
- Moving an item recalculates inherited access from its new ancestry. Copying creates new metadata/object IDs owned by the caller and does not duplicate explicit grants or stars. Folder copies are limited to 100 items/512 MiB; ZIPs to 500 items/512 MiB; recursive mutations to 1,000 items; nesting to 63 levels. These bounds keep synchronous operations predictable. Folder operations reject cycles.
- Trash blocks new content URLs and retains metadata, contents and grants. Restore affects only the matching deletion batch, preserving items trashed earlier. Permanently deleting hides the entire subtree immediately, queues object deletion, and removes metadata after both keys and children are cleaned. S3 failures retain durable retry intents. Removing a workspace member cascades their grants and stars; rejoining does not restore grants.
- Already-issued URLs remain usable until expiry. Already-downloaded bytes cannot be revoked. There is no external/public sharing. Native desktop downloads reauthorize through the API in the main process and use Electron's save dialog; the renderer receives no filesystem or credential access.

Inline previews allow PNG/JPEG/GIF/WebP, PDF, UTF-8 plain text/CSV and JSON. Text previews read at most 256 KiB. HTML/SVG and other active content are attachments. The service checks common image/PDF/ZIP/Office magic signatures, UTF-8 text, and common executable signatures. This is **not an antivirus scanner**: encrypted archives, macros and malware need a dedicated scanning/quarantine pipeline before allowing untrusted organizations to exchange files. Do not describe signature checks as comprehensive malware detection.

Uploads are in-memory client jobs while the Drive page is mounted; leaving it cancels active work. Retries within that page reuse the session; resuming uploads across reloads is not implemented. Storage errors remain visible with retry actions. Large copy/archive operations run synchronously under the workspace lock; installations needing larger limits should move them to a durable background job queue.

## Verification

Run `pnpm test --project env --project api --project desktop src/env.test.ts src/storage/s3.test.ts src/main/drive-download.test.ts src/main/policy.test.ts` for both providers' configuration, real SDK presigning/credential isolation, adapter operations and Electron restrictions. These tests use synthetic credentials and intercepted SDK calls, with no provider requests. Run `pnpm lint` and `pnpm check-types` as well.

Before deploying Spaces, use a dedicated non-production bucket to verify small and >16-MiB browser/Electron uploads, rejection of a bad checksum, streamed SHA-256 fallback when HEAD omits it, ListParts without additional checksums, conditional copy failure after a source change, Unicode filenames and signed response overrides, range previews, Office saves, avatars, attachments, ZIPs, deletion and multipart abort. Run `pnpm --filter @lumolynk/api drive:check` against that explicitly configured bucket to verify CORS; it only sends OPTIONS and cannot validate object operations. No live Spaces test or migration was performed as part of this compatibility change.

`pnpm test --project api src/drive.integration.test.ts` exercises real PostgreSQL in an isolated schema on the dedicated `TEST_DATABASE_URL` database, with an in-memory implementation of the production storage interface. Adapter tests intercept AWS calls; no test writes to production S3. Run `pnpm check:all`, `pnpm build`, `pnpm test:e2e`, and `pnpm test:desktop` as applicable. The October 20 Office/Drive acceptance pass additionally exercised the configured development S3 bucket with isolated synthetic files on web and Electron: single PUT and true multipart transfers, previews, native/browser downloads, copying, ZIPs, inherited sharing and Trash/restore. See the [implementation results](onlyoffice-implementation-notes.md). Native save-dialog/window-manager behavior and PDF rendering still require target-machine verification.

## Diagnosing browser transfer failures

Run `pnpm --filter @lumolynk/api drive:check` to send real S3 OPTIONS requests for the configured web origin, packaged Electron origin and local Electron development origin. It never writes object bytes or prints a signed URL. A valid server-side PUT can still fail in the browser when bucket CORS rejects preflight.

The October 20 live repair pass reproduced HTTP 403 `AccessForbidden` preflight responses with no allow-origin header. Server-side signed PUT succeeded. After the user granted bucket-level `s3:GetBucketCORS`/`s3:PutBucketCORS`, the read confirmed no existing CORS configuration. The empty configuration was backed up locally and [the development rule](drive-cors.example.json) applied. All six origin/method probes and real web/Electron transfers now pass. For another deployment, merge the rule with existing rules and substitute the deployed web origin. CORS administration is separate from runtime object permissions and can be removed from the backend identity after configuration.

A separate true multipart test reproduced `SignatureDoesNotMatch` for 17-MiB files. The UploadPart signer inherited a forced SDK Content-Type while the client sent only the checksum. Multipart signing now excludes that incidental header, preserving signed length and checksum; single PUTs continue signing the declared MIME type. Regression tests use the real SDK presigner. Real web and Electron multipart uploads completed, and full downloaded hashes matched the original bytes.


## Production Spaces CORS

For `https://lumolynk.com`, the Spaces rule must allow request headers as well as the origin and methods. In the bucket's CORS Advanced Options, set **Allowed Headers** to `*` (or explicitly allow `content-type`, `content-length`, `x-amz-checksum-sha256` and `range`). Max Age controls preflight caching; `0` is valid. The October 23 production check returned HTTP 200 without requested headers but HTTP 403 as soon as any upload header was requested. After Allowed Headers was updated, upload and range-download preflights returned HTTP 200.

[drive-cors.production.json](drive-cors.production.json) contains an AWS CLI-compatible rule for the web and packaged desktop origins. Merge it with existing rules before applying it; PutBucketCors replaces the bucket's complete ruleset. Run `drive:check` with the production API environment after saving. It checks the allowed request headers, methods and origins without uploading files.

The API adapter fix requires rebuilding and redeploying the API on DigitalOcean App Platform. The attendance timezone/clock UI requires a separate frontend rebuild and Wrangler deployment. A bucket CORS change takes effect independently of either deployment.
