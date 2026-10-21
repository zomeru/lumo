import { approvalHistorySchema, approvalsSchema, canHr, type Approval } from "@lumo/contracts/hr";
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
} from "@lumo/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { hrAccessQuery, allPeopleQuery, downloadHrFile, hrQuery, useHrAction } from "./hr-api";
import { useHrTab, useHrFilter } from "./hr-search";
import { HrDialog, HrForm, HrTabs, formString } from "./hr-ui";
import { RequestDialog } from "./request-dialog";
export function ApprovalsPage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useHrTab("Waiting for me", "/w/$workspaceId/approvals"),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Approval | null>(null),
    [editing, setEditing] = useState<Approval | null>(null);
  const filters = useHrFilter("/w/$workspaceId/approvals");
  const { q, setQ, offset, setOffset } = filters;
  const status = filters.status ?? "all",
    requestType = filters.requestType ?? "all";
  const people = useQuery(allPeopleQuery(workspaceId));
  const access = useQuery(hrAccessQuery(workspaceId));
  const action = useHrAction(workspaceId);
  const download = useMutation({ mutationFn: (id: string) => downloadHrFile(workspaceId, id) });
  const view = tab === "Waiting for me" ? "waiting" : tab === "My requests" ? "mine" : "all";
  const query = new URLSearchParams({ view, q, offset: String(offset) });
  if (status !== "all") query.set("status", status);
  if (requestType !== "all") query.set("type", requestType);
  if (view === "all")
    for (const name of ["employeeId", "approverId", "fromDate", "toDate"] as const) {
      const value = filters[name];
      if (value) query.set(name, value);
    }
  const requests = useQuery(hrQuery(workspaceId, `/requests?${query}`, approvalsSchema));
  const history = useQuery({
    ...hrQuery(workspaceId, `/requests/${selected?.id}/history`, approvalHistorySchema),
    enabled: !!selected,
  });
  if (!access.data)
    return (
      <>
        <ErrorMessage error={access.error} />
        {access.isPending && <Loading />}
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="People & HR"
        title="Approvals"
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New request
          </Button>
        }
      >
        Requests and sign-offs with an auditable decision history.
      </PageHeading>
      <HrTabs
        tabs={[
          "Waiting for me",
          "My requests",
          ...(canHr(access.data, "hr.approvals.read_all") ? ["All requests"] : []),
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setOffset(0);
        }}
      />
      <Field
        className="mb-4 max-w-sm"
        label="Search requests"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOffset(0);
        }}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Request status"
          value={status}
          onValueChange={(v) => {
            filters.setFilters({ status: v, offset: 0 });
          }}
          options={["all", "draft", "pending", "approved", "rejected", "cancelled"].map(
            (value) => ({ value, label: value }),
          )}
        />
        <SelectField
          label="Request type"
          value={requestType}
          onValueChange={(v) => {
            filters.setFilters({ requestType: v, offset: 0 });
          }}
          options={[
            "all",
            "leave",
            "expense",
            "purchase",
            "overtime",
            "travel",
            "advance",
            "general",
          ].map((value) => ({ value, label: value }))}
        />
      </div>
      {view === "all" && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Requester filter"
            value={filters.employeeId ?? "all"}
            options={[
              { value: "all", label: "All employees" },
              ...(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name })),
            ]}
            onValueChange={(value) =>
              filters.setFilters({ employeeId: value === "all" ? undefined : value, offset: 0 })
            }
          />
          <SelectField
            label="Approver filter"
            value={filters.approverId ?? "all"}
            options={[
              { value: "all", label: "All approvers" },
              ...(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name })),
            ]}
            onValueChange={(value) =>
              filters.setFilters({ approverId: value === "all" ? undefined : value, offset: 0 })
            }
          />
          <Field
            label="Created from"
            type="date"
            value={filters.fromDate ?? ""}
            onChange={(event) =>
              filters.setFilters({ fromDate: event.target.value || undefined, offset: 0 })
            }
          />
          <Field
            label="Created through"
            type="date"
            value={filters.toDate ?? ""}
            onChange={(event) =>
              filters.setFilters({ toDate: event.target.value || undefined, offset: 0 })
            }
          />
        </div>
      )}
      <ErrorMessage error={requests.error ?? people.error ?? action.error} />
      {requests.isPending ? (
        <Loading />
      ) : requests.data?.requests.length ? (
        <div className="grid gap-3">
          {requests.data.requests.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2>{r.subject}</h2>
                <p>
                  {people.data?.people.find((p) => p.userId === r.requesterId)?.name ??
                    "Former workspace member"}{" "}
                  · {requestSummary(r)}
                </p>
                <p>
                  {r.details.type} · {new Date(r.createdAt).toLocaleDateString()} · {r.priority}
                </p>
                <Badge>{r.status}</Badge>
                {r.blockedReason && <p>{r.blockedReason}</p>}
              </div>
              <Button onClick={() => setSelected(r)}>View request</Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={view === "waiting" ? "Nothing waiting for you" : "No requests yet"} />
      )}
      <div className="mt-4 flex gap-2">
        {offset > 0 && (
          <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
        )}
        {requests.data?.nextOffset != null && (
          <Button onClick={() => setOffset(requests.data!.nextOffset!)}>Next</Button>
        )}
      </div>
      {open && <RequestDialog workspaceId={workspaceId} open onClose={() => setOpen(false)} />}
      {editing && (
        <RequestDialog
          workspaceId={workspaceId}
          open
          initialApproval={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <HrDialog
        title={selected?.subject ?? "Request"}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <p>{selected.description}</p>
            <Badge>{selected.status}</Badge>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(selected.details).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
            <p>
              Approval step {selected.currentStep + 1} of {selected.approverIds.length}
            </p>
            <HrForm
              busy={action.isPending}
              error={action.error}
              label="Add comment"
              onSubmit={(data) =>
                action.mutate({
                  path: `/requests/${selected.id}/comments`,
                  body: { comment: formString(data, "comment") },
                })
              }
            >
              <Field name="comment" label="Comment" required maxLength={2000} />
            </HrForm>
            <div className="flex flex-wrap gap-2">
              {selected.status === "draft" &&
                selected.requesterId === access.data.userId &&
                selected.details.type !== "attendance_correction" && (
                  <Button
                    onClick={() => {
                      setEditing(selected);
                      setSelected(null);
                    }}
                  >
                    Edit draft
                  </Button>
                )}

              {selected.requesterId === access.data.userId && selected.status === "draft" && (
                <Button
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(
                      { path: `/requests/${selected.id}/action`, body: { action: "submit" } },
                      { onSuccess: () => setSelected(null) },
                    )
                  }
                >
                  Submit draft
                </Button>
              )}
              {selected.status === "pending" &&
                selected.approverIds[selected.currentStep] === access.data.userId &&
                selected.requesterId !== access.data.userId &&
                ["approve", "reject"].map((value) => (
                  <Button
                    key={value}
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(
                        { path: `/requests/${selected.id}/action`, body: { action: value } },
                        { onSuccess: () => setSelected(null) },
                      )
                    }
                  >
                    {value === "approve" ? "Approve" : "Reject"}
                  </Button>
                ))}
              {selected.requesterId === access.data.userId &&
                ["draft", "pending", "approved"].includes(selected.status) && (
                  <Button
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(
                        { path: `/requests/${selected.id}/action`, body: { action: "cancel" } },
                        { onSuccess: () => setSelected(null) },
                      )
                    }
                  >
                    Cancel request
                  </Button>
                )}
            </div>
            <ErrorMessage error={history.error ?? download.error} />
            {history.data?.events.map((event) => (
              <p key={event.id} className="border-t pt-2 text-xs">
                {new Date(event.createdAt).toLocaleString()} · {event.action} {event.comment}
              </p>
            ))}
            {history.data?.files.map((file) => (
              <Button key={file.id} onClick={() => download.mutate(file.id)}>
                Download {file.name}
              </Button>
            ))}
          </>
        )}
      </HrDialog>
    </>
  );
}

function requestSummary(request: Approval) {
  const details = request.details;
  if (details.type === "leave" || details.type === "travel")
    return `${details.startDate} – ${details.endDate}`;
  if (details.type === "overtime") return `${details.date} · ${details.durationMinutes} minutes`;
  if (details.type === "attendance_correction") return details.date;
  if (details.type === "general") return "General request";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: details.currency }).format(
    details.amountMinor / 100,
  );
}
