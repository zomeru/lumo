import { idSchema } from "@lumolynk/contracts";
import {
  onboardingAssignSchema,
  onboardingStepSchema,
  onboardingTemplateInputSchema,
} from "@lumolynk/contracts/hr";
import {
  hrEmployee,
  hrFile,
  hrOnboardingEvent,
  hrOnboardingInstance,
  hrOnboardingTask,
  hrOnboardingTemplate,
  invitation,
} from "@lumolynk/database/schema";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { ApiContext } from "../../lib/context";
import { AppError, denied, missing, parse } from "../../lib/errors";
import { auditHr, canTeam, notifyHr, requireHrMember, type HrCore } from "./core";
import { taskFor } from "./onboarding";
export function onboardingRoutes(core: HrCore) {
  const app = new Hono<ApiContext>();
  app.get("/onboarding/templates", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.onboarding.manage");
        return {
          templates: await ctx.tx
            .select({
              id: hrOnboardingTemplate.id,
              name: hrOnboardingTemplate.name,
              active: hrOnboardingTemplate.active,
              steps: hrOnboardingTemplate.steps,
              version: hrOnboardingTemplate.version,
            })
            .from(hrOnboardingTemplate)
            .where(eq(hrOnboardingTemplate.workspaceId, ctx.workspaceId))
            .orderBy(asc(hrOnboardingTemplate.name)),
        };
      }),
    ),
  );
  app.post("/onboarding/templates", async (c) => {
    const input = parse(onboardingTemplateInputSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.onboarding.manage");
        const [row] = await ctx.tx
          .insert(hrOnboardingTemplate)
          .values({ workspaceId: ctx.workspaceId, ...input })
          .returning();
        await auditHr(ctx, "onboarding_template.created", row!.id, { after: input });
        return { ok: true, id: row!.id };
      }),
      201,
    );
  });
  app.put("/onboarding/templates/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(onboardingTemplateInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.onboarding.manage");
      const [row] = await ctx.tx
        .select()
        .from(hrOnboardingTemplate)
        .where(
          and(
            eq(hrOnboardingTemplate.workspaceId, ctx.workspaceId),
            eq(hrOnboardingTemplate.id, id),
          ),
        );
      if (!row) missing();
      await ctx.tx
        .update(hrOnboardingTemplate)
        .set({ ...input, version: row.version + 1 })
        .where(
          and(
            eq(hrOnboardingTemplate.workspaceId, ctx.workspaceId),
            eq(hrOnboardingTemplate.id, id),
          ),
        );
      await auditHr(ctx, "onboarding_template.updated", id, {
        before: { name: row.name, steps: row.steps, version: row.version },
        after: input,
      });
    });
    return c.json({ ok: true });
  });
  app.get("/onboarding/invitations", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.onboarding.manage");
        return {
          invitations: await ctx.tx
            .select({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt })
            .from(invitation)
            .where(
              and(
                eq(invitation.workspaceId, ctx.workspaceId),
                isNull(invitation.acceptedAt),
                isNull(invitation.revokedAt),
                gt(invitation.expiresAt, new Date()),
              ),
            )
            .orderBy(asc(invitation.createdAt)),
        };
      }),
    ),
  );
  app.post("/onboarding/instances", async (c) => {
    const input = parse(onboardingAssignSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.onboarding.manage");
        await requireHrMember(ctx, input.hrAssigneeId);
        if (input.itAssigneeId) await requireHrMember(ctx, input.itAssigneeId);
        if (input.userId) await requireHrMember(ctx, input.userId);
        if (input.invitationId) {
          const [invite] = await ctx.tx
            .select()
            .from(invitation)
            .where(
              and(
                eq(invitation.workspaceId, ctx.workspaceId),
                eq(invitation.id, input.invitationId),
                isNull(invitation.acceptedAt),
                isNull(invitation.revokedAt),
                gt(invitation.expiresAt, new Date()),
              ),
            );
          if (!invite) missing();
        }
        const [template] = await ctx.tx
          .select()
          .from(hrOnboardingTemplate)
          .where(
            and(
              eq(hrOnboardingTemplate.workspaceId, ctx.workspaceId),
              eq(hrOnboardingTemplate.id, input.templateId),
              eq(hrOnboardingTemplate.active, true),
            ),
          );
        if (!template) missing();
        const [employee] = input.userId
          ? await ctx.tx
              .select()
              .from(hrEmployee)
              .where(
                and(
                  eq(hrEmployee.workspaceId, ctx.workspaceId),
                  eq(hrEmployee.userId, input.userId),
                ),
              )
          : [];
        const [instance] = await ctx.tx
          .insert(hrOnboardingInstance)
          .values({
            workspaceId: ctx.workspaceId,
            templateId: template.id,
            userId: input.userId,
            invitationId: input.invitationId,
            name: template.name,
            version: template.version,
            snapshot: { steps: template.steps },
            startDate: input.startDate,
            ownerId: ctx.actorId,
          })
          .returning();
        for (const [position, raw] of template.steps.entries()) {
          const step = onboardingStepSchema.parse(raw),
            assigneeId = {
              employee: input.userId,
              manager: employee?.managerId ?? null,
              hr: input.hrAssigneeId,
              it: input.itAssigneeId,
            }[step.assigneeRole];
          const dueDate = new Date(
            new Date(`${input.startDate}T12:00:00Z`).getTime() + step.dueOffsetDays * 86400000,
          )
            .toISOString()
            .slice(0, 10);
          const [task] = await ctx.tx
            .insert(hrOnboardingTask)
            .values({
              workspaceId: ctx.workspaceId,
              instanceId: instance!.id,
              assigneeId,
              step,
              position,
              dueDate,
            })
            .returning();
          await ctx.tx.insert(hrOnboardingEvent).values({
            workspaceId: ctx.workspaceId,
            taskId: task!.id,
            actorId: ctx.actorId,
            action: "assigned",
          });
          if (assigneeId)
            await notifyHr(
              ctx,
              assigneeId,
              `Onboarding: ${step.title}`,
              "onboarding",
              instance!.id,
            );
        }
        await auditHr(ctx, "onboarding.assigned", instance!.id, {
          templateId: template.id,
          version: template.version,
          userId: input.userId,
          invitationId: input.invitationId,
        });
        return { ok: true, id: instance!.id };
      }),
      201,
    );
  });
  app.get("/onboarding", async (c) => {
    const view = parse(z.enum(["mine", "checklists"]), c.req.query("view") ?? "mine");
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const manage = await ctx.can("hr.onboarding.manage"),
          verify = await ctx.can("hr.onboarding.verify");
        const all = await ctx.tx
          .select()
          .from(hrOnboardingInstance)
          .where(eq(hrOnboardingInstance.workspaceId, ctx.workspaceId))
          .orderBy(desc(hrOnboardingInstance.createdAt))
          .limit(200);
        const tasks = await ctx.tx
          .select()
          .from(hrOnboardingTask)
          .where(eq(hrOnboardingTask.workspaceId, ctx.workspaceId))
          .orderBy(asc(hrOnboardingTask.position));
        const instances = [],
          visible = [];
        for (const instance of all) {
          const assigned = tasks.filter((t) => t.instanceId === instance.id);
          const own =
            assigned.some((t) => t.assigneeId === ctx.actorId) || instance.userId === ctx.actorId;
          const team = instance.userId
            ? await canTeam(ctx, "hr.leave.read_team", instance.userId)
            : false;
          if (view === "mine" ? !own : !manage && !verify && !team) continue;
          const required = assigned.filter((t) => onboardingStepSchema.parse(t.step).required),
            completed = required.filter((t) => ["completed", "verified"].includes(t.status)).length;
          instances.push({
            id: instance.id,
            name: instance.name,
            userId: instance.userId,
            invitationId: instance.invitationId,
            startDate: instance.startDate,
            ownerId: instance.ownerId,
            version: instance.version,
            completed,
            total: required.length,
            status:
              completed === required.length ? ("completed" as const) : ("in_progress" as const),
          });
          visible.push(...assigned.filter((t) => t.assigneeId === ctx.actorId || manage || verify));
        }
        if (view === "checklists" && !manage && !verify && !instances.length) {
          const reports = await ctx.tx
            .select()
            .from(hrEmployee)
            .where(
              and(
                eq(hrEmployee.workspaceId, ctx.workspaceId),
                eq(hrEmployee.managerId, ctx.actorId),
              ),
            );
          if (!reports.length) denied();
        }
        return { instances, tasks: visible };
      }),
    );
  });
  app.get("/onboarding/instances/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const rows = await ctx.tx
          .select()
          .from(hrOnboardingTask)
          .where(
            and(
              eq(hrOnboardingTask.workspaceId, ctx.workspaceId),
              eq(hrOnboardingTask.instanceId, id),
            ),
          )
          .orderBy(asc(hrOnboardingTask.position));
        const tasks = [];
        for (const task of rows) {
          if (
            task.assigneeId === ctx.actorId ||
            (await ctx.can("hr.onboarding.manage")) ||
            (await ctx.can("hr.onboarding.verify"))
          )
            tasks.push(task);
        }
        if (!tasks.length) missing();
        const ids = tasks.map((t) => t.id);
        return {
          tasks,
          events: await ctx.tx
            .select({
              id: hrOnboardingEvent.id,
              taskId: hrOnboardingEvent.taskId,
              actorId: hrOnboardingEvent.actorId,
              action: hrOnboardingEvent.action,
              comment: hrOnboardingEvent.comment,
              createdAt: hrOnboardingEvent.createdAt,
            })
            .from(hrOnboardingEvent)
            .where(
              and(
                eq(hrOnboardingEvent.workspaceId, ctx.workspaceId),
                inArray(hrOnboardingEvent.taskId, ids),
              ),
            )
            .orderBy(asc(hrOnboardingEvent.createdAt)),
          files: await ctx.tx
            .select({ id: hrFile.id, targetId: hrFile.targetId, name: hrFile.name })
            .from(hrFile)
            .where(
              and(
                eq(hrFile.workspaceId, ctx.workspaceId),
                eq(hrFile.targetType, "task"),
                inArray(hrFile.targetId, ids),
                eq(hrFile.state, "ready"),
              ),
            ),
        };
      }),
    );
  });
  app.post("/onboarding/tasks/:id/action", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(
        z.strictObject({
          action: z.enum(["complete", "verify", "reopen", "reassign"]),
          assigneeId: z.uuid().optional(),
          comment: z.string().max(2000).default(""),
        }),
        await c.req.json(),
      );
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      const task = await taskFor(ctx, id),
        step = onboardingStepSchema.parse(task.step);
      let status = task.status;
      if (input.action === "complete") {
        if (task.assigneeId !== ctx.actorId) denied();
        if (["completed", "verified", "submitted"].includes(status)) return;
        if (step.requiresAttachment) {
          const files = await ctx.tx
            .select()
            .from(hrFile)
            .where(
              and(
                eq(hrFile.workspaceId, ctx.workspaceId),
                eq(hrFile.targetId, id),
                eq(hrFile.state, "ready"),
              ),
            );
          if (!files.length)
            throw new AppError(
              409,
              "SUBMISSION_REQUIRED",
              "Attach the required document before completing this task.",
            );
        }
        status = step.requiresVerification ? "submitted" : "completed";
      } else if (input.action === "verify") {
        await ctx.require("hr.onboarding.verify");
        if (task.assigneeId === ctx.actorId) denied();
        if (status !== "submitted")
          throw new AppError(409, "INVALID_TASK_STATE", "Only submitted tasks can be verified.");
        status = "verified";
      } else if (input.action === "reopen") {
        await ctx.require("hr.onboarding.manage");
        if (input.comment.trim().length < 3)
          throw new AppError(400, "REASON_REQUIRED", "Explain why the task is being reopened.");
        status = "todo";
      } else {
        await ctx.require("hr.onboarding.manage");
        if (!input.assigneeId) throw new AppError(400, "ASSIGNEE_REQUIRED", "Choose an assignee.");
        await requireHrMember(ctx, input.assigneeId);
      }
      await ctx.tx
        .update(hrOnboardingTask)
        .set({ status, ...(input.action === "reassign" ? { assigneeId: input.assigneeId } : {}) })
        .where(and(eq(hrOnboardingTask.workspaceId, ctx.workspaceId), eq(hrOnboardingTask.id, id)));
      await ctx.tx.insert(hrOnboardingEvent).values({
        workspaceId: ctx.workspaceId,
        taskId: id,
        actorId: ctx.actorId,
        action: input.action,
        comment: input.comment,
      });
      await auditHr(ctx, `onboarding_task.${input.action}`, id, {
        before: { status: task.status, assigneeId: task.assigneeId },
        after: { status, assigneeId: input.assigneeId ?? task.assigneeId },
      });
      if (input.action === "complete") {
        const [instance] = await ctx.tx
          .select()
          .from(hrOnboardingInstance)
          .where(
            and(
              eq(hrOnboardingInstance.workspaceId, ctx.workspaceId),
              eq(hrOnboardingInstance.id, task.instanceId),
            ),
          );
        if (instance)
          await notifyHr(
            ctx,
            instance.ownerId,
            "An onboarding task was submitted",
            "onboarding",
            task.instanceId,
          );
      } else if (task.assigneeId)
        await notifyHr(
          ctx,
          task.assigneeId,
          `Onboarding task ${input.action}`,
          "onboarding",
          task.instanceId,
        );
    });
    return c.json({ ok: true });
  });
  return app;
}
