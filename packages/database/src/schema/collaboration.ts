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
