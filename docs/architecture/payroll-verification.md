# Payroll calculation and independent verification

The software is an auditable calculation system, not a certificate of Philippine payroll compliance. Every employee in every run needs an independent human verification record, even when deterministic software fixtures pass. Browsing and test-fixture approvals are not accounting sign-off.

## Supported scope and sources

The current registry `PH-2025-01-v1` covers ordinary Philippine salaried employees, monthly and semimonthly periods, PHP centavos, from 2025-01-01 through 2026-12-31. Its end date is a software review boundary, not an assertion that an issuance expires then. Extend it only after checking for superseding issuances and updating fixtures. Other jurisdictions, hourly/daily payroll, household workers, self-employed contributions, minimum-wage tax exemptions, annualized withholding, final pay, and statutory annual benefit exemptions require a reviewed extension or explicitly documented per-run corrections; do not assume this ordinary-employee model covers them.

Primary sources inspected on 2026-10-21:

- [SSS Circular 2024-006 and contribution schedule](https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf), linked from [SSS contribution resources](https://www.sss.gov.ph/pay-contribution/). The engine separates regular SS, MPF and employer-only EC and applies the schedule's salary-credit brackets.
- [PhilHealth Advisory 2025-0002](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf); the [2026 advisories](https://www.philhealth.gov.ph/advisories/2026/archives.php) and [2026 circulars](https://www.philhealth.gov.ph/circulars/2026/) were checked for updates. This source discovery does not replace independent confirmation of current applicability.
- [Pag-IBIG Circular 460 in an official DepEd-hosted issuance](https://catanduanes.deped.gov.ph/files/UM-2024---Increase-in-PAG-IBIG-Premium-Contributions.pdf). The issuing agency's [original PDF](https://www.pagibigfund.gov.ph/document/pdf/circulars/provident/Circular%20No.%20460%20-%20Guidelines%20on%20the%20Pag-IBIG%20Fund%27s%20Implementation%20of%20Increase%20in%20the%20MFS%20Effective%20February%202024.pdf) was blocked by its browser verification challenge. Confirm the original with the payroll reviewer.
- [BIR RR 11-2018 Annex E](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf), with separate monthly and semimonthly withholding brackets effective from 2023.

Statutory values are versioned application configuration. Workspace settings edit business policies, not government tables. Calculation snapshots include rule configuration, effective compensation, settings, employment, attendance, canonical approved leave/overtime, and explicitly classified adjustments.

## Arithmetic and precedence

All stored amounts are integer PHP centavos. Ratios use BigInt intermediates and round half away from zero to the nearest centavo at each line. Salaried base pay is weighted by scheduled work minutes at each effective salary within the full period, divided by the configured frequency. Hire/end dates prorate eligible minutes. Monthly allowances use the latest effective profile and frequency; a reviewer must correct partial-period or mid-period allowance eligibility explicitly.

Unpaid leave and attendance deductions are separate lines. Attendance deductions follow the workspace's explicit policy. Paid leave reduces scheduled attendance obligations without being a payroll deduction. Extra logged minutes become payable only up to approved overtime. Holiday/rest-day premiums use configured business multipliers. Night differential uses local 22:00–06:00 minutes excluding recorded unpaid breaks; reviewed corrections with unspecified break intervals require explicit night-pay review and, when needed, a classified adjustment.

Contributions use monthly compensation and frequency-specific contribution allocation; semimonthly odd centavos are assigned to the second cutoff. Withholding uses the appropriate period's table after employee statutory contributions and taxable adjustments. Employer-only contributions do not reduce employee net pay. Non-taxable allowances, statutory adjustments, employment proration and unusual earned/paid-period treatment require reviewer evidence. Expenses/advances enter payroll only through a deliberate classified adjustment referencing an approved request. Purchase, travel and general approvals cannot be auto-imported as payroll deductions.

## Required review workflow

1. Configure business policies and effective compensation. An editor cannot change their own compensation. Assign the reviewer `hr.payroll.read_all` and `hr.payroll.runs.approve`; assign operators `hr.payroll.runs.manage` separately.
2. Create the full monthly or semimonthly period and attendance cutoff. Resolve incomplete time entries, missing compensation/schedules and rule coverage warnings. Use documented, classified adjustments for payroll-specific corrections.
3. Calculate. Recalculation replaces the draft's employee snapshots and invalidates previous verification. Never edit a closed run.
4. A different authorized reviewer independently checks each employee's gross pay, paid/unpaid leave, approved time, earnings classifications, SSS/MPF/EC, PhilHealth, Pag-IBIG, withholding, caps, rounding, prior cutoff allocation and net pay against applicable official rules and accounting records. Review any employee-specific exemption, annual limit or exceptional treatment. If the engine's line differs, return to draft and enter a documented correction, then recalculate.
5. For each employee, the reviewer enters the independently determined net amount and evidence/source references, and explicitly confirms all lines and warnings were checked. The API requires matching net pay, current revision, a reviewer other than the calculator, and a reviewer other than the employee. This is the explicit manual-verification process required while rules remain unverified independently.
6. Approve only when every employee has that record and no blocking warnings remain. Finalize only after the period closes. Publishing is separate unless explicitly configured; employees cannot access drafts or unreleased payslips, including through exports or operator views of their own pay.
7. Record paid only after confirming payment outside Lumo. Lumo performs no transfers or government remittances.

Unpaid runs can be voided with a reason and reissued with an explicit replacement link. Paid runs require a documented subsequent-period correction. Closed-period leave/overtime/correction changes and backdated compensation/settings changes are blocked. Original snapshots, reviewer evidence and audit records remain intact.

No actual payroll/accounting reviewer has certified these rules as part of implementation. Production operators must follow the process above for every run; software test confirmations do not count as production approval.
