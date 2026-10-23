import {
  payrollAdjustmentInputSchema,
  payrollResultSchema,
  payrollSettingsInputSchema,
  scheduleInputSchema,
  type PayrollSettings,
} from "@lumolynk/contracts/hr";
import {
  hrCompensation,
  hrEmployee,
  hrPayrollAdjustment,
  hrPayrollEmployee,
  hrPayrollRun,
  hrPayrollSetting,
  hrRequest,
  hrShift,
  membership,
} from "@lumolynk/database/schema";
import { and, asc, desc, eq, sql, or, isNull, lte, gte } from "drizzle-orm";

import { AppError, missing } from "../../lib/errors";
import { attendanceMonth } from "./attendance";
import { datesBetween, employeeCalendar, localParts, scheduleOn, scheduledDay } from "./calendar";
import { auditHr, type HrContext } from "./core";
import { calculatePay, roundedRatio, type PayrollEngineInput } from "./payroll-engine";
import { statutoryFor } from "./statutory-config";

export const closedPayroll = (status: string) => ["finalized", "paid", "voided"].includes(status);
export async function payrollRunFor(c: HrContext, id: string) {
  const [run] = await c.tx
    .select()
    .from(hrPayrollRun)
    .where(and(eq(hrPayrollRun.workspaceId, c.workspaceId), eq(hrPayrollRun.id, id)));
  if (!run) missing();
  return run;
}
export async function settingsFor(c: HrContext, date: string) {
  const [setting] = await c.tx
    .select()
    .from(hrPayrollSetting)
    .where(
      and(
        eq(hrPayrollSetting.workspaceId, c.workspaceId),
        sql`${hrPayrollSetting.effectiveFrom} <= ${date}`,
      ),
    )
    .orderBy(desc(hrPayrollSetting.effectiveFrom))
    .limit(1);
  if (!setting)
    throw new AppError(
      409,
      "PAYROLL_SETTINGS_REQUIRED",
      "Configure an effective payroll schedule first.",
    );
  return { ...setting, parsed: payrollSettingsInputSchema.parse(setting.data) };
}
export async function assertOpenPayrollPeriod(c: HrContext, start: string, end: string) {
  const rows = await c.tx
    .select()
    .from(hrPayrollRun)
    .where(
      and(
        eq(hrPayrollRun.workspaceId, c.workspaceId),
        sql`${hrPayrollRun.status} in ('finalized','paid')`,
        sql`${hrPayrollRun.startDate} <= ${end}`,
        sql`${hrPayrollRun.cutoffDate} >= ${start}`,
      ),
    );
  if (rows.length)
    throw new AppError(
      409,
      "PAYROLL_PERIOD_CLOSED",
      "This affects a finalized payroll period. Record a subsequent-period adjustment instead.",
    );
}
function nightMinutes(
  shift: {
    clockIn: Date;
    clockOut: Date | null;
    breaks: { start: string; end: string | null }[];
    timezone: string;
  },
  paidBreaks: boolean,
) {
  if (!shift.clockOut) return 0;
  let minutes = 0;
  for (
    let time = shift.clockIn.getTime();
    time + 60000 <= Math.min(shift.clockOut.getTime(), shift.clockIn.getTime() + 86400000);
    time += 60000
  ) {
    const local = localParts(new Date(time), shift.timezone);
    if (local.minute >= 1320 || local.minute < 360) {
      if (
        paidBreaks ||
        !shift.breaks.some(
          (b) =>
            time >= new Date(b.start).getTime() &&
            time < new Date(b.end ?? shift.clockOut!).getTime(),
        )
      )
        minutes++;
    }
  }
  return minutes;
}
export async function employeePay(
  c: HrContext,
  userId: string,
  period: { startDate: string; endDate: string; cutoffDate: string },
  settings: PayrollSettings,
  runId?: string,
  privileged = true,
  statutory?: Awaited<ReturnType<typeof statutoryFor>>,
) {
  const configuration = statutory ?? (await statutoryFor(c, period.startDate, period.endDate));
  const compensation = await c.tx
    .select()
    .from(hrCompensation)
    .where(
      and(
        eq(hrCompensation.workspaceId, c.workspaceId),
        eq(hrCompensation.userId, userId),
        sql`${hrCompensation.effectiveFrom} <= ${period.endDate}`,
      ),
    )
    .orderBy(asc(hrCompensation.effectiveFrom));
  const current = compensation.at(-1);
  if (!current)
    throw new AppError(409, "COMPENSATION_REQUIRED", "Effective compensation is missing.");
  const employment = await c.tx
    .select()
    .from(hrEmployee)
    .where(and(eq(hrEmployee.workspaceId, c.workspaceId), eq(hrEmployee.userId, userId)));
  const employee = employment[0];
  const calendar = await employeeCalendar(c, userId);
  const dates = datesBetween(period.startDate, period.endDate);
  let totalMinutes = 0,
    weightedBasic = 0,
    eligibleMinutes = 0;
  const warnings: string[] = [];
  const compensationSources = new Set<string>();
  for (const date of dates) {
    const schedule = scheduleOn(calendar.schedules, date);
    if (!scheduledDay(schedule, date, calendar.holidays) || !schedule) continue;
    const minutes =
      ((schedule.endMinute - schedule.startMinute + 1440) % 1440) -
      (schedule.paidBreaks ? 0 : schedule.breakMinutes);
    totalMinutes += minutes;
    if (
      (employee?.hireDate && date < employee.hireDate) ||
      (employee?.endDate && date > employee.endDate)
    )
      continue;
    const effective = compensation.filter((row) => row.effectiveFrom <= date).at(-1);
    if (!effective) {
      warnings.push("Compensation does not cover every scheduled day.");
      continue;
    }
    eligibleMinutes += minutes;
    weightedBasic += effective.salaryMinor * minutes;
    compensationSources.add(effective.id);
  }
  // weightedBasic remains an exact safe integer under validated salary/duration bounds.
  if (!totalMinutes) warnings.push("Assign a work schedule covering the payroll period.");
  const basicMinor = totalMinutes
    ? roundedRatio(weightedBasic, 1, totalMinutes * (settings.frequency === "monthly" ? 1 : 2))
    : 0;
  const months = [
    ...new Set(datesBetween(period.startDate, period.cutoffDate).map((date) => date.slice(0, 7))),
  ];
  const days = [];
  for (const month of months) {
    const report = await attendanceMonth(c, { month, userId }, new Date(), privileged);
    days.push(
      ...report.days.filter((day) => day.date >= period.startDate && day.date <= period.cutoffDate),
    );
  }
  const requests = await c.tx
    .select()
    .from(hrRequest)
    .where(
      and(
        eq(hrRequest.workspaceId, c.workspaceId),
        eq(hrRequest.requesterId, userId),
        eq(hrRequest.status, "approved"),
      ),
    );
  let unpaidMinutes = 0,
    overtimeMinutes = 0,
    holidayMinutes = 0,
    restMinutes = 0;
  const timeAmounts: NonNullable<PayrollEngineInput["timeAmounts"]> = {
    "Unpaid leave": 0,
    "Attendance deduction": 0,
    "Approved overtime": 0,
    "Approved holiday work": 0,
    "Approved rest-day work": 0,
    "Night differential": 0,
  };
  const rate = (date: string, minutes: number, bps = 10000) =>
    roundedRatio(
      compensation.filter((row) => row.effectiveFrom <= date).at(-1)?.salaryMinor ?? 0,
      12 * minutes * bps,
      settings.workingDaysPerYear * settings.minutesPerDay * 10000,
    );
  for (const day of days) {
    const schedule = scheduleOn(calendar.schedules, day.date);
    if (!schedule) continue;
    const scheduledMinutes =
      ((schedule.endMinute - schedule.startMinute + 1440) % 1440) -
      (schedule.paidBreaks ? 0 : schedule.breakMinutes);
    const unpaidHalfDays = requests
      .filter((r) => r.details.type === "leave" && r.details.paid === false)
      .reduce(
        (n, r) => n + Number(((r.details.charges as Record<string, number>) ?? {})[day.date] ?? 0),
        0,
      );
    const unpaidDay = Math.floor((scheduledMinutes * unpaidHalfDays) / 2);
    unpaidMinutes += unpaidDay;
    timeAmounts["Unpaid leave"] += rate(day.date, unpaidDay);
    timeAmounts["Attendance deduction"] += rate(day.date, day.undertimeMinutes);
    const approvedMinutes = Math.min(day.overtimeMinutes, day.approvedOvertimeMinutes);
    if (calendar.holidays.includes(day.date)) {
      holidayMinutes += approvedMinutes;
      timeAmounts["Approved holiday work"] += rate(day.date, approvedMinutes, settings.holidayBps);
    } else if (!schedule.weekdays.includes(new Date(`${day.date}T12:00:00Z`).getUTCDay())) {
      restMinutes += approvedMinutes;
      timeAmounts["Approved rest-day work"] += rate(day.date, approvedMinutes, settings.restDayBps);
    } else {
      overtimeMinutes += approvedMinutes;
      timeAmounts["Approved overtime"] += rate(day.date, approvedMinutes, settings.overtimeBps);
    }
  }
  const shifts = await c.tx
    .select()
    .from(hrShift)
    .where(
      and(
        eq(hrShift.workspaceId, c.workspaceId),
        eq(hrShift.userId, userId),
        sql`${hrShift.workDate} between ${period.startDate} and ${period.cutoffDate}`,
      ),
    );
  const night = shifts.reduce(
    (n, s) =>
      n + nightMinutes(s, s.schedule ? scheduleInputSchema.parse(s.schedule).paidBreaks : false),
    0,
  );
  for (const shift of shifts) {
    if (shift.clockOut && shift.clockOut.getTime() - shift.clockIn.getTime() > 86400000)
      warnings.push("Correct shifts longer than 24 hours before finalization.");
    timeAmounts["Night differential"] += rate(
      shift.workDate,
      nightMinutes(
        shift,
        shift.schedule ? scheduleInputSchema.parse(shift.schedule).paidBreaks : false,
      ),
      settings.nightDifferentialBps,
    );
  }
  const adjustments = runId
    ? await c.tx
        .select()
        .from(hrPayrollAdjustment)
        .where(
          and(
            eq(hrPayrollAdjustment.workspaceId, c.workspaceId),
            eq(hrPayrollAdjustment.runId, runId),
            eq(hrPayrollAdjustment.userId, userId),
          ),
        )
    : [];
  const parsedAdjustments = adjustments.map((a) => payrollAdjustmentInputSchema.parse(a.data));
  const input: PayrollEngineInput = {
    basicMinor,
    timeAmounts,
    monthlySalaryMinor: current.salaryMinor,
    allowances: current.allowances,
    unpaidMinutes,
    undertimeMinutes: days.reduce((n, d) => n + d.undertimeMinutes, 0),
    overtimeMinutes,
    holidayMinutes,
    restMinutes,
    nightMinutes: night,
    secondCutoff: Number(period.startDate.slice(8)) > 15,
    adjustments: parsedAdjustments,
  };
  input.finalCollection = Boolean(employee?.endDate && employee.endDate <= period.endDate);
  let priorRunId: string | null = null;
  if (
    settings.frequency === "semimonthly" &&
    input.secondCutoff &&
    [configuration.rules.sss, configuration.rules.pagibig, configuration.rules.philhealth].some(
      (p) => p.enabled && p.salaryBasis === "period_remuneration",
    )
  ) {
    const month = period.startDate.slice(0, 7);
    const [prior] = await c.tx
      .select({ run: hrPayrollRun, employee: hrPayrollEmployee })
      .from(hrPayrollRun)
      .innerJoin(
        hrPayrollEmployee,
        and(
          eq(hrPayrollEmployee.workspaceId, hrPayrollRun.workspaceId),
          eq(hrPayrollEmployee.runId, hrPayrollRun.id),
          eq(hrPayrollEmployee.userId, userId),
        ),
      )
      .where(
        and(
          eq(hrPayrollRun.workspaceId, c.workspaceId),
          eq(hrPayrollRun.startDate, `${month}-01`),
          eq(hrPayrollRun.endDate, `${month}-15`),
          sql`${hrPayrollRun.status} in ('finalized','paid')`,
        ),
      )
      .limit(1);
    if (prior) {
      const result = payrollResultSchema.parse(prior.employee.result);
      input.priorRemunerationMinor = Math.max(
        0,
        result.grossMinor -
          result.lines
            .filter(
              (l) =>
                l.source === "approved unpaid leave" ||
                l.source === "reviewed attendance, configured policy",
            )
            .reduce((n, l) => n + l.amountMinor, 0),
      );
      priorRunId = prior.run.id;
    } else if (!employee?.hireDate || employee.hireDate < period.startDate)
      warnings.push("Finalize the first cutoff before reconciling monthly statutory remuneration.");
  }
  const result = calculatePay(input, settings, configuration);
  if (!privileged) result.warnings.push(...warnings);
  if (days.some((d) => d.status === "incomplete"))
    warnings.push("Close or correct incomplete attendance before finalization.");
  if (days.some((d) => d.correctionId) && settings.nightDifferentialBps > 0)
    result.warnings.push(
      "Verify night differential against corrected breaks; apply a documented adjustment if needed.",
    );
  if (eligibleMinutes !== totalMinutes)
    result.warnings.push(
      "Prorated employment period requires contribution and withholding review.",
    );
  return {
    result,
    snapshot: {
      engineVersion: "lumolynk-payroll-2",
      ruleVersion: configuration.version,
      statutoryConfigurationId: configuration.id,
      rules: configuration.rules,
      priorRunId,
      settings,
      compensation: compensation.map(({ id, effectiveFrom, salaryMinor, allowances }) => ({
        id,
        effectiveFrom,
        salaryMinor,
        allowances,
      })),
      compensationSources: [...compensationSources],
      employment: employee ?? null,
      attendance: days,
      approvedRequests: requests
        .filter((r) => ["leave", "overtime"].includes(String(r.details.type)))
        .map((r) => ({ id: r.id, details: r.details })),
      adjustments: parsedAdjustments,
      input,
    },
    warnings,
  };
}
export async function calculateRun(c: HrContext, id: string) {
  await c.require("hr.payroll.runs.manage");
  const run = await payrollRunFor(c, id);
  if (closedPayroll(run.status) || run.status === "approved")
    throw new AppError(409, "RUN_IMMUTABLE", "Return an open run to draft before recalculating.");
  const settings = await settingsFor(c, run.endDate);
  const configuration = await statutoryFor(c, run.startDate, run.endDate);
  const warnings: string[] = [];
  const employees = await c.tx
    .select()
    .from(hrEmployee)
    .innerJoin(
      membership,
      and(
        eq(membership.workspaceId, hrEmployee.workspaceId),
        eq(membership.userId, hrEmployee.userId),
      ),
    )
    .where(
      and(
        eq(hrEmployee.workspaceId, c.workspaceId),
        or(isNull(hrEmployee.hireDate), lte(hrEmployee.hireDate, run.endDate)),
        or(isNull(hrEmployee.endDate), gte(hrEmployee.endDate, run.startDate)),
      ),
    );
  await c.tx
    .delete(hrPayrollEmployee)
    .where(and(eq(hrPayrollEmployee.workspaceId, c.workspaceId), eq(hrPayrollEmployee.runId, id)));
  for (const { hr_employees: employee } of employees) {
    if (employee.employmentType !== "employee") continue;
    try {
      const calculated = await employeePay(
        c,
        employee.userId,
        run,
        settings.parsed,
        id,
        true,
        configuration,
      );
      warnings.push(...calculated.warnings.map((w) => `${employee.userId}: ${w}`));
      await c.tx.insert(hrPayrollEmployee).values({
        workspaceId: c.workspaceId,
        runId: id,
        userId: employee.userId,
        snapshot: calculated.snapshot,
        result: calculated.result,
      });
    } catch (error) {
      if (error instanceof AppError && error.code === "COMPENSATION_REQUIRED")
        warnings.push(`${employee.userId}: Set effective compensation.`);
      else throw error;
    }
  }
  if (!employees.length)
    warnings.push("Add employee employment profiles before calculating payroll.");
  await c.tx
    .update(hrPayrollRun)
    .set({
      status: "calculated",
      revision: run.revision + 1,
      calculatedBy: c.actorId,
      approvedBy: null,
      settingsSnapshot: {
        data: settings.parsed,
        timezone: c.timezone,
        settingsId: settings.id,
        statutoryConfigurationId: configuration.id,
        statutory: configuration.rules,
      },
      ruleVersion: configuration.version,
      warnings,
    })
    .where(and(eq(hrPayrollRun.workspaceId, c.workspaceId), eq(hrPayrollRun.id, id)));
  await auditHr(c, "payroll.calculated", id, { revision: run.revision + 1, warnings });
}
export async function guardPayrollRequestChange(
  c: HrContext,
  row: typeof hrRequest.$inferSelect,
  status: string,
) {
  if (status === "cancelled" && row.status === "approved") {
    const [included] = await c.tx
      .select({ runId: hrPayrollRun.id })
      .from(hrPayrollAdjustment)
      .innerJoin(
        hrPayrollRun,
        and(
          eq(hrPayrollRun.workspaceId, hrPayrollAdjustment.workspaceId),
          eq(hrPayrollRun.id, hrPayrollAdjustment.runId),
        ),
      )
      .where(
        and(
          eq(hrPayrollAdjustment.workspaceId, c.workspaceId),
          eq(hrPayrollAdjustment.sourceRequestId, row.id),
          sql`${hrPayrollRun.status} in ('finalized','paid')`,
        ),
      )
      .limit(1);
    if (included)
      throw new AppError(
        409,
        "PAYROLL_PERIOD_CLOSED",
        "This request is included in closed payroll. Record a subsequent-period correction instead.",
      );
  }
  if (!["leave", "overtime", "attendance_correction"].includes(String(row.details.type))) return;
  if (status !== "approved" && !(status === "cancelled" && row.status === "approved")) return;
  const start = String(row.details.startDate ?? row.details.date),
    end = String(row.details.endDate ?? row.details.date);
  await assertOpenPayrollPeriod(c, start, end);
}
export async function releasedPayslips(c: HrContext) {
  const rows = await c.tx
    .select({ run: hrPayrollRun, employee: hrPayrollEmployee })
    .from(hrPayrollEmployee)
    .innerJoin(
      hrPayrollRun,
      and(
        eq(hrPayrollRun.workspaceId, hrPayrollEmployee.workspaceId),
        eq(hrPayrollRun.id, hrPayrollEmployee.runId),
      ),
    )
    .where(
      and(
        eq(hrPayrollEmployee.workspaceId, c.workspaceId),
        eq(hrPayrollEmployee.userId, c.actorId),
        sql`${hrPayrollRun.publishedAt} is not null`,
        sql`${hrPayrollRun.status} in ('finalized','paid','voided')`,
      ),
    )
    .orderBy(desc(hrPayrollRun.endDate));
  return rows.map(({ run, employee }) => ({
    runId: run.id,
    startDate: run.startDate,
    endDate: run.endDate,
    payoutDate: run.payoutDate,
    status: run.status,
    result: payrollResultSchema.parse(employee.result),
  }));
}
