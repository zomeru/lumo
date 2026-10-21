import {
  approvalHistorySchema,
  approvalsSchema,
  canHr,
  hrUrlSchema,
  type Approval,
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
} from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api";
import { hrAccessQuery, hrPath, hrQuery, useHrAction } from "./hr-api";
import { HrDialog, HrForm, HrTabs, formString } from "./hr-ui";
import { RequestDialog } from "./request-dialog";
export function ApprovalsPage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState("Waiting for me"),
    [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Approval | null>(null);
  const access = useQuery(hrAccessQuery(workspaceId));
  const action = useHrAction(workspaceId);
  const view = tab === "Waiting for me" ? "waiting" : tab === "My requests" ? "mine" : "all";
  const requests = useQuery(
    hrQuery(
      workspaceId,
      `/requests?view=${view}&q=${encodeURIComponent(q)}&offset=${offset}`,
      approvalsSchema,
    ),
  );
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
      <ErrorMessage error={requests.error ?? action.error} />
      {requests.isPending ? (
        <Loading />
      ) : requests.data?.requests.length ? (
        <div className="grid gap-3">
          {requests.data.requests.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2>{r.subject}</h2>
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
            <ErrorMessage error={history.error} />
            {history.data?.events.map((event) => (
              <p key={event.id} className="border-t pt-2 text-xs">
                {new Date(event.createdAt).toLocaleString()} · {event.action} {event.comment}
              </p>
            ))}
            {history.data?.files.map((file) => (
              <Button
                key={file.id}
                onClick={() => {
                  void api(`${hrPath(workspaceId)}/files/${file.id}/download`, hrUrlSchema, {
                    method: "POST",
                    body: {},
                  }).then((result) => window.open(result.url, "_blank", "noopener,noreferrer"));
                }}
              >
                Download {file.name}
              </Button>
            ))}
          </>
        )}
      </HrDialog>
    </>
  );
}
