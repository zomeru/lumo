import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  date,
  jsonb,
  timestamp,
  boolean,
  primaryKey,
  foreignKey,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./helpers.ts";
import { workspace, membership } from "./workspaces.ts";

export const hrDepartment = pgTable(
  "hr_departments",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text().notNull(),
    managerId: uuid("manager_id"),
    archived: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("hr_department_workspace_id").on(t.workspaceId, t.id),
    uniqueIndex("hr_department_name").on(t.workspaceId, t.name),
    foreignKey({
      columns: [t.workspaceId, t.managerId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }),
  ],
);
export const hrEmployee = pgTable(
  "hr_employees",
  {
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    employeeCode: text("employee_code").notNull().default(""),
    jobTitle: text("job_title").notNull().default(""),
    departmentId: uuid("department_id"),
    managerId: uuid("manager_id"),
    employmentType: text("employment_type").notNull().default("employee"),
    status: text().notNull().default("active"),
    hireDate: date("hire_date"),
    endDate: date("end_date"),
    location: text().notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }),
    foreignKey({
      columns: [t.workspaceId, t.managerId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }),
    foreignKey({
      columns: [t.workspaceId, t.departmentId],
      foreignColumns: [hrDepartment.workspaceId, hrDepartment.id],
    }),
    uniqueIndex("hr_employee_code")
      .on(t.workspaceId, t.employeeCode)
      .where(sql`${t.employeeCode} <> ''`),
    index("hr_employee_manager").on(t.workspaceId, t.managerId),
    check("hr_employee_status", sql`${t.status} in ('active','on_leave','terminated')`),
    check("hr_employee_type", sql`${t.employmentType} in ('employee','contractor','intern')`),
    check("hr_employee_manager_not_self", sql`${t.managerId} <> ${t.userId}`),
    check(
      "hr_employee_dates",
      sql`${t.endDate} is null or ${t.hireDate} is null or ${t.endDate} >= ${t.hireDate}`,
    ),
  ],
);
export const hrGrant = pgTable(
  "hr_permission_grants",
  {
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    capability: text().notNull(),
    scope: text().notNull().default("workspace"),
    grantedBy: uuid("granted_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId, t.capability] }),
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }).onDelete("cascade"),
    check("hr_grant_scope", sql`${t.scope} in ('workspace','direct_reports')`),
  ],
);
export const hrAudit = pgTable(
  "hr_audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    actorId: uuid("actor_id").notNull(),
    action: text().notNull(),
    targetId: text("target_id").notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("hr_audit_workspace_time").on(t.workspaceId, t.createdAt)],
);
export const hrNotification = pgTable(
  "hr_notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    title: text().notNull(),
    module: text().notNull(),
    targetId: text("target_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.userId],
      foreignColumns: [membership.workspaceId, membership.userId],
    }).onDelete("cascade"),
    index("hr_notification_recipient").on(t.workspaceId, t.userId, t.createdAt),
  ],
);
