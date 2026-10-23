import { scheduleInputSchema, type WorkSchedule } from "@lumolynk/contracts/hr";
import { hrHoliday, hrSchedule } from "@lumolynk/database/schema";
import { and, eq } from "drizzle-orm";

import type { HrContext } from "./core";
export function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
export function datesBetween(start: string, end: string) {
  const days: string[] = [];
  let date = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (date <= last) {
    days.push(date.toISOString().slice(0, 10));
    date = new Date(date.getTime() + 86400000);
    if (days.length > 732) throw new Error("Date range is too large");
  }
  return days;
}
export function scheduleOn(schedules: WorkSchedule[], date: string) {
  return schedules
    .filter((s) => s.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
export function scheduledDay(schedule: WorkSchedule | undefined, date: string, holidays: string[]) {
  return Boolean(
    schedule?.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay()) &&
    !holidays.includes(date),
  );
}
export async function employeeCalendar(c: HrContext, userId: string) {
  const schedules = await c.tx
    .select()
    .from(hrSchedule)
    .where(and(eq(hrSchedule.workspaceId, c.workspaceId), eq(hrSchedule.userId, userId)));
  const holidays = await c.tx
    .select()
    .from(hrHoliday)
    .where(eq(hrHoliday.workspaceId, c.workspaceId));
  return {
    schedules: schedules.map((s) => ({
      ...scheduleInputSchema.parse(s.data),
      timezone: s.timezone,
    })),
    holidays: holidays.map((h) => h.date),
  };
}
// Resolve a local calendar wall time without depending on the server's time zone.
export function wallInstant(date: string, minute: number, timezone: string) {
  const desired = new Date(`${date}T00:00:00Z`).getTime() + minute * 60000;
  let candidate = desired;
  for (let i = 0; i < 3; i++) {
    const local = localParts(new Date(candidate), timezone);
    const actual = new Date(`${local.date}T00:00:00Z`).getTime() + local.minute * 60000;
    candidate += desired - actual;
  }
  return new Date(candidate);
}
