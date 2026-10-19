# Implement Lumo Drive with AWS S3 Storage

Implement the **Drive** section in Lumo using Amazon S3 for object storage. Drive should provide a modern, enterprise-grade file management experience similar to Google Drive and Lark Drive, while following our existing architecture, design system, and coding conventions.

## 1. Review the Existing Project

Before implementing anything:

- Inspect the current Turborepo structure, applications, shared packages, API, database schema, authentication, and workspace authorization.
- Review the existing Drive implementation, if any, and reuse or extend existing functionality.
- Examine the UI reference located at `docs/ui_samples/documents_flow/5_Drive`.
- Use the reference to understand the intended layout, interactions, and user flow. Do not treat it as the absolute source of truth.
- Preserve our existing design system, reusable components, Tailwind CSS v4 styling, icons, typography, spacing, and professional blue/dark-blue theme.
- Ensure the implementation works in both the web application and Electron desktop application.

Do not introduce unnecessary dependencies or replace existing tooling.

## 2. AWS S3 Integration

Use the official AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`) to integrate S3 object storage into our backend.

Implement:

- File uploads and downloads.
- Presigned URLs for secure direct-to-S3 uploads and downloads.
- Multipart uploads for large files, including progress tracking, cancellation, and retry handling.
- File deletion and object cleanup.
- File metadata retrieval.
- Secure file access based on authentication, workspace membership, and permissions.

Use environment variables for AWS configuration:

```env
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Use the AWS SDK's default credential provider chain so IAM roles can be used in production without static credentials.

Keep the bucket private. Never expose AWS credentials to the frontend or make uploaded files publicly accessible by default.

Implement a reusable storage service or abstraction rather than coupling Drive's business logic directly to AWS SDK calls.

## 3. Workspace-Based Drive

Lumo is a workspace-based collaboration platform, similar to Slack or Lark.

Drive must respect workspace isolation.

- Each workspace has its own logically isolated files and folders.
- Users must be workspace members to access workspace files.
- Users cannot access files from another workspace without explicit authorization.
- Workspace administrators and authorized members can manage shared files based on permissions.
- Enforce authorization in the backend for every operation.
- Never rely solely on frontend permission checks or client-supplied workspace IDs.

Reuse our existing workspace roles and permission architecture. Extend it only when necessary.

## 4. Core Drive Features

Implement the following functionality:

**File management**
- Upload individual files or multiple files.
- Drag-and-drop uploads.
- Create folders and nested folders.
- Rename files and folders.
- Move files between folders.
- Copy and duplicate files.
- Delete files and folders.
- Restore deleted items from Trash.
- Permanently delete items.
- Download individual files.
- Download multiple files or folders as ZIP archives.
- Display upload progress and errors.

**File browsing**
- My Files.
- Recent Files.
- Starred.
- Shared With Me.
- Trash.
- Folder navigation with breadcrumbs.
- Grid and list views.
- File and folder search.
- Sorting by name, size, type, and modification date.
- Filtering by file type.
- File previews for supported formats, including images, PDFs, and text files.

**Sharing and collaboration**
- Share files and folders with workspace members.
- Support viewer and editor permissions.
- Display ownership and sharing information.
- Allow authorized users to revoke access.
- Support shared folders with inherited permissions.
- Prevent unauthorized downloads, modifications, or sharing.

Design the sharing model so external sharing can be introduced later without requiring major architectural changes. Do not enable public sharing by default.

## 5. Database and File Metadata

Use our existing PostgreSQL database and ORM.

Store file metadata in PostgreSQL, including:

- File ID and workspace ID.
- Owner/uploader ID.
- Parent folder ID.
- Original filename and display name.
- File type and MIME type.
- File size.
- S3 object key.
- Checksum where applicable.
- Upload and processing status.
- Creation and modification timestamps.
- Soft deletion timestamp.
- Sharing and permission information.

S3 should store file contents, while PostgreSQL handles metadata, relationships, and permissions.

Use UUIDs or similarly collision-resistant identifiers for S3 object keys. Never use untrusted filenames directly as storage keys.

Ensure database and S3 operations remain consistent, including handling failed uploads, abandoned multipart uploads, deleted files, and partial failures.

Create migrations following our existing database conventions.

## 6. API Implementation

Implement the necessary Drive endpoints using our existing Hono API architecture.

Include endpoints for:

- Listing and searching files/folders.
- Creating folders.
- Initializing uploads and generating presigned URLs.
- Completing, canceling, and validating uploads.
- Downloading files.
- Renaming, moving, and copying items.
- Deleting and restoring items.
- Managing starred items.
- Sharing and managing permissions.
- Retrieving file details and preview URLs.

Follow our existing API patterns, validation, error handling, authentication, and authorization conventions.

Use shared TypeScript types and validation schemas where appropriate.

Avoid unnecessary API duplication.

## 7. Frontend Implementation

Implement the Drive interface using our existing React, Vite, TanStack Router, and Tailwind CSS v4 stack.

Use `docs/ui_samples/documents_flow/5_Drive` as the primary visual and workflow reference.

The UI should be:

- Modern, elegant, and enterprise-grade.
- Consistent with Lumo's existing design system.
- Responsive across desktop and smaller screens.
- Optimized for both browser and Electron usage.
- Compact, with appropriate information density.
- Accessible and keyboard-friendly.

Implement appropriate loading states, empty states, error states, confirmation dialogs, context menus, tooltips, and upload notifications.

Use existing reusable UI components wherever possible. Create new reusable components only when necessary.

Ensure file operations update the UI correctly without requiring manual refreshes.

## 8. Integration With Lumo

Drive should be designed as a shared file storage foundation for other Lumo modules.

Consider future integrations with:

- Messenger attachments.
- Meeting attachments and recordings.
- Collaborative Docs, Sheets, and Slides.
- Tasks and Projects.
- Other workspace modules requiring file storage.

Avoid implementing these unrelated modules now. Instead, establish reusable backend services and file references that they can integrate with later.

Ensure files created by future collaborative document editors can be represented in Drive without duplicating storage or metadata logic.

## 9. Security and Reliability

Implement appropriate security measures:

- Private S3 bucket access.
- Short-lived presigned URLs.
- Server-side authorization before issuing URLs.
- File size limits and configurable allowed file types.
- Filename sanitization.
- MIME type and file signature validation where applicable.
- Protection against path traversal and unauthorized object access.
- Secure handling of deleted files.
- Safe upload finalization and object verification.
- Protection against malicious file uploads.
- No AWS credentials in frontend bundles or logs.

Use appropriate S3 CORS configuration for direct browser uploads.

Do not introduce unnecessary public bucket policies or broad IAM permissions.

## 10. Testing and Verification

Add tests using our existing testing infrastructure.

Cover:

- Upload and download workflows.
- Folder creation and nested navigation.
- File rename, move, copy, and deletion.
- Trash and restoration.
- Sharing and permission enforcement.
- Workspace isolation.
- Unauthorized access attempts.
- Upload failures and recovery.
- Metadata consistency.

Mock S3 in unit tests where appropriate. Keep integration tests isolated from production resources.

Run the relevant linting, formatting, type-checking, and test commands using our existing Turborepo tooling.

Fix issues introduced by the implementation.

## 11. Implementation Requirements

- Inspect the codebase thoroughly before making changes.
- Create a clear implementation plan and execute it in logical phases.
- Follow existing project architecture and conventions.
- Reuse existing packages, utilities, and components.
- Use TypeScript with proper types.
- Avoid `any` unless absolutely necessary.
- Do not install ESLint or Prettier. We already use OXC.
- Do not replace existing design decisions or introduce unnecessary abstractions.
- Do not modify unrelated features.
- Do not hardcode AWS credentials, bucket names, or environment-specific configuration.
- Update `.env.example` files and relevant documentation.
- Do not stop at scaffolding, mock functionality, or placeholder UI. Implement the actual end-to-end functionality.

## 12. Expected Deliverables

1. Fully functional Drive UI integrated into Lumo web and desktop.
2. AWS S3 integration through our backend.
3. Database schema and migrations.
4. Secure file and folder management APIs.
5. Workspace-scoped access control and file sharing.
6. Upload progress, previews, downloads, and file operations.
7. Relevant automated tests.
8. Updated environment configuration and documentation.

After implementation, provide a concise summary of the changes, architectural decisions, required AWS configuration, test results, and any remaining limitations.

**Important:** The goal is a fully functional, production-oriented Drive module, not simply a UI recreation. Prioritize secure storage, workspace isolation, maintainability, and seamless integration with the existing Lumo ecosystem.