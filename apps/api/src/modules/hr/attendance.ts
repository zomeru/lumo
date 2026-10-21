import { requestDetailsSchema, scheduleInputSchema, type WorkSchedule } from "@lumo/contracts/hr";
import {
  hrAttendanceCorrection,
  hrEmployee,
  hrRequest,
  hrShift,
  membership,
} from "@lumo/database/schema";
import { and, asc, eq, sql } from "drizzle-orm";

import { AppError, denied } from "../../lib/errors";
import {
  datesBetween,
  employeeCalendar,
  localParts,
  scheduleOn,
  scheduledDay,
  wallInstant,
} from "./calendar";
import { canTeam, type HrContext } from "./core";

export function shiftMinutes(
  shift: { clockIn: Date; clockOut: Date | null; breaks: { start: string; end: string | null }[] },
  schedule: WorkSchedule | undefined,
  workDate: string,
  now: Date,
) {
  const end = shift.clockOut ?? now;
  const breakMinutes = shift.breaks.reduce(
    (n, b) =>
      n +
      Math.max(
        0,
        ((b.end ? new Date(b.end) : end).getTime() - new Date(b.start).getTime()) / 60000,
      ),
    0,
  );
  const workedMinutes = Math.max(
    0,
    Math.floor(
      (end.getTime() - shift.clockIn.getTime()) / 60000 - (schedule?.paidBreaks ? 0 : breakMinutes),
    ),
  );
  const lateMinutes = schedule
    ? Math.max(
        0,
        Math.ceil(
          (shift.clockIn.getTime() -
            wallInstant(workDate, schedule.startMinute, schedule.timezone).getTime()) /
            60000,
        ),
      )
    : 0;
  return {
    breakMinutes: Math.floor(breakMinutes),
    workedMinutes,
    lateMinutes,
    late: lateMinutes > (schedule?.graceMinutes ?? 15),
  };
}
export function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+\-@\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
export function csvRows(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export async function attendanceMonth(
  c: HrContext,
  input: { month: string; userId?: string; team?: string; departmentId?: string; status?: string },
  now = new Date(),
  payroll = false,
) {
  const target = input.userId ?? c.actorId;
  if (payroll) await c.require("hr.payroll.runs.manage");
  else if (!(await canTeam(c, "hr.attendance.read_team", target))) denied();
  let userIds = [target];
  const employees = await c.tx
    .select()
    .from(hrEmployee)
    .where(eq(hrEmployee.workspaceId, c.workspaceId));
  if (input.team === "true") {
    userIds = [];
    for (const m of await c.tx
      .select()
      .from(membership)
      .where(eq(membership.workspaceId, c.workspaceId)))
      if (await canTeam(c, "hr.attendance.read_team", m.userId)) userIds.push(m.userId);
    if (
      userIds.length <= 1 &&
      !(await c.can("hr.attendance.read_team")) &&
      !employees.some((e) => e.managerId === c.actorId)
    )
      denied();
  }
  if (input.departmentId)
    userIds = userIds.filter((id) =>
      employees.some((e) => e.userId === id && e.departmentId === input.departmentId),
    );
  const end = new Date(
    Date.UTC(Number(input.month.slice(0, 4)), Number(input.month.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const calendarDays = datesBetween(`${input.month}-01`, end);
  const days = [];
  for (const userId of userIds) {
    const calendar = await employeeCalendar(c, userId),
      employee = employees.find((e) => e.userId === userId);
    const shifts = await c.tx
      .select()
      .from(hrShift)
      .where(
        and(
          eq(hrShift.workspaceId, c.workspaceId),
          eq(hrShift.userId, userId),
          sql`${hrShift.workDate} between ${input.month + "-01"} and ${end}`,
        ),
      );
    const corrections = await c.tx
      .select()
      .from(hrAttendanceCorrection)
      .where(
        and(
          eq(hrAttendanceCorrection.workspaceId, c.workspaceId),
          eq(hrAttendanceCorrection.userId, userId),
          sql`${hrAttendanceCorrection.date} between ${input.month + "-01"} and ${end}`,
        ),
      )
      .orderBy(asc(hrAttendanceCorrection.createdAt));
    const approved = await c.tx
      .select()
      .from(hrRequest)
      .where(
        and(
          eq(hrRequest.workspaceId, c.workspaceId),
          eq(hrRequest.requesterId, userId),
          eq(hrRequest.status, "approved"),
        ),
      );
    for (const date of calendarDays) {
      const actual = shifts.filter((s) => s.workDate === date);
      const correction = corrections.filter((r) => r.date === date).at(-1);
      const schedule = actual[0]?.schedule
        ? { ...scheduleInputSchema.parse(actual[0].schedule), timezone: actual[0].timezone }
        : scheduleOn(calendar.schedules, date);
      const today = localParts(now, schedule?.timezone ?? c.timezone).date;
      const employed =
        (!employee?.hireDate || date >= employee.hireDate) &&
        (!employee?.endDate || date <= employee.endDate);
      const scheduled = employed && scheduledDay(schedule, date, calendar.holidays);
      const leaveHalfDays = approved
        .filter((r) => r.details.type === "leave")
        .reduce(
          (n, r) =>
            n + Number((r.details.charges as Record<string, number> | undefined)?.[date] ?? 0),
          0,
        );
      const approvedOvertimeMinutes = approved
        .filter((r) => r.details.type === "overtime" && r.details.date === date)
        .reduce((n, r) => n + Number(r.details.durationMinutes), 0);
      const required =
        scheduled && schedule
          ? Math.max(
              0,
              (((schedule.endMinute - schedule.startMinute + 1440) % 1440) -
                (schedule.paidBreaks ? 0 : schedule.breakMinutes)) *
                (1 - leaveHalfDays / 2),
            )
          : 0;
      let workedMinutes = 0,
        breakMinutes = 0,
        lateMinutes = 0,
        late = false;
      actual.sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
      for (const [index, shift] of actual.entries()) {
        const totals = shiftMinutes(shift, schedule, date, now);
        workedMinutes += totals.workedMinutes;
        breakMinutes += totals.breakMinutes;
        if (index === 0 && scheduled) {
          lateMinutes = totals.lateMinutes;
          late = totals.late;
        }
      }
      let clockIn = actual[0]?.clockIn.toISOString() ?? null,
        clockOut = actual.at(-1)?.clockOut?.toISOString() ?? null;
      if (correction) {
        const data = requestDetailsSchema.parse(correction.data);
        if (data.type !== "attendance_correction") throw new Error("Invalid correction");
        clockIn = data.clockIn;
        clockOut = data.clockOut;
        breakMinutes = data.breakMinutes;
        const totals = shiftMinutes(
          { clockIn: new Date(data.clockIn), clockOut: new Date(data.clockOut), breaks: [] },
          schedule,
          date,
          now,
        );
        workedMinutes = Math.max(
          0,
          totals.workedMinutes - (schedule?.paidBreaks ? 0 : breakMinutes),
        );
        lateMinutes = totals.lateMinutes;
        late = totals.late;
      }
      const status = clockIn
        ? !clockOut
          ? "incomplete"
          : "present"
        : leaveHalfDays >= 2
          ? "approved leave"
          : calendar.holidays.includes(date)
            ? "holiday"
            : !schedule || !employed
              ? "unscheduled"
              : !scheduled
                ? "rest day"
                : date < today
                  ? "absent"
                  : "scheduled";
      days.push({
        userId,
        date,
        scheduled:
          schedule && scheduled
            ? `${String(Math.floor(schedule.startMinute / 60)).padStart(2, "0")}:${String(schedule.startMinute % 60).padStart(2, "0")}–${String(Math.floor(schedule.endMinute / 60)).padStart(2, "0")}:${String(schedule.endMinute % 60).padStart(2, "0")}`
            : "—",
        clockIn,
        clockOut,
        breakMinutes,
        workedMinutes,
        lateMinutes,
        late,
        undertimeMinutes:
          clockOut || status === "absent" ? Math.max(0, required - workedMinutes) : 0,
        overtimeMinutes: Math.max(0, workedMinutes - required),
        approvedOvertimeMinutes,
        status,
        correctionId: correction?.requestId ?? null,
      });
    }
  }
  const [active] = await c.tx
    .select()
    .from(hrShift)
    .where(
      and(
        eq(hrShift.workspaceId, c.workspaceId),
        eq(hrShift.userId, c.actorId),
        sql`${hrShift.clockOut} is null`,
      ),
    );
  const filtered = input.status ? days.filter((d) => d.status === input.status) : days;
  return {
    days: filtered,
    state: active
      ? ((active.breaks.at(-1)?.end === null ? "break" : "working") as "break" | "working")
      : ("out" as const),
    serverTime: now.toISOString(),
    timezone: c.timezone,
    metrics: {
      daysPresent: filtered.filter((d) => d.clockIn).length,
      lateArrivals: filtered.filter((d) => d.late).length,
      workedMinutes: filtered.reduce((n, d) => n + d.workedMinutes, 0),
      absences: filtered.filter((d) => d.status === "absent").length,
    },
  };
}
export async function validateCorrection(
  c: HrContext,
  details: ReturnType<typeof requestDetailsSchema.parse>,
) {
  if (details.type !== "attendance_correction") return;
  const duration =
    (new Date(details.clockOut).getTime() - new Date(details.clockIn).getTime()) / 60000;
  if (
    duration > 1440 ||
    duration <= details.breakMinutes ||
    localParts(new Date(details.clockIn), c.timezone).date !== details.date
  )
    throw new AppError(
      400,
      "INVALID_CORRECTION",
      "Use a valid shift of up to 24 hours starting on the correction date.",
    );
}
export async function transitionCorrection(
  c: HrContext,
  row: typeof hrRequest.$inferSelect,
  status: string,
) {
  if (row.details.type !== "attendance_correction") return;
  if (status === "cancelled" && row.status === "approved")
    throw new AppError(
      409,
      "CORRECTION_IMMUTABLE",
      "Submit another reviewed correction to revise approved time.",
    );
  if (status !== "approved") return;
  if (
    !(await canTeam(c, "hr.attendance.read_team", row.requesterId)) &&
    !(await c.can("hr.attendance.correct", row.requesterId))
  )
    denied();
  await c.tx
    .insert(hrAttendanceCorrection)
    .values({
      workspaceId: c.workspaceId,
      userId: row.requesterId,
      date: String(row.details.date),
      requestId: row.id,
      data: row.details,
    })
    .onConflictDoNothing();
}
