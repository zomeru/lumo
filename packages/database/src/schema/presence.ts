import { pgTable, uuid, boolean, timestamp, index, foreignKey } from "drizzle-orm/pg-core";

import { session, user } from "./identity";
import { membership } from "./workspaces";

export const presencePreference = pgTable("presence_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  dnd: boolean().notNull().default(false),
});
export const presenceLease = pgTable(
  "presence_leases",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }).onDelete("cascade"),
    index("presence_workspace_user_expiry_idx").on(t.workspaceId, t.userId, t.expiresAt),
    index("presence_expiry_idx").on(t.expiresAt),
  ],
);
