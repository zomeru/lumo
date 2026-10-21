import {
  leavePolicyInputSchema,
  requestDetailsSchema,
  type RequestDetails,
} from "@lumo/contracts/hr";
import { hrEmployee, hrLeaveLedger, hrLeaveType, hrRequest, hrFile } from "@lumo/database/schema";
import { and, eq, sql } from "drizzle-orm";

import { AppError, missing } from "../../lib/errors";
import { requestFor } from "./approvals";
import { datesBetween, employeeCalendar, localParts, scheduleOn, scheduledDay } from "./calendar";
import type { HrContext } from "./core";

export async function ledgerYear(
  c: HrContext,
  userId: string,
  type: typeof hrLeaveType.$inferSelect,
  year: number,
) {
  const policy = leavePolicyInputSchema.parse(type.data);
  const [employee] = await c.tx
    .select()
    .from(hrEmployee)
    .where(and(eq(hrEmployee.workspaceId, c.workspaceId), eq(hrEmployee.userId, userId)));
  const today = localParts(new Date(), c.timezone).date;
  const eligible = employee?.hireDate
    ? new Date(
        new Date(`${employee.hireDate}T00:00:00Z`).getTime() + policy.eligibleAfterDays * 86400000,
      )
        .toISOString()
        .slice(0, 10)
    : policy.effectiveFrom;
  const from = [`${year}-01-01`, eligible, policy.effectiveFrom].sort().at(-1)!;
  async function entry(source: string, amountHalfDays: number, reason: string) {
    await c.tx
      .insert(hrLeaveLedger)
      .values({
        workspaceId: c.workspaceId,
        userId,
        leaveTypeId: type.id,
        year,
        source,
        amountHalfDays,
        reason,
        actorId: c.actorId,
      })
      .onConflictDoNothing();
  }
  if (from <= `${year}-12-31`) {
    await entry(`opening:${year}`, policy.allocationHalfDays, "Annual opening allocation");
    const monthMax = Math.min(
      12,
      year === Number(today.slice(0, 4))
        ? Number(today.slice(5, 7))
        : year > Number(today.slice(0, 4))
          ? 0
          : 12,
    );
    for (let month = 1; month <= monthMax; month++) {
      const date = `${year}-${String(month).padStart(2, "0")}-01`;
      if (date >= from)
        await entry(`accrual:${year}-${month}`, policy.accrualHalfDaysMonthly, "Monthly accrual");
    }
    if (policy.carryoverHalfDays) {
      const prior = await c.tx
        .select()
        .from(hrLeaveLedger)
        .where(
          and(
            eq(hrLeaveLedger.workspaceId, c.workspaceId),
            eq(hrLeaveLedger.userId, userId),
            eq(hrLeaveLedger.leaveTypeId, type.id),
            eq(hrLeaveLedger.year, year - 1),
          ),
        );
      const carry = Math.min(
        policy.carryoverHalfDays,
        Math.max(
          0,
          prior.reduce((n, l) => n + l.amountHalfDays, 0),
        ),
      );
      await entry(`carryover:${year}`, carry, "Carryover from previous year");
      if (
        policy.carryoverExpiryMonth &&
        today >= `${year}-${String(policy.carryoverExpiryMonth).padStart(2, "0")}-01`
      ) {
        const rows = await c.tx
          .select()
          .from(hrLeaveLedger)
          .where(
            and(
              eq(hrLeaveLedger.workspaceId, c.workspaceId),
              eq(hrLeaveLedger.userId, userId),
              eq(hrLeaveLedger.leaveTypeId, type.id),
              eq(hrLeaveLedger.year, year),
            ),
          );
        const consumed = -rows
          .filter((l) => l.amountHalfDays < 0 && !l.source.startsWith("expiry:"))
          .reduce((n, l) => n + l.amountHalfDays, 0);
        await entry(`expiry:${year}`, -Math.max(0, carry - consumed), "Unused carryover expiry");
      }
    }
  }
  return c.tx
    .select()
    .from(hrLeaveLedger)
    .where(
      and(
        eq(hrLeaveLedger.workspaceId, c.workspaceId),
        eq(hrLeaveLedger.userId, userId),
        eq(hrLeaveLedger.leaveTypeId, type.id),
        eq(hrLeaveLedger.year, year),
      ),
    );
}
export async function validateLeave(c: HrContext, details: RequestDetails, requestId?: string) {
  if (details.type !== "leave") return;
  const request = requestId ? await requestFor(c, requestId) : null;
  const userId = request?.requesterId ?? c.actorId;
  const [type] = await c.tx
    .select()
    .from(hrLeaveType)
    .where(
      and(eq(hrLeaveType.workspaceId, c.workspaceId), eq(hrLeaveType.id, details.leaveTypeId)),
    );
  if (!type) missing();
  const policy = leavePolicyInputSchema.parse(request?.details.policySnapshot ?? type.data);
  if (policy.archived || details.startDate < policy.effectiveFrom)
    throw new AppError(
      400,
      "LEAVE_INELIGIBLE",
      "This leave policy is unavailable for the selected dates.",
    );
  const days = datesBetween(details.startDate, details.endDate);
  if (
    !days.length ||
    days.length > 366 ||
    (details.halfDay && (!policy.allowHalfDay || days.length !== 1))
  )
    throw new AppError(
      400,
      "INVALID_LEAVE_RANGE",
      "Select an eligible date range or a single half day.",
    );
  const [employee] = await c.tx
    .select()
    .from(hrEmployee)
    .where(and(eq(hrEmployee.workspaceId, c.workspaceId), eq(hrEmployee.userId, userId)));
  if (
    employee?.hireDate &&
    new Date(`${details.startDate}T00:00:00Z`).getTime() <
      new Date(`${employee.hireDate}T00:00:00Z`).getTime() + policy.eligibleAfterDays * 86400000
  )
    throw new AppError(400, "LEAVE_INELIGIBLE", "The employee is not yet eligible for this leave.");
  const calendar = await employeeCalendar(c, userId);
  const charges: Record<string, number> = {};
  for (const day of days) {
    if (scheduledDay(scheduleOn(calendar.schedules, day), day, calendar.holidays))
      charges[day] = details.halfDay ? 1 : 2;
  }
  if (!Object.keys(charges).length)
    throw new AppError(
      400,
      "NO_SCHEDULED_DAYS",
      "Assign a work schedule; leave must include scheduled workdays.",
    );
  const existing = await c.tx
    .select()
    .from(hrRequest)
    .where(
      and(
        eq(hrRequest.workspaceId, c.workspaceId),
        eq(hrRequest.requesterId, userId),
        sql`${hrRequest.status} in ('pending','approved')`,
        sql`${hrRequest.details}->>'type' = 'leave'`,
      ),
    );
  if (
    existing.some(
      (r) =>
        r.id !== requestId &&
        String(r.details.startDate) <= details.endDate &&
        String(r.details.endDate) >= details.startDate,
    )
  )
    throw new AppError(409, "LEAVE_OVERLAP", "This request overlaps existing leave.");
  for (const year of new Set(Object.keys(charges).map((d) => Number(d.slice(0, 4))))) {
    const ledger = await ledgerYear(c, userId, type, year);
    const balance = ledger.reduce((sum, l) => sum + l.amountHalfDays, 0);
    const reserved = existing
      .filter(
        (r) => r.id !== requestId && r.status === "pending" && r.details.leaveTypeId === type.id,
      )
      .reduce(
        (sum, r) =>
          sum +
          Object.entries((r.details.charges as Record<string, number>) ?? {})
            .filter(([date]) => Number(date.slice(0, 4)) === year)
            .reduce((n, [, v]) => n + v, 0),
        0,
      );
    const charge = Object.entries(charges)
      .filter(([date]) => Number(date.slice(0, 4)) === year)
      .reduce((n, [, v]) => n + v, 0);
    if (policy.enforceBalance && balance - reserved < charge)
      throw new AppError(
        409,
        "INSUFFICIENT_LEAVE",
        "Insufficient leave balance for the selected year.",
      );
  }
  if (requestId) {
    if (policy.requireDocumentation) {
      const files = await c.tx
        .select()
        .from(hrFile)
        .where(
          and(
            eq(hrFile.workspaceId, c.workspaceId),
            eq(hrFile.targetId, requestId),
            eq(hrFile.state, "ready"),
          ),
        );
      if (!files.length)
        throw new AppError(
          400,
          "DOCUMENTATION_REQUIRED",
          "Attach the required leave documentation.",
        );
    }
    await c.tx
      .update(hrRequest)
      .set({
        details: {
          ...details,
          charges,
          paid: policy.paid,
          policyVersion: request?.details.policyVersion ?? type.version,
          policySnapshot: policy,
        },
      })
      .where(and(eq(hrRequest.workspaceId, c.workspaceId), eq(hrRequest.id, requestId)));
  }
}
export async function transitionLeave(
  c: HrContext,
  row: typeof hrRequest.$inferSelect,
  status: string,
) {
  const details = requestDetailsSchema.parse(row.details);
  if (details.type !== "leave") return;
  if (status !== "approved" && !(status === "cancelled" && row.status === "approved")) return;
  const current = await requestFor(c, row.id);
  const charges = current.details.charges as Record<string, number>;
  for (const year of new Set(Object.keys(charges).map((d) => Number(d.slice(0, 4))))) {
    const amount = Object.entries(charges)
      .filter(([date]) => Number(date.slice(0, 4)) === year)
      .reduce((sum, [, n]) => sum + n, 0);
    await c.tx
      .insert(hrLeaveLedger)
      .values({
        workspaceId: c.workspaceId,
        userId: row.requesterId,
        leaveTypeId: details.leaveTypeId,
        year,
        source: `${status}:${row.id}:${year}`,
        amountHalfDays: status === "approved" ? -amount : amount,
        reason: status === "approved" ? "Approved leave" : "Leave cancellation reversal",
        actorId: c.actorId,
      })
      .onConflictDoNothing();
  }
}
