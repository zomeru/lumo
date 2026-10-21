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

const requestDateRange = z
  .object({ startDate: calendarDateSchema, endDate: calendarDateSchema })
  .refine((v) => v.endDate >= v.startDate, "End date must follow start date");
export const requestDetailsSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("leave"),
      leaveTypeId: z.uuid(),
      startDate: calendarDateSchema,
      endDate: calendarDateSchema,
      halfDay: z.boolean().default(false),
    }),
    z.object({
      type: z.literal("expense"),
      amountMinor: z.number().int().positive().max(1000000000),
      currency: z.string().regex(/^[A-Z]{3}$/),
      date: calendarDateSchema,
      category: z.string().min(1).max(100),
    }),
    z.object({
      type: z.literal("purchase"),
      amountMinor: z.number().int().positive().max(1000000000),
      currency: z.string().regex(/^[A-Z]{3}$/),
      quantity: z.number().int().positive().max(100000),
      vendor: z.string().max(150),
    }),
    z.object({
      type: z.literal("overtime"),
      date: calendarDateSchema,
      durationMinutes: z.number().int().min(1).max(1440),
    }),
    z.object({
      type: z.literal("travel"),
      destination: z.string().min(1).max(200),
      startDate: calendarDateSchema,
      endDate: calendarDateSchema,
      amountMinor: z.number().int().min(0).max(1000000000),
      currency: z.string().regex(/^[A-Z]{3}$/),
    }),
    z.object({
      type: z.literal("advance"),
      amountMinor: z.number().int().positive().max(1000000000),
      currency: z.string().regex(/^[A-Z]{3}$/),
      repaymentDate: calendarDateSchema.nullable().default(null),
    }),
    z.object({ type: z.literal("general") }),
    z.object({
      type: z.literal("attendance_correction"),
      date: calendarDateSchema,
      clockIn: z.iso.datetime(),
      clockOut: z.iso.datetime(),
      breakMinutes: z.number().int().min(0).max(1440),
    }),
  ])
  .superRefine((v, ctx) => {
    if ((v.type === "leave" || v.type === "travel") && !requestDateRange.safeParse(v).success)
      ctx.addIssue({ code: "custom", message: "Invalid date range" });
    if (v.type === "attendance_correction" && v.clockOut <= v.clockIn)
      ctx.addIssue({ code: "custom", message: "Clock out must follow clock in" });
  });
export type RequestDetails = z.infer<typeof requestDetailsSchema>;
export const approvalInputSchema = z.strictObject({
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(["normal", "high"]).default("normal"),
  details: requestDetailsSchema,
  approverIds: z.array(z.uuid()).max(10).default([]),
  draft: z.boolean().default(false),
});
export const approvalActionSchema = z.strictObject({
  action: z.enum(["submit", "approve", "reject", "cancel", "reassign"]),
  comment: z.string().trim().max(2000).default(""),
  approverIds: z.array(z.uuid()).max(10).optional(),
});
export const approvalSchema = z.object({
  id: z.uuid(),
  requesterId: z.uuid(),
  subject: z.string(),
  description: z.string(),
  priority: z.string(),
  details: requestDetailsSchema,
  status: z.string(),
  approverIds: z.array(z.uuid()),
  currentStep: z.number(),
  blockedReason: z.string().nullable(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;
export const approvalsSchema = z.object({
  requests: z.array(approvalSchema),
  nextOffset: z.number().nullable(),
});
export const approvalHistorySchema = z.object({
  events: z.array(
    z.object({
      id: z.uuid(),
      actorId: z.uuid(),
      action: z.string(),
      comment: z.string(),
      createdAt: z.string(),
    }),
  ),
  files: z.array(
    z.object({ id: z.uuid(), name: z.string(), size: z.number(), mimeType: z.string() }),
  ),
});
export const approvalPolicyInputSchema = z.strictObject({
  type: z.enum([
    "leave",
    "expense",
    "purchase",
    "overtime",
    "travel",
    "advance",
    "general",
    "attendance_correction",
  ]),
  approverIds: z.array(z.uuid()).min(1).max(10),
  requireAttachment: z.boolean().default(false),
});
export const approvalPoliciesSchema = z.object({ policies: z.array(approvalPolicyInputSchema) });
export const hrFileInputSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[^/\\]+$/)
    .refine((value) => value.split("").every((char) => char.charCodeAt(0) >= 32)),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "text/plain"]),
  size: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  checksum: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
});
export const hrUploadSchema = z.object({ id: z.uuid(), url: z.url() });
export const hrUrlSchema = z.object({ url: z.url() });

export const scheduleInputSchema = z
  .strictObject({
    userId: z.uuid(),
    effectiveFrom: calendarDateSchema,
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .refine((v) => new Set(v).size === v.length),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
    breakMinutes: z.number().int().min(0).max(480).default(60),
    graceMinutes: z.number().int().min(0).max(120).default(15),
    paidBreaks: z.boolean().default(false),
  })
  .refine(
    (v) =>
      v.startMinute !== v.endMinute && v.breakMinutes < (v.endMinute - v.startMinute + 1440) % 1440,
    "Invalid shift duration",
  );
export type WorkSchedule = z.infer<typeof scheduleInputSchema> & { timezone: string };
export const schedulesSchema = z.object({
  schedules: z.array(scheduleInputSchema.safeExtend({ id: z.uuid(), timezone: z.string() })),
});
export const holidayInputSchema = z.strictObject({
  date: calendarDateSchema,
  name: z.string().trim().min(1).max(120),
});
export const holidaysSchema = z.object({ holidays: z.array(holidayInputSchema) });
export const leavePolicyInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  paid: z.boolean(),
  allocationHalfDays: z.number().int().min(0).max(732),
  accrualHalfDaysMonthly: z.number().int().min(0).max(62).default(0),
  carryoverHalfDays: z.number().int().min(0).max(732).default(0),
  carryoverExpiryMonth: z.number().int().min(1).max(12).nullable().default(null),
  eligibleAfterDays: z.number().int().min(0).max(3650).default(0),
  allowHalfDay: z.boolean().default(true),
  requireDocumentation: z.boolean().default(false),
  enforceBalance: z.boolean().default(true),
  effectiveFrom: calendarDateSchema,
  archived: z.boolean().default(false),
});
export const leavePolicySchema = leavePolicyInputSchema.extend({
  id: z.uuid(),
  version: z.number(),
});
export const leavePoliciesSchema = z.object({ policies: z.array(leavePolicySchema) });
export const leaveBalanceSchema = z.object({
  userId: z.uuid(),
  leaveTypeId: z.uuid(),
  name: z.string(),
  paid: z.boolean(),
  balanceHalfDays: z.number(),
  pendingHalfDays: z.number(),
  usedHalfDays: z.number(),
  ledger: z.array(
    z.object({
      id: z.uuid(),
      amountHalfDays: z.number(),
      source: z.string(),
      reason: z.string(),
      createdAt: z.string(),
    }),
  ),
});
export const leaveBalancesSchema = z.object({ balances: z.array(leaveBalanceSchema) });
export const whoOutSchema = z.object({
  absences: z.array(
    z.object({
      id: z.uuid(),
      userId: z.uuid(),
      startDate: z.string(),
      endDate: z.string(),
      status: z.literal("away"),
    }),
  ),
});

export const attendanceMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  userId: z.uuid().optional(),
  team: z.enum(["true", "false"]).default("false"),
  departmentId: z.uuid().optional(),
  status: z.string().max(30).optional(),
});
export const punchInputSchema = z.strictObject({
  action: z.enum(["clock_in", "start_break", "end_break", "clock_out"]),
  idempotencyKey: z.uuid(),
});
export const attendanceDaySchema = z.object({
  userId: z.uuid(),
  date: z.string(),
  scheduled: z.string(),
  clockIn: z.string().nullable(),
  clockOut: z.string().nullable(),
  breakMinutes: z.number(),
  workedMinutes: z.number(),
  lateMinutes: z.number(),
  late: z.boolean(),
  undertimeMinutes: z.number(),
  overtimeMinutes: z.number(),
  approvedOvertimeMinutes: z.number(),
  status: z.string(),
  correctionId: z.uuid().nullable(),
});
export const attendanceSchema = z.object({
  days: z.array(attendanceDaySchema),
  state: z.enum(["out", "working", "break"]),
  serverTime: z.string(),
  timezone: z.string(),
  metrics: z.object({
    daysPresent: z.number(),
    lateArrivals: z.number(),
    workedMinutes: z.number(),
    absences: z.number(),
  }),
});
export const csvResultSchema = z.object({ filename: z.string(), content: z.string() });
