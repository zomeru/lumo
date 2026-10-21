import type { PayrollResult, PayrollSettings } from "@lumo/contracts/hr";
import type { StatutoryConfigurationInput } from "@lumo/contracts/payroll";

import { financialRatio } from "./payroll-money";
import { configuredContributions, configuredWithholding } from "./statutory-engine";
export const roundedRatio = financialRatio;
export type PayrollEngineInput = {
  basicMinor: number;
  monthlySalaryMinor: number;
  allowances: { label: string; amountMinor: number; taxable: boolean }[];
  timeAmounts?: Record<
    | "Unpaid leave"
    | "Attendance deduction"
    | "Approved overtime"
    | "Approved holiday work"
    | "Approved rest-day work"
    | "Night differential",
    number
  >;
  unpaidMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  holidayMinutes: number;
  restMinutes: number;
  nightMinutes: number;
  secondCutoff: boolean;
  priorRemunerationMinor?: number;
  finalCollection?: boolean;
  adjustments: { label: string; amountMinor: number; classification: string; reason: string }[];
};
export function calculatePay(
  input: PayrollEngineInput,
  settings: PayrollSettings,
  configuration: { rules: StatutoryConfigurationInput; version: string },
): PayrollResult {
  const lines: PayrollResult["lines"] = [];
  const warnings: string[] = [];
  const line = (
    label: string,
    kind: "earning" | "deduction" | "employer",
    amountMinor: number,
    source: string,
  ) => {
    lines.push({ label, kind, amountMinor, source });
  };
  const frequency = settings.frequency === "monthly" ? 1 : 2;
  const minuteAmount = (minutes: number, bps = 10000) =>
    roundedRatio(
      input.monthlySalaryMinor,
      12 * minutes * bps,
      settings.workingDaysPerYear * settings.minutesPerDay * 10000,
    );
  line("Basic pay", "earning", input.basicMinor, "effective compensation");
  let taxable = input.basicMinor;
  for (const allowance of input.allowances) {
    const amount = roundedRatio(allowance.amountMinor, 1, frequency);
    line(
      allowance.label,
      "earning",
      amount,
      allowance.taxable ? "taxable allowance" : "non-taxable allowance, manual eligibility review",
    );
    if (allowance.taxable) taxable += amount;
    else warnings.push("Confirm non-taxable allowance eligibility and annual limits.");
  }
  const unpaid = input.timeAmounts?.["Unpaid leave"] ?? minuteAmount(input.unpaidMinutes),
    undertime = settings.deductUndertime
      ? (input.timeAmounts?.["Attendance deduction"] ?? minuteAmount(input.undertimeMinutes))
      : 0;
  line("Unpaid leave", "deduction", unpaid, "approved unpaid leave");
  line("Attendance deduction", "deduction", undertime, "reviewed attendance, configured policy");
  taxable -= unpaid + undertime;
  for (const [label, minutes, bps] of [
    ["Approved overtime", input.overtimeMinutes, settings.overtimeBps],
    ["Approved holiday work", input.holidayMinutes, settings.holidayBps],
    ["Approved rest-day work", input.restMinutes, settings.restDayBps],
    ["Night differential", input.nightMinutes, settings.nightDifferentialBps],
  ] as const) {
    const amount = input.timeAmounts?.[label] ?? minuteAmount(minutes, bps);
    line(label, "earning", amount, "attendance and approved request snapshot");
    taxable += amount;
  }
  for (const adjustment of input.adjustments) {
    const kind = adjustment.classification.startsWith("earning")
      ? "earning"
      : adjustment.classification === "employer"
        ? "employer"
        : "deduction";
    line(
      adjustment.label,
      kind,
      adjustment.amountMinor,
      `Manual ${adjustment.classification}: ${adjustment.reason}`,
    );
    if (adjustment.classification === "earning_taxable") taxable += adjustment.amountMinor;
    if (["sss", "philhealth", "pagibig"].includes(adjustment.classification))
      taxable -= adjustment.amountMinor;
  }
  const remunerationMinor = Math.max(
    0,
    lines.filter((l) => l.kind === "earning").reduce((n, l) => n + l.amountMinor, 0) -
      unpaid -
      undertime,
  );
  const statutory = configuredContributions(
    {
      basicMinor: input.monthlySalaryMinor,
      compensationMinor:
        input.monthlySalaryMinor + input.allowances.reduce((n, a) => n + a.amountMinor, 0),
      remunerationMinor: remunerationMinor + (input.priorRemunerationMinor ?? 0),
    },
    settings,
    configuration.rules,
    input.secondCutoff,
    input.finalCollection,
  );
  for (const [label, kind, amount] of [
    ["SSS", "deduction", statutory.sss],
    ["SSS MPF", "deduction", statutory.sssMpf],
    ["PhilHealth", "deduction", statutory.philhealth],
    ["Pag-IBIG", "deduction", statutory.pagibig],
    ["Employer SSS", "employer", statutory.sssEmployer],
    ["Employer MPF", "employer", statutory.sssMpfEmployer],
    ["Employer EC", "employer", statutory.sssEc],
    ["Employer PhilHealth", "employer", statutory.philhealthEmployer],
    ["Employer Pag-IBIG", "employer", statutory.pagibigEmployer],
  ] as const)
    line(label, kind, amount, configuration.version);
  taxable -= statutory.sss + statutory.sssMpf + statutory.philhealth + statutory.pagibig;
  const withholding = configuredWithholding(taxable, settings.frequency, configuration.rules);
  line("BIR withholding", "deduction", withholding, configuration.version);
  const grossMinor = lines
      .filter((l) => l.kind === "earning")
      .reduce((n, l) => n + l.amountMinor, 0),
    deductionsMinor = lines
      .filter((l) => l.kind === "deduction")
      .reduce((n, l) => n + l.amountMinor, 0),
    employerMinor = lines
      .filter((l) => l.kind === "employer")
      .reduce((n, l) => n + l.amountMinor, 0);
  if (grossMinor < 0 || deductionsMinor < 0 || grossMinor - deductionsMinor < 0)
    warnings.push("Invalid negative payroll total; correct the input before finalization.");
  return {
    grossMinor,
    deductionsMinor,
    netMinor: grossMinor - deductionsMinor,
    employerMinor,
    lines,
    warnings,
  };
}
