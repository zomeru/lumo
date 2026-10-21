import type { PayrollSettings } from "@lumo/contracts/hr";
import { hrNotification, hrPayrollRun } from "@lumo/database/schema";
import { and, eq, lte } from "drizzle-orm";

import { localParts } from "./calendar";
import { notifyHr, type HrContext } from "./core";

/** Calendar cutoffs, with short months clamped and earlier payout days in the next month. */
export function suggestedPayrollPeriod(settings: PayrollSettings, today: string) {
  const year = Number(today.slice(0, 4)),
    month = Number(today.slice(5, 7));
  const first = settings.frequency === "semimonthly" && Number(today.slice(8)) <= 15;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${today.slice(0, 7)}-${first || settings.frequency === "monthly" ? "01" : "16"}`;
  const endDate = `${today.slice(0, 7)}-${first ? "15" : String(last)}`;
  const payoutDay = first ? settings.firstPayoutDay : settings.payoutDay;
  const payoutMonth =
    month - 1 + (payoutDay < Number(endDate.slice(8)) && payoutDay < last ? 1 : 0);
  const payoutLast = new Date(Date.UTC(year, payoutMonth + 1, 0)).getUTCDate();
  const payoutDate = new Date(Date.UTC(year, payoutMonth, Math.min(payoutDay, payoutLast)))
    .toISOString()
    .slice(0, 10);
  return { startDate, endDate, cutoffDate: endDate, payoutDate };
}

/** Durable in-app reminders are created once per authorized recipient and unpaid run. */
export async function remindPayrollDue(c: HrContext) {
  if (!(await c.can("hr.payroll.runs.manage")) && !(await c.can("hr.payroll.mark_paid"))) return;
  const title = "Payroll payout is due";
  const due = await c.tx
    .select({ id: hrPayrollRun.id })
    .from(hrPayrollRun)
    .where(
      and(
        eq(hrPayrollRun.workspaceId, c.workspaceId),
        eq(hrPayrollRun.status, "finalized"),
        lte(hrPayrollRun.payoutDate, localParts(new Date(), c.timezone).date),
      ),
    );
  if (!due.length) return;
  const existing = await c.tx
    .select({ targetId: hrNotification.targetId })
    .from(hrNotification)
    .where(
      and(
        eq(hrNotification.workspaceId, c.workspaceId),
        eq(hrNotification.userId, c.actorId),
        eq(hrNotification.module, "payroll"),
        eq(hrNotification.title, title),
      ),
    );
  const reminded = new Set(existing.map((n) => n.targetId));
  for (const run of due)
    if (!reminded.has(run.id)) await notifyHr(c, c.actorId, title, "payroll", run.id);
}
