import { payrollSettingsInputSchema } from "@lumo/contracts/hr";
import { expect, test } from "vitest";

import { suggestedPayrollPeriod } from "./payroll-schedule";
const settings = payrollSettingsInputSchema.parse({
  effectiveFrom: "2025-01-01",
  frequency: "monthly",
  currency: "PHP",
  workingDaysPerYear: 261,
  minutesPerDay: 480,
  overtimeBps: 12500,
  holidayBps: 20000,
  restDayBps: 13000,
  deductUndertime: false,
  payoutDay: 31,
  reason: "Calendar fixture",
});
test.each([
  ["2026-02-03", "2026-02-01", "2026-02-28"],
  ["2028-02-29", "2028-02-01", "2028-02-29"],
  ["2026-04-29", "2026-04-01", "2026-04-30"],
])("monthly schedule clamps payout to the end of %s", (today, start, end) => {
  expect(suggestedPayrollPeriod(settings, today)).toEqual({
    startDate: start,
    endDate: end,
    cutoffDate: end,
    payoutDate: end,
  });
});
test("an earlier payout day belongs to the following month including year rollover", () => {
  expect(suggestedPayrollPeriod({ ...settings, payoutDay: 5 }, "2026-12-20").payoutDate).toBe(
    "2027-01-05",
  );
});
test("semimonthly suggestions use separate payout days for each cutoff", () => {
  const semi = { ...settings, frequency: "semimonthly" as const };
  expect(suggestedPayrollPeriod(semi, "2026-10-15")).toEqual({
    startDate: "2026-10-01",
    endDate: "2026-10-15",
    cutoffDate: "2026-10-15",
    payoutDate: "2026-10-15",
  });
  expect(suggestedPayrollPeriod(semi, "2026-10-16")).toEqual({
    startDate: "2026-10-16",
    endDate: "2026-10-31",
    cutoffDate: "2026-10-31",
    payoutDate: "2026-10-31",
  });
});
