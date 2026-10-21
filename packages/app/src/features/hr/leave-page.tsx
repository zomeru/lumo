import {
  approvalsSchema,
  canHr,
  leaveBalancesSchema,
  leavePoliciesSchema,
  whoOutSchema,
  type LeavePolicy,
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
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { hrAccessQuery, hrQuery, allPeopleQuery, useHrAction } from "./hr-api";
import { useHrTab, useHrMonth } from "./hr-search";
import { HrDialog, HrForm, HrTabs, formString } from "./hr-ui";
import { RequestDialog } from "./request-dialog";
export function LeavePage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useHrTab("My leave", "/w/$workspaceId/leave"),
    [open, setOpen] = useState(false),
    [policyOpen, setPolicyOpen] = useState(false),
    [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null),
    [ledger, setLedger] = useState<string | null>(null),
    [adjust, setAdjust] = useState(false),
    [selectedYear, setYear] = useState<number>();
  const access = useQuery(hrAccessQuery(workspaceId)),
    people = useQuery(allPeopleQuery(workspaceId)),
    policies = useQuery(hrQuery(workspaceId, "/leave/policies", leavePoliciesSchema));
  const { month, setMonth } = useHrMonth("/w/$workspaceId/leave", access.data?.timezone ?? "UTC");
  const year = selectedYear ?? Number(month.slice(0, 4));
  const action = useHrAction(workspaceId);
  const balances = useQuery(
      hrQuery(
        workspaceId,
        `/leave/balances?year=${year}&team=${tab === "Team balances"}`,
        leaveBalancesSchema,
      ),
    ),
    requests = useQuery(hrQuery(workspaceId, "/requests?view=mine&type=leave", approvalsSchema));
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  const out = useQuery({
    ...hrQuery(workspaceId, `/leave/out?startDate=${month}-01&endDate=${end}`, whoOutSchema),
    enabled: tab === "Who is out",
  });
  if (!access.data)
    return (
      <>
        <ErrorMessage error={access.error} />
        {access.isPending && <Loading />}
      </>
    );
  const canPolicy = canHr(access.data, "hr.leave.manage_policy"),
    canAdjust = canHr(access.data, "hr.leave.adjust_balances");
  return (
    <>
      <PageHeading
        eyebrow="People & HR"
        title="Leave"
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Request leave
          </Button>
        }
      >
        Balances, requests and who is away. Days follow assigned work schedules and holidays.
      </PageHeading>
      <HrTabs
        tabs={[
          "My leave",
          "Who is out",
          ...(access.data.hasReports || canHr(access.data, "hr.leave.read_team")
            ? ["Team balances"]
            : []),
          ...(canPolicy ? ["Policies"] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorMessage error={balances.error ?? policies.error ?? action.error} />
      {(tab === "My leave" || tab === "Team balances") && (
        <Field
          label="Balance year"
          type="number"
          min="1900"
          max="2200"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="mb-4 max-w-36"
        />
      )}
      {tab === "My leave" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {balances.data?.balances.map((b) => (
              <Card key={b.leaveTypeId}>
                <h2>
                  {b.name} {!b.paid && <Badge>Unpaid</Badge>}
                </h2>
                <p className="my-3 text-2xl font-semibold text-foreground">
                  {policies.data?.policies.find((p) => p.id === b.leaveTypeId)?.enforceBalance ===
                  false
                    ? "No fixed limit"
                    : `${b.balanceHalfDays / 2} days left`}
                </p>
                <p>
                  {b.usedHalfDays / 2} used · {b.pendingHalfDays / 2} pending
                </p>
                <Button variant="ghost" size="sm" onClick={() => setLedger(b.leaveTypeId)}>
                  View balance history
                </Button>
              </Card>
            ))}
          </div>
          {!policies.data?.policies.length && (
            <EmptyState title="No leave policies configured">
              Ask HR to configure leave policies and assign a work schedule.
            </EmptyState>
          )}
          <h2 className="mt-6 mb-3">My leave requests</h2>
          {requests.data?.requests.length ? (
            requests.data.requests.map((r) => (
              <Card
                key={r.id}
                className="mb-3 flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <strong>{r.subject}</strong>
                  <p>
                    {r.details.type === "leave"
                      ? `${r.details.startDate} – ${r.details.endDate}`
                      : ""}
                  </p>
                  <Badge>{r.status}</Badge>
                </div>
                {["draft", "pending", "approved"].includes(r.status) && (
                  <Button
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/requests/${r.id}/action`,
                        body: { action: "cancel" },
                      })
                    }
                  >
                    Cancel leave
                  </Button>
                )}
              </Card>
            ))
          ) : (
            <EmptyState title="No leave requests yet" />
          )}
          <Button asChild variant="ghost">
            <Link to="/w/$workspaceId/approvals" params={{ workspaceId }}>
              Review request details and history
            </Link>
          </Button>
        </>
      )}
      {tab === "Who is out" && (
        <>
          <Field
            type="month"
            label="Month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
            className="mb-4 max-w-48"
          />
          <ErrorMessage error={out.error} />
          {out.data?.absences.length ? (
            <div className="grid gap-3">
              {out.data.absences.map((a) => (
                <Card key={a.id}>
                  <strong>
                    {people.data?.people.find((p) => p.userId === a.userId)?.name ??
                      "Workspace member"}
                  </strong>
                  <p>
                    Away · {a.startDate} – {a.endDate}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No one is on leave this month" />
          )}
        </>
      )}
      {tab === "Team balances" && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {["Person", "Leave", "Available days", "Used", "Pending"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.data?.balances.map((b) => (
                <TableRow key={`${b.userId}:${b.leaveTypeId}`}>
                  <TableCell>
                    {people.data?.people.find((p) => p.userId === b.userId)?.name ?? "Member"}
                  </TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.balanceHalfDays / 2}</TableCell>
                  <TableCell>{b.usedHalfDays / 2}</TableCell>
                  <TableCell>{b.pendingHalfDays / 2}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {canAdjust && (
            <Button className="mt-4" onClick={() => setAdjust(true)}>
              Adjust balance
            </Button>
          )}
        </>
      )}
      {tab === "Policies" && (
        <>
          <Button
            className="mb-4"
            onClick={() => {
              setEditingPolicy(null);
              setPolicyOpen(true);
            }}
          >
            Add leave policy
          </Button>
          <div className="grid gap-3 sm:grid-cols-2">
            {policies.data?.policies.map((p) => (
              <Card key={p.id}>
                <h2>{p.name}</h2>
                <p>
                  {p.paid ? "Paid" : "Unpaid"} · {p.allocationHalfDays / 2} opening days ·{" "}
                  {p.accrualHalfDaysMonthly / 2} days/month
                </p>
                <p>
                  Effective {p.effectiveFrom} · version {p.version}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPolicy(p);
                    setPolicyOpen(true);
                  }}
                >
                  Edit policy
                </Button>
                <Button
                  size="sm"
                  disabled={action.isPending}
                  onClick={() => {
                    const { id: _id, version: _version, ...input } = p;
                    action.mutate({
                      path: `/leave/policies/${p.id}`,
                      method: "PUT",
                      body: { ...input, archived: !p.archived },
                    });
                  }}
                >
                  {p.archived ? "Activate" : "Archive"}
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-4">Configure schedules and holidays in Attendance.</p>
        </>
      )}
      {open && (
        <RequestDialog
          workspaceId={workspaceId}
          initialType="leave"
          leaveTypes={policies.data?.policies.filter((p) => !p.archived) ?? []}
          open
          onClose={() => setOpen(false)}
        />
      )}
      <HrDialog title="Balance history" open={!!ledger} onClose={() => setLedger(null)}>
        {balances.data?.balances
          .find((b) => b.leaveTypeId === ledger)
          ?.ledger.map((l) => (
            <p key={l.id} className="border-b py-2">
              {l.amountHalfDays / 2} days · {l.reason}
              <small>{new Date(l.createdAt).toLocaleString()}</small>
            </p>
          ))}
      </HrDialog>
      <HrDialog title="Leave policy" open={policyOpen} onClose={() => setPolicyOpen(false)}>
        <HrForm
          busy={action.isPending}
          error={action.error}
          onSubmit={(data) =>
            action.mutate(
              {
                path: editingPolicy ? `/leave/policies/${editingPolicy.id}` : "/leave/policies",
                method: editingPolicy ? "PUT" : "POST",
                body: {
                  name: formString(data, "name"),
                  paid: formString(data, "paid") === "true",
                  allocationHalfDays: Number(formString(data, "allocationHalfDays")),
                  accrualHalfDaysMonthly: Number(formString(data, "accrualHalfDaysMonthly")),
                  carryoverHalfDays: Number(formString(data, "carryoverHalfDays")),
                  eligibleAfterDays: Number(formString(data, "eligibleAfterDays")),
                  allowHalfDay: formString(data, "allowHalfDay") === "true",
                  carryoverExpiryMonth: formString(data, "carryoverExpiryMonth")
                    ? Number(formString(data, "carryoverExpiryMonth"))
                    : null,
                  requireDocumentation: formString(data, "requireDocumentation") === "true",
                  enforceBalance: formString(data, "enforceBalance") === "true",
                  effectiveFrom: formString(data, "effectiveFrom"),
                },
              },
              { onSuccess: () => setPolicyOpen(false) },
            )
          }
        >
          <Field name="name" label="Leave category" defaultValue={editingPolicy?.name} required />
          <SelectField
            name="paid"
            defaultValue={String(editingPolicy?.paid ?? true)}
            label="Pay treatment"
            options={[
              { value: "true", label: "Paid leave" },
              { value: "false", label: "Unpaid leave" },
            ]}
          />
          <Field
            name="allocationHalfDays"
            label="Annual allocation (half-day units)"
            type="number"
            min="0"
            max="732"
            defaultValue={editingPolicy?.allocationHalfDays ?? 0}
            required
          />
          <Field
            name="accrualHalfDaysMonthly"
            label="Monthly accrual (half-day units)"
            type="number"
            defaultValue={editingPolicy?.accrualHalfDaysMonthly ?? 0}
            min="0"
            max="62"
          />
          <Field
            name="carryoverHalfDays"
            label="Maximum carryover (half-day units)"
            type="number"
            defaultValue={editingPolicy?.carryoverHalfDays ?? 0}
            min="0"
            max="732"
          />
          <Field
            name="eligibleAfterDays"
            label="Eligibility after hire (calendar days)"
            type="number"
            defaultValue={editingPolicy?.eligibleAfterDays ?? 0}
            min="0"
          />
          <Field
            name="effectiveFrom"
            label="Effective from"
            type="date"
            defaultValue={editingPolicy?.effectiveFrom}
            required
          />
          <Field
            label="Carryover expiry month (optional, 1–12)"
            name="carryoverExpiryMonth"
            type="number"
            min="1"
            max="12"
            defaultValue={editingPolicy?.carryoverExpiryMonth ?? ""}
          />
          <SelectField
            label="Partial-day requests"
            name="allowHalfDay"
            defaultValue={String(editingPolicy?.allowHalfDay ?? true)}
            options={[
              { value: "true", label: "Allow half days" },
              { value: "false", label: "Full days only" },
            ]}
          />
          <SelectField
            defaultValue={String(editingPolicy?.requireDocumentation ?? false)}
            name="requireDocumentation"
            label="Documentation"
            options={[
              { value: "false", label: "Optional" },
              { value: "true", label: "Required" },
            ]}
          />
          <SelectField
            defaultValue={String(editingPolicy?.enforceBalance ?? true)}
            name="enforceBalance"
            label="Balance limit"
            options={[
              { value: "true", label: "Require sufficient balance" },
              { value: "false", label: "Unlimited / unpaid" },
            ]}
          />
        </HrForm>
      </HrDialog>
      <HrDialog
        title="Documented balance adjustment"
        open={adjust}
        onClose={() => setAdjust(false)}
      >
        <HrForm
          busy={action.isPending}
          error={action.error}
          onSubmit={(data) =>
            action.mutate(
              {
                path: "/leave/adjustments",
                body: {
                  userId: formString(data, "userId"),
                  leaveTypeId: formString(data, "leaveTypeId"),
                  year,
                  amountHalfDays: Number(formString(data, "amountHalfDays")),
                  reason: formString(data, "reason"),
                  idempotencyKey: crypto.randomUUID(),
                },
              },
              { onSuccess: () => setAdjust(false) },
            )
          }
        >
          <SelectField
            label="Employee"
            name="userId"
            options={(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name }))}
          />
          <SelectField
            label="Leave category"
            name="leaveTypeId"
            options={(policies.data?.policies ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Field
            name="amountHalfDays"
            label="Adjustment (signed half-day units)"
            type="number"
            required
          />
          <Field name="reason" label="Reason" required minLength={3} />
        </HrForm>
      </HrDialog>
    </>
  );
}
