import { z } from "zod";

const money = z.number().int().min(0).max(1000000000000);
const rate = z.number().int().min(0).max(10000);
const contributionPolicy = {
  enabled: z.boolean(),
  exemptionReason: z.string().trim().max(500),
  rounding: z.enum(["nearest_centavo", "up_centavo", "down_centavo"]),
  collection: z.enum(["split", "second_cutoff"]),
  salaryBasis: z.enum(["monthly_basic", "monthly_compensation", "period_remuneration"]),
};
const range = { fromMinor: money, toMinor: money.nullable() };
const taxBracket = z.strictObject({ thresholdMinor: money, fixedMinor: money, bps: rate });
export const statutoryConfigurationInputSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(120),
    effectiveFrom: z.iso.date(),
    validThrough: z.iso.date(),
    reason: z.string().trim().min(10).max(1000),
    sources: z
      .array(
        z.strictObject({
          title: z.string().trim().min(1).max(200),
          url: z.url({ protocol: /^https$/ }),
        }),
      )
      .min(1)
      .max(20),
    confirmed: z.literal(true),
    sss: z.strictObject({
      ...contributionPolicy,
      employeeBps: rate,
      employerBps: rate,
      mpfEmployeeBps: rate,
      mpfEmployerBps: rate,
      minimumCreditMinor: money,
      maximumCreditMinor: money,
      regularCreditCapMinor: money,
      ecEnabled: z.boolean(),
      brackets: z
        .array(z.strictObject({ ...range, salaryCreditMinor: money, ecMinor: money }))
        .min(1)
        .max(200),
    }),
    pagibig: z.strictObject({
      ...contributionPolicy,
      compensationCapMinor: money,
      employeeCapMinor: money.nullable(),
      employerCapMinor: money.nullable(),
      brackets: z
        .array(z.strictObject({ ...range, employeeBps: rate, employerBps: rate }))
        .min(1)
        .max(100),
    }),
    philhealth: z.strictObject({
      ...contributionPolicy,
      totalBps: rate,
      employeeShareBps: rate,
      employerShareBps: rate,
      floorMinor: money,
      ceilingMinor: money,
      premiumCapMinor: money.nullable(),
    }),
    bir: z.strictObject({
      enabled: z.boolean(),
      exemptionReason: z.string().trim().max(500),
      rounding: contributionPolicy.rounding,
      monthly: z.array(taxBracket).min(1).max(100),
      semimonthly: z.array(taxBracket).min(1).max(100),
    }),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (v.validThrough < v.effectiveFrom)
      issue(["validThrough"], "Review end date must follow the effective date.");
    for (const key of ["sss", "pagibig", "philhealth", "bir"] as const) {
      const policy = v[key];
      if (!policy.enabled && policy.exemptionReason.length < 10)
        issue(
          [key, "exemptionReason"],
          "Document the legal basis for disabling this contribution.",
        );
      if (
        key !== "bir" &&
        v[key].salaryBasis === "period_remuneration" &&
        v[key].collection !== "second_cutoff"
      )
        issue(
          [key, "collection"],
          "Actual remuneration requires month-end collection to reconcile both cutoffs.",
        );
    }
    for (const key of ["sss", "pagibig"] as const) {
      const brackets = v[key].brackets;
      for (const [i, row] of brackets.entries()) {
        if (row.fromMinor !== (i === 0 ? 0 : brackets[i - 1]!.toMinor))
          issue(
            [key, "brackets", i, "fromMinor"],
            "Brackets must cover salary continuously from zero, without gaps or overlaps.",
          );
        if (
          i === brackets.length - 1
            ? row.toMinor !== null
            : row.toMinor === null || row.toMinor <= row.fromMinor
        )
          issue(
            [key, "brackets", i, "toMinor"],
            "Use an exclusive upper bound; only the last bracket must be open-ended.",
          );
      }
    }
    const s = v.sss;
    if (
      s.minimumCreditMinor > s.maximumCreditMinor ||
      s.regularCreditCapMinor < s.minimumCreditMinor ||
      s.regularCreditCapMinor > s.maximumCreditMinor
    )
      issue(
        ["sss", "regularCreditCapMinor"],
        "Credit limits must satisfy minimum ≤ regular cap ≤ maximum.",
      );
    for (const [i, row] of s.brackets.entries()) {
      if (
        row.salaryCreditMinor < s.minimumCreditMinor ||
        row.salaryCreditMinor > s.maximumCreditMinor ||
        (i > 0 && row.salaryCreditMinor < s.brackets[i - 1]!.salaryCreditMinor)
      )
        issue(
          ["sss", "brackets", i, "salaryCreditMinor"],
          "Salary credits must increase within the configured limits.",
        );
    }
    if (v.philhealth.floorMinor > v.philhealth.ceilingMinor)
      issue(["philhealth", "ceilingMinor"], "Salary ceiling must be at least the floor.");
    if (v.philhealth.employeeShareBps + v.philhealth.employerShareBps !== 10000)
      issue(["philhealth", "employeeShareBps"], "Employee and employer shares must total 100%.");
    for (const period of ["monthly", "semimonthly"] as const) {
      for (const [i, row] of v.bir[period].entries()) {
        if (
          i === 0
            ? row.thresholdMinor !== 0 || row.fixedMinor !== 0
            : row.thresholdMinor <= v.bir[period][i - 1]!.thresholdMinor ||
              row.fixedMinor < v.bir[period][i - 1]!.fixedMinor
        )
          issue(
            ["bir", period, i],
            "Tax brackets must start at zero and have increasing thresholds and nondecreasing fixed tax.",
          );
      }
    }
  });
export type StatutoryConfigurationInput = z.infer<typeof statutoryConfigurationInputSchema>;
export const statutoryConfigurationSchema = statutoryConfigurationInputSchema.safeExtend({
  id: z.uuid(),
  actorId: z.uuid(),
  createdAt: z.string(),
});
export type StatutoryConfiguration = z.infer<typeof statutoryConfigurationSchema>;
export const statutoryConfigurationsSchema = z.object({
  configurations: z.array(statutoryConfigurationSchema),
  template: statutoryConfigurationInputSchema,
});
