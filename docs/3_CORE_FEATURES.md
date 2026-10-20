# Core Features & Functional Requirements

> Office implementation update (October 20, 2026): Docs, Sheets and Slides use ONLYOFFICE Docs Cloud through `packages/app/src/features/office` and the existing Hono/Drive/S3 services. Wiki uses CodeMirror 6 + Yjs for Markdown source editing, with sanitized GFM preview. This extends the separately approved Wiki-only fallback after the Cloud Markdown fidelity test failed. Earlier Univer references and proposed `packages/univer` trees below are historical design rationale, not the implemented editor or a package to scaffold. See [implementation and operations](onlyoffice-implementation-notes.md). Native mobile Office remains future work.

**Project:** Internal Collaboration & Productivity Platform  
**Document:** `docs/CORE_FEATURES.md`  
**Version:** 1.0  
**Status:** Initial Product Specification  
**Last Updated:** October 16, 2026

---

## 1. Overview

The platform is a workspace-based collaboration and productivity application inspired by Slack, Discord, and Lark.

It provides messaging, meetings, collaborative office documents, file storage, HR management, and work management within isolated workspaces.

Users can belong to multiple workspaces and switch between them without signing out.

Each workspace operates as an independent environment with its own members, conversations, meetings, documents, files, employees, and projects.

### 1.1 Core Modules

| Module | Description |
|---|---|
| Workspace | Workspace creation, switching, membership, and administration |
| Messenger | Direct messages and group conversations |
| Contacts | Workspace members and contact management |
| Meetings | Voice/video meetings, scheduling, and screen sharing |
| Collaborative Office | Docs, Sheets, and Slides |
| Drive | File and folder storage |
| People & HR | Approvals, leave, employee directory, attendance, and hiring |
| Work | Tasks, projects, and related workflows |
| Notifications | Real-time and persistent notifications |

### 1.2 Supported Platforms

- Web
- iOS
- Android
- Windows
- macOS
- Linux

The same core functionality should be available across supported platforms, subject to platform-specific capabilities. Web and Electron use React + Vite; iOS and Android use React Native + Expo with native screens and Expo Router. Shared contracts, domain logic, and API/query helpers preserve consistent behavior across clients.

Mobile acceptance includes safe-area layouts, keyboard handling, accessible native controls, system back navigation, and authenticated deep links. Recheck workspace and resource access when opening invitations, meetings, files, or notification links, including from a cold start.

---

## 2. Workspace Architecture

### 2.1 Workspace Concept

A workspace is the primary organizational boundary of the application.

Each workspace has its own:

- Members and roles.
- Messenger conversations.
- Contacts and member directory.
- Workspace-bound meetings.
- Docs, Sheets, and Slides.
- Drive files and folders.
- HR records and workflows.
- Tasks and projects.
- Notifications and activity records.
- Settings and access policies.

A user may belong to multiple workspaces.

However, workspace data must remain isolated.

**Critical rule: A user who is not an active member of a workspace must not be able to access that workspace's protected data.**

This restriction applies to the frontend, backend, APIs, real-time events, search, file storage, and third-party integrations.

### 2.2 Default Personal Workspace

When a user registers for the first time:

1. A user account is created.
2. The system automatically creates a personal workspace.
3. The user becomes the workspace owner.
4. The personal workspace becomes the user's initial active workspace.
5. The user is redirected to the personal workspace dashboard.

Example:

**User:** Juan Dela Cruz  
**Default workspace:** Juan's Workspace

The personal workspace follows the same isolation rules as other workspaces.

Initially, only the owner has access. The owner may later create or join additional workspaces.

### 2.3 Workspace Switching

Users can switch between workspaces they belong to.

Expected behavior:

1. User opens the workspace switcher.
2. The application displays workspaces with active membership.
3. User selects another workspace.
4. The application changes the active workspace.
5. Workspace-specific data is refreshed.
6. Unauthorized data from the previous workspace is removed from active views and caches.

Switching workspaces must not require logging out.

The selected workspace should be remembered between sessions, provided the user still has access.

If the user's membership is revoked, the application must automatically remove access to that workspace.

### 2.4 Workspace Visibility Types

| Type | Discovery | Joining |
|---|---|---|
| Public | Visible in workspace discovery | Authenticated users may join |
| Private | Not publicly listed | Membership requires approval or an authorized invitation |
| Invite-only | Not publicly listed | Valid invitation required; no self-join or join requests |

**Public does not mean public data access.**

For a public workspace, non-members may see limited discovery information such as workspace name, description, and icon. They must join before accessing protected content.

For private workspaces, a controlled join-request flow may be supported.

For invite-only workspaces, only an authorized invitation allows joining.

Workspace owners and administrators can configure visibility according to the workspace's policy.

### 2.5 Workspace Roles

Initial roles:

| Role | Description |
|---|---|
| Owner | Full control over the workspace |
| Admin | Workspace administration and member management |
| Moderator | Community and member moderation |
| Member | Standard workspace access |
| Guest | Limited access, if guest membership is enabled |

### 2.6 Initial Permission Matrix

| Action | Owner | Admin | Moderator | Member |
|---|---|---|---|---|
| Manage workspace settings | Yes | Yes | Limited | No |
| Delete workspace | Yes | No | No | No |
| Change workspace visibility | Yes | Yes | No | No |
| Invite members | Yes | Yes | Yes | Policy-based |
| Remove regular members | Yes | Yes | Yes | No |
| Manage roles | Yes | Yes | Limited | No |
| Create conversations | Yes | Yes | Yes | Yes |
| Create meetings | Yes | Yes | Yes | Yes |
| Create documents | Yes | Yes | Yes | Yes |
| Upload files | Yes | Yes | Yes | Yes |
| Create projects | Yes | Yes | Yes | Yes |
| View HR-sensitive records | Permission-based | Permission-based | No by default | No by default |

The role matrix is a starting point. Sensitive modules must also implement resource-level permissions.

Being a workspace admin must not automatically grant unrestricted access to confidential HR records.

### 2.7 Workspace Management

Planned features:

- Create workspace.
- Update workspace name and description.
- Upload workspace icon.
- Set workspace visibility.
- Invite members.
- Review join requests.
- Accept or revoke invitations.
- Manage members and roles.
- Leave workspace.
- Transfer ownership.
- Archive or delete workspace.
- View workspace activity and audit logs.

The workspace owner must transfer ownership before leaving if no other eligible owner exists.

Workspace deletion should require explicit confirmation and follow a defined retention and recovery policy.

---

## 3. Messenger

### 3.1 Overview

Messenger provides real-time communication within a workspace.

**Selected technology: Agora Chat**

Messenger data is scoped to the workspace.

### 3.2 Direct Messages

Users can start private conversations with other members of the same workspace.

Features:

- One-to-one messaging.
- Text messages.
- File attachments.
- Message history.
- Message editing and deletion, subject to policy.
- Read/unread status.
- Message reactions.
- Replying to messages.
- Search within conversations.
- Conversation mute settings.
- Start voice/video call from a conversation.

**Access rule:** A user must be an active workspace member and a participant in the conversation to access a workspace DM.

The same two people may have separate conversations in different workspaces.

### 3.3 Group Chats

Users can create conversations with multiple workspace members.

Features:

- Create group chat.
- Set group name and avatar.
- Add and remove members.
- Assign group administrators.
- Send messages and attachments.
- Reply and react to messages.
- View group members.
- Leave group.
- Mute notifications.
- Search messages.

Group conversations must belong to exactly one workspace.

Only authorized participants may access group content.

### 3.4 Messaging Rules

- Users cannot message a non-member through a workspace-scoped conversation.
- Users cannot access conversations from workspaces they have not joined.
- Removed workspace members lose access to workspace conversations.
- Conversation membership must be checked independently of workspace membership.
- Message delivery and history behavior must be consistent with Agora's supported APIs.
- Chat history retention and deletion policies must be defined.

### 3.5 Messenger Integration

| Responsibility | Technology |
|---|---|
| Chat messaging | Agora Chat |
| Application authentication | Better Auth |
| Workspace authorization | Hono backend |
| User presence | Socket.IO |
| In-app notifications | Socket.IO |
| Push notifications | expo-notifications on mobile; backend delivery directly to APNs / FCM |

---

## 4. Contacts

### 4.1 Overview

Contacts allows users to discover and communicate with members of their active workspace.

### 4.2 Features

- View workspace member directory.
- Search members by name.
- View basic member profiles.
- View online/offline presence where permitted.
- Start direct messages.
- Start calls.
- View department and role information.
- View recently contacted members.

### 4.3 Contact Profiles

Basic profile information may include:

- Display name.
- Profile photo.
- Job title.
- Department.
- Workspace role.
- Work email, if permitted.
- Presence status.

Private personal information must not be exposed through the general contacts directory.

### 4.4 Access Rules

- Contacts are scoped to the active workspace.
- Users can only browse members of workspaces they belong to.
- Profiles must expose only information permitted by workspace and privacy settings.
- HR-specific information must not be exposed through ordinary contact profiles.

A global user identity can belong to multiple workspaces, but the visible member profile may differ per workspace.

---

## 5. Meetings

### 5.1 Overview

Meetings provide real-time voice and video communication.

**Selected technology: Agora RTC**

### 5.2 Meeting Features

- Create a new meeting.
- Join an existing meeting.
- Schedule a meeting.
- Generate meeting links.
- Voice communication.
- Video communication.
- Screen sharing.
- Mute/unmute microphone.
- Enable/disable camera.
- View participants.
- Leave meeting.
- End meeting.
- Meeting host controls.
- Participant management.

### 5.3 Meeting Access Types

Meetings support two access types.

#### Open Meeting

An open meeting is not restricted to members of a specific workspace.

Expected behavior:

- Meeting link can be shared outside the workspace.
- Users may join according to the meeting's configured guest and authentication policy.
- Meeting participants do not automatically receive workspace membership.
- Joining an open meeting does not grant access to workspace files, chats, or other data.

Open meetings may require authentication, a guest name, or a meeting passcode.

#### Workspace-Bound Meeting

A workspace-bound meeting is accessible only to active members of its associated workspace.

Expected behavior:

1. User opens a meeting link.
2. Backend identifies the meeting and its workspace.
3. Backend validates the user's active workspace membership.
4. If authorized, the user may join.
5. If unauthorized, access is denied.

**Critical rule: Possessing a workspace-bound meeting link does not grant permission to join.**

Example:

- Meeting belongs to Workspace A.
- User belongs only to Workspace B.
- User opens the Workspace A meeting link.
- The system denies access.

Suggested error:

> You don't have access to this meeting because you're not a member of its workspace.

The backend must enforce this restriction before issuing Agora meeting credentials.

### 5.4 Meeting Scheduling

Scheduled meetings should support:

- Meeting title.
- Description.
- Start date and time.
- Time zone.
- Duration.
- Meeting access type.
- Invited participants.
- Meeting link.
- Meeting organizer.
- Scheduled meeting status.

Potential future enhancements:

- Recurring meetings.
- Calendar synchronization.
- Meeting reminders.
- Waiting room.
- Recording and transcription.

### 5.5 Screen Sharing

Screen sharing should be supported where technically available.

Required testing:

- Browser screen sharing.
- Electron screen/window sharing.
- iOS screen sharing.
- Android screen sharing.
- Screen-sharing permissions.
- Audio/video behavior while sharing.

Screen-sharing support requires validation of the Agora React Native SDK in Expo development and release builds, including any native extensions, config plugins, permissions, and foreground services required by the selected SDK. Web and Electron use their own Agora integrations. Test background/resume, audio routing, interruptions, and reconnection; define incoming-call behavior separately from ordinary push notifications.

### 5.6 Meeting Security

- Validate meeting access server-side.
- Issue short-lived Agora credentials.
- Verify host and participant permissions.
- Prevent unauthorized users from joining workspace-bound meetings.
- Revalidate access when membership is revoked.
- Restrict meeting administration to authorized participants.
- Do not expose workspace information through open meeting links.

---

## 6. Collaborative Office

### 6.1 Overview

The collaborative office module provides document, spreadsheet, and presentation editing.

**Selected technology: ONLYOFFICE Docs for Docs/Sheets/Slides; CodeMirror 6 + Yjs for Wiki.**

All documents belong to a workspace and are integrated with Drive.

### 6.2 Docs

Features:

- Create document.
- Rename document.
- Edit document content.
- Rich-text formatting.
- Share with authorized workspace members.
- Collaborative editing.
- Save and reopen documents.
- Revision history.
- Move document to Drive folders.
- Delete and restore documents.

### 6.3 Sheets

Features:

- Create spreadsheet.
- Rename spreadsheet.
- Edit cells.
- Cell formatting.
- Formulas and calculations.
- Multiple worksheets.
- Collaborative editing.
- Save and reopen spreadsheets.
- Revision history.
- Import/export where supported.
- Drive integration.

### 6.4 Slides

Features:

- Create presentation.
- Rename presentation.
- Add, remove, and reorder slides.
- Edit slide content.
- Presentation layouts.
- Collaborative editing.
- Save and reopen presentations.
- Revision history.
- Import/export where supported.
- Drive integration.

### 6.5 Document Access Levels

Initial access levels:

| Permission | Allowed Actions |
|---|---|
| Owner | Full control and sharing |
| Editor | View and edit |
| Viewer | Read-only access |
| No access | Cannot open document |

Comment-only access may be introduced if supported by the selected editor integration.

### 6.6 Collaboration Rules

- Every document belongs to exactly one workspace.
- Only authorized workspace members may open a document.
- Document-level permissions must also be enforced.
- Real-time collaboration must not bypass authorization.
- Revoked members must lose document access.
- Document revisions must be stored according to the persistence design.
- Autosave and recovery must be tested.

**Implementation note:** The web/Electron implementation uses signed ONLYOFFICE sessions, verified save callbacks, canonical Drive files and immutable S3 versions. Wiki uses durable Yjs state with Markdown snapshots. Native mobile remains unimplemented; its hosted editor still requires an explicit usability and authorization proof.

---

## 7. Drive

### 7.1 Overview

Drive provides workspace-scoped file storage and management.

**Selected technologies: React (web/desktop) + React Native (Expo mobile) + Hono + PostgreSQL + S3-compatible storage**

### 7.2 Core Features

- Upload files.
- Download files.
- Create folders.
- Rename files and folders.
- Move files and folders.
- Copy files where supported.
- Delete files.
- Trash and restore.
- File previews.
- File search.
- File metadata.
- File sharing.
- File version history.
- Storage usage display.

### 7.3 File Types

Drive should support general file uploads, including:

- Images.
- PDFs.
- Documents.
- Spreadsheets.
- Presentations.
- Videos.
- Audio.
- Archives.
- Other allowed file types.

Supported file types and maximum upload sizes must be configurable. Mobile uses native document/media pickers and URI-based upload/download adapters, with permission denial, cancellation, progress, interrupted transfers, and OS sharing tested on physical devices. Browser File objects must not be assumed on mobile.

### 7.4 Workspace Storage

Each workspace has a logically isolated storage area.

Example:

**Workspace A**

- Reports
- Contracts
- Presentations

**Workspace B**

- HR Documents
- Project Files
- Meeting Materials

Members of Workspace B must not access Workspace A's files unless they are separately authorized members of Workspace A.

### 7.5 File Permissions

Initial access levels:

- Owner.
- Editor.
- Viewer.
- No access.

File permissions must not grant access to users outside the owning workspace in the initial release.

Cross-workspace sharing is excluded from the initial scope unless explicitly designed later.

### 7.6 Drive and Univer Integration

Users should be able to:

1. Create Docs, Sheets, and Slides from Drive.
2. Open existing collaborative documents.
3. Rename documents.
4. Move documents between folders.
5. Share documents with authorized members.
6. View document metadata and versions.

Drive remains responsible for file ownership, workspace association, storage, and access control.

---

## 8. People & HR

### 8.1 Overview

People & HR provides internal employee management and human resource workflows.

HR features are scoped to a workspace.

A workspace may represent a company, department, or organization depending on how the product is used.

### 8.2 People

Features:

- Employee directory.
- Employee profiles.
- Departments.
- Job titles.
- Reporting relationships.
- Employment status.
- Employee search.
- Basic organizational structure.

Employee records must be separate from general user accounts.

A person may have one global application account and different workspace memberships, but HR employment records belong to the appropriate workspace.

### 8.3 Approvals

The approvals module allows members to submit requests requiring review.

Initial features:

- Create approval request.
- Select request type.
- Add description and attachments.
- Submit request.
- Assign approver.
- Approve request.
- Reject request.
- View request status.
- View approval history.
- Receive status notifications.

Example request types:

- General request.
- Expense request.
- Equipment request.
- Leave request.
- Overtime request.

Initial approval statuses:

- Draft.
- Pending.
- Approved.
- Rejected.
- Cancelled.

Multi-stage approval workflows may be introduced later.

### 8.4 Leave Management

Features:

- Submit leave request.
- Select leave type.
- Choose start and end dates.
- Add reason.
- Attach supporting documents.
- View request status.
- Approve or reject leave.
- View leave history.
- View leave balances where configured.

Possible leave types:

- Vacation leave.
- Sick leave.
- Emergency leave.
- Unpaid leave.
- Custom company-defined leave types.

Leave policies and balances must be configurable according to company requirements.

### 8.5 Attendance

Features:

- Clock in.
- Clock out.
- Start break.
- End break.
- View attendance history.
- View daily attendance summary.
- Calculate recorded work and break durations.
- View attendance status.
- Request attendance corrections.
- Review attendance records with appropriate permissions.

Suggested attendance states:

- Not clocked in.
- Working.
- On break.
- Clocked out.

Attendance events should use server-generated timestamps.

Time zones must be handled consistently.

Future capabilities may include:

- Shift scheduling.
- Overtime requests.
- Holidays.
- Late/undertime calculations.
- Attendance exports.

Attendance and payroll calculations must follow the company's applicable policies and legal requirements.

### 8.6 Hiring

Features:

- Create open roles.
- View job openings.
- Edit job postings.
- Close job openings.
- Assign hiring managers.
- Filter roles by department and status.
- Manage visibility of job listings.

Suggested role information:

- Job title.
- Department.
- Employment type.
- Work location.
- Job description.
- Requirements.
- Hiring manager.
- Opening date.
- Status.

Potential future features:

- Candidate applications.
- Applicant tracking.
- Interview scheduling.
- Hiring pipeline.
- Offer management.

The initial scope is **open-role management**, not necessarily a complete applicant tracking system.

### 8.7 HR Access Rules

HR data requires more restrictive permissions than ordinary workspace data.

Examples:

- Employees may view their own leave requests.
- Approvers may view requests assigned to them.
- HR staff may access authorized employee records.
- Managers may view records for their assigned team, according to policy.
- Ordinary workspace members cannot view confidential employee information.

Workspace membership alone is not sufficient authorization to access sensitive HR records.

---

## 9. Work Management

### 9.1 Overview

Work provides tools for planning and tracking work within a workspace.

### 9.2 Tasks

Features:

- Create task.
- Edit task.
- Assign task.
- Set due date.
- Set priority.
- Set status.
- Add description.
- Add comments.
- Attach files.
- View assigned tasks.
- Filter and search tasks.
- Mark tasks complete.

Suggested task statuses:

- To Do.
- In Progress.
- In Review.
- Done.
- Cancelled.

Suggested priorities:

- Low.
- Medium.
- High.
- Urgent.

### 9.3 Projects

Features:

- Create project.
- Edit project information.
- Assign project owner.
- Add project members.
- Create tasks under projects.
- Set project status.
- Track progress.
- Set project deadlines.
- Attach related documents.
- View project activity.

Suggested project statuses:

- Planned.
- Active.
- On Hold.
- Completed.
- Archived.

### 9.4 Project Views

Initial views:

- List view.
- Kanban board.
- My Tasks.
- Project overview.

Potential future views:

- Calendar view.
- Timeline/Gantt view.
- Workload view.

### 9.5 Work Permissions

- Projects belong to one workspace.
- Users must be workspace members to access workspace projects.
- Private projects require explicit project membership or authorization.
- Tasks inherit workspace and project boundaries.
- Project and task permissions must be enforced server-side.

---

## 10. Notifications

### 10.1 Overview

Notifications inform users about relevant events across their workspaces.

**Selected technologies: Socket.IO + PostgreSQL + platform push notifications**

### 10.2 Notification Events

Examples:

- New direct message.
- Group message mention.
- Meeting invitation.
- Upcoming scheduled meeting.
- Document shared.
- File shared.
- Approval request assigned.
- Approval approved or rejected.
- Leave request status changed.
- Task assigned.
- Task due soon.
- Project update.
- Workspace invitation.

### 10.3 Notification Features

- Notification center.
- Unread notification count.
- Mark notification as read.
- Mark all as read.
- Open related resource.
- Notification preferences.
- Workspace-specific notifications.

### 10.4 Mobile Delivery and Navigation

- Use expo-notifications to request permissions, register native APNs/FCM device tokens, and handle foreground notifications and notification taps.
- Associate device registrations with authenticated users; handle token rotation and remove registrations on logout. Workers deliver directly to APNs/FCM; Expo Push Service remains an optional explicit alternative using its own token format.
- Validate suspended and terminated app delivery on physical iOS and Android devices. Socket.IO is for active connections; recover missed notifications from persisted records when resuming.
- Notification taps must authenticate, validate the destination, resolve workspace context, and recheck resource access before displaying content.
- Coordinate Agora message push with application notifications to prevent duplicates. Background call invitations need a separate native call/VoIP feasibility check.

### 10.5 Notification Access Rules

Notifications must not leak workspace data.

If a user loses workspace access:

- They must stop receiving protected workspace events.
- They must no longer receive workspace-scoped push notifications.
- Existing notifications must not provide access to restricted resources.
- Notification previews must follow privacy rules.

---

## 11. Cross-Workspace Isolation

### 11.1 Fundamental Security Requirement

Workspace isolation is a system-wide requirement, not merely a frontend feature.

**Every workspace-scoped resource must have an explicit workspace association and enforce membership checks.**

This includes:

- Conversations.
- Messages and message access.
- Meetings.
- Documents.
- Spreadsheets.
- Presentations.
- Drive files and folders.
- Employee records.
- Approval requests.
- Leave requests.
- Attendance records.
- Job openings.
- Tasks.
- Projects.
- Notifications.
- Search results.

### 11.2 Authorization Flow

For every protected request:

1. Authenticate the user.
2. Identify the requested workspace.
3. Verify active workspace membership.
4. Verify the required role or permission.
5. Verify resource-specific access.
6. Return the resource only if authorized.

A user-supplied `workspaceId` must never be treated as proof of authorization.

### 11.3 Third-Party Service Isolation

Workspace access must also be enforced when issuing credentials or joining sessions through third-party services.

**Agora:**

- Validate workspace membership before granting chat or meeting access.
- Map conversations and groups to workspace boundaries.
- Revoke or restrict access when membership changes.

**Univer:**

- Validate document access before opening collaborative sessions.
- Ensure collaboration sessions cannot expose documents across workspaces.
- Enforce permissions during editing and persistence.

**Socket.IO:**

- Authenticate socket connections.
- Authorize workspace room subscriptions.
- Remove subscriptions when membership is revoked.

**Drive:**

- Use private storage.
- Authorize uploads and downloads.
- Prevent unauthorized object access.
- Avoid unrestricted public file URLs.

### 11.4 Workspace Switching and Caching

When switching workspaces:

- Change the active workspace context.
- Update workspace-specific navigation.
- Refresh workspace-specific queries.
- Isolate query cache keys by workspace.
- Unsubscribe from irrelevant workspace real-time rooms.
- Reauthorize workspace-specific services.
- Prevent stale content from the previous workspace appearing in the new one.

The user may remain subscribed to authorized background notifications for other joined workspaces, but those subscriptions must be explicitly authorized.

### 11.5 Required Security Tests

- Non-member cannot fetch workspace data.
- Non-member cannot access a workspace document by ID.
- Non-member cannot download a workspace file using a copied link.
- Non-member cannot join a workspace-bound meeting using a copied link.
- Non-member cannot subscribe to another workspace's Socket.IO rooms.
- Non-member cannot access Agora conversations belonging to another workspace.
- Removing a member revokes future access.
- Switching workspaces does not mix cached data.
- Search results never reveal unauthorized resources.
- HR-sensitive records remain protected from ordinary workspace members.

---

## 12. Core Data Model

The following entities represent the initial logical data model.

### Identity and Workspace

- `users`
- `workspaces`
- `workspace_members`
- `workspace_invitations`
- `workspace_join_requests`
- `workspace_roles`
- `workspace_settings`

### Messenger and Meetings

- `conversations` (application metadata and Agora references)
- `conversation_members`
- `meetings`
- `meeting_participants`
- `meeting_invitations`

### Collaborative Office and Drive

- `drive_items`
- `drive_folders`
- `drive_permissions`
- `file_versions`
- `office_documents`
- `document_permissions`
- `document_revisions`

### People & HR

- `employees`
- `departments`
- `approval_requests`
- `approval_steps`
- `leave_requests`
- `leave_types`
- `leave_balances`
- `attendance_records`
- `attendance_events`
- `job_openings`

### Work

- `projects`
- `project_members`
- `tasks`
- `task_assignees`
- `task_comments`

### Shared Infrastructure

- `notifications`
- `notification_preferences`
- `push_device_registrations` (user, platform, native token, and registration lifecycle)
- `audit_logs`
- `activity_logs`

These are conceptual entities, not a finalized physical database schema.

Most workspace-scoped entities should contain a `workspace_id` and appropriate foreign keys, indexes, and access constraints.

Some provider-managed data, such as Agora messages, may remain in the provider rather than being duplicated in PostgreSQL.

---

## 13. Main User Flows

### 13.1 New User Onboarding

1. User signs up or signs in.
2. System checks whether the user has a default workspace.
3. If none exists, a personal workspace is created.
4. User becomes its owner.
5. User enters the workspace dashboard.
6. User may create or join other workspaces.

### 13.2 Join Public Workspace

1. User opens workspace discovery.
2. User selects a public workspace.
3. User views permitted public information.
4. User selects Join.
5. Backend creates active membership.
6. User gains access according to the assigned role.

### 13.3 Join Invite-Only Workspace

1. Admin or moderator creates an invitation.
2. User receives the invitation.
3. User opens the invitation link.
4. Backend validates invitation and identity.
5. User accepts.
6. Backend creates workspace membership.
7. User gains access to the workspace.

Expired, revoked, or unauthorized invitations must be rejected.

### 13.4 Open Workspace-Bound Meeting

1. User opens meeting link.
2. Backend authenticates the user.
3. Backend identifies the meeting's workspace.
4. Backend checks membership.
5. If unauthorized, return an access error.
6. If authorized, issue meeting credentials.
7. User joins the meeting.

### 13.5 Create Collaborative Document

1. User opens Drive.
2. User selects New Document, Spreadsheet, or Presentation.
3. Backend validates workspace permissions.
4. Backend creates document metadata.
5. Univer editor opens in the web/desktop UI or the authorized mobile editor WebView; use the approved preview/browser fallback if mobile editing is unavailable.
6. User edits and saves the document.
7. Document appears in Drive.
8. Authorized collaborators may access it.

### 13.6 Submit Leave Request

1. Employee opens People & HR.
2. Employee selects Leave.
3. Employee completes the request.
4. Backend validates the request.
5. Request enters Pending status.
6. Approver receives a notification.
7. Approver approves or rejects.
8. Employee receives a status notification.
9. Leave records are updated according to workspace policy.

### 13.7 Create Project and Assign Tasks

1. User creates a project.
2. User adds project members.
3. User creates tasks.
4. User assigns tasks to workspace members.
5. Assignees receive notifications.
6. Task status changes are recorded.
7. Project progress updates.

---

## 14. Feature Priorities

### Phase 1: Workspace Foundation

**Priority: Critical**

- Authentication.
- Default personal workspace.
- Create workspace.
- Workspace switching.
- Workspace visibility.
- Invitations and membership.
- Workspace roles.
- Workspace isolation.
- Basic workspace settings.

### Phase 2: Communication

**Priority: High**

- Contacts.
- Direct messages.
- Group chats.
- Presence.
- In-app notifications.
- Create and join meetings.
- Workspace-bound meeting authorization.
- Voice/video calls.
- Screen sharing.
- Meeting scheduling.

### Phase 3: Drive and Collaboration

**Priority: High**

- Drive file uploads.
- Folders.
- File permissions.
- Docs.
- Sheets.
- Slides.
- Collaborative editing.
- Document persistence.
- Drive integration.

### Phase 4: Work Management

**Priority: Medium–High**

- Tasks.
- Projects.
- Task assignments.
- Project members.
- List and Kanban views.
- Task notifications.

### Phase 5: People & HR

**Priority: Medium–High**

- Employee directory.
- Departments.
- Approvals.
- Leave management.
- Attendance.
- Job openings.

The actual delivery order may change based on which existing Lark features the company depends on most.

---

## 15. Minimum Acceptance Criteria

### Workspace

- Every new user receives a personal workspace.
- Users can create and join multiple workspaces.
- Users can switch between joined workspaces.
- Non-members cannot access protected workspace data.
- Public, private, and invite-only policies work as defined.

### Mobile

- Expo development and signed release builds load the required native Agora integrations.
- Login/SSO callbacks, secure session restoration, logout, and membership revocation work on physical iOS and Android devices.
- Native navigation and cold-start deep links preserve workspace isolation.
- Push registration, token rotation, notification taps, and missed-event recovery work across app lifecycle states.
- File selection, uploads, downloads, sharing, and permission denial work through native adapters.
- Office editing passes the mobile WebView proof of concept or has an explicitly approved preview/browser handoff.
- Native components are checked with React Native Testing Library / jest-expo; Appium / WebdriverIO covers native end-to-end flows and the editor WebView.

### Messenger

- Members can send and receive DMs.
- Members can create group chats.
- Conversations are isolated by workspace.
- Unauthorized users cannot read conversations.

### Contacts

- Users can browse their active workspace's members.
- Users cannot browse protected member directories from unrelated workspaces.

### Meetings

- Users can create and join meetings.
- Users can schedule meetings.
- Voice/video communication works on supported platforms.
- Screen sharing works on supported platforms where technically available.
- Workspace-bound meetings reject non-members.

### Collaborative Office

- Users can create Docs, Sheets, and Slides.
- Documents can be reopened after saving.
- Authorized members can collaborate where supported.
- Unauthorized users cannot open documents.

### Drive

- Users can upload and download files.
- Users can create folders.
- File permissions are enforced.
- Documents created in the office module appear in Drive.
- Non-members cannot access workspace files.

### People & HR

- Authorized users can manage employee records.
- Employees can submit approval and leave requests.
- Authorized approvers can review requests.
- Employees can clock in, take breaks, and clock out.
- Authorized users can manage job openings.
- Confidential HR records remain restricted.

### Work

- Members can create tasks and projects.
- Tasks can be assigned to authorized workspace members.
- Task and project status changes persist.
- Unauthorized users cannot access restricted projects.

---

## 16. Out of Scope for Initial Release

Unless specifically prioritized, the following are not required for the first production version:

- Cross-workspace file sharing.
- Cross-workspace direct messaging.
- Public document publishing.
- Complete payroll processing.
- Full applicant tracking system.
- Advanced project portfolio management.
- AI assistants and AI document generation.
- Meeting recording and transcription.
- Full offline collaborative editing.
- Custom spreadsheet formula engines.
- Custom presentation rendering engines.

These may be considered in later phases.

---

## 17. Open Product Decisions

The following requirements should be confirmed before implementation:

1. Should public workspaces be discoverable by every registered user or only users within a company organization?
2. Should private workspaces support join requests, or invitations only?
3. Should the default personal workspace support inviting additional members?
4. Should guest users be allowed inside workspaces?
5. Should direct messages exist only within workspaces, or should there also be global user-to-user messaging?
6. Should open meetings allow anonymous guests, or require authentication?
7. Should workspace owners be able to disable specific modules?
8. What file size and storage quotas should apply to workspaces?
9. Which HR policies, approval flows, and attendance rules must be configurable?
10. What retention, export, and deletion policies are required for company data?

Until decided, implementations should follow the strictest practical workspace isolation policy.

---

## 18. Final Product Principles

1. **Workspace-first:** Every core feature operates within a workspace context.
2. **Private by default:** Workspace data is protected unless explicitly authorized.
3. **Membership is mandatory:** Non-members cannot access protected workspace resources.
4. **Resource-level permissions:** Workspace membership alone does not grant access to every document, conversation, or HR record.
5. **Consistent cross-platform experience:** Web, mobile, and desktop share the same core behavior.
6. **Secure third-party integrations:** Agora and Univer must follow application authorization rules.
7. **Modular feature development:** Modules should be independently maintainable.
8. **Single source of truth:** Each domain must have clearly defined authoritative data storage.
9. **Scalable architecture:** Build for maintainability without introducing unnecessary complexity.
10. **Business-driven priorities:** Focus on the workflows the company actually needs.

**Core architectural requirement:**

> A workspace is an isolated collaboration environment. A user may belong to multiple workspaces, but must never be able to access another workspace's protected data without valid membership and resource-level authorization.
