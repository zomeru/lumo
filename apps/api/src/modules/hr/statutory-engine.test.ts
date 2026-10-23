import type { PayrollSettings } from "@lumolynk/contracts/hr";
import { statutoryConfigurationInputSchema } from "@lumolynk/contracts/payroll";
import { expect, test } from "vitest";

import { calculatePay } from "./payroll-engine";
import { financialRatio } from "./payroll-money";
import {
  configuredContributions,
  configuredWithholding,
  statutoryTemplate,
} from "./statutory-engine";

const settings: PayrollSettings = {
  effectiveFrom: "2026-01-01",
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
const bases = (salary: number) => ({
  basicMinor: salary,
  compensationMinor: salary,
  remunerationMinor: salary,
});
test("the source template is valid and covers every salary credit boundary", () => {
  const rules = statutoryTemplate();
  expect(statutoryConfigurationInputSchema.parse(rules)).toEqual(rules);
  for (const row of rules.sss.brackets.slice(1)) {
    const below = configuredContributions(bases(row.fromMinor - 1), settings, rules);
    const at = configuredContributions(bases(row.fromMinor), settings, rules);
    expect(at.sss + at.sssMpf - below.sss - below.sssMpf).toBe(2500);
  }
});
test("custom tables, contribution rates and individual caps control employee and employer liabilities", () => {
  const rules = statutoryTemplate();
  rules.sss.brackets = [
    { fromMinor: 0, toMinor: 1000000, salaryCreditMinor: 500000, ecMinor: 777 },
    { fromMinor: 1000000, toMinor: null, salaryCreditMinor: 3500000, ecMinor: 1234 },
  ];
  rules.sss.employeeBps = 400;
  rules.sss.employerBps = 900;
  rules.sss.mpfEmployeeBps = 300;
  rules.sss.mpfEmployerBps = 800;
  rules.pagibig.employeeCapMinor = 15000;
  rules.pagibig.employerCapMinor = 18000;
  rules.philhealth.premiumCapMinor = 90000;
  rules.philhealth.employeeShareBps = 4000;
  rules.philhealth.employerShareBps = 6000;
  expect(configuredContributions(bases(999999), settings, rules).sss).toBe(20000);
  expect(configuredContributions(bases(1000000), settings, rules)).toMatchObject({
    sss: 80000,
    sssMpf: 45000,
    sssEmployer: 180000,
    sssMpfEmployer: 120000,
    sssEc: 1234,
  });
  expect(configuredContributions(bases(2500000), settings, rules)).toMatchObject({
    pagibig: 15000,
    pagibigEmployer: 18000,
    philhealth: 36000,
    philhealthEmployer: 54000,
  });
});
test("collection timing sums exactly once per month, including odd-centavo shares", () => {
  const rules = statutoryTemplate(),
    semi = { ...settings, frequency: "semimonthly" as const };
  const salary = 2500020;
  const first = configuredContributions(bases(salary), semi, rules),
    second = configuredContributions(bases(salary), semi, rules, true),
    monthly = configuredContributions(bases(salary), settings, rules);
  expect(first.sss).toBe(0);
  expect(second.sss).toBe(monthly.sss);
  expect(first.sssEc).toBe(0);
  expect(second.sssEc).toBe(monthly.sssEc);
  for (const key of Object.keys(monthly) as (keyof typeof monthly)[])
    expect(first[key] + second[key]).toBe(monthly[key]);
  expect(monthly.philhealth + monthly.philhealthEmployer).toBe(125001);
  expect(configuredContributions(bases(salary), semi, rules, false, true).sss).toBe(monthly.sss);
});
test("contribution salary bases remain independent and exemptions and EC are respected", () => {
  const rules = statutoryTemplate();
  const result = configuredContributions(
    { basicMinor: 2500000, compensationMinor: 3000000, remunerationMinor: 3500000 },
    settings,
    rules,
  );
  expect(result.sss + result.sssMpf).toBe(175000);
  expect(result.philhealth).toBe(62500);
  rules.pagibig.compensationCapMinor = 10000000;
  expect(
    configuredContributions(
      { basicMinor: 2500000, compensationMinor: 3000000, remunerationMinor: 3500000 },
      settings,
      rules,
    ).pagibig,
  ).toBe(60000);
  rules.sss.salaryBasis = "monthly_basic";
  rules.sss.collection = "split";
  rules.sss.ecEnabled = false;
  rules.pagibig.enabled = false;
  rules.philhealth.enabled = false;
  expect(configuredContributions(bases(2500000), settings, rules)).toMatchObject({
    pagibig: 0,
    pagibigEmployer: 0,
    philhealth: 0,
    philhealthEmployer: 0,
    sssEc: 0,
  });
  const semi = { ...settings, frequency: "semimonthly" as const };
  const first = configuredContributions(bases(2500000), semi, rules),
    second = configuredContributions(bases(2500000), semi, rules, true);
  expect(first.sss + second.sss).toBe(100000);
});
test.each([
  ["nearest_centavo", 1],
  ["up_centavo", 1],
  ["down_centavo", 0],
] as const)("uses exact %s rounding", (rounding, expected) => {
  expect(financialRatio(1, 1, 2, rounding)).toBe(expected);
  expect(financialRatio(-1, 1, 2, rounding)).toBe(expected === 0 ? 0 : -expected);
  const rules = statutoryTemplate();
  rules.philhealth.rounding = rounding;
  rules.philhealth.totalBps = 1;
  rules.philhealth.floorMinor = 0;
  expect(configuredContributions(bases(5000), settings, rules).philhealth).toBe(expected);
});
test("BIR uses manually configured brackets, frequency, exemption and rounding", () => {
  const rules = statutoryTemplate();
  rules.bir.monthly = [
    { thresholdMinor: 0, fixedMinor: 0, bps: 0 },
    { thresholdMinor: 10000, fixedMinor: 100, bps: 5000 },
  ];
  expect(configuredWithholding(-1, "monthly", rules)).toBe(0);
  expect(configuredWithholding(10000, "monthly", rules)).toBe(0);
  expect(configuredWithholding(10001, "monthly", rules)).toBe(101);
  rules.bir.rounding = "down_centavo";
  expect(configuredWithholding(10001, "monthly", rules)).toBe(100);
  expect(configuredWithholding(1250000, "semimonthly", rules)).toBe(31245);
  rules.bir.enabled = false;
  expect(configuredWithholding(10001, "monthly", rules)).toBe(0);
});
test("actual remuneration includes taxable bonuses, allowances and time pay before statutory calculation", () => {
  const rules = statutoryTemplate();
  const result = calculatePay(
    {
      basicMinor: 1250000,
      monthlySalaryMinor: 2500000,
      allowances: [{ label: "Allowance", amountMinor: 10000, taxable: true }],
      unpaidMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      holidayMinutes: 0,
      restMinutes: 0,
      nightMinutes: 0,
      secondCutoff: true,
      priorRemunerationMinor: 1250000,
      adjustments: [
        {
          label: "Bonus",
          amountMinor: 500000,
          classification: "earning_taxable",
          reason: "Approved incentive",
        },
      ],
    },
    { ...settings, frequency: "semimonthly" },
    { rules, version: "workspace-rule-version" },
  );
  expect(result.grossMinor).toBe(1755000);
  expect(result.lines.find((l) => l.label === "SSS MPF")).toMatchObject({
    amountMinor: 50000,
    source: "workspace-rule-version",
  });
  expect(result.lines.find((l) => l.label === "PhilHealth")?.amountMinor).toBe(31250);
  expect(result.employerMinor).toBeGreaterThan(0);
});
