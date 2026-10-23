import { attendanceMonthSchema, punchInputSchema } from "@lumolynk/contracts/hr";
import { hrPunch, hrShift } from "@lumolynk/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context";
import { AppError, parse } from "../../lib/errors";
import { attendanceMonth, csvRows } from "./attendance";
import { employeeCalendar, localParts, scheduleOn } from "./calendar";
import { auditHr, type HrCore } from "./core";
export function attendanceRoutes(core: HrCore) {
  const app = new Hono<ApiContext>();
  app.get("/attendance", async (c) => {
    const input = parse(attendanceMonthSchema, c.req.query());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, (ctx) => attendanceMonth(ctx, input)),
    );
  });
  app.post("/attendance/punch", async (c) => {
    const input = parse(punchInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      const prior = await ctx.tx
        .select()
        .from(hrPunch)
        .where(
          and(
            eq(hrPunch.workspaceId, ctx.workspaceId),
            eq(hrPunch.userId, ctx.actorId),
            eq(hrPunch.idempotencyKey, input.idempotencyKey),
          ),
        );
      if (prior.length) {
        if (prior[0]!.action !== input.action)
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This submission key was already used for a different clock action.",
          );
        return;
      }
      const now = new Date();
      let [shift] = await ctx.tx
        .select()
        .from(hrShift)
        .where(
          and(
            eq(hrShift.workspaceId, ctx.workspaceId),
            eq(hrShift.userId, ctx.actorId),
            sql`${hrShift.clockOut} is null`,
          ),
        );
      const onBreak = shift?.breaks.at(-1)?.end === null;
      if (input.action === "clock_in") {
        if (shift)
          throw new AppError(
            409,
            "INVALID_CLOCK_STATE",
            "Clock out of the open shift before clocking in.",
          );
        const calendar = await employeeCalendar(ctx, ctx.actorId);
        let date = localParts(now, ctx.timezone).date;
        let schedule = scheduleOn(calendar.schedules, date);
        if (schedule) {
          const local = localParts(now, schedule.timezone);
          date = local.date;
          if (schedule.endMinute < schedule.startMinute && local.minute < schedule.endMinute)
            date = new Date(new Date(`${date}T12:00:00Z`).getTime() - 86400000)
              .toISOString()
              .slice(0, 10);
          schedule = scheduleOn(calendar.schedules, date);
        }
        [shift] = await ctx.tx
          .insert(hrShift)
          .values({
            workspaceId: ctx.workspaceId,
            userId: ctx.actorId,
            workDate: date,
            clockIn: now,
            timezone: schedule?.timezone ?? ctx.timezone,
            schedule: schedule
              ? Object.fromEntries(Object.entries(schedule).filter(([key]) => key !== "timezone"))
              : null,
          })
          .returning();
      } else {
        if (
          !shift ||
          (input.action === "start_break" && onBreak) ||
          (input.action === "end_break" && !onBreak) ||
          (input.action === "clock_out" && onBreak)
        )
          throw new AppError(
            409,
            "INVALID_CLOCK_STATE",
            "That action is unavailable in the current clock state. End an active break before clocking out.",
          );
        const breaks = shift.breaks.map((b) => ({ ...b }));
        if (input.action === "start_break") breaks.push({ start: now.toISOString(), end: null });
        if (input.action === "end_break") breaks[breaks.length - 1]!.end = now.toISOString();
        await ctx.tx
          .update(hrShift)
          .set({ breaks, ...(input.action === "clock_out" ? { clockOut: now } : {}) })
          .where(and(eq(hrShift.workspaceId, ctx.workspaceId), eq(hrShift.id, shift.id)));
      }
      await ctx.tx.insert(hrPunch).values({
        workspaceId: ctx.workspaceId,
        userId: ctx.actorId,
        shiftId: shift!.id,
        action: input.action,
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
      });
      await auditHr(ctx, `attendance.${input.action}`, shift!.id);
    });
    return c.json({ ok: true });
  });
  app.get("/attendance/export", async (c) => {
    const input = parse(attendanceMonthSchema, c.req.query());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const result = await attendanceMonth(ctx, input);
        await auditHr(ctx, "attendance.exported", input.month, {
          team: input.team,
          userId: input.userId,
        });
        return {
          filename: `${ctx.workspaceId}-attendance-${input.month}.csv`,
          content: csvRows(
            [
              "Employee",
              "Date",
              "Scheduled",
              "In (UTC)",
              "Out (UTC)",
              "Break minutes",
              "Worked minutes",
              "Actual late minutes",
              "Late after grace",
              "Undertime minutes",
              "Overtime minutes",
              "Approved overtime minutes",
              "Status",
            ],
            result.days.map((d) => [
              d.userId,
              d.date,
              d.scheduled,
              d.clockIn,
              d.clockOut,
              d.breakMinutes,
              d.workedMinutes,
              d.lateMinutes,
              d.late,
              d.undertimeMinutes,
              d.overtimeMinutes,
              d.approvedOvertimeMinutes,
              d.status,
            ]),
          ),
        };
      }),
    );
  });
  return app;
}
