import { sql } from "drizzle-orm";
import {
  pgTable,
  foreignKey,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "moderator", "member"]);
export const workspaceVisibility = pgEnum("workspace_visibility", [
  "public",
  "private",
  "invite-only",
]);

export const user = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const session = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const account = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_idx").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("rate_limits", {
  id: text()
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const workspace = pgTable(
  "workspaces",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text().default("").notNull(),
    visibility: workspaceVisibility().default("private").notNull(),
    personalOwnerId: uuid("personal_owner_id")
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    industry: text().default("").notNull(),
    companySize: text("company_size").default("just-me").notNull(),
    timezone: text().default("UTC").notNull(),
    currency: text().default("USD").notNull(),
    language: text().default("en").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("workspace_discovery_idx").on(t.visibility, t.name),
    check(
      "personal_workspace_private",
      sql`${t.personalOwnerId} is null or ${t.visibility} = 'private'`,
    ),
  ],
);
export const membership = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRole().default("member").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index("membership_user_idx").on(t.userId),
    uniqueIndex("workspace_one_owner_idx")
      .on(t.workspaceId)
      .where(sql`${t.role} = 'owner'`),
  ],
);
export const profile = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  jobTitle: text("job_title").default("").notNull(),
  department: text().default("").notNull(),
  activeWorkspaceId: uuid("active_workspace_id").references(() => workspace.id, {
    onDelete: "set null",
  }),
});
export const invitation = pgTable(
  "workspace_invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: workspaceRole().notNull().default("member"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invitation_workspace_idx").on(t.workspaceId),
    check("invitation_safe_role", sql`${t.role} in ('member', 'moderator')`),
  ],
);
export const auditEvent = pgTable(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    targetId: text("target_id"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_workspace_time_idx").on(t.workspaceId, t.createdAt)],
);
export const requestLimit = pgTable("request_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const conversation = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    name: text().notNull(),
    directKey: text("direct_key"),
    providerGroupId: text("provider_group_id").unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversation_workspace_id_idx").on(t.workspaceId, t.id),
    uniqueIndex("conversation_dm_idx").on(t.workspaceId, t.directKey),
    index("conversation_workspace_time_idx").on(t.workspaceId, t.createdAt),
    check("conversation_kind", sql`${t.kind} in ('direct','group')`),
  ],
);
export const conversationMember = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    foreignKey({
      columns: [t.workspaceId, t.conversationId],
      foreignColumns: [conversation.workspaceId, conversation.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }).onDelete("cascade"),
    index("conversation_member_user_idx").on(t.workspaceId, t.userId),
  ],
);
export const meeting = pgTable(
  "meetings",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    hostId: uuid("host_id")
      .notNull()
      .references(() => user.id),
    title: text().notNull(),
    description: text().default("").notNull(),
    access: text().notNull().default("workspace"),
    status: text().notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    timezone: text().notNull().default("UTC"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    createdAt: createdAt(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("meeting_workspace_time_idx").on(t.workspaceId, t.createdAt),
    check("meeting_access", sql`${t.access} in ('open','workspace')`),
    check("meeting_status", sql`${t.status} in ('scheduled','active','ended')`),
    check("meeting_duration", sql`${t.durationMinutes} between 5 and 1440`),
  ],
);
export const meetingParticipant = pgTable(
  "meeting_participants",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    invited: boolean().notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.meetingId, t.userId] }),
    index("meeting_participant_user_idx").on(t.userId),
  ],
);

// A Drive ID is the reusable file reference for other workspace modules. Object keys
// and upload state stay server-side; folders and future editor files share this tree.
export const driveItem = pgTable(
  "drive_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id"),
    name: text().notNull(),
    originalName: text("original_name").notNull(),
    kind: text().$type<"file" | "folder">().notNull(),
    mimeType: text("mime_type").notNull().default(""),
    size: bigint({ mode: "number" }).notNull().default(0),
    objectKey: text("object_key").unique(),
    stagingKey: text("staging_key").unique(),
    uploadId: text("upload_id"),
    status: text()
      .$type<"uploading" | "ready" | "failed" | "deleting">()
      .notNull()
      .default("ready"),
    checksum: text(),
    etag: text(),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionId: uuid("deletion_id"),
  },
  (t) => [
    uniqueIndex("drive_workspace_id_idx").on(t.workspaceId, t.id),
    foreignKey({ columns: [t.workspaceId, t.parentId], foreignColumns: [t.workspaceId, t.id] }),
    index("drive_parent_idx").on(t.workspaceId, t.parentId, t.name),
    index("drive_owner_idx").on(t.workspaceId, t.ownerId, t.updatedAt),
    index("drive_trash_idx").on(t.workspaceId, t.deletedAt),
    check("drive_kind", sql`${t.kind} in ('file','folder')`),
    check("drive_status", sql`${t.status} in ('uploading','ready','failed','deleting')`),
    check("drive_size", sql`${t.size} >= 0 and ${t.size} <= 5368709120`),
    check("drive_parent_self", sql`${t.id} <> ${t.parentId}`),
    check(
      "drive_storage",
      sql`(${t.kind} = 'folder' and ${t.objectKey} is null and ${t.size} = 0) or (${t.kind} = 'file' and ${t.objectKey} is not null)`,
    ),
  ],
);
export const driveShare = pgTable(
  "drive_shares",
  {
    workspaceId: uuid("workspace_id").notNull(),
    itemId: uuid("item_id").notNull(),
    userId: uuid("user_id").notNull(),
    permission: text().$type<"viewer" | "editor">().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.userId] }),
    foreignKey({
      columns: [t.workspaceId, t.itemId],
      foreignColumns: [driveItem.workspaceId, driveItem.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }).onDelete("cascade"),
    index("drive_share_user_idx").on(t.workspaceId, t.userId),
    check("drive_permission", sql`${t.permission} in ('viewer','editor')`),
  ],
);
export const driveStar = pgTable(
  "drive_stars",
  {
    workspaceId: uuid("workspace_id").notNull(),
    itemId: uuid("item_id").notNull(),
    userId: uuid("user_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.userId] }),
    foreignKey({
      columns: [t.workspaceId, t.itemId],
      foreignColumns: [driveItem.workspaceId, driveItem.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }).onDelete("cascade"),
  ],
);
// Durable cleanup intents precede storage writes. Failures retain these rows for
// the maintenance worker, including objects whose metadata transaction failed.
export const storageCleanup = pgTable(
  "storage_cleanup",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull().unique(),
    uploadId: text("upload_id"),
    notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
    attempts: integer().notNull().default(0),
  },
  (t) => [index("storage_cleanup_due_idx").on(t.notBefore)],
);
