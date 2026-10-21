import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { idSchema, okSchema, errorSchema } from "@lumo/contracts";
import * as hr from "@lumo/contracts/hr";

import type { ApiContext } from "../../lib/context";

/** Documents the shared web/Electron API with the same validators as runtime handlers. */
export function documentHr(app: OpenAPIHono<ApiContext>) {
  const created = z.object({ id: idSchema });
  type Endpoint = {
    method: "get" | "post" | "put";
    path: string;
    response: z.ZodType;
    input?: z.ZodType;
    query?: z.ZodObject;
    status?: number;
    description?: string;
  };
  const endpoints: Endpoint[] = [
    { method: "get", path: "/access", response: hr.hrAccessSchema },
    { method: "get", path: "/grants", response: z.object({ grants: z.array(hr.hrGrantSchema) }) },
    {
      method: "post",
      path: "/grants",
      response: okSchema,
      input: hr.hrGrantSchema.extend({ revoke: z.boolean().default(false) }).strict(),
    },
    {
      method: "get",
      path: "/audit",
      response: hr.hrAuditSchema,
      query: hr.hrPageSchema,
      description:
        "Requires both access administration and payroll read access. Includes restricted change history.",
    },
    {
      method: "get",
      path: "/notifications",
      response: hr.hrNotificationsSchema,
      description:
        "Recipient-only inbox. Lazily creates one payout-due reminder per authorized operator and finalized unpaid run.",
    },
    { method: "post", path: "/notifications/{id}/read", response: okSchema },
    {
      method: "get",
      path: "/people",
      response: hr.peopleSchema,
      query: hr.hrPageSchema.extend({
        departmentId: idSchema.optional(),
        status: z.enum(["active", "on_leave", "terminated"]).optional(),
      }),
    },
    { method: "put", path: "/people/{id}", response: okSchema, input: hr.employmentInputSchema },
    { method: "get", path: "/departments", response: hr.departmentsSchema },
    {
      method: "post",
      path: "/departments",
      response: created,
      input: hr.departmentInputSchema,
      status: 201,
    },
    {
      method: "put",
      path: "/departments/{id}",
      response: okSchema,
      input: hr.departmentInputSchema,
    },
    {
      method: "get",
      path: "/requests",
      response: hr.approvalsSchema,
      query: hr.hrPageSchema.extend({
        view: z.enum(["mine", "waiting", "all"]).default("mine"),
        status: z.string().optional(),
        type: z.string().optional(),
        employeeId: idSchema.optional(),
        approverId: idSchema.optional(),
        fromDate: hr.calendarDateSchema.optional(),
        toDate: hr.calendarDateSchema.optional(),
      }),
    },
    {
      method: "post",
      path: "/requests",
      response: created,
      input: hr.approvalInputSchema,
      status: 201,
    },
    { method: "put", path: "/requests/{id}", response: okSchema, input: hr.approvalInputSchema },
    { method: "get", path: "/requests/{id}/history", response: hr.approvalHistorySchema },
    {
      method: "post",
      path: "/requests/{id}/comments",
      response: okSchema,
      input: z.strictObject({ comment: z.string().trim().min(1).max(2000) }),
    },
    {
      method: "post",
      path: "/requests/{id}/action",
      response: okSchema,
      input: hr.approvalActionSchema,
    },
    { method: "get", path: "/approval-policies", response: hr.approvalPoliciesSchema },
    {
      method: "post",
      path: "/approval-policies",
      response: okSchema,
      input: hr.approvalPolicyInputSchema,
    },
    {
      method: "post",
      path: "/files/{type}/{targetId}/uploads",
      response: hr.hrUploadSchema,
      input: hr.hrFileInputSchema,
      status: 201,
    },
    { method: "post", path: "/files/{id}/complete", response: okSchema },
    {
      method: "post",
      path: "/files/{id}/download",
      response: hr.hrUrlSchema,
      description:
        "Reauthorizes the request/task relationship before issuing a short-lived private URL.",
    },
    { method: "get", path: "/leave/policies", response: hr.leavePoliciesSchema },
    {
      method: "post",
      path: "/leave/policies",
      response: created,
      input: hr.leavePolicyInputSchema,
      status: 201,
    },
    {
      method: "put",
      path: "/leave/policies/{id}",
      response: okSchema,
      input: hr.leavePolicyInputSchema,
    },
    {
      method: "get",
      path: "/leave/balances",
      response: hr.leaveBalancesSchema,
      query: z.object({
        year: z.coerce.number().int().min(1900).max(2200),
        userId: idSchema.optional(),
        team: z.enum(["true", "false"]).default("false"),
      }),
    },
    {
      method: "post",
      path: "/leave/adjustments",
      response: okSchema,
      input: z.strictObject({
        userId: idSchema,
        leaveTypeId: idSchema,
        year: z.number().int().min(1900).max(2200),
        amountHalfDays: z
          .number()
          .int()
          .min(-732)
          .max(732)
          .refine((v) => v !== 0),
        reason: z.string().trim().min(3).max(500),
        idempotencyKey: idSchema,
      }),
    },
    {
      method: "get",
      path: "/leave/out",
      response: hr.whoOutSchema,
      query: z
        .object({ startDate: hr.calendarDateSchema, endDate: hr.calendarDateSchema })
        .refine((v) => v.endDate >= v.startDate),
    },
    { method: "get", path: "/schedules", response: hr.schedulesSchema },
    { method: "post", path: "/schedules", response: okSchema, input: hr.scheduleInputSchema },
    { method: "get", path: "/holidays", response: hr.holidaysSchema },
    { method: "post", path: "/holidays", response: okSchema, input: hr.holidayInputSchema },
    {
      method: "get",
      path: "/attendance",
      response: hr.attendanceSchema,
      query: hr.attendanceMonthSchema,
    },
    { method: "post", path: "/attendance/punch", response: okSchema, input: hr.punchInputSchema },
    {
      method: "get",
      path: "/attendance/export",
      response: hr.csvResultSchema,
      query: hr.attendanceMonthSchema,
    },
    {
      method: "get",
      path: "/payroll/me",
      response: hr.ownPaySchema,
      query: z.object({ periodStart: hr.calendarDateSchema.optional() }),
    },
    { method: "get", path: "/payroll/me/{runId}/export", response: hr.csvResultSchema },
    { method: "get", path: "/payroll/compensation", response: hr.compensationsSchema },
    {
      method: "post",
      path: "/payroll/compensation",
      response: okSchema,
      input: hr.compensationInputSchema,
    },
    { method: "get", path: "/payroll/settings", response: hr.payrollSettingsSchema },
    {
      method: "post",
      path: "/payroll/settings",
      response: okSchema,
      input: hr.payrollSettingsInputSchema,
    },
    { method: "get", path: "/payroll/schedule", response: hr.payrollScheduleSchema },
    { method: "get", path: "/payroll/runs", response: hr.payRunsSchema },
    {
      method: "post",
      path: "/payroll/runs",
      response: created,
      input: hr.payrollRunInputSchema,
      status: 201,
    },
    { method: "get", path: "/payroll/runs/{id}", response: hr.payrollDetailSchema },
    { method: "post", path: "/payroll/runs/{id}/calculate", response: okSchema },
    {
      method: "post",
      path: "/payroll/runs/{id}/adjustments",
      response: okSchema,
      input: hr.payrollAdjustmentInputSchema,
    },
    {
      method: "post",
      path: "/payroll/runs/{id}/employees/{userId}/verify",
      response: okSchema,
      input: hr.payrollVerifySchema.extend({ revision: z.number().int().min(0) }),
    },
    {
      method: "post",
      path: "/payroll/runs/{id}/action",
      response: okSchema,
      input: z.strictObject({
        action: z.enum(["approve", "finalize", "publish", "mark_paid", "void", "return_to_draft"]),
        revision: z.number().int().min(0),
        confirmation: z.string().max(100).default(""),
        reason: z.string().max(1000).default(""),
      }),
    },
    { method: "get", path: "/payroll/runs/{id}/export", response: hr.csvResultSchema },
    { method: "get", path: "/onboarding/templates", response: hr.onboardingTemplatesSchema },
    {
      method: "post",
      path: "/onboarding/templates",
      response: created,
      input: hr.onboardingTemplateInputSchema,
      status: 201,
    },
    {
      method: "put",
      path: "/onboarding/templates/{id}",
      response: okSchema,
      input: hr.onboardingTemplateInputSchema,
    },
    { method: "get", path: "/onboarding/invitations", response: hr.onboardingInvitationsSchema },
    {
      method: "get",
      path: "/onboarding",
      response: hr.onboardingInstancesSchema,
      query: z.object({ team: z.enum(["true", "false"]).default("false") }),
    },
    {
      method: "post",
      path: "/onboarding/instances",
      response: created,
      input: hr.onboardingAssignSchema,
      status: 201,
    },
    { method: "get", path: "/onboarding/instances/{id}", response: hr.onboardingDetailSchema },
    {
      method: "post",
      path: "/onboarding/tasks/{id}/action",
      response: okSchema,
      input: z.strictObject({
        action: z.enum(["complete", "verify", "reopen", "reassign"]),
        assigneeId: idSchema.optional(),
        comment: z.string().max(2000).default(""),
      }),
    },
  ];
  for (const endpoint of endpoints) {
    const path = `/api/v1/workspaces/{workspaceId}/hr${endpoint.path}`;
    const params = Object.fromEntries(
      [...path.matchAll(/\{(\w+)\}/g)].map((match) => [
        match[1]!,
        match[1] === "type" ? z.enum(["request", "task"]) : idSchema,
      ]),
    );
    app.openAPIRegistry.registerPath({
      method: endpoint.method,
      path,
      tags: ["People & HR"],
      security: [{ cookieAuth: [] }],
      description:
        endpoint.description ??
        "Requires workspace membership and the capability/relationship for this operation. See the People & HR permission matrix.",
      request: {
        params: z.object(params),
        ...(endpoint.query ? { query: endpoint.query } : {}),
        ...(endpoint.input
          ? {
              body: { required: true, content: { "application/json": { schema: endpoint.input } } },
            }
          : {}),
      },
      responses: Object.fromEntries([
        [
          endpoint.status ?? 200,
          {
            description: "Success",
            content: { "application/json": { schema: endpoint.response } },
          },
        ],
        ...[400, 401, 403, 404, 409].map((status) => [
          status,
          {
            description: "Validated API error",
            content: { "application/json": { schema: errorSchema } },
          },
        ]),
      ]),
    });
  }
}
