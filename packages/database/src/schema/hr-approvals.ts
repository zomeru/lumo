import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  bigint,
  boolean,
  unique,
  foreignKey,
  index,
  check,
} from "drizzle-orm/pg-core";

import { createdAt } from "./helpers.ts";
import { workspace } from "./workspaces.ts";
export const hrApprovalPolicy = pgTable(
  "hr_approval_policies",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    type: text().notNull(),
    approverIds: uuid("approver_ids").array().notNull(),
    requireAttachment: boolean("require_attachment").notNull().default(false),
  },
  (t) => [unique("hr_approval_policy_key").on(t.workspaceId, t.type)],
);
export const hrRequest = pgTable(
  "hr_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    requesterId: uuid("requester_id").notNull(),
    subject: text().notNull(),
    description: text().notNull().default(""),
    priority: text().notNull().default("normal"),
    details: jsonb().$type<Record<string, unknown>>().notNull(),
    status: text().notNull().default("draft"),
    approverIds: uuid("approver_ids").array().notNull().default([]),
    currentStep: integer("current_step").notNull().default(0),
    blockedReason: text("blocked_reason"),
    createdAt: createdAt(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    unique("hr_request_workspace_id").on(t.workspaceId, t.id),
    index("hr_request_queue").on(t.workspaceId, t.status, t.requesterId),
    check(
      "hr_request_status",
      sql`${t.status} in ('draft','pending','approved','rejected','cancelled')`,
    ),
    check("hr_request_step", sql`${t.currentStep} >= 0`),
  ],
);
export const hrRequestEvent = pgTable(
  "hr_request_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    requestId: uuid("request_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    action: text().notNull(),
    comment: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.requestId],
      foreignColumns: [hrRequest.workspaceId, hrRequest.id],
    }),
    index("hr_request_event_time").on(t.workspaceId, t.requestId, t.createdAt),
  ],
);
export const hrFile = pgTable(
  "hr_files",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    name: text().notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint({ mode: "number" }).notNull(),
    checksum: text().notNull(),
    state: text().notNull().default("uploading"),
    createdAt: createdAt(),
  },
  (t) => [
    index("hr_file_target").on(t.workspaceId, t.targetType, t.targetId),
    check("hr_file_size", sql`${t.size} between 1 and 10485760`),
    check("hr_file_state", sql`${t.state} in ('uploading','ready')`),
  ],
);
