// Versioned source configuration. Browsing is not independent payroll reviewer sign-off.
export const philippineRules = {
  version: "PH-2025-01-v1",
  effectiveFrom: "2025-01-01",
  effectiveTo: "2026-12-31",
  reviewStatus: "requires_independent_review" as const,
  sources: [
    {
      title: "SSS Circular 2024-006, business employers and employees",
      url: "https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf",
    },
    {
      title: "PhilHealth Advisory 2025-0002",
      url: "https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf",
    },
    {
      title: "Pag-IBIG Circular 460 (official DepEd-hosted copy)",
      url: "https://catanduanes.deped.gov.ph/files/UM-2024---Increase-in-PAG-IBIG-Premium-Contributions.pdf",
    },
    {
      title: "BIR RR 11-2018 Annex E, effective 2023 onwards",
      url: "https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf",
    },
  ],
  sss: {
    floorMinor: 500000,
    ceilingMinor: 3500000,
    stepMinor: 50000,
    midpointMinor: 25000,
    regularCapMinor: 2000000,
    employeeBps: 500,
    employerBps: 1000,
    ecThresholdMinor: 1500000,
    ecLowMinor: 1000,
    ecHighMinor: 3000,
  },
  philhealth: { floorMinor: 1000000, ceilingMinor: 10000000, employeeBps: 250, employerBps: 250 },
  pagibig: {
    ceilingMinor: 1000000,
    lowThresholdMinor: 150000,
    lowEmployeeBps: 100,
    employeeBps: 200,
    employerBps: 200,
  },
  monthlyTax: [
    { thresholdMinor: 0, fixedMinor: 0, bps: 0 },
    { thresholdMinor: 2083300, fixedMinor: 0, bps: 1500 },
    { thresholdMinor: 3333300, fixedMinor: 187500, bps: 2000 },
    { thresholdMinor: 6666700, fixedMinor: 854180, bps: 2500 },
    { thresholdMinor: 16666700, fixedMinor: 3354180, bps: 3000 },
    { thresholdMinor: 66666700, fixedMinor: 18354180, bps: 3500 },
  ],
  semimonthlyTax: [
    { thresholdMinor: 0, fixedMinor: 0, bps: 0 },
    { thresholdMinor: 1041700, fixedMinor: 0, bps: 1500 },
    { thresholdMinor: 1666700, fixedMinor: 93750, bps: 2000 },
    { thresholdMinor: 3333300, fixedMinor: 427070, bps: 2500 },
    { thresholdMinor: 8333300, fixedMinor: 1677070, bps: 3000 },
    { thresholdMinor: 33333300, fixedMinor: 9177070, bps: 3500 },
  ],
};
