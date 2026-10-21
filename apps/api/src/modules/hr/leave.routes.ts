import { idSchema } from "@lumo/contracts";
import {
  calendarDateSchema,
  holidayInputSchema,
  leavePolicyInputSchema,
  scheduleInputSchema,
} from "@lumo/contracts/hr";
import {
  hrEmployee,
  hrHoliday,
  hrLeaveLedger,
  hrLeaveType,
  hrRequest,
  hrSchedule,
  membership,
} from "@lumo/database/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { ApiContext } from "../../lib/context";
import { AppError, denied, missing, parse } from "../../lib/errors";
import { auditHr, canTeam, requireHrMember, type HrCore } from "./core";
import { ledgerYear } from "./leave";
export function leaveRoutes(core: HrCore) {
  const app = new Hono<ApiContext>();
  app.get("/leave/policies", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => ({
        policies: (
          await ctx.tx
            .select()
            .from(hrLeaveType)
            .where(eq(hrLeaveType.workspaceId, ctx.workspaceId))
            .orderBy(asc(hrLeaveType.name))
        ).map((t) => ({ ...leavePolicyInputSchema.parse(t.data), id: t.id, version: t.version })),
      })),
    ),
  );
  app.post("/leave/policies", async (c) => {
    const input = parse(leavePolicyInputSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.leave.manage_policy");
        const exists = await ctx.tx
          .select()
          .from(hrLeaveType)
          .where(
            and(eq(hrLeaveType.workspaceId, ctx.workspaceId), eq(hrLeaveType.name, input.name)),
          );
        if (exists.length)
          throw new AppError(409, "DUPLICATE_POLICY", "Leave policy name already exists.");
        const [row] = await ctx.tx
          .insert(hrLeaveType)
          .values({ workspaceId: ctx.workspaceId, name: input.name, paid: input.paid, data: input })
          .returning();
        await auditHr(ctx, "leave_policy.created", row!.id, { after: input });
        return { ok: true, id: row!.id };
      }),
      201,
    );
  });
  app.put("/leave/policies/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(leavePolicyInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.leave.manage_policy");
      const [before] = await ctx.tx
        .select()
        .from(hrLeaveType)
        .where(and(eq(hrLeaveType.workspaceId, ctx.workspaceId), eq(hrLeaveType.id, id)));
      if (!before) missing();
      await ctx.tx
        .update(hrLeaveType)
        .set({ name: input.name, paid: input.paid, data: input, version: before.version + 1 })
        .where(and(eq(hrLeaveType.workspaceId, ctx.workspaceId), eq(hrLeaveType.id, id)));
      await auditHr(ctx, "leave_policy.updated", id, { before: before.data, after: input });
    });
    return c.json({ ok: true });
  });
  app.get("/leave/balances", async (c) => {
    const { year, userId, team } = parse(
      z.object({
        year: z.coerce.number().int().min(1900).max(2200).default(new Date().getUTCFullYear()),
        userId: z.uuid().optional(),
        team: z.enum(["true", "false"]).default("false"),
      }),
      c.req.query(),
    );
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const target = userId ?? ctx.actorId;
        let userIds = [target];
        if (!(await canTeam(ctx, "hr.leave.read_team", target))) denied();
        if (team === "true") {
          const all = await ctx.tx
            .select({ userId: membership.userId })
            .from(membership)
            .where(eq(membership.workspaceId, ctx.workspaceId));
          userIds = [];
          for (const row of all)
            if (await canTeam(ctx, "hr.leave.read_team", row.userId)) userIds.push(row.userId);
          if (userIds.length <= 1 && !(await ctx.can("hr.leave.read_team"))) {
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
        }
        const types = await ctx.tx
          .select()
          .from(hrLeaveType)
          .where(eq(hrLeaveType.workspaceId, ctx.workspaceId));
        const balances = [];
        for (const memberId of userIds)
          for (const type of types) {
            const ledger = await ledgerYear(ctx, memberId, type, year);
            const pending = await ctx.tx
              .select()
              .from(hrRequest)
              .where(
                and(
                  eq(hrRequest.workspaceId, ctx.workspaceId),
                  eq(hrRequest.requesterId, memberId),
                  eq(hrRequest.status, "pending"),
                  sql`${hrRequest.details}->>'leaveTypeId' = ${type.id}`,
                ),
              );
            balances.push({
              userId: memberId,
              leaveTypeId: type.id,
              name: type.name,
              paid: type.paid,
              balanceHalfDays: ledger.reduce((n, l) => n + l.amountHalfDays, 0),
              usedHalfDays: -ledger
                .filter(
                  (l) => l.source.startsWith("approved:") || l.source.startsWith("cancelled:"),
                )
                .reduce((n, l) => n + l.amountHalfDays, 0),
              pendingHalfDays: pending.reduce(
                (n, r) =>
                  n +
                  Object.entries((r.details.charges as Record<string, number>) ?? {})
                    .filter(([d]) => Number(d.slice(0, 4)) === year)
                    .reduce((sum, [, v]) => sum + v, 0),
                0,
              ),
              ledger: ledger.map(({ id, amountHalfDays, source, reason, createdAt }) => ({
                id,
                amountHalfDays,
                source,
                reason,
                createdAt,
              })),
            });
          }
        return { balances };
      }),
    );
  });
  app.post("/leave/adjustments", async (c) => {
    const input = parse(
      z.strictObject({
        userId: z.uuid(),
        leaveTypeId: z.uuid(),
        year: z.number().int().min(1900).max(2200),
        amountHalfDays: z
          .number()
          .int()
          .min(-732)
          .max(732)
          .refine((v) => v !== 0),
        reason: z.string().trim().min(3).max(500),
        idempotencyKey: z.uuid(),
      }),
      await c.req.json(),
    );
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.leave.adjust_balances");
      await requireHrMember(ctx, input.userId);
      const [type] = await ctx.tx
        .select()
        .from(hrLeaveType)
        .where(
          and(eq(hrLeaveType.workspaceId, ctx.workspaceId), eq(hrLeaveType.id, input.leaveTypeId)),
        );
      if (!type) missing();
      await ledgerYear(ctx, input.userId, type, input.year);
      await ctx.tx
        .insert(hrLeaveLedger)
        .values({
          workspaceId: ctx.workspaceId,
          userId: input.userId,
          leaveTypeId: input.leaveTypeId,
          year: input.year,
          amountHalfDays: input.amountHalfDays,
          source: `adjustment:${input.idempotencyKey}`,
          reason: input.reason,
          actorId: ctx.actorId,
        })
        .onConflictDoNothing();
      await auditHr(ctx, "leave_balance.adjusted", input.userId, { ...input });
    });
    return c.json({ ok: true });
  });
  app.get("/leave/out", async (c) => {
    const { startDate, endDate } = parse(
      z
        .object({ startDate: calendarDateSchema, endDate: calendarDateSchema })
        .refine((v) => v.endDate >= v.startDate),
      c.req.query(),
    );
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => ({
        absences: (
          await ctx.tx
            .select({ id: hrRequest.id, userId: hrRequest.requesterId, details: hrRequest.details })
            .from(hrRequest)
            .where(
              and(
                eq(hrRequest.workspaceId, ctx.workspaceId),
                eq(hrRequest.status, "approved"),
                sql`${hrRequest.details}->>'type' = 'leave'`,
                sql`${hrRequest.details}->>'startDate' <= ${endDate}`,
                sql`${hrRequest.details}->>'endDate' >= ${startDate}`,
              ),
            )
        ).map((r) => ({
          id: r.id,
          userId: r.userId,
          startDate: String(r.details.startDate),
          endDate: String(r.details.endDate),
          status: "away" as const,
        })),
      })),
    );
  });
  app.get("/schedules", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.attendance.manage_policy");
        return {
          schedules: (
            await ctx.tx
              .select()
              .from(hrSchedule)
              .where(eq(hrSchedule.workspaceId, ctx.workspaceId))
          ).map((s) => ({ ...s.data, id: s.id, timezone: s.timezone })),
        };
      }),
    ),
  );
  app.post("/schedules", async (c) => {
    const input = parse(scheduleInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.attendance.manage_policy");
      await requireHrMember(ctx, input.userId);
      const exists = await ctx.tx
        .select()
        .from(hrSchedule)
        .where(
          and(
            eq(hrSchedule.workspaceId, ctx.workspaceId),
            eq(hrSchedule.userId, input.userId),
            eq(hrSchedule.effectiveFrom, input.effectiveFrom),
          ),
        );
      if (exists.length)
        throw new AppError(
          409,
          "SCHEDULE_EXISTS",
          "Choose a new effective date to preserve schedule history.",
        );
      await ctx.tx.insert(hrSchedule).values({
        workspaceId: ctx.workspaceId,
        userId: input.userId,
        effectiveFrom: input.effectiveFrom,
        timezone: ctx.timezone,
        data: input,
      });
      await auditHr(ctx, "schedule.assigned", input.userId, {
        after: input,
        timezone: ctx.timezone,
      });
    });
    return c.json({ ok: true });
  });
  app.get("/holidays", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => ({
        holidays: await ctx.tx
          .select({ date: hrHoliday.date, name: hrHoliday.name })
          .from(hrHoliday)
          .where(eq(hrHoliday.workspaceId, ctx.workspaceId))
          .orderBy(asc(hrHoliday.date)),
      })),
    ),
  );
  app.post("/holidays", async (c) => {
    const input = parse(holidayInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.attendance.manage_policy");
      await ctx.tx
        .insert(hrHoliday)
        .values({ workspaceId: ctx.workspaceId, ...input })
        .onConflictDoUpdate({
          target: [hrHoliday.workspaceId, hrHoliday.date],
          set: { name: input.name },
        });
      await auditHr(ctx, "holiday.updated", input.date, { after: input });
    });
    return c.json({ ok: true });
  });
  return app;
}
