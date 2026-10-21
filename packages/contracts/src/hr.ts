import { z } from "zod";

export const hrCapabilities = [
  "hr.people.manage",
  "hr.departments.manage",
  "hr.approvals.read_all",
  "hr.approvals.manage",
  "hr.leave.read_team",
  "hr.leave.manage_policy",
  "hr.leave.adjust_balances",
  "hr.attendance.read_team",
  "hr.attendance.correct",
  "hr.attendance.manage_policy",
  "hr.onboarding.manage",
  "hr.onboarding.verify",
  "hr.payroll.read_all",
  "hr.payroll.compensation.manage",
  "hr.payroll.runs.manage",
  "hr.payroll.runs.approve",
  "hr.payroll.settings.manage",
  "hr.payroll.mark_paid",
  "hr.permissions.manage",
  "hr.reports.read",
] as const;
export type HrCapability = (typeof hrCapabilities)[number];
export const hrGrantSchema = z.object({
  userId: z.uuid(),
  capability: z.enum(hrCapabilities),
  scope: z.enum(["workspace", "direct_reports"]),
});
export const hrAccessSchema = z.object({
  userId: z.uuid(),
  owner: z.boolean(),
  grants: z.array(hrGrantSchema),
  hasReports: z.boolean(),
  timezone: z.string(),
  currency: z.string(),
});
export type HrAccess = z.infer<typeof hrAccessSchema>;
export function canHr(access: HrAccess, capability: HrCapability) {
  return access.owner || access.grants.some((grant) => grant.capability === capability);
}
export const calendarDateSchema = z.iso.date();
export const hrPageSchema = z.object({
  q: z.string().trim().max(100).default(""),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const employmentInputSchema = z
  .strictObject({
    employeeCode: z.string().trim().max(50).default(""),
    jobTitle: z.string().trim().max(120).default(""),
    departmentId: z.uuid().nullable().default(null),
    managerId: z.uuid().nullable().default(null),
    employmentType: z.enum(["employee", "contractor", "intern"]).default("employee"),
    status: z.enum(["active", "on_leave", "terminated"]).default("active"),
    hireDate: calendarDateSchema.nullable().default(null),
    endDate: calendarDateSchema.nullable().default(null),
    location: z.string().trim().max(150).default(""),
  })
  .refine((v) => !v.endDate || !v.hireDate || v.endDate >= v.hireDate);
export const departmentInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  managerId: z.uuid().nullable().default(null),
  archived: z.boolean().default(false),
});
export const departmentSchema = departmentInputSchema.extend({
  id: z.uuid(),
  employeeCount: z.number(),
});
export const personSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  image: z.string().nullable(),
  role: z.string(),
  employeeCode: z.string(),
  jobTitle: z.string(),
  departmentId: z.uuid().nullable(),
  department: z.string(),
  managerId: z.uuid().nullable(),
  employmentType: z.string(),
  status: z.string(),
  hireDate: z.string().nullable(),
  endDate: z.string().nullable(),
  location: z.string(),
});
export type Person = z.infer<typeof personSchema>;
export const peopleSchema = z.object({
  people: z.array(personSchema),
  nextOffset: z.number().nullable(),
});
export const departmentsSchema = z.object({ departments: z.array(departmentSchema) });
export const hrAuditSchema = z.object({
  events: z.array(
    z.object({
      id: z.uuid(),
      actorId: z.uuid(),
      action: z.string(),
      targetId: z.string(),
      createdAt: z.string(),
      data: z.record(z.string(), z.unknown()),
    }),
  ),
  nextOffset: z.number().nullable(),
});
export const hrNotificationsSchema = z.object({
  notifications: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      module: z.string(),
      targetId: z.string(),
      readAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
