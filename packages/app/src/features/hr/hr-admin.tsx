import { approvalPoliciesSchema, canHr, hrAuditSchema, type HrAccess } from "@lumo/contracts/hr";
import { formatDateTime } from "@lumo/shared/date-time";
import { Button, Card, ErrorMessage, MultiSelectField, SelectField } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { hrQuery, allPeopleQuery, useHrAction } from "./hr-api";
import { HrForm, formString } from "./hr-ui";
export function HrAdmin({ workspaceId, access }: { workspaceId: string; access: HrAccess }) {
  const manage = canHr(access, "hr.approvals.manage"),
    audit = canHr(access, "hr.permissions.manage") && canHr(access, "hr.payroll.read_all");
  const [approvers, setApprovers] = useState<string[]>([]),
    [offset, setOffset] = useState(0);
  const action = useHrAction(workspaceId);
  const people = useQuery(allPeopleQuery(workspaceId)),
    policies = useQuery({
      ...hrQuery(workspaceId, "/approval-policies", approvalPoliciesSchema),
      enabled: manage,
    }),
    events = useQuery({
      ...hrQuery(workspaceId, `/audit?offset=${offset}`, hrAuditSchema),
      enabled: audit,
    });
  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="mb-4">Workspace HR administration</h2>
        <div className="flex flex-wrap gap-2">
          {canHr(access, "hr.leave.manage_policy") && (
            <Button asChild>
              <Link
                to="/w/$workspaceId/leave"
                params={{ workspaceId }}
                search={{ tab: "Policies" }}
              >
                Leave policies
              </Link>
            </Button>
          )}
          {canHr(access, "hr.attendance.manage_policy") && (
            <Button asChild>
              <Link
                to="/w/$workspaceId/attendance"
                params={{ workspaceId }}
                search={{ tab: "Schedules" }}
              >
                Schedules & holidays
              </Link>
            </Button>
          )}
          {(canHr(access, "hr.payroll.settings.manage") ||
            canHr(access, "hr.permissions.manage")) && (
            <Button asChild>
              <Link
                to="/w/$workspaceId/payroll"
                params={{ workspaceId }}
                search={{ tab: "Settings" }}
              >
                Payroll settings & access grants
              </Link>
            </Button>
          )}
        </div>
      </Card>
      {manage && (
        <Card>
          <h2 className="mb-4">Approval routing policies</h2>
          <HrForm
            busy={action.isPending}
            error={action.error ?? policies.error}
            label="Save routing policy"
            onSubmit={(data) =>
              action.mutate({
                path: "/approval-policies",
                body: {
                  type: formString(data, "type"),
                  approverIds: approvers,
                  requireAttachment: formString(data, "requireAttachment") === "true",
                },
              })
            }
          >
            <SelectField
              name="type"
              label="Request type"
              options={[
                "leave",
                "expense",
                "purchase",
                "overtime",
                "travel",
                "advance",
                "general",
                "attendance_correction",
              ].map((value) => ({ value, label: value }))}
            />
            <MultiSelectField
              label="Ordered approvers (select in approval order)"
              value={approvers}
              onValueChange={setApprovers}
              options={(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name }))}
            />
            <SelectField
              label="Attachment policy"
              name="requireAttachment"
              options={[
                { value: "false", label: "Optional" },
                { value: "true", label: "Required before submission" },
              ]}
            />
          </HrForm>
          {policies.data?.policies.map((p) => (
            <p key={p.type} className="mt-3 border-t pt-3">
              {p.type}:{" "}
              {p.approverIds
                .map((id) => people.data?.people.find((person) => person.userId === id)?.name ?? id)
                .join(" → ")}
              {p.requireAttachment ? " · documentation required" : ""}
            </p>
          ))}
        </Card>
      )}
      {audit && (
        <Card>
          <h2 className="mb-4">Protected HR audit history</h2>
          <ErrorMessage error={events.error} />
          {events.data?.events.map((e) => (
            <details className="border-t py-3 text-sm" key={e.id}>
              <summary>
                {formatDateTime(e.createdAt)} · {e.action} ·{" "}
                {people.data?.people.find((p) => p.userId === e.actorId)?.name ?? e.actorId}
              </summary>
              <p>Target: {e.targetId}</p>
              <pre className="max-h-60 overflow-auto text-xs">
                {JSON.stringify(e.data, null, 2)}
              </pre>
            </details>
          ))}
          <div className="mt-4 flex gap-2">
            {offset > 0 && (
              <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous events</Button>
            )}
            {events.data?.nextOffset != null && (
              <Button onClick={() => setOffset(events.data!.nextOffset!)}>Next events</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
