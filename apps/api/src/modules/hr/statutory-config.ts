import { statutoryConfigurationInputSchema } from "@lumolynk/contracts/payroll";
import {
  hrPayrollEmployee,
  hrPayrollRun,
  hrStatutoryConfiguration,
} from "@lumolynk/database/schema";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";

import { AppError } from "../../lib/errors";
import type { HrContext } from "./core";

export async function statutoryFor(c: HrContext, start: string, end: string) {
  const versions = await c.tx
    .select()
    .from(hrStatutoryConfiguration)
    .where(
      and(
        eq(hrStatutoryConfiguration.workspaceId, c.workspaceId),
        lte(hrStatutoryConfiguration.effectiveFrom, end),
      ),
    )
    .orderBy(desc(hrStatutoryConfiguration.effectiveFrom));
  const row = versions[0];
  if (!row)
    throw new AppError(
      409,
      "STATUTORY_CONFIGURATION_REQUIRED",
      "Ask an authorized payroll colleague to save statutory settings covering this payroll period.",
    );
  if (row.effectiveFrom > start || row.validThrough < end)
    throw new AppError(
      409,
      "STATUTORY_PERIOD_UNCOVERED",
      "One reviewed statutory configuration must cover the entire payroll period. Save an applicable effective version first.",
    );
  return {
    id: row.id,
    version: `workspace:${row.id}`,
    rules: statutoryConfigurationInputSchema.parse(row.data),
  };
}

// Saving a new effective version invalidates approval of affected open calculations.
// Workspace access serializes this with calculation/finalization in the same transaction.
export async function invalidateStatutoryRuns(c: HrContext, effectiveFrom: string) {
  const rows = await c.tx
    .update(hrPayrollRun)
    .set({
      status: "draft",
      revision: sql`${hrPayrollRun.revision} + 1`,
      calculatedBy: null,
      approvedBy: null,
      settingsSnapshot: null,
      ruleVersion: null,
      warnings: [],
    })
    .where(
      and(
        eq(hrPayrollRun.workspaceId, c.workspaceId),
        sql`${hrPayrollRun.endDate} >= ${effectiveFrom}`,
        sql`${hrPayrollRun.status} in ('calculated','under_review','approved')`,
      ),
    )
    .returning({ id: hrPayrollRun.id });
  if (rows.length)
    await c.tx.delete(hrPayrollEmployee).where(
      and(
        eq(hrPayrollEmployee.workspaceId, c.workspaceId),
        inArray(
          hrPayrollEmployee.runId,
          rows.map((r) => r.id),
        ),
      ),
    );
  return rows.map((r) => r.id);
}
