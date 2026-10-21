import { describe, expect, it } from "vitest";

import {
  statutoryConfigurationInputSchema,
  statutoryConfigurationSchema,
  type StatutoryConfigurationInput,
} from "./payroll";

function configuration(): StatutoryConfigurationInput {
  const policy = {
    enabled: true,
    exemptionReason: "",
    rounding: "nearest_centavo",
    collection: "split",
    salaryBasis: "monthly_basic",
  } as const;
  return {
    label: "Accounting verified rules",
    effectiveFrom: "2026-01-01",
    validThrough: "2026-12-31",
    reason: "Annual accounting review",
    confirmed: true,
    sources: [{ title: "Official source", url: "https://www.sss.gov.ph/" }],
    sss: {
      ...policy,
      employeeBps: 500,
      employerBps: 1000,
      mpfEmployeeBps: 500,
      mpfEmployerBps: 1000,
      minimumCreditMinor: 500000,
      maximumCreditMinor: 3500000,
      regularCreditCapMinor: 2000000,
      ecEnabled: true,
      brackets: [
        { fromMinor: 0, toMinor: 1000000, salaryCreditMinor: 500000, ecMinor: 1000 },
        { fromMinor: 1000000, toMinor: null, salaryCreditMinor: 3500000, ecMinor: 3000 },
      ],
    },
    pagibig: {
      ...policy,
      compensationCapMinor: 1000000,
      employeeCapMinor: null,
      employerCapMinor: null,
      brackets: [{ fromMinor: 0, toMinor: null, employeeBps: 200, employerBps: 200 }],
    },
    philhealth: {
      ...policy,
      totalBps: 500,
      employeeShareBps: 5000,
      employerShareBps: 5000,
      floorMinor: 1000000,
      ceilingMinor: 10000000,
      premiumCapMinor: null,
    },
    bir: {
      enabled: true,
      exemptionReason: "",
      rounding: "nearest_centavo",
      monthly: [
        { thresholdMinor: 0, fixedMinor: 0, bps: 0 },
        { thresholdMinor: 2083300, fixedMinor: 0, bps: 1500 },
      ],
      semimonthly: [{ thresholdMinor: 0, fixedMinor: 0, bps: 0 }],
    },
  };
}
describe("statutory configuration validation", () => {
  it("accepts an explicit effective version and its persisted identity", () => {
    const value = configuration();
    expect(statutoryConfigurationInputSchema.parse(value)).toEqual(value);
    expect(
      statutoryConfigurationSchema.parse({
        ...value,
        id: "00000000-0000-4000-8000-000000000001",
        actorId: "00000000-0000-4000-8000-000000000002",
        createdAt: "2026-01-01T00:00:00Z",
      }).label,
    ).toBe(value.label);
    value.sss.enabled = false;
    value.sss.exemptionReason = "Documented legal exemption";
    expect(statutoryConfigurationInputSchema.safeParse(value).success).toBe(true);
  });
  it.each([
    (v: StatutoryConfigurationInput) => {
      v.effectiveFrom = "2026-01-16";
    },
    (v: StatutoryConfigurationInput) => {
      v.validThrough = "2025-01-01";
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.enabled = false;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[0]!.fromMinor = 1;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[0]!.toMinor = null;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[0]!.toMinor = 0;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[1]!.toMinor = 2000000;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[1]!.fromMinor = 999999;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.minimumCreditMinor = 3500001;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.regularCreditCapMinor = 1;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.regularCreditCapMinor = 3500001;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[0]!.salaryCreditMinor = 1;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[1]!.salaryCreditMinor = 3500001;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.brackets[0]!.salaryCreditMinor = 3500000;
      v.sss.brackets[1]!.salaryCreditMinor = 500000;
    },
    (v: StatutoryConfigurationInput) => {
      v.philhealth.employeeShareBps = 4999;
    },
    (v: StatutoryConfigurationInput) => {
      v.philhealth.floorMinor = 10000001;
    },
    (v: StatutoryConfigurationInput) => {
      v.pagibig.salaryBasis = "period_remuneration";
    },
    (v: StatutoryConfigurationInput) => {
      v.bir.monthly[0]!.thresholdMinor = 1;
    },
    (v: StatutoryConfigurationInput) => {
      v.bir.monthly[0]!.fixedMinor = 1;
    },
    (v: StatutoryConfigurationInput) => {
      v.bir.monthly[1]!.thresholdMinor = 0;
    },
    (v: StatutoryConfigurationInput) => {
      v.bir.monthly[0]!.fixedMinor = 2;
    },
    (v: StatutoryConfigurationInput) => {
      v.sss.employeeBps = 10001;
    },
    (v: StatutoryConfigurationInput) => {
      v.pagibig.compensationCapMinor = 0.5;
    },
    (v: StatutoryConfigurationInput) => {
      v.sources[0]!.url = "http://example.com";
    },
  ])(
    "rejects invalid dates, exemption reasons, coverage, shares and numeric limits (%#)",
    (change) => {
      const value = configuration();
      change(value);
      expect(statutoryConfigurationInputSchema.safeParse(value).success).toBe(false);
    },
  );
  it("supports monthly remuneration reconciled at month-end and additional tax rows", () => {
    const value = configuration();
    value.sss.salaryBasis = "period_remuneration";
    value.sss.collection = "second_cutoff";
    value.bir.monthly.push({ thresholdMinor: 3333300, fixedMinor: 187500, bps: 2000 });
    expect(statutoryConfigurationInputSchema.safeParse(value).success).toBe(true);
    value.bir.monthly[2]!.fixedMinor = 0;
    value.bir.monthly[1]!.fixedMinor = 1;
    expect(statutoryConfigurationInputSchema.safeParse(value).success).toBe(false);
  });
});
