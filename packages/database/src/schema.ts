import { sql } from "drizzle-orm";
import {
  pgTable,
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
