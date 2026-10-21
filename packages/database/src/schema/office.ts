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
  check,
} from "drizzle-orm/pg-core";

import { driveItem } from "./drive.ts";
import { createdAt } from "./helpers.ts";
import { user } from "./identity.ts";

// Office adds editing state to the canonical Drive file, never a second ACL or filename.
export const officeDocument = pgTable(
  "office_documents",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    kind: text().$type<"document" | "sheet" | "slide" | "wiki">().notNull(),
    version: integer().notNull().default(1),
    generation: integer().notNull().default(0),
    state: text().$type<"idle" | "editing" | "error">().notNull().default("idle"),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    wikiState: text("wiki_state"),
  },
  (t) => [
    uniqueIndex("office_workspace_id_idx").on(t.workspaceId, t.id),
    foreignKey({
      columns: [t.workspaceId, t.id],
      foreignColumns: [driveItem.workspaceId, driveItem.id],
    }).onDelete("cascade"),
    check("office_kind", sql`${t.kind} in ('document','sheet','slide','wiki')`),
    check("office_state", sql`${t.state} in ('idle','editing','error')`),
    check("office_versions_positive", sql`${t.version} > 0 and ${t.generation} >= 0`),
  ],
);

export const officeVersion = pgTable(
  "office_document_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    documentId: uuid("document_id").notNull(),
    number: integer().notNull(),
    objectKey: text("object_key").notNull().unique(),
    checksum: text().notNull(),
    size: bigint({ mode: "number" }).notNull(),
    source: text()
      .$type<"initial" | "import" | "final-save" | "forcesave" | "restore" | "wiki">()
      .notNull(),
    generation: integer().notNull(),
    actorId: uuid("actor_id").references(() => user.id, { onDelete: "set null" }),
    wikiState: text("wiki_state"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.documentId],
      foreignColumns: [officeDocument.workspaceId, officeDocument.id],
    }).onDelete("cascade"),
    uniqueIndex("office_revision_idx").on(t.documentId, t.number),
    check("office_revision_size", sql`${t.size} >= 0 and ${t.number} > 0`),
  ],
);

export const officeCallback = pgTable(
  "office_callback_events",
  {
    fingerprint: text().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => officeDocument.id, { onDelete: "cascade" }),
    generation: integer().notNull(),
    status: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("office_callback_retention_idx").on(t.createdAt)],
);

export const wikiPage = pgTable(
  "wiki_pages",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    parentId: uuid("parent_id"),
    folderId: uuid("folder_id").notNull().unique(),
    position: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex("wiki_workspace_id_idx").on(t.workspaceId, t.id),
    foreignKey({
      columns: [t.workspaceId, t.id],
      foreignColumns: [officeDocument.workspaceId, officeDocument.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.folderId],
      foreignColumns: [driveItem.workspaceId, driveItem.id],
    }),
    foreignKey({ columns: [t.workspaceId, t.parentId], foreignColumns: [t.workspaceId, t.id] }),
    index("wiki_parent_idx").on(t.workspaceId, t.parentId, t.position),
    check("wiki_parent_self", sql`${t.id} <> ${t.parentId}`),
  ],
);

export const wikiUpdate = pgTable(
  "wiki_updates",
  {
    id: uuid().primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => officeDocument.id, { onDelete: "cascade" }),
    update: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("wiki_update_document_idx").on(t.documentId, t.createdAt)],
);

export const wikiConnection = pgTable(
  "wiki_connections",
  {
    id: uuid().primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => officeDocument.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("wiki_connection_document_idx").on(t.documentId, t.expiresAt)],
);
