import { workspaceUpdateSchema, workspaceSchema } from "@lumo/contracts";
import { canManageSettings } from "@lumo/contracts/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorMessage, Loading, PageHeading } from "@/components/ui";
import { activityQuery, api, workspaceQuery } from "@/lib/api";

import { WorkspaceFields } from "./workspace-fields";

export function SettingsPage({ workspaceId }: { workspaceId: string }) {
  const client = useQueryClient();
  const ws = useQuery(workspaceQuery(workspaceId));
  const [validation, setValidation] = useState<Error | null>(null);
  const activity = useQuery({
    ...activityQuery(workspaceId),
    enabled: Boolean(ws.data && canManageSettings(ws.data.role)),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, FormDataEntryValue>) =>
      api(`/workspaces/${workspaceId}`, workspaceSchema, { method: "PATCH", body }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
        client.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
    },
  });
  if (!ws.data) return <Loading />;
  if (!canManageSettings(ws.data.role))
    return (
      <>
        <PageHeading eyebrow="Workspace administration" title="Permission required">
          Only owners and admins can manage workspace settings.
        </PageHeading>
      </>
    );
  return (
    <>
      <PageHeading eyebrow="Make it yours" title="Workspace settings">
        Update your workspace details and preferences.
      </PageHeading>
      <section className="card settings-form">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const body = Object.fromEntries(new FormData(e.currentTarget));
            const parsed = workspaceUpdateSchema.safeParse(body);
            if (!parsed.success) {
              setValidation(new Error(parsed.error.issues[0]?.message ?? "Check your settings."));
              return;
            }
            setValidation(null);
            save.mutate(body);
          }}
        >
          <WorkspaceFields value={ws.data} personal={ws.data.isPersonal} />
          <ErrorMessage error={validation ?? save.error} />
          {save.isSuccess && <output className="notice">Workspace settings saved.</output>}
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
        </form>
      </section>
      <section className="card">
        <h2>Recent workspace activity</h2>
        <ErrorMessage error={activity.error} />
        {activity.isPending ? (
          <Loading label="Loading activity…" />
        ) : (
          activity.data?.events.map((item) => (
            <div key={item.id} className="activity-row">
              <span>
                {item.action.replaceAll(".", " ")}
                <small>{item.actorName ?? "Former member"}</small>
              </span>
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
          ))
        )}
      </section>
    </>
  );
}
