import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  date,
  foreignKey,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";

import { createdAt } from "./helpers.ts";
import { workspace } from "./workspaces.ts";
export const hrSchedule = pgTable(
  "hr_work_schedules",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    userId: uuid("user_id").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    timezone: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("hr_schedule_effective").on(t.workspaceId, t.userId, t.effectiveFrom)],
);
export const hrHoliday = pgTable(
  "hr_holidays",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    date: date().notNull(),
    name: text().notNull(),
  },
  (t) => [unique("hr_holiday_date").on(t.workspaceId, t.date)],
);
export const hrLeaveType = pgTable(
  "hr_leave_types",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text().notNull(),
    paid: boolean().notNull(),
    version: integer().notNull().default(1),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("hr_leave_workspace_id").on(t.workspaceId, t.id),
    unique("hr_leave_name").on(t.workspaceId, t.name),
  ],
);
export const hrLeaveLedger = pgTable(
  "hr_leave_balance_ledger",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    leaveTypeId: uuid("leave_type_id").notNull(),
    year: integer().notNull(),
    amountHalfDays: integer("amount_half_days").notNull(),
    source: text().notNull(),
    reason: text().notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.leaveTypeId],
      foreignColumns: [hrLeaveType.workspaceId, hrLeaveType.id],
    }),
    unique("hr_ledger_once").on(t.workspaceId, t.userId, t.leaveTypeId, t.source),
    index("hr_ledger_balance").on(t.workspaceId, t.userId, t.leaveTypeId, t.year),
    check("hr_ledger_year", sql`${t.year} between 1900 and 2200`),
  ],
);
