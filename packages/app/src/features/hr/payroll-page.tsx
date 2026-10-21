import {
  canHr,
  compensationsSchema,
  csvResultSchema,
  ownPaySchema,
  payRunsSchema,
  payrollDetailSchema,
  type PayrollResult,
} from "@lumo/contracts/hr";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lumo/ui";
import { ConfirmAction } from "@lumo/ui/confirm-action";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api";
import { hrAccessQuery, hrPath, hrQuery, allPeopleQuery, useHrAction } from "./hr-api";
import { useHrTab } from "./hr-search";
import { HrDialog, HrForm, HrTabs, formString, saveCsv } from "./hr-ui";
import { PayrollSettingsPanel } from "./payroll-settings";
const money = (amount: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP" }).format(amount / 100);
function PayBreakdown({ result }: { result: PayrollResult }) {
  return (
    <>
      <dl className="grid gap-1 text-sm">
        {result.lines.map((line, index) => (
          <div className="flex items-start justify-between gap-4" key={`${line.label}:${index}`}>
            <dt>
              {line.label} {line.kind === "employer" ? "(employer only)" : ""}
              <small>{line.source}</small>
            </dt>
            <dd className="whitespace-nowrap">
              {line.kind === "deduction" ? "−" : ""}
              {money(line.amountMinor)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t pt-3 font-semibold text-foreground">
        Net pay: {money(result.netMinor)}
      </p>
      {result.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs">
          {w}
        </p>
      ))}
    </>
  );
}
export function PayrollPage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useHrTab("My Pay", "/w/$workspaceId/payroll"),
    [newRun, setNewRun] = useState(false),
    [salary, setSalary] = useState(false),
    [runId, setRunId] = useState<string | null>(null),
    [adjust, setAdjust] = useState(false),
    [voidOpen, setVoidOpen] = useState(false);
  const access = useQuery(hrAccessQuery(workspaceId)),
    people = useQuery(allPeopleQuery(workspaceId)),
    action = useHrAction(workspaceId);
  const own = useQuery({
      ...hrQuery(workspaceId, "/payroll/me", ownPaySchema),
      enabled: tab === "My Pay",
    }),
    runs = useQuery({
      ...hrQuery(workspaceId, "/payroll/runs", payRunsSchema),
      enabled: tab === "Pay Runs",
    }),
    compensation = useQuery({
      ...hrQuery(workspaceId, "/payroll/compensation", compensationsSchema),
      enabled: tab === "Employees",
    });
  const detail = useQuery({
    ...hrQuery(workspaceId, `/payroll/runs/${runId}`, payrollDetailSchema),
    enabled: !!runId,
  });
  const download = useMutation({
    mutationFn: async (path: string) => {
      const result = await api(`${hrPath(workspaceId)}${path}`, csvResultSchema);
      saveCsv(result.filename, result.content);
    },
  });
  if (!access.data)
    return (
      <>
        <ErrorMessage error={access.error} />
        {access.isPending && <Loading />}
      </>
    );
  const permissions = access.data,
    read = canHr(permissions, "hr.payroll.read_all"),
    manage = canHr(permissions, "hr.payroll.runs.manage"),
    approve = canHr(permissions, "hr.payroll.runs.approve"),
    compManage = canHr(permissions, "hr.payroll.compensation.manage");
  const run = detail.data?.run;
  const runAction = (value: string, extra: Record<string, unknown> = {}) => {
    if (run)
      action.mutate({
        path: `/payroll/runs/${run.id}/action`,
        body: { action: value, revision: run.revision, ...extra },
      });
  };
  return (
    <>
      <PageHeading eyebrow="People & HR" title="Payroll">
        Payslips, restricted pay runs and effective compensation. Recording payment does not
        transfer funds.
      </PageHeading>
      <HrTabs
        tabs={[
          "My Pay",
          ...(read || manage ? ["Pay Runs"] : []),
          ...(read ? ["Employees"] : []),
          ...(canHr(permissions, "hr.payroll.settings.manage") ||
          canHr(permissions, "hr.permissions.manage")
            ? ["Settings"]
            : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorMessage error={action.error ?? download.error} />
      {tab === "My Pay" && (
        <>
          <ErrorMessage error={own.error} />
          <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
            <Card>
              <h2 className="mb-4">My payslips</h2>
              {own.isPending ? (
                <Loading />
              ) : own.data?.payslips.length ? (
                own.data.payslips.map((slip) => (
                  <article key={slip.runId} className="mb-4 border-t py-4">
                    <h3>
                      {slip.startDate} – {slip.endDate}
                    </h3>
                    <Badge>{slip.status}</Badge>
                    <p>
                      Gross {money(slip.result.grossMinor)} · Deductions{" "}
                      {money(slip.result.deductionsMinor)} · Net {money(slip.result.netMinor)}
                    </p>
                    <details className="my-3">
                      <summary>View payslip breakdown</summary>
                      <PayBreakdown result={slip.result} />
                    </details>
                    <Button
                      size="sm"
                      disabled={download.isPending}
                      onClick={() => download.mutate(`/payroll/me/${slip.runId}/export`)}
                    >
                      Download payslip CSV
                    </Button>
                  </article>
                ))
              ) : (
                <EmptyState title="No published payslips yet">
                  Payslips appear after the payroll team finalizes and publishes your pay run.
                </EmptyState>
              )}
            </Card>
            <Card>
              <h2>Take-home pay estimate</h2>
              <Badge>Estimate — requires payroll review</Badge>
              <p className="my-3">{own.data?.estimatePeriod}</p>
              {own.data?.estimate ? (
                <PayBreakdown result={own.data.estimate} />
              ) : (
                <p>
                  Your estimate becomes available once effective compensation and payroll settings
                  are configured.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
      {tab === "Pay Runs" && (
        <>
          <div className="mb-4">
            {manage && (
              <Button variant="primary" onClick={() => setNewRun(true)}>
                New pay run
              </Button>
            )}
          </div>
          <ErrorMessage error={runs.error} />
          {runs.data?.runs.length ? (
            <div className="grid gap-3">
              {runs.data.runs.map((r) => (
                <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <h2>
                      {r.startDate} – {r.endDate}
                    </h2>
                    <p>
                      Payout {r.payoutDate} · revision {r.revision}
                    </p>
                    <Badge>{r.status}</Badge>
                  </div>
                  <Button onClick={() => setRunId(r.id)}>Review run</Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No pay runs yet">
              Set up employee compensation and an effective pay schedule before creating a period.
            </EmptyState>
          )}
        </>
      )}
      {tab === "Employees" && (
        <>
          <div className="mb-4">
            {compManage && (
              <Button onClick={() => setSalary(true)}>Add effective compensation</Button>
            )}
          </div>
          <ErrorMessage error={compensation.error} />
          <Table>
            <TableHeader>
              <TableRow>
                {["Employee", "Effective from", "Monthly basic", "Change reason", "Editor"].map(
                  (h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {compensation.data?.compensations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {people.data?.people.find((p) => p.userId === row.userId)?.name ?? row.userId}
                  </TableCell>
                  <TableCell>{row.effectiveFrom}</TableCell>
                  <TableCell>{money(row.salaryMinor)}</TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell>
                    {people.data?.people.find((p) => p.userId === row.actorId)?.name ?? row.actorId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
      {tab === "Settings" && (
        <PayrollSettingsPanel workspaceId={workspaceId} access={permissions} />
      )}
      <HrDialog title="Create payroll period" open={newRun} onClose={() => setNewRun(false)}>
        <HrForm
          busy={action.isPending}
          error={action.error}
          label="Create draft run"
          onSubmit={(data) =>
            action.mutate(
              {
                path: "/payroll/runs",
                body: {
                  startDate: formString(data, "startDate"),
                  endDate: formString(data, "endDate"),
                  cutoffDate: formString(data, "cutoffDate"),
                  payoutDate: formString(data, "payoutDate"),
                  replacesRunId: formString(data, "replacesRunId") || null,
                  reason: formString(data, "reason"),
                },
              },
              { onSuccess: () => setNewRun(false) },
            )
          }
        >
          <p>
            Use a full calendar month, or the configured 1–15 / 16–month-end semimonthly period.
          </p>
          <Field type="date" name="startDate" label="Period start" required />
          <Field type="date" name="endDate" label="Period end" required />
          <Field type="date" name="cutoffDate" label="Attendance cutoff" required />
          <Field type="date" name="payoutDate" label="Payout date" required />
          <Field name="replacesRunId" label="Voided run ID to replace (optional)" />
          <Field name="reason" label="Replacement reason (when applicable)" />
        </HrForm>
      </HrDialog>
      <HrDialog title="Effective compensation" open={salary} onClose={() => setSalary(false)}>
        <HrForm
          busy={action.isPending}
          error={action.error}
          onSubmit={(data) =>
            action.mutate(
              {
                path: "/payroll/compensation",
                body: {
                  userId: formString(data, "userId"),
                  effectiveFrom: formString(data, "effectiveFrom"),
                  salaryMinor: Number(formString(data, "salaryMinor")),
                  reason: formString(data, "reason"),
                  allowances: formString(data, "allowanceLabel")
                    ? [
                        {
                          label: formString(data, "allowanceLabel"),
                          amountMinor: Number(formString(data, "allowanceMinor")),
                          taxable: formString(data, "taxable") === "true",
                        },
                      ]
                    : [],
                },
              },
              { onSuccess: () => setSalary(false) },
            )
          }
        >
          <SelectField
            label="Employee"
            name="userId"
            options={(people.data?.people ?? [])
              .filter((p) => p.userId !== permissions.userId)
              .map((p) => ({ value: p.userId, label: p.name }))}
          />
          <Field label="Effective date" name="effectiveFrom" type="date" required />
          <Field
            label="Monthly salary (PHP centavos)"
            name="salaryMinor"
            type="number"
            min="1"
            max="1000000000"
            required
          />
          <Field label="Reason" name="reason" required minLength={3} />
          <Field label="Allowance label (optional)" name="allowanceLabel" />
          <Field
            label="Monthly allowance (PHP centavos)"
            name="allowanceMinor"
            type="number"
            min="0"
          />
          <SelectField
            label="Allowance tax classification"
            name="taxable"
            options={[
              { value: "true", label: "Taxable" },
              { value: "false", label: "Non-taxable; requires documented eligibility" },
            ]}
          />
        </HrForm>
      </HrDialog>
      <HrDialog title="Pay run review" open={!!runId} onClose={() => setRunId(null)}>
        <ErrorMessage error={detail.error ?? action.error} />
        {run && (
          <>
            <p>
              {run.startDate} – {run.endDate} · revision {run.revision}
            </p>
            <Badge>{run.status}</Badge>
            {run.warnings.map((w) => (
              <p className="text-destructive" key={w}>
                {w}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {manage && ["draft", "calculated", "under_review"].includes(run.status) && (
                <Button
                  disabled={action.isPending}
                  onClick={() => action.mutate({ path: `/payroll/runs/${run.id}/calculate` })}
                >
                  Calculate draft
                </Button>
              )}
              {manage && ["draft", "calculated"].includes(run.status) && (
                <Button onClick={() => setAdjust(true)}>Add adjustment</Button>
              )}
              {approve && ["calculated", "under_review"].includes(run.status) && (
                <Button disabled={action.isPending} onClick={() => runAction("approve")}>
                  Approve verified run
                </Button>
              )}
              {manage && run.status === "approved" && (
                <ConfirmAction
                  label="Finalize payroll"
                  message="Finalize this independently reviewed run? Its calculations become immutable."
                  disabled={action.isPending}
                  onConfirm={() => runAction("finalize")}
                />
              )}
              {manage && ["finalized", "paid"].includes(run.status) && !run.publishedAt && (
                <ConfirmAction
                  label="Publish payslips"
                  message="Release payslips to the respective employees?"
                  disabled={action.isPending}
                  onConfirm={() => runAction("publish")}
                />
              )}
              {canHr(permissions, "hr.payroll.mark_paid") && run.status === "finalized" && (
                <ConfirmAction
                  label="Record paid"
                  message="Record that payment was made outside Lumo? This does not transmit funds."
                  disabled={action.isPending}
                  onConfirm={() => runAction("mark_paid", { confirmation: "record_payment" })}
                />
              )}
              {manage && !["finalized", "paid", "voided"].includes(run.status) && (
                <Button disabled={action.isPending} onClick={() => runAction("return_to_draft")}>
                  Return to draft
                </Button>
              )}
              {manage && !["paid", "voided"].includes(run.status) && (
                <Button onClick={() => setVoidOpen(true)}>Void run</Button>
              )}
              <Button
                disabled={download.isPending}
                onClick={() => download.mutate(`/payroll/runs/${run.id}/export`)}
              >
                Export run CSV
              </Button>
            </div>
            <p className="text-xs">
              Your own unpublished payroll figures are withheld from operator views.
            </p>
            {detail.data?.employees.map((employee) => (
              <Card key={employee.userId} className="p-4">
                <h3>
                  {people.data?.people.find((p) => p.userId === employee.userId)?.name ??
                    employee.userId}
                </h3>
                <PayBreakdown result={employee.result} />
                {employee.verifiedBy ? (
                  <p className="mt-3">Verified · {employee.verificationReference}</p>
                ) : (
                  approve &&
                  ["calculated", "under_review"].includes(run.status) && (
                    <HrForm
                      label="Record independent verification"
                      busy={action.isPending}
                      error={action.error}
                      onSubmit={(data) =>
                        action.mutate({
                          path: `/payroll/runs/${run.id}/employees/${employee.userId}/verify`,
                          body: {
                            revision: run.revision,
                            expectedNetMinor: Number(formString(data, "expectedNetMinor")),
                            reference: formString(data, "reference"),
                            confirmed: formString(data, "confirmed") === "on",
                          },
                        })
                      }
                    >
                      <Field
                        label="Independently checked net amount (centavos)"
                        name="expectedNetMinor"
                        type="number"
                        min="0"
                        required
                      />
                      <Field
                        label="Reviewer evidence and statutory/source references"
                        name="reference"
                        minLength={20}
                        required
                      />
                      <label className="flex items-start gap-2 text-xs">
                        <input type="checkbox" name="confirmed" required />I independently checked
                        statutory contributions, withholding, earnings, deductions and all warnings
                        for this employee.
                      </label>
                    </HrForm>
                  )
                )}
                <details className="mt-3">
                  <summary>Calculation sources</summary>
                  <pre className="max-h-64 overflow-auto text-xs">
                    {JSON.stringify(employee.snapshot, null, 2)}
                  </pre>
                </details>
              </Card>
            ))}
          </>
        )}
      </HrDialog>
      <HrDialog
        title="Classified payroll adjustment"
        open={adjust}
        onClose={() => setAdjust(false)}
      >
        <HrForm
          busy={action.isPending}
          error={action.error}
          onSubmit={(data) =>
            action.mutate(
              {
                path: `/payroll/runs/${runId}/adjustments`,
                body: {
                  userId: formString(data, "userId"),
                  label: formString(data, "label"),
                  amountMinor: Number(formString(data, "amountMinor")),
                  classification: formString(data, "classification"),
                  reason: formString(data, "reason"),
                  sourceRequestId: formString(data, "sourceRequestId") || null,
                  idempotencyKey: crypto.randomUUID(),
                },
              },
              { onSuccess: () => setAdjust(false) },
            )
          }
        >
          <SelectField
            name="userId"
            label="Employee"
            options={(detail.data?.employees ?? [])
              .filter((e) => e.userId !== permissions.userId)
              .map((e) => ({
                value: e.userId,
                label: people.data?.people.find((p) => p.userId === e.userId)?.name ?? e.userId,
              }))}
          />
          <Field label="Line label" name="label" required />
          <Field
            label="Signed adjustment (PHP centavos)"
            name="amountMinor"
            type="number"
            required
          />
          <SelectField
            label="Classification"
            name="classification"
            options={[
              "earning_taxable",
              "earning_nontaxable",
              "deduction",
              "sss",
              "philhealth",
              "pagibig",
              "withholding",
              "employer",
            ].map((value) => ({ value, label: value }))}
          />
          <Field label="Reason / correction reference" name="reason" minLength={10} required />
          <Field label="Approved expense / advance request ID (optional)" name="sourceRequestId" />
        </HrForm>
      </HrDialog>
      <HrDialog title="Void payroll run" open={voidOpen} onClose={() => setVoidOpen(false)}>
        <HrForm
          busy={action.isPending}
          error={action.error}
          label="Record void"
          onSubmit={(data) => {
            runAction("void", { reason: formString(data, "reason") });
            setVoidOpen(false);
          }}
        >
          <Field label="Void reason" name="reason" required minLength={10} />
          <p>
            Paid runs use a documented correction in a subsequent period. A voided run remains in
            history.
          </p>
        </HrForm>
      </HrDialog>
    </>
  );
}
