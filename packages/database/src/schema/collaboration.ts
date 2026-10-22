import { sql } from "drizzle-orm";
import {
  pgTable,
  foreignKey,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  check,
  bigint,
} from "drizzle-orm/pg-core";

import { createdAt } from "./helpers.ts";
import { user } from "./identity.ts";
import { workspace, membership } from "./workspaces.ts";

export const conversation = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    name: text().notNull(),
    description: text().notNull().default(""),
    slug: text(),
    visibility: text().$type<"public" | "private">().notNull().default("private"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    uniqueIndex("conversation_channel_slug_idx").on(t.workspaceId, t.slug),
    index("conversation_discovery_idx").on(t.workspaceId, t.kind, t.visibility),
    check("conversation_kind", sql`${t.kind} in ('direct','group','channel')`),
    check("conversation_visibility", sql`${t.visibility} in ('public','private')`),
    check(
      "conversation_channel",
      sql`(${t.kind} = 'channel' and ${t.slug} is not null) or (${t.kind} <> 'channel' and ${t.slug} is null and ${t.visibility} = 'private')`,
    ),
  ],
);
export const conversationMember = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text().$type<"owner" | "manager" | "member">().notNull().default("member"),
    joinedAt: createdAt(),
    lastReadSequence: bigint("last_read_sequence", { mode: "number" }).notNull().default(0),
    notifications: text().$type<"all" | "mentions" | "muted">().notNull().default("all"),
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
    check("conversation_member_role", sql`${t.role} in ('owner','manager','member')`),
    check(
      "conversation_member_notifications",
      sql`${t.notifications} in ('all','mentions','muted')`,
    ),
  ],
);
// One destination per message: channels and DMs share the workspace-scoped conversation FK.
export const messengerMessage = pgTable(
  "messenger_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => user.id),
    sequence: bigint({ mode: "number" }).generatedAlwaysAsIdentity().notNull(),
    nonce: uuid().notNull(),
    body: text().notNull(),
    parentId: uuid("parent_id"),
    mentionIds: uuid("mention_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedBy: uuid("pinned_by").references(() => user.id),
  },
  (t) => [
    uniqueIndex("messenger_message_scope_idx").on(t.workspaceId, t.conversationId, t.id),
    uniqueIndex("messenger_message_nonce_idx").on(t.conversationId, t.senderId, t.nonce),
    index("messenger_message_history_idx").on(t.conversationId, t.sequence),
    index("messenger_message_thread_idx").on(t.parentId, t.sequence),
    index("messenger_message_search_idx").using("gin", sql`to_tsvector('simple', ${t.body})`),
    foreignKey({
      columns: [t.workspaceId, t.conversationId],
      foreignColumns: [conversation.workspaceId, conversation.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.conversationId, t.parentId],
      foreignColumns: [t.workspaceId, t.conversationId, t.id],
    }),
    check("messenger_message_body", sql`length(${t.body}) <= 4000`),
    check("messenger_message_parent", sql`${t.id} <> ${t.parentId}`),
  ],
);
export const messengerReaction = pgTable(
  "messenger_reactions",
  {
    workspaceId: uuid("workspace_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    messageId: uuid("message_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    emoji: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
    foreignKey({
      columns: [t.workspaceId, t.conversationId, t.messageId],
      foreignColumns: [
        messengerMessage.workspaceId,
        messengerMessage.conversationId,
        messengerMessage.id,
      ],
    }).onDelete("cascade"),
  ],
);
export const messengerAttachment = pgTable(
  "messenger_attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    messageId: uuid("message_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer().notNull(),
    checksum: text().notNull(),
    state: text().$type<"uploading" | "ready">().notNull().default("uploading"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.conversationId],
      foreignColumns: [conversation.workspaceId, conversation.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.conversationId, t.messageId],
      foreignColumns: [
        messengerMessage.workspaceId,
        messengerMessage.conversationId,
        messengerMessage.id,
      ],
    }),
    index("messenger_attachment_message_idx").on(t.messageId),
    check("messenger_attachment_size", sql`${t.size} > 0 and ${t.size} <= 20971520`),
    check("messenger_attachment_state", sql`${t.state} in ('uploading','ready')`),
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
    index("meeting_workspace_schedule_idx").on(t.workspaceId, t.startsAt),
    check("meeting_access", sql`${t.access} in ('open','workspace')`),
    check("meeting_status", sql`${t.status} in ('scheduled','active','ended','canceled')`),
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
