import type { WorkSchedule } from "@lumo/contracts/hr";
import { expect, test } from "vitest";

import { csvRows, shiftMinutes } from "./attendance";
import { datesBetween, localParts, scheduleOn, scheduledDay, wallInstant } from "./calendar";
const schedule: WorkSchedule = {
  userId: "00000000-0000-4000-8000-000000000001",
  effectiveFrom: "2026-01-01",
  weekdays: [1, 2, 3, 4, 5],
  startMinute: 480,
  endMinute: 1020,
  breakMinutes: 60,
  graceMinutes: 15,
  paidBreaks: false,
  timezone: "Asia/Manila",
};
test.each([
  ["2026-10-21T00:15:00Z", 15, false],
  ["2026-10-21T00:16:00Z", 16, true],
  ["2026-10-20T23:59:00Z", 0, false],
])("keeps exact timestamps and counts grace boundary %s", (instant, minutes, late) => {
  const clockIn = new Date(instant),
    shift = { clockIn, clockOut: new Date("2026-10-21T09:00:00Z"), breaks: [] };
  const result = shiftMinutes(shift, schedule, "2026-10-21", shift.clockOut);
  expect(result.lateMinutes).toBe(minutes);
  expect(result.late).toBe(late);
  expect(shift.clockIn.getTime()).toBe(new Date(instant).getTime());
});
test("multiple breaks, overnight shifts, incomplete shifts and paid breaks", () => {
  const shift = {
    clockIn: new Date("2026-10-21T14:00:00Z"),
    clockOut: new Date("2026-10-21T22:00:00Z"),
    breaks: [
      { start: "2026-10-21T16:00:00Z", end: "2026-10-21T16:15:00Z" },
      { start: "2026-10-21T18:00:00Z", end: "2026-10-21T18:30:00Z" },
    ],
  };
  const overnight = { ...schedule, startMinute: 1320, endMinute: 360 };
  expect(shiftMinutes(shift, overnight, "2026-10-21", shift.clockOut)).toMatchObject({
    workedMinutes: 435,
    breakMinutes: 45,
    late: false,
  });
  expect(
    shiftMinutes(shift, { ...overnight, paidBreaks: true }, "2026-10-21", shift.clockOut)
      .workedMinutes,
  ).toBe(480);
  expect(
    shiftMinutes(
      { ...shift, clockOut: null },
      overnight,
      "2026-10-21",
      new Date("2026-10-21T23:00:00Z"),
    ).workedMinutes,
  ).toBe(495);
});
test("calendar days and effective schedule use workspace dates and holidays", () => {
  expect(datesBetween("2026-02-01", "2026-02-28")).toHaveLength(28);
  expect(localParts(new Date("2026-10-20T20:00:00Z"), "Asia/Manila")).toEqual({
    date: "2026-10-21",
    minute: 240,
  });
  expect(wallInstant("2026-10-21", 480, "Asia/Manila").toISOString()).toBe(
    "2026-10-21T00:00:00.000Z",
  );
  expect(
    scheduleOn(
      [schedule, { ...schedule, effectiveFrom: "2026-11-01", startMinute: 540 }],
      "2026-10-21",
    ),
  ).toBe(schedule);
  expect(scheduledDay(schedule, "2026-10-24", [])).toBe(false);
  expect(scheduledDay(schedule, "2026-10-21", ["2026-10-21"])).toBe(false);
  expect(scheduledDay(undefined, "2026-10-21", [])).toBe(false);
});
test("CSV neutralizes formula prefixes, quotes and newlines", () => {
  expect(
    csvRows(["Name"], [["=HYPERLINK(1)"], [" +SUM(1)"], ["@command"], ['quote"x'], ["normal"]]),
  ).toBe('"Name"\r\n"\'=HYPERLINK(1)"\r\n"\' +SUM(1)"\r\n"\'@command"\r\n"quote""x"\r\n"normal"');
});
