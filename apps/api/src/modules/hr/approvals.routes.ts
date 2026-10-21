import { idSchema } from "@lumo/contracts";
import {
  calendarDateSchema,
  approvalActionSchema,
  approvalInputSchema,
  approvalPolicyInputSchema,
  hrPageSchema,
  requestDetailsSchema,
} from "@lumo/contracts/hr";
import { hrApprovalPolicy, hrFile, hrRequest, hrRequestEvent } from "@lumo/database/schema";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { ApiContext } from "../../lib/context";
import { AppError, denied, parse } from "../../lib/errors";
import { createRequest, readRequest, recordRequest, requestFor, submitRequest } from "./approvals";
import { auditHr, notifyHr, requireHrMember, type HrCore, type HrContext } from "./core";

export type RequestHooks = {
  validate: (
    c: HrContext,
    details: ReturnType<typeof requestDetailsSchema.parse>,
    requestId?: string,
  ) => Promise<void>;
  transition: (c: HrContext, row: typeof hrRequest.$inferSelect, status: string) => Promise<void>;
};
export function approvalsRoutes(core: HrCore, hooks: RequestHooks) {
  const app = new Hono<ApiContext>();
  app.get("/requests", async (c) => {
    const { q, offset, limit, view, status, type, employeeId, approverId, fromDate, toDate } =
      parse(
        hrPageSchema.extend({
          view: z.enum(["waiting", "mine", "all"]).default("mine"),
          status: z.string().max(30).optional(),
          type: z.string().max(30).optional(),
          employeeId: z.uuid().optional(),
          approverId: z.uuid().optional(),
          fromDate: calendarDateSchema.optional(),
          toDate: calendarDateSchema.optional(),
        }),
        c.req.query(),
      );
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        if (view === "all") await ctx.require("hr.approvals.read_all");
        const requests = await ctx.tx
          .select()
          .from(hrRequest)
          .where(
            and(
              eq(hrRequest.workspaceId, ctx.workspaceId),
              view === "mine"
                ? eq(hrRequest.requesterId, ctx.actorId)
                : view === "waiting"
                  ? sql`${hrRequest.status} = 'pending' and ${hrRequest.approverIds}[${hrRequest.currentStep}+1] = ${ctx.actorId}`
                  : undefined,
              q ? ilike(hrRequest.subject, `%${q}%`) : undefined,
              status ? eq(hrRequest.status, status) : undefined,
              type ? sql`${hrRequest.details}->>'type' = ${type}` : undefined,
              employeeId ? eq(hrRequest.requesterId, employeeId) : undefined,
              approverId ? sql`${approverId} = any(${hrRequest.approverIds})` : undefined,
              fromDate ? sql`${hrRequest.createdAt} >= ${fromDate}::date` : undefined,
              toDate ? sql`${hrRequest.createdAt} < ${toDate}::date + interval '1 day'` : undefined,
            ),
          )
          .orderBy(desc(hrRequest.createdAt), desc(hrRequest.id))
          .offset(offset)
          .limit(limit + 1);
        return {
          requests: requests.slice(0, limit),
          nextOffset: requests.length > limit ? offset + limit : null,
        };
      }),
    );
  });
  app.post("/requests", async (c) => {
    const input = parse(approvalInputSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await hooks.validate(ctx, input.details);
        const row = await createRequest(ctx, input);
        if (!input.draft) {
          await hooks.validate(ctx, input.details, row.id);
          await submitRequest(ctx, row.id);
        }
        return { ok: true, id: row.id };
      }),
      201,
    );
  });
  app.put("/requests/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(approvalInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      const row = await requestFor(ctx, id);
      if (row.requesterId !== ctx.actorId) denied();
      if (row.status !== "draft")
        throw new AppError(409, "INVALID_STATE", "Only drafts can be edited.");
      await hooks.validate(ctx, input.details, id);
      await ctx.tx
        .update(hrRequest)
        .set({
          subject: input.subject,
          description: input.description,
          details: input.details,
          priority: input.priority,
        })
        .where(and(eq(hrRequest.workspaceId, ctx.workspaceId), eq(hrRequest.id, id)));
      await recordRequest(ctx, id, "edited");
    });
    return c.json({ ok: true });
  });
  app.get("/requests/:id/history", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await readRequest(ctx, id);
        return {
          events: await ctx.tx
            .select({
              id: hrRequestEvent.id,
              actorId: hrRequestEvent.actorId,
              action: hrRequestEvent.action,
              comment: hrRequestEvent.comment,
              createdAt: hrRequestEvent.createdAt,
            })
            .from(hrRequestEvent)
            .where(
              and(
                eq(hrRequestEvent.workspaceId, ctx.workspaceId),
                eq(hrRequestEvent.requestId, id),
              ),
            )
            .orderBy(asc(hrRequestEvent.createdAt), asc(hrRequestEvent.id)),
          files: await ctx.tx
            .select({
              id: hrFile.id,
              name: hrFile.name,
              size: hrFile.size,
              mimeType: hrFile.mimeType,
            })
            .from(hrFile)
            .where(
              and(
                eq(hrFile.workspaceId, ctx.workspaceId),
                eq(hrFile.targetType, "request"),
                eq(hrFile.targetId, id),
                eq(hrFile.state, "ready"),
              ),
            ),
        };
      }),
    );
  });
  app.post("/requests/:id/comments", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(
        z.strictObject({ comment: z.string().trim().min(1).max(2000) }),
        await c.req.json(),
      );
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await readRequest(ctx, id);
      await recordRequest(ctx, id, "commented", input.comment);
    });
    return c.json({ ok: true });
  });
  app.post("/requests/:id/action", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(approvalActionSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      const row = await readRequest(ctx, id);
      if (input.action === "reassign") {
        await ctx.require("hr.approvals.manage");
        if (!["draft", "pending"].includes(row.status))
          throw new AppError(409, "INVALID_STATE", "Closed requests cannot be reassigned.");
        const ids = input.approverIds ?? [];
        if (!ids.length || new Set(ids).size !== ids.length || ids.includes(row.requesterId))
          throw new AppError(
            400,
            "INVALID_APPROVERS",
            "Choose distinct approvers other than the requester.",
          );
        for (const userId of ids) await requireHrMember(ctx, userId);
        await ctx.tx
          .update(hrRequest)
          .set({ approverIds: ids, currentStep: 0, blockedReason: null })
          .where(and(eq(hrRequest.workspaceId, ctx.workspaceId), eq(hrRequest.id, id)));
        await recordRequest(ctx, id, "reassigned", input.comment);
        return;
      }
      if (input.action === "submit") {
        await hooks.validate(ctx, requestDetailsSchema.parse(row.details), id);
        await submitRequest(ctx, id);
        return;
      }
      if (input.action === "cancel") {
        if (row.requesterId !== ctx.actorId && !(await ctx.can("hr.approvals.manage"))) denied();
        if (row.status === "cancelled") return;
        if (!["draft", "pending", "approved"].includes(row.status))
          throw new AppError(409, "INVALID_STATE", "Request cannot be cancelled.");
        await hooks.transition(ctx, row, "cancelled");
        await ctx.tx
          .update(hrRequest)
          .set({ status: "cancelled" })
          .where(and(eq(hrRequest.workspaceId, ctx.workspaceId), eq(hrRequest.id, id)));
        await recordRequest(ctx, id, "cancelled", input.comment);
        return;
      }
      if (row.requesterId === ctx.actorId) denied();
      const assigned = row.approverIds[row.currentStep] === ctx.actorId;
      if (!assigned || row.status !== "pending") {
        const prior = await ctx.tx
          .select()
          .from(hrRequestEvent)
          .where(
            and(
              eq(hrRequestEvent.workspaceId, ctx.workspaceId),
              eq(hrRequestEvent.requestId, id),
              eq(hrRequestEvent.actorId, ctx.actorId),
              eq(hrRequestEvent.action, input.action),
            ),
          );
        if (prior.length) return;
        if (!assigned) denied();
        throw new AppError(409, "INVALID_STATE", "This request is no longer pending.");
      }
      const status =
        input.action === "reject"
          ? "rejected"
          : row.currentStep + 1 === row.approverIds.length
            ? "approved"
            : "pending";
      if (status === "approved")
        await hooks.validate(ctx, requestDetailsSchema.parse(row.details), id);
      await hooks.transition(ctx, row, status);
      await ctx.tx
        .update(hrRequest)
        .set({ status, currentStep: status === "pending" ? row.currentStep + 1 : row.currentStep })
        .where(and(eq(hrRequest.workspaceId, ctx.workspaceId), eq(hrRequest.id, id)));
      await recordRequest(ctx, id, input.action, input.comment);
      await notifyHr(
        ctx,
        status === "pending" ? row.approverIds[row.currentStep + 1]! : row.requesterId,
        status === "pending" ? "A request needs your approval" : `Your request was ${status}`,
        "approvals",
        id,
      );
    });
    return c.json({ ok: true });
  });
  app.get("/approval-policies", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.approvals.manage");
        return {
          policies: await ctx.tx
            .select({
              type: hrApprovalPolicy.type,
              approverIds: hrApprovalPolicy.approverIds,
              requireAttachment: hrApprovalPolicy.requireAttachment,
            })
            .from(hrApprovalPolicy)
            .where(eq(hrApprovalPolicy.workspaceId, ctx.workspaceId)),
        };
      }),
    ),
  );
  app.post("/approval-policies", async (c) => {
    const input = parse(approvalPolicyInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.approvals.manage");
      for (const id of input.approverIds) await requireHrMember(ctx, id);
      await ctx.tx
        .insert(hrApprovalPolicy)
        .values({ workspaceId: ctx.workspaceId, ...input })
        .onConflictDoUpdate({
          target: [hrApprovalPolicy.workspaceId, hrApprovalPolicy.type],
          set: input,
        });
      await auditHr(ctx, "approval_policy.updated", input.type, { after: input });
    });
    return c.json({ ok: true });
  });
  return app;
}
