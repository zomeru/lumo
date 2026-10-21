import {
  type approvalInputSchema,
  requestDetailsSchema,
  type RequestDetails,
} from "@lumo/contracts/hr";
import {
  hrRequest,
  hrRequestEvent,
  hrEmployee,
  hrApprovalPolicy,
  hrFile,
} from "@lumo/database/schema";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { AppError, denied, missing } from "../../lib/errors";
import { auditHr, notifyHr, requireHrMember, type HrContext } from "./core";

export async function requestFor(c: HrContext, id: string) {
  const [row] = await c.tx
    .select()
    .from(hrRequest)
    .where(and(eq(hrRequest.workspaceId, c.workspaceId), eq(hrRequest.id, id)));
  if (!row) missing();
  return row;
}
export async function readRequest(c: HrContext, id: string) {
  const row = await requestFor(c, id);
  if (
    row.requesterId !== c.actorId &&
    !row.approverIds.includes(c.actorId) &&
    !(await c.can("hr.approvals.read_all"))
  )
    missing();
  return row;
}
export async function recordRequest(c: HrContext, id: string, action: string, comment = "") {
  await c.tx
    .insert(hrRequestEvent)
    .values({ workspaceId: c.workspaceId, requestId: id, actorId: c.actorId, action, comment });
  await auditHr(c, `request.${action}`, id);
}
export async function routeRequest(
  c: HrContext,
  details: RequestDetails,
  requesterId: string,
  provided: string[],
) {
  const [policy] = await c.tx
    .select()
    .from(hrApprovalPolicy)
    .where(
      and(eq(hrApprovalPolicy.workspaceId, c.workspaceId), eq(hrApprovalPolicy.type, details.type)),
    );
  const [employee] = await c.tx
    .select()
    .from(hrEmployee)
    .where(and(eq(hrEmployee.workspaceId, c.workspaceId), eq(hrEmployee.userId, requesterId)));
  const ids = policy?.approverIds ?? (employee?.managerId ? [employee.managerId] : provided);
  if (new Set(ids).size !== ids.length || ids.includes(requesterId))
    throw new AppError(
      400,
      "INVALID_APPROVERS",
      "Approvers must be distinct and cannot include the requester.",
    );
  for (const id of ids) await requireHrMember(c, id);
  return ids;
}
export async function createRequest(c: HrContext, input: z.infer<typeof approvalInputSchema>) {
  const approverIds = await routeRequest(c, input.details, c.actorId, input.approverIds);
  const [row] = await c.tx
    .insert(hrRequest)
    .values({
      workspaceId: c.workspaceId,
      requesterId: c.actorId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      details: input.details,
      approverIds,
      status: "draft",
      blockedReason: approverIds.length
        ? null
        : "No approver configured. Ask HR to assign an approver.",
    })
    .returning();
  if (!row) throw new Error("Request insert failed");
  await recordRequest(c, row.id, "created");
  return row;
}
export async function submitRequest(c: HrContext, id: string) {
  const row = await requestFor(c, id);
  if (row.requesterId !== c.actorId) denied();
  if (row.status !== "draft")
    throw new AppError(409, "INVALID_STATE", "Only a draft can be submitted.");
  if (!row.approverIds.length)
    throw new AppError(409, "APPROVER_REQUIRED", "Configure an approver before submitting.");
  for (const approver of row.approverIds) await requireHrMember(c, approver);
  const details = requestDetailsSchema.parse(row.details);
  const [policy] = await c.tx
    .select()
    .from(hrApprovalPolicy)
    .where(
      and(eq(hrApprovalPolicy.workspaceId, c.workspaceId), eq(hrApprovalPolicy.type, details.type)),
    );
  if (policy?.requireAttachment) {
    const files = await c.tx
      .select()
      .from(hrFile)
      .where(
        and(
          eq(hrFile.workspaceId, c.workspaceId),
          eq(hrFile.targetId, id),
          eq(hrFile.state, "ready"),
        ),
      );
    if (!files.length)
      throw new AppError(
        409,
        "ATTACHMENT_REQUIRED",
        "Attach the required documentation before submitting.",
      );
  }
  await c.tx
    .update(hrRequest)
    .set({ status: "pending", submittedAt: new Date(), blockedReason: null })
    .where(and(eq(hrRequest.workspaceId, c.workspaceId), eq(hrRequest.id, id)));
  await recordRequest(c, id, "submitted");
  await notifyHr(c, row.approverIds[0]!, "A request needs your approval", "approvals", id);
}
