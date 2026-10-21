import { sql } from "drizzle-orm";
import {
  pgTable,
  foreignKey,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./helpers.ts";
import { user } from "./identity.ts";
import { workspace, membership } from "./workspaces.ts";

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
