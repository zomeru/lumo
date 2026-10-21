import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  jsonb,
  unique,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

import { createdAt } from "./helpers.ts";
import { workspace } from "./workspaces.ts";
export const hrShift = pgTable(
  "hr_attendance_shifts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    userId: uuid("user_id").notNull(),
    workDate: date("work_date").notNull(),
    clockIn: timestamp("clock_in", { withTimezone: true }).notNull(),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    timezone: text().notNull(),
    schedule: jsonb().$type<Record<string, unknown> | null>(),
    breaks: jsonb().$type<{ start: string; end: string | null }[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("hr_one_open_shift")
      .on(t.workspaceId, t.userId)
      .where(sql`${t.clockOut} is null`),
    index("hr_shift_workday").on(t.workspaceId, t.userId, t.workDate),
    check("hr_shift_time_order", sql`${t.clockOut} is null or ${t.clockOut} >= ${t.clockIn}`),
  ],
);
export const hrPunch = pgTable(
  "hr_attendance_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    userId: uuid("user_id").notNull(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => hrShift.id),
    action: text().notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("hr_punch_idempotency").on(t.workspaceId, t.userId, t.idempotencyKey),
    index("hr_punch_audit").on(t.workspaceId, t.shiftId, t.createdAt),
    check(
      "hr_punch_action",
      sql`${t.action} in ('clock_in','start_break','end_break','clock_out')`,
    ),
  ],
);
export const hrAttendanceCorrection = pgTable(
  "hr_attendance_corrections",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    userId: uuid("user_id").notNull(),
    date: date().notNull(),
    requestId: uuid("request_id").notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("hr_correction_request").on(t.workspaceId, t.requestId),
    index("hr_correction_day").on(t.workspaceId, t.userId, t.date, t.createdAt),
  ],
);
