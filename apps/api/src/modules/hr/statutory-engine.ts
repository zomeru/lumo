import type { PayrollSettings } from "@lumo/contracts/hr";
import type { StatutoryConfigurationInput } from "@lumo/contracts/payroll";

import { financialRatio } from "./payroll-money";
import { philippineRules } from "./payroll-rules";

// A reference draft, never an active workspace configuration until explicitly saved.
export function statutoryTemplate(): StatutoryConfigurationInput {
  const r = philippineRules;
  const policy = {
    enabled: true,
    exemptionReason: "",
    rounding: "nearest_centavo",
    collection: "split",
    salaryBasis: "monthly_basic",
  } as const;
  const brackets = [];
  for (let credit = r.sss.floorMinor; credit <= r.sss.ceilingMinor; credit += r.sss.stepMinor) {
    brackets.push({
      fromMinor: credit === r.sss.floorMinor ? 0 : credit - r.sss.midpointMinor,
      toMinor: credit === r.sss.ceilingMinor ? null : credit + r.sss.midpointMinor,
      salaryCreditMinor: credit,
      ecMinor: credit >= r.sss.ecThresholdMinor ? r.sss.ecHighMinor : r.sss.ecLowMinor,
    });
  }
  return {
    label: "Philippine statutory reference — review before saving",
    effectiveFrom: r.effectiveFrom,
    validThrough: r.effectiveTo,
    reason: "Review applicable official sources and document approval before saving.",
    confirmed: true,
    sources: r.sources.map((s) =>
      s.title.startsWith("Pag-IBIG")
        ? {
            title: "Pag-IBIG Circular 460 (official DMW-hosted copy)",
            url: "https://dmw.gov.ph/archives/v1/resources/dsms/DMW/ISN-EXT/2025/DMW-ADVISORY-37-2025.pdf",
          }
        : { ...s },
    ),
    sss: {
      ...policy,
      salaryBasis: "period_remuneration",
      collection: "second_cutoff",
      employeeBps: r.sss.employeeBps,
      employerBps: r.sss.employerBps,
      mpfEmployeeBps: r.sss.employeeBps,
      mpfEmployerBps: r.sss.employerBps,
      minimumCreditMinor: r.sss.floorMinor,
      maximumCreditMinor: r.sss.ceilingMinor,
      regularCreditCapMinor: r.sss.regularCapMinor,
      ecEnabled: true,
      brackets,
    },
    pagibig: {
      ...policy,
      salaryBasis: "monthly_compensation",
      compensationCapMinor: r.pagibig.ceilingMinor,
      employeeCapMinor: null,
      employerCapMinor: null,
      brackets: [
        {
          fromMinor: 0,
          toMinor: r.pagibig.lowThresholdMinor + 1,
          employeeBps: r.pagibig.lowEmployeeBps,
          employerBps: r.pagibig.employerBps,
        },
        {
          fromMinor: r.pagibig.lowThresholdMinor + 1,
          toMinor: null,
          employeeBps: r.pagibig.employeeBps,
          employerBps: r.pagibig.employerBps,
        },
      ],
    },
    philhealth: {
      ...policy,
      totalBps: r.philhealth.employeeBps + r.philhealth.employerBps,
      employeeShareBps: 5000,
      employerShareBps: 5000,
      floorMinor: r.philhealth.floorMinor,
      ceilingMinor: r.philhealth.ceilingMinor,
      premiumCapMinor: null,
    },
    bir: {
      enabled: true,
      exemptionReason: "",
      rounding: "nearest_centavo",
      monthly: r.monthlyTax.map((b) => ({ ...b })),
      semimonthly: r.semimonthlyTax.map((b) => ({ ...b })),
    },
  };
}

export function configuredContributions(
  bases: { basicMinor: number; compensationMinor: number; remunerationMinor: number },
  settings: PayrollSettings,
  rules: StatutoryConfigurationInput,
  secondCutoff = false,
  finalCollection = false,
) {
  type Policy = Pick<StatutoryConfigurationInput["sss"], "salaryBasis" | "enabled" | "collection">;
  const base = (policy: Policy) =>
    policy.salaryBasis === "monthly_basic"
      ? bases.basicMinor
      : policy.salaryBasis === "monthly_compensation"
        ? bases.compensationMinor
        : bases.remunerationMinor;
  const collect = (value: number, policy: Policy) => {
    if (!policy.enabled) return 0;
    if (settings.frequency === "monthly") return value;
    if (policy.collection === "second_cutoff") return secondCutoff || finalCollection ? value : 0;
    return secondCutoff ? value - Math.floor(value / 2) : Math.floor(value / 2);
  };
  // Common policy shape is shared; the subtype does not affect base/collection selection.
  const p = rules.pagibig,
    h = rules.philhealth,
    s = rules.sss;
  const salary = base(s),
    row = s.brackets.find(
      (b) => salary >= b.fromMinor && (b.toMinor === null || salary < b.toMinor),
    )!;
  const credit = Math.min(
    s.maximumCreditMinor,
    Math.max(s.minimumCreditMinor, row.salaryCreditMinor),
  );
  const regular = Math.min(credit, s.regularCreditCapMinor),
    mpf = credit - regular;
  const pagibigSalary = base(p);
  const pagibigRow = p.brackets.find(
    (b) => pagibigSalary >= b.fromMinor && (b.toMinor === null || pagibigSalary < b.toMinor),
  )!;
  const pagibigBase = Math.min(p.compensationCapMinor, pagibigSalary);
  const premium = Math.min(
    h.premiumCapMinor ?? Number.MAX_SAFE_INTEGER,
    financialRatio(
      Math.min(h.ceilingMinor, Math.max(h.floorMinor, base(h))),
      h.totalBps,
      10000,
      h.rounding,
    ),
  );
  const employeePremium = financialRatio(premium, h.employeeShareBps, 10000, h.rounding);
  return {
    sss: collect(financialRatio(regular, s.employeeBps, 10000, s.rounding), s),
    sssMpf: collect(financialRatio(mpf, s.mpfEmployeeBps, 10000, s.rounding), s),
    sssEmployer: collect(financialRatio(regular, s.employerBps, 10000, s.rounding), s),
    sssMpfEmployer: collect(financialRatio(mpf, s.mpfEmployerBps, 10000, s.rounding), s),
    sssEc: collect(s.ecEnabled ? row.ecMinor : 0, s),
    philhealth: collect(employeePremium, h),
    philhealthEmployer: collect(premium - employeePremium, h),
    pagibig: collect(
      Math.min(
        p.employeeCapMinor ?? Number.MAX_SAFE_INTEGER,
        financialRatio(pagibigBase, pagibigRow.employeeBps, 10000, p.rounding),
      ),
      p,
    ),
    pagibigEmployer: collect(
      Math.min(
        p.employerCapMinor ?? Number.MAX_SAFE_INTEGER,
        financialRatio(pagibigBase, pagibigRow.employerBps, 10000, p.rounding),
      ),
      p,
    ),
  };
}
export function configuredWithholding(
  taxableMinor: number,
  frequency: PayrollSettings["frequency"],
  rules: StatutoryConfigurationInput,
) {
  if (!rules.bir.enabled) return 0;
  const brackets = rules.bir[frequency];
  const bracket = brackets.filter((b) => taxableMinor > b.thresholdMinor).at(-1) ?? brackets[0]!;
  return (
    bracket.fixedMinor +
    financialRatio(
      Math.max(0, taxableMinor - bracket.thresholdMinor),
      bracket.bps,
      10000,
      rules.bir.rounding,
    )
  );
}
