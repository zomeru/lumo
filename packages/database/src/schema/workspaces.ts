import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./helpers.ts";
import { user } from "./identity.ts";

export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "moderator", "member"]);
export const workspaceVisibility = pgEnum("workspace_visibility", [
  "public",
  "private",
  "invite-only",
]);

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
