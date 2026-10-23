import {
  canHr,
  hrCapabilities,
  hrGrantSchema,
  payrollSettingsSchema,
  type HrAccess,
} from "@lumolynk/contracts/hr";
import { formatDate } from "@lumolynk/shared/date-time";
import { Button, Card, ErrorMessage, Field, SelectField } from "@lumolynk/ui";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { hrQuery, allPeopleQuery, useHrAction } from "./hr-api";
import { HrForm, formString } from "./hr-ui";
import { StatutorySettingsPanel } from "./statutory-settings";
export function PayrollSettingsPanel({
  workspaceId,
  access,
}: {
  workspaceId: string;
  access: HrAccess;
}) {
  const canSettings = canHr(access, "hr.payroll.settings.manage"),
    canGrants = canHr(access, "hr.permissions.manage");
  const settings = useQuery({
      ...hrQuery(workspaceId, "/payroll/settings", payrollSettingsSchema),
      enabled: canSettings,
    }),
    grants = useQuery({
      ...hrQuery(workspaceId, "/grants", z.object({ grants: z.array(hrGrantSchema) })),
      enabled: canGrants,
    }),
    people = useQuery(allPeopleQuery(workspaceId));
  const action = useHrAction(workspaceId);
  return (
    <div className="grid gap-5">
      <ErrorMessage error={settings.error ?? grants.error} />
      {canSettings && (
        <>
          <Card>
            <h2 className="mb-4">Effective payroll schedule and business policies</h2>
            <HrForm
              busy={action.isPending}
              error={action.error}
              label="Save effective settings"
              onSubmit={(data) => {
                const number = (name: string) => Number(formString(data, name));
                action.mutate({
                  path: "/payroll/settings",
                  body: {
                    effectiveFrom: formString(data, "effectiveFrom"),
                    frequency: formString(data, "frequency"),
                    currency: "PHP",
                    workingDaysPerYear: number("workingDaysPerYear"),
                    minutesPerDay: number("minutesPerDay"),
                    overtimeBps: number("overtimeBps"),
                    holidayBps: number("holidayBps"),
                    restDayBps: number("restDayBps"),
                    nightDifferentialBps: number("nightDifferentialBps"),
                    deductUndertime: formString(data, "deductUndertime") === "true",
                    publishOnFinalize: formString(data, "publishOnFinalize") === "true",
                    payoutDay: number("payoutDay"),
                    firstPayoutDay: number("firstPayoutDay"),
                    reason: formString(data, "reason"),
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Effective date" name="effectiveFrom" type="date" required />
                <SelectField
                  label="Frequency"
                  name="frequency"
                  options={[
                    { value: "monthly", label: "Monthly" },
                    { value: "semimonthly", label: "Semimonthly" },
                  ]}
                />
                <Field
                  label="Working days per year"
                  name="workingDaysPerYear"
                  type="number"
                  min="200"
                  max="366"
                  required
                />
                <Field
                  label="Work minutes per day"
                  name="minutesPerDay"
                  type="number"
                  min="60"
                  max="1440"
                  required
                />
                <Field
                  label="Overtime multiplier (basis points; 10000 = 1×)"
                  name="overtimeBps"
                  type="number"
                  min="10000"
                  max="50000"
                  required
                />
                <Field
                  label="Holiday multiplier (basis points)"
                  name="holidayBps"
                  type="number"
                  min="10000"
                  max="50000"
                  required
                />
                <Field
                  label="Rest-day multiplier (basis points)"
                  name="restDayBps"
                  type="number"
                  min="10000"
                  max="50000"
                  required
                />
                <Field
                  label="Night differential (basis points)"
                  name="nightDifferentialBps"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue="0"
                  required
                />
                <Field
                  label="Monthly / second payout day"
                  name="payoutDay"
                  type="number"
                  min="1"
                  max="31"
                  required
                />
                <Field
                  label="First semimonthly payout day"
                  name="firstPayoutDay"
                  type="number"
                  min="1"
                  max="15"
                  defaultValue="15"
                  required
                />
                <SelectField
                  label="Deduct attendance undertime"
                  name="deductUndertime"
                  options={[
                    { value: "false", label: "Do not deduct automatically" },
                    { value: "true", label: "Deduct missing scheduled minutes" },
                  ]}
                />
                <SelectField
                  label="Payslip publishing"
                  name="publishOnFinalize"
                  options={[
                    { value: "false", label: "Publish separately after finalization" },
                    { value: "true", label: "Publish on finalization" },
                  ]}
                />
              </div>
              <Field label="Reason for change" name="reason" required minLength={3} />
            </HrForm>
            {settings.data?.settings.map((s) => (
              <p key={s.id} className="mt-3 border-t pt-3">
                {formatDate(s.effectiveFrom)} · {s.frequency} · PHP · {s.reason}
              </p>
            ))}
          </Card>
          <StatutorySettingsPanel workspaceId={workspaceId} />
        </>
      )}
      {canGrants && (
        <Card>
          <h2 className="mb-4">HR and payroll permissions</h2>
          <p className="mb-4">
            Workspace roles and job titles do not grant payroll access. Assign only the capabilities
            each colleague needs.
          </p>
          <HrForm
            busy={action.isPending}
            error={action.error}
            label="Grant capability"
            onSubmit={(data) =>
              action.mutate({
                path: "/grants",
                body: {
                  userId: formString(data, "userId"),
                  capability: formString(data, "capability"),
                  scope: formString(data, "scope"),
                },
              })
            }
          >
            <SelectField
              label="Colleague"
              name="userId"
              options={(people.data?.people ?? [])
                .filter((p) => p.userId !== access.userId)
                .map((p) => ({ value: p.userId, label: p.name }))}
            />
            <SelectField
              label="Capability"
              name="capability"
              options={hrCapabilities.map((value) => ({ value, label: value }))}
            />
            <SelectField
              label="Scope (team scope applies only to leave/attendance reads)"
              name="scope"
              options={[
                { value: "workspace", label: "Workspace" },
                { value: "direct_reports", label: "Direct reports" },
              ]}
            />
          </HrForm>
          {grants.data?.grants.map((g) => (
            <div
              key={`${g.userId}:${g.capability}`}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3"
            >
              <p>
                {people.data?.people.find((p) => p.userId === g.userId)?.name ?? g.userId}
                <small>
                  {g.capability} · {g.scope}
                </small>
              </p>
              <Button
                size="sm"
                disabled={action.isPending || g.userId === access.userId}
                onClick={() => action.mutate({ path: "/grants", body: { ...g, revoke: true } })}
              >
                Revoke
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
