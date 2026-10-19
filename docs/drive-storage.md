# Lumo Drive storage

Drive is implemented in `packages/app` and shared by the web and sandboxed Electron renderer. Hono owns authorization and metadata workflows; PostgreSQL owns the folder tree, workspace-scoped grants, stars, upload state and durable storage cleanup. `apps/api/src/storage/storage.ts` defines the storage interface; the production adapter uses AWS SDK v3 and its default credential provider chain. Other modules can store a Drive item UUID as a file reference and call this service with the authenticated actor. They must not accept object keys or issue S3 URLs independently.

## Enable Drive

1. Run `pnpm install` and `pnpm db:migrate`. Migration `0004_shiny_speed.sql` adds the Drive tables and cross-workspace foreign keys. Apply migrations before starting the updated API.
2. Configure `AWS_REGION` and `AWS_S3_BUCKET` in the API environment. Both are optional together; without them, metadata operations work and storage operations return `STORAGE_UNAVAILABLE`. Static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (plus `AWS_SESSION_TOKEN` for temporary credentials) remain API-only. Prefer an IAM role in production and SSO/profile credentials locally. Never use `VITE_*` for credentials.
3. Use a dedicated **private** S3 general-purpose bucket with Block Public Access enabled, Object Ownership set to bucket-owner-enforced, default server-side encryption enabled, and HTTPS-only access. No public read/write policy or object ACL is needed. The service leaves encryption selection to the bucket default; SSE-KMS also needs the role's narrowly scoped KMS permissions.
4. Configure the CORS and lifecycle rules below. Set `DRIVE_MAX_FILE_BYTES` if needed (default 1 GiB; configurable up to 5 GiB), and optionally `DRIVE_ALLOWED_MIME_TYPES` as comma-separated MIME types or `image/*` style patterns. `*` accepts attachment formats subject to signature validation. The size limit applies per file; this release has no workspace storage quota.
5. Start the API with `pnpm --filter @lumo/api dev`, or `pnpm dev`. Storage maintenance runs every minute while the API process is running. Each batch attempts 50 due cleanup intents with exponential backoff. Monitor the `storage_cleanup` backlog and the API's cleanup failure counts; logs exclude filenames, URLs, object contents and credentials.

The bucket can remain unversioned. If versioning is enabled, S3 DeleteObject creates a delete marker: configure noncurrent-version expiration according to your retention policy. This release does not enumerate and erase historical object versions or support Object Lock retention overrides. Do not enable bucket-wide expiration on `drive/`, which contains retained files and Trash contents.

## S3 CORS

Use exact origins for your deployed web application and desktop renderer. Remove development origins in production. The packaged Electron application uses `lumo://app`; its development renderer uses `http://127.0.0.1:5174`. CORS controls browser access, not authorization. All objects remain private.

```json
[
  {
    "AllowedOrigins": ["https://app.example.com", "lumo://app", "http://localhost:3000", "http://127.0.0.1:5174"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length", "x-amz-checksum-sha256", "range"],
    "ExposeHeaders": ["ETag", "x-amz-checksum-sha256", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 600
  }
]
```

See [AWS CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html) and [presigned URL behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html). ETags and part checksums are obtained server-side during finalization; they are never trusted from the browser.

## IAM scope and lifecycle

Scope the API role to its bucket and these prefixes: `drive/*`, `drive-staging/*`, `drive-archives/*`. Required object actions are `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload`, and `s3:ListMultipartUploadParts`. Copy uses GetObject on the source and PutObject on the destination. No bucket listing, ACL writes, bucket administration or public access is required at runtime. A bucket policy denying requests with `aws:SecureTransport = false` enforces TLS. Configure the bucket separately with an infrastructure operator role.

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

`pnpm test --project api src/drive.integration.test.ts` exercises real PostgreSQL in an isolated schema on the dedicated `TEST_DATABASE_URL` database, with an in-memory implementation of the production storage interface. Adapter tests intercept AWS calls; no test writes to production S3. Run `pnpm check:all`, `pnpm build`, `pnpm test:e2e`, and `pnpm test:desktop` as applicable. A live S3 smoke test still requires a configured private bucket, role, CORS and lifecycle rules; native save dialogs and PDF rendering also require target-machine verification.
