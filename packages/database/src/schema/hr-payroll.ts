import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  bigint,
  jsonb,
  timestamp,
  foreignKey,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";

import { createdAt } from "./helpers.ts";
import { hrRequest } from "./hr-approvals.ts";
import { workspace } from "./workspaces.ts";
export const hrCompensation = pgTable(
  "hr_employee_compensation",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    userId: uuid("user_id").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    salaryMinor: bigint("salary_minor", { mode: "number" }).notNull(),
    allowances: jsonb()
      .$type<{ label: string; amountMinor: number; taxable: boolean }[]>()
      .notNull()
      .default([]),
    reason: text().notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("hr_compensation_effective").on(t.workspaceId, t.userId, t.effectiveFrom),
    check("hr_salary_positive", sql`${t.salaryMinor} between 1 and 1000000000`),
  ],
);
export const hrPayrollSetting = pgTable(
  "hr_payroll_settings",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    effectiveFrom: date("effective_from").notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("hr_payroll_settings_effective").on(t.workspaceId, t.effectiveFrom)],
);
export const hrPayrollRun = pgTable(
  "hr_payroll_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    cutoffDate: date("cutoff_date").notNull(),
    payoutDate: date("payout_date").notNull(),
    status: text().notNull().default("draft"),
    revision: integer().notNull().default(0),
    createdBy: uuid("created_by").notNull(),
    calculatedBy: uuid("calculated_by"),
    approvedBy: uuid("approved_by"),
    ruleVersion: text("rule_version"),
    settingsSnapshot: jsonb("settings_snapshot").$type<Record<string, unknown>>(),
    warnings: jsonb().$type<string[]>().notNull().default([]),
    replacesRunId: uuid("replaces_run_id"),
    reason: text().notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("hr_run_workspace_id").on(t.workspaceId, t.id),
    index("hr_run_period").on(t.workspaceId, t.startDate, t.endDate),
    check(
      "hr_run_status",
      sql`${t.status} in ('draft','calculated','under_review','approved','finalized','paid','voided')`,
    ),
    check("hr_run_dates", sql`${t.endDate} >= ${t.startDate} and ${t.cutoffDate} <= ${t.endDate}`),
  ],
);
export const hrPayrollEmployee = pgTable(
  "hr_payroll_run_employees",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    runId: uuid("run_id").notNull(),
    userId: uuid("user_id").notNull(),
    snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    result: jsonb().$type<Record<string, unknown>>().notNull(),
    verifiedBy: uuid("verified_by"),
    verificationReference: text("verification_reference"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.runId],
      foreignColumns: [hrPayrollRun.workspaceId, hrPayrollRun.id],
    }),
    unique("hr_run_employee_once").on(t.workspaceId, t.runId, t.userId),
  ],
);
export const hrPayrollAdjustment = pgTable(
  "hr_payroll_adjustments",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    runId: uuid("run_id").notNull(),
    userId: uuid("user_id").notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    actorId: uuid("actor_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    sourceRequestId: uuid("source_request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.runId],
      foreignColumns: [hrPayrollRun.workspaceId, hrPayrollRun.id],
    }),
    foreignKey({
      columns: [t.workspaceId, t.sourceRequestId],
      foreignColumns: [hrRequest.workspaceId, hrRequest.id],
    }),
    unique("hr_payroll_adjustment_once").on(t.workspaceId, t.idempotencyKey),
  ],
);
