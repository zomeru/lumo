import type { PayrollSettings } from "@lumo/contracts/hr";
import { expect, test } from "vitest";

import {
  calculatePay,
  roundedRatio,
  statutoryAmounts,
  type PayrollEngineInput,
} from "./payroll-engine";
const settings: PayrollSettings = {
  effectiveFrom: "2025-01-01",
  frequency: "monthly",
  currency: "PHP",
  workingDaysPerYear: 261,
  minutesPerDay: 480,
  overtimeBps: 12500,
  holidayBps: 20000,
  restDayBps: 13000,
  nightDifferentialBps: 1000,
  deductUndertime: true,
  publishOnFinalize: false,
  payoutDay: 30,
  firstPayoutDay: 15,
  reason: "Reviewed business policy",
};
const input: PayrollEngineInput = {
  basicMinor: 2500000,
  monthlySalaryMinor: 2500000,
  allowances: [],
  unpaidMinutes: 0,
  undertimeMinutes: 0,
  overtimeMinutes: 0,
  holidayMinutes: 0,
  restMinutes: 0,
  nightMinutes: 0,
  secondCutoff: false,
  adjustments: [],
};
test("25000 monthly fixture separates regular SS, MPF, EC and employee/employer portions", () => {
  const result = calculatePay(input, settings);
  expect(result.grossMinor).toBe(2500000);
  expect(result.deductionsMinor).toBe(238880);
  expect(result.netMinor).toBe(2261120);
  expect(result.employerMinor).toBe(335500);
  expect(result.lines.find((l) => l.label === "BIR withholding")?.amountMinor).toBe(31380);
  expect(result.lines.find((l) => l.label === "SSS MPF")?.amountMinor).toBe(25000);
});
test.each([
  [524999, 25000],
  [525000, 27500],
  [3474999, 172500],
  [3475000, 175000],
  [100000000, 175000],
])("SSS bracket and cap salary %i", (salary, expected) => {
  const amounts = statutoryAmounts(salary, settings);
  expect(amounts.sss + amounts.sssMpf).toBe(expected);
});
test("contribution floors and low Pag-IBIG bracket", () => {
  const amounts = statutoryAmounts(100000, settings);
  expect(amounts).toMatchObject({
    sss: 25000,
    sssMpf: 0,
    sssEc: 1000,
    philhealth: 25000,
    pagibig: 1000,
    pagibigEmployer: 2000,
  });
  expect(statutoryAmounts(100000000, settings).philhealth).toBe(250000);
});
test("semimonthly uses its own withholding table and splits contribution rounding consistently", () => {
  const semi = { ...settings, frequency: "semimonthly" as const };
  const result = calculatePay({ ...input, basicMinor: 1250000 }, semi);
  expect(result.lines.find((l) => l.label === "BIR withholding")?.amountMinor).toBe(15683);
  const first = statutoryAmounts(2500100, semi),
    second = statutoryAmounts(2500100, semi, true),
    monthly = statutoryAmounts(2500100, settings);
  expect(first.philhealth + second.philhealth).toBe(monthly.philhealth);
});
test("integer rounding, classified adjustments and nonnegative validation", () => {
  expect(roundedRatio(1, 1, 2)).toBe(1);
  expect(roundedRatio(-1, 1, 2)).toBe(-1);
  expect(() => roundedRatio(1.1, 1, 2)).toThrow("Invalid financial input");
  expect(() => roundedRatio(1, 1, 0)).toThrow("Invalid financial input");
  const result = calculatePay(
    {
      ...input,
      allowances: [{ label: "Allowance", amountMinor: 10000, taxable: false }],
      unpaidMinutes: 480,
      undertimeMinutes: 60,
      overtimeMinutes: 120,
      holidayMinutes: 60,
      restMinutes: 60,
      nightMinutes: 60,
      adjustments: [
        {
          label: "Bonus",
          amountMinor: 10000,
          classification: "earning_taxable",
          reason: "Approved bonus",
        },
        {
          label: "Recovery",
          amountMinor: 2000,
          classification: "deduction",
          reason: "Confirmed loan recovery",
        },
      ],
    },
    settings,
  );
  expect(result.lines.find((l) => l.label === "Unpaid leave")?.amountMinor).toBe(114943);
  expect(result.lines.find((l) => l.label === "Approved overtime")?.amountMinor).toBe(35920);
  expect(result.warnings).toHaveLength(1);
  expect(result.netMinor).toBeGreaterThan(0);
  expect(
    calculatePay(
      {
        ...input,
        adjustments: [
          {
            label: "Too large",
            amountMinor: 10000000,
            classification: "deduction",
            reason: "Invalid",
          },
        ],
      },
      settings,
    ).warnings,
  ).toContain("Invalid negative payroll total; correct the input before finalization.");
});
