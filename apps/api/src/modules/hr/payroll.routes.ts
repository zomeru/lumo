import { idSchema } from "@lumo/contracts";
import {
  calendarDateSchema,
  compensationInputSchema,
  payrollAdjustmentInputSchema,
  payrollResultSchema,
  payrollRunInputSchema,
  payrollSettingsInputSchema,
  payrollVerifySchema,
} from "@lumo/contracts/hr";
import { statutoryConfigurationInputSchema } from "@lumo/contracts/payroll";
import {
  hrStatutoryConfiguration,
  hrCompensation,
  hrPayrollAdjustment,
  hrPayrollEmployee,
  hrPayrollRun,
  hrPayrollSetting,
  hrRequest,
} from "@lumo/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { ApiContext } from "../../lib/context";
import { AppError, denied, missing, parse } from "../../lib/errors";
import { csvRows } from "./attendance";
import { localParts } from "./calendar";
import { auditHr, notifyHr, requireHrMember, type HrCore, type HrContext } from "./core";
import {
  assertOpenPayrollPeriod,
  calculateRun,
  closedPayroll,
  employeePay,
  payrollRunFor,
  releasedPayslips,
  settingsFor,
} from "./payroll";
import { philippineRules } from "./payroll-rules";
import { suggestedPayrollPeriod } from "./payroll-schedule";
import { statutoryFor, invalidateStatutoryRuns } from "./statutory-config";
import { statutoryTemplate } from "./statutory-engine";

async function readPayroll(c: HrContext) {
  if (!(await c.can("hr.payroll.read_all")) && !(await c.can("hr.payroll.runs.manage"))) denied();
}
async function runRows(c: HrContext, id: string) {
  await readPayroll(c);
  const run = await payrollRunFor(c, id);
  const employees = await c.tx
    .select()
    .from(hrPayrollEmployee)
    .where(
      and(
        eq(hrPayrollEmployee.workspaceId, c.workspaceId),
        eq(hrPayrollEmployee.runId, id),
        run.publishedAt ? undefined : sql`${hrPayrollEmployee.userId} <> ${c.actorId}`,
      ),
    );
  return { run, employees };
}
export function payrollRoutes(core: HrCore) {
  const app = new Hono<ApiContext>();
  app.get("/payroll/compensation", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.payroll.read_all");
        await auditHr(ctx, "compensation.read", "roster");
        return {
          compensations: await ctx.tx
            .select({
              id: hrCompensation.id,
              userId: hrCompensation.userId,
              effectiveFrom: hrCompensation.effectiveFrom,
              salaryMinor: hrCompensation.salaryMinor,
              allowances: hrCompensation.allowances,
              reason: hrCompensation.reason,
              actorId: hrCompensation.actorId,
              createdAt: hrCompensation.createdAt,
            })
            .from(hrCompensation)
            .where(eq(hrCompensation.workspaceId, ctx.workspaceId))
            .orderBy(desc(hrCompensation.effectiveFrom)),
        };
      }),
    ),
  );
  app.post("/payroll/compensation", async (c) => {
    const input = parse(compensationInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.payroll.compensation.manage");
      if (input.userId === ctx.actorId) denied();
      await requireHrMember(ctx, input.userId);
      await assertOpenPayrollPeriod(ctx, input.effectiveFrom, "2200-12-31");
      const history = await ctx.tx
        .select()
        .from(hrCompensation)
        .where(
          and(
            eq(hrCompensation.workspaceId, ctx.workspaceId),
            eq(hrCompensation.userId, input.userId),
          ),
        )
        .orderBy(desc(hrCompensation.effectiveFrom));
      if (history.some((r) => r.effectiveFrom === input.effectiveFrom))
        throw new AppError(
          409,
          "COMPENSATION_EXISTS",
          "Use a new effective date to retain compensation history.",
        );
      await ctx.tx
        .insert(hrCompensation)
        .values({ workspaceId: ctx.workspaceId, ...input, actorId: ctx.actorId });
      await auditHr(ctx, "compensation.changed", input.userId, {
        before: history[0] ?? null,
        after: input,
      });
    });
    return c.json({ ok: true });
  });
  app.get("/payroll/statutory-configurations", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.payroll.settings.manage");
        const rows = await ctx.tx
          .select()
          .from(hrStatutoryConfiguration)
          .where(eq(hrStatutoryConfiguration.workspaceId, ctx.workspaceId))
          .orderBy(desc(hrStatutoryConfiguration.effectiveFrom));
        return {
          configurations: rows.map((r) => ({
            ...r.data,
            id: r.id,
            actorId: r.actorId,
            createdAt: r.createdAt,
          })),
          template: statutoryTemplate(),
        };
      }),
    ),
  );
  app.post("/payroll/statutory-configurations", async (c) => {
    const input = parse(statutoryConfigurationInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.payroll.settings.manage");
      await assertOpenPayrollPeriod(ctx, input.effectiveFrom, "2200-12-31");
      const history = await ctx.tx
        .select()
        .from(hrStatutoryConfiguration)
        .where(eq(hrStatutoryConfiguration.workspaceId, ctx.workspaceId))
        .orderBy(desc(hrStatutoryConfiguration.effectiveFrom));
      if (history.some((r) => r.effectiveFrom === input.effectiveFrom))
        throw new AppError(
          409,
          "STATUTORY_VERSION_EXISTS",
          "Save a new effective date to retain statutory configuration history.",
        );
      const [row] = await ctx.tx
        .insert(hrStatutoryConfiguration)
        .values({
          workspaceId: ctx.workspaceId,
          effectiveFrom: input.effectiveFrom,
          validThrough: input.validThrough,
          data: input,
          actorId: ctx.actorId,
        })
        .returning();
      const invalidatedRuns = await invalidateStatutoryRuns(ctx, input.effectiveFrom);
      await auditHr(ctx, "statutory_configuration.changed", row!.id, {
        before: history.find((r) => r.effectiveFrom <= input.effectiveFrom)?.data ?? null,
        after: input,
        invalidatedRuns,
      });
    });
    return c.json({ ok: true });
  });
  app.get("/payroll/settings", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.payroll.settings.manage");
        return {
          settings: (
            await ctx.tx
              .select()
              .from(hrPayrollSetting)
              .where(eq(hrPayrollSetting.workspaceId, ctx.workspaceId))
              .orderBy(desc(hrPayrollSetting.effectiveFrom))
          ).map((s) => ({ ...s.data, id: s.id, actorId: s.actorId, createdAt: s.createdAt })),
          rules: philippineRules,
        };
      }),
    ),
  );
  app.get("/payroll/schedule", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.payroll.runs.manage");
        try {
          const today = localParts(new Date(), ctx.timezone).date;
          const setting = await settingsFor(ctx, today);
          return { period: suggestedPayrollPeriod(setting.parsed, today) };
        } catch (error) {
          if (error instanceof AppError && error.code === "PAYROLL_SETTINGS_REQUIRED")
            return { period: null };
          throw error;
        }
      }),
    ),
  );
  app.post("/payroll/settings", async (c) => {
    const input = parse(payrollSettingsInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.payroll.settings.manage");
      await assertOpenPayrollPeriod(ctx, input.effectiveFrom, "2200-12-31");
      const exists = await ctx.tx
        .select()
        .from(hrPayrollSetting)
        .where(
          and(
            eq(hrPayrollSetting.workspaceId, ctx.workspaceId),
            eq(hrPayrollSetting.effectiveFrom, input.effectiveFrom),
          ),
        );
      if (exists.length)
        throw new AppError(
          409,
          "SETTINGS_EXISTS",
          "Use a new effective date to preserve payroll settings history.",
        );
      await ctx.tx.insert(hrPayrollSetting).values({
        workspaceId: ctx.workspaceId,
        effectiveFrom: input.effectiveFrom,
        data: input,
        actorId: ctx.actorId,
      });
      await auditHr(ctx, "payroll_settings.changed", input.effectiveFrom, { after: input });
    });
    return c.json({ ok: true });
  });
  app.get("/payroll/me", async (c) => {
    const { periodStart } = parse(
      z.object({ periodStart: calendarDateSchema.optional() }),
      c.req.query(),
    );
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const payslips = await releasedPayslips(ctx);
        let estimate = null,
          estimatePeriod = null,
          estimateUnavailableReason: string | null = null;
        const today = periodStart ?? localParts(new Date(), ctx.timezone).date,
          month = today.slice(0, 7),
          end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
            .toISOString()
            .slice(0, 10);
        try {
          const setting = await settingsFor(ctx, today);
          if (
            periodStart &&
            (setting.parsed.frequency === "monthly"
              ? periodStart.slice(8) !== "01"
              : !["01", "16"].includes(periodStart.slice(8)))
          )
            throw new AppError(
              400,
              "INVALID_ESTIMATE_PERIOD",
              "Choose day 1 for monthly payroll, or day 1/16 for semimonthly payroll.",
            );
          const first = setting.parsed.frequency === "semimonthly" && Number(today.slice(8)) <= 15;
          const startDate = `${month}-${first || setting.parsed.frequency === "monthly" ? "01" : "16"}`,
            endDate = first ? `${month}-15` : end;
          const pay = await employeePay(
            ctx,
            ctx.actorId,
            { startDate, endDate, cutoffDate: endDate },
            setting.parsed,
            undefined,
            false,
          );
          estimate = pay.result;
          estimatePeriod = `${startDate} – ${endDate}`;
        } catch (error) {
          if (
            !(
              error instanceof AppError &&
              [
                "PAYROLL_SETTINGS_REQUIRED",
                "COMPENSATION_REQUIRED",
                "STATUTORY_CONFIGURATION_REQUIRED",
                "STATUTORY_PERIOD_UNCOVERED",
              ].includes(error.code)
            )
          )
            throw error;
          estimateUnavailableReason = error.message;
        }
        return { payslips, estimate, estimatePeriod, estimateUnavailableReason };
      }),
    );
  });
  app.get("/payroll/me/:runId/export", async (c) => {
    const id = parse(idSchema, c.req.param("runId"));
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const slip = (await releasedPayslips(ctx)).find((s) => s.runId === id);
        if (!slip) missing();
        await auditHr(ctx, "payslip.downloaded", id);
        return {
          filename: `${ctx.workspaceId}-payslip-${slip.startDate}-${ctx.actorId}.csv`,
          content: csvRows(
            [
              "Employee",
              "Period start",
              "Period end",
              "Payment status",
              "Line",
              "Category",
              "Amount (PHP minor units)",
              "Source",
            ],
            slip.result.lines.map((l) => [
              ctx.actorId,
              slip.startDate,
              slip.endDate,
              slip.status,
              l.label,
              l.kind,
              l.amountMinor,
              l.source,
            ]),
          ),
        };
      }),
    );
  });
  app.get("/payroll/runs", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await readPayroll(ctx);
        return {
          runs: await ctx.tx
            .select()
            .from(hrPayrollRun)
            .where(eq(hrPayrollRun.workspaceId, ctx.workspaceId))
            .orderBy(desc(hrPayrollRun.startDate), desc(hrPayrollRun.id))
            .limit(100),
        };
      }),
    ),
  );
  app.post("/payroll/runs", async (c) => {
    const input = parse(payrollRunInputSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.payroll.runs.manage");
        const setting = await settingsFor(ctx, input.endDate);
        const endOfMonth = new Date(
          Date.UTC(Number(input.startDate.slice(0, 4)), Number(input.startDate.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10);
        const day = Number(input.startDate.slice(8));
        if (
          input.startDate.slice(0, 7) !== input.endDate.slice(0, 7) ||
          input.cutoffDate < input.startDate ||
          (setting.parsed.frequency === "monthly"
            ? day !== 1 || input.endDate !== endOfMonth
            : (day !== 1 && day !== 16) ||
              input.endDate !== (day === 1 ? `${input.startDate.slice(0, 7)}-15` : endOfMonth))
        )
          throw new AppError(
            400,
            "INVALID_PAY_PERIOD",
            "Use a full monthly period or the configured 1–15 / 16–month-end cutoff.",
          );
        const overlapping = await ctx.tx
          .select()
          .from(hrPayrollRun)
          .where(
            and(
              eq(hrPayrollRun.workspaceId, ctx.workspaceId),
              sql`${hrPayrollRun.status} <> 'voided'`,
              sql`${hrPayrollRun.startDate} <= ${input.endDate}`,
              sql`${hrPayrollRun.endDate} >= ${input.startDate}`,
            ),
          );
        if (overlapping.length)
          throw new AppError(
            409,
            "DUPLICATE_PAY_PERIOD",
            "An active payroll run already covers this period.",
          );
        if (!input.replacesRunId) {
          const [voided] = await ctx.tx
            .select({ id: hrPayrollRun.id })
            .from(hrPayrollRun)
            .where(
              and(
                eq(hrPayrollRun.workspaceId, ctx.workspaceId),
                eq(hrPayrollRun.status, "voided"),
                eq(hrPayrollRun.startDate, input.startDate),
                eq(hrPayrollRun.endDate, input.endDate),
              ),
            )
            .limit(1);
          if (voided)
            throw new AppError(
              409,
              "REPLACEMENT_REQUIRED",
              "Link the voided run and document the reason when reissuing this period.",
            );
        }
        if (input.replacesRunId) {
          const replaced = await payrollRunFor(ctx, input.replacesRunId);
          if (
            replaced.status !== "voided" ||
            replaced.startDate !== input.startDate ||
            replaced.endDate !== input.endDate ||
            input.reason.length < 10
          )
            throw new AppError(
              409,
              "INVALID_REPLACEMENT",
              "Replace a voided run for the same period and document the reason.",
            );
        }
        const [run] = await ctx.tx
          .insert(hrPayrollRun)
          .values({ workspaceId: ctx.workspaceId, ...input, createdBy: ctx.actorId })
          .returning();
        await auditHr(ctx, "payroll.created", run!.id, { ...input });
        return { ok: true, id: run!.id };
      }),
      201,
    );
  });
  app.get("/payroll/runs/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const { run, employees } = await runRows(ctx, id);
        await auditHr(ctx, "payroll.read", id);
        return {
          run,
          employees: employees.map((e) => ({
            userId: e.userId,
            result: e.result,
            snapshot: e.snapshot,
            verifiedBy: e.verifiedBy,
            verificationReference: e.verificationReference,
          })),
        };
      }),
    );
  });
  app.post("/payroll/runs/:id/calculate", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    await core.run(c.get("workspaceId"), c.get("user").id, (ctx) => calculateRun(ctx, id));
    return c.json({ ok: true });
  });
  app.post("/payroll/runs/:id/adjustments", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(payrollAdjustmentInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.payroll.runs.manage");
      if (input.userId === ctx.actorId) denied();
      await requireHrMember(ctx, input.userId);
      const run = await payrollRunFor(ctx, id);
      if (!["draft", "calculated"].includes(run.status))
        throw new AppError(409, "RUN_IMMUTABLE", "Only an editable draft can receive adjustments.");
      if (input.sourceRequestId) {
        const [request] = await ctx.tx
          .select()
          .from(hrRequest)
          .where(
            and(
              eq(hrRequest.workspaceId, ctx.workspaceId),
              eq(hrRequest.id, input.sourceRequestId),
              eq(hrRequest.requesterId, input.userId),
              eq(hrRequest.status, "approved"),
            ),
          );
        if (!request) missing();
        if (["purchase", "travel", "general"].includes(String(request.details.type)))
          throw new AppError(
            400,
            "INVALID_PAYROLL_SOURCE",
            "This request is not an employee payroll payment or deduction.",
          );
      }
      await ctx.tx
        .insert(hrPayrollAdjustment)
        .values({
          workspaceId: ctx.workspaceId,
          runId: id,
          userId: input.userId,
          data: input,
          actorId: ctx.actorId,
          idempotencyKey: input.idempotencyKey,
          sourceRequestId: input.sourceRequestId,
        })
        .onConflictDoNothing();
      await ctx.tx
        .update(hrPayrollRun)
        .set({ status: "draft", approvedBy: null })
        .where(and(eq(hrPayrollRun.workspaceId, ctx.workspaceId), eq(hrPayrollRun.id, id)));
      await auditHr(ctx, "payroll.adjustment_created", id, { after: input });
    });
    return c.json({ ok: true });
  });
  app.post("/payroll/runs/:id/employees/:userId/verify", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      userId = parse(idSchema, c.req.param("userId")),
      input = parse(
        payrollVerifySchema.extend({ revision: z.number().int().positive() }),
        await c.req.json(),
      );
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.payroll.runs.approve");
      if (userId === ctx.actorId) denied();
      const run = await payrollRunFor(ctx, id);
      if (
        !["calculated", "under_review"].includes(run.status) ||
        run.revision !== input.revision ||
        run.calculatedBy === ctx.actorId
      )
        throw new AppError(
          409,
          "INDEPENDENT_REVIEW_REQUIRED",
          "A different reviewer must verify the current calculation revision.",
        );
      const [row] = await ctx.tx
        .select()
        .from(hrPayrollEmployee)
        .where(
          and(
            eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
            eq(hrPayrollEmployee.runId, id),
            eq(hrPayrollEmployee.userId, userId),
          ),
        );
      if (!row) missing();
      const result = payrollResultSchema.parse(row.result);
      if (result.netMinor !== input.expectedNetMinor || result.netMinor < 0)
        throw new AppError(
          409,
          "REVIEW_MISMATCH",
          "The reviewed net amount does not match this calculation.",
        );
      await ctx.tx
        .update(hrPayrollEmployee)
        .set({
          verifiedBy: ctx.actorId,
          verificationReference: input.reference,
          verifiedAt: new Date(),
        })
        .where(
          and(
            eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
            eq(hrPayrollEmployee.runId, id),
            eq(hrPayrollEmployee.userId, userId),
          ),
        );
      await ctx.tx
        .update(hrPayrollRun)
        .set({ status: "under_review" })
        .where(and(eq(hrPayrollRun.workspaceId, ctx.workspaceId), eq(hrPayrollRun.id, id)));
      await auditHr(ctx, "payroll.employee_verified", id, {
        userId,
        revision: run.revision,
        reference: input.reference,
      });
    });
    return c.json({ ok: true });
  });
  app.post("/payroll/runs/:id/action", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(
        z.strictObject({
          action: z.enum([
            "approve",
            "finalize",
            "publish",
            "mark_paid",
            "void",
            "return_to_draft",
          ]),
          revision: z.number().int().min(0),
          confirmation: z.string().max(100).default(""),
          reason: z.string().max(1000).default(""),
        }),
        await c.req.json(),
      );
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require(
        input.action === "approve"
          ? "hr.payroll.runs.approve"
          : input.action === "mark_paid"
            ? "hr.payroll.mark_paid"
            : "hr.payroll.runs.manage",
      );
      const run = await payrollRunFor(ctx, id);
      if (input.revision !== run.revision)
        throw new AppError(
          409,
          "STALE_PAYROLL",
          "Reload the current payroll revision before continuing.",
        );
      const where = and(eq(hrPayrollRun.workspaceId, ctx.workspaceId), eq(hrPayrollRun.id, id));
      if (input.action === "return_to_draft") {
        if (closedPayroll(run.status))
          throw new AppError(409, "RUN_IMMUTABLE", "Closed payroll cannot be edited.");
        await ctx.tx.update(hrPayrollRun).set({ status: "draft", approvedBy: null }).where(where);
        await ctx.tx
          .update(hrPayrollEmployee)
          .set({ verifiedBy: null, verificationReference: null, verifiedAt: null })
          .where(
            and(
              eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
              eq(hrPayrollEmployee.runId, id),
            ),
          );
      } else if (input.action === "approve") {
        if (
          !["calculated", "under_review"].includes(run.status) ||
          run.calculatedBy === ctx.actorId
        )
          throw new AppError(
            409,
            "INDEPENDENT_REVIEW_REQUIRED",
            "A different payroll reviewer must approve the calculated run.",
          );
        const employees = await ctx.tx
          .select()
          .from(hrPayrollEmployee)
          .where(
            and(
              eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
              eq(hrPayrollEmployee.runId, id),
            ),
          );
        if (
          run.warnings.length ||
          !employees.length ||
          employees.some(
            (e) =>
              !e.verifiedBy ||
              !e.verificationReference ||
              payrollResultSchema.parse(e.result).netMinor < 0,
          )
        )
          throw new AppError(
            409,
            "PAYROLL_NOT_VERIFIED",
            "Resolve all blocking warnings and record independent statutory and line-item verification for every employee.",
          );
        await ctx.tx
          .update(hrPayrollRun)
          .set({ status: "approved", approvedBy: ctx.actorId })
          .where(where);
      } else if (input.action === "finalize") {
        if (run.status !== "approved" || !run.approvedBy || run.approvedBy === run.calculatedBy)
          throw new AppError(
            409,
            "PAYROLL_NOT_APPROVED",
            "Payroll must be independently reviewed and approved before finalization.",
          );
        if (
          run.endDate >
            localParts(
              new Date(),
              typeof run.settingsSnapshot?.timezone === "string"
                ? run.settingsSnapshot.timezone
                : ctx.timezone,
            ).date ||
          run.warnings.length
        )
          throw new AppError(
            409,
            "PAYROLL_NOT_READY",
            "The payroll period must be closed and covered by a reviewed statutory version.",
          );
        const sources = await ctx.tx
          .select({ snapshot: hrPayrollEmployee.snapshot })
          .from(hrPayrollEmployee)
          .where(
            and(
              eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
              eq(hrPayrollEmployee.runId, id),
            ),
          );
        for (const source of sources) {
          if (typeof source.snapshot.priorRunId === "string") {
            const prior = await payrollRunFor(ctx, source.snapshot.priorRunId);
            if (!["finalized", "paid"].includes(prior.status))
              throw new AppError(
                409,
                "PAYROLL_RECONCILIATION_CHANGED",
                "The first cutoff has changed. Return this run to draft and recalculate monthly remuneration.",
              );
          }
        }
        const applicable = await statutoryFor(ctx, run.startDate, run.endDate);
        if (
          run.ruleVersion !== applicable.version ||
          run.settingsSnapshot?.statutoryConfigurationId !== applicable.id
        )
          throw new AppError(
            409,
            "STATUTORY_CONFIGURATION_CHANGED",
            "Recalculate and independently review payroll using the applicable statutory configuration.",
          );
        const settings = payrollSettingsInputSchema.parse(run.settingsSnapshot?.data);
        await ctx.tx
          .update(hrPayrollRun)
          .set({
            status: "finalized",
            finalizedAt: new Date(),
            publishedAt: settings.publishOnFinalize ? new Date() : null,
          })
          .where(where);
        if (settings.publishOnFinalize)
          for (const e of await ctx.tx
            .select()
            .from(hrPayrollEmployee)
            .where(
              and(
                eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
                eq(hrPayrollEmployee.runId, id),
              ),
            ))
            await notifyHr(ctx, e.userId, "Your payslip is available", "payroll", id);
      } else if (input.action === "publish") {
        if (!["finalized", "paid"].includes(run.status))
          throw new AppError(
            409,
            "PAYROLL_NOT_FINALIZED",
            "Only finalized payroll can be published.",
          );
        if (!run.publishedAt) {
          await ctx.tx.update(hrPayrollRun).set({ publishedAt: new Date() }).where(where);
          for (const e of await ctx.tx
            .select()
            .from(hrPayrollEmployee)
            .where(
              and(
                eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
                eq(hrPayrollEmployee.runId, id),
              ),
            ))
            await notifyHr(ctx, e.userId, "Your payslip is available", "payroll", id);
        }
      } else if (input.action === "mark_paid") {
        if (run.status !== "finalized" || input.confirmation !== "record_payment")
          throw new AppError(
            409,
            "PAYMENT_CONFIRMATION_REQUIRED",
            "Confirm recording payment for finalized payroll. Lumo does not transfer funds.",
          );
        await ctx.tx.update(hrPayrollRun).set({ status: "paid", paidAt: new Date() }).where(where);
      } else {
        if (run.status === "paid" || run.status === "voided" || input.reason.trim().length < 10)
          throw new AppError(
            409,
            "VOID_NOT_ALLOWED",
            "Paid payroll requires a subsequent-period correction; otherwise document a void reason.",
          );
        const [dependent] = await ctx.tx
          .select({ id: hrPayrollRun.id })
          .from(hrPayrollEmployee)
          .innerJoin(
            hrPayrollRun,
            and(
              eq(hrPayrollRun.workspaceId, hrPayrollEmployee.workspaceId),
              eq(hrPayrollRun.id, hrPayrollEmployee.runId),
            ),
          )
          .where(
            and(
              eq(hrPayrollEmployee.workspaceId, ctx.workspaceId),
              sql`${hrPayrollEmployee.snapshot}->>'priorRunId' = ${id}`,
              sql`${hrPayrollRun.status} in ('finalized','paid')`,
            ),
          )
          .limit(1);
        if (dependent)
          throw new AppError(
            409,
            "PAYROLL_RECONCILIATION_CLOSED",
            "A finalized month-end payroll uses this cutoff. Record a subsequent-period correction instead.",
          );
        await ctx.tx
          .update(hrPayrollRun)
          .set({ status: "voided", reason: input.reason })
          .where(where);
      }
      await auditHr(ctx, `payroll.${input.action}`, id, {
        revision: run.revision,
        reason: input.reason,
      });
    });
    return c.json({ ok: true });
  });
  app.get("/payroll/runs/:id/export", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const { run, employees } = await runRows(ctx, id);
        await auditHr(ctx, "payroll.exported", id);
        return {
          filename: `${ctx.workspaceId}-payroll-${run.startDate}-${run.endDate}-r${run.revision}.csv`,
          content: csvRows(
            [
              "Employee",
              "Start",
              "End",
              "Status",
              "Gross (centavos)",
              "Deductions (centavos)",
              "Net (centavos)",
              "Employer contributions (centavos)",
              "Rule version",
            ],
            employees.map((e) => {
              const result = payrollResultSchema.parse(e.result);
              return [
                e.userId,
                run.startDate,
                run.endDate,
                run.status,
                result.grossMinor,
                result.deductionsMinor,
                result.netMinor,
                result.employerMinor,
                run.ruleVersion,
              ];
            }),
          ),
        };
      }),
    );
  });
  return app;
}
