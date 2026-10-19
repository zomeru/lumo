import { workspaceUpdateSchema, workspaceSchema } from "@lumo/contracts";
import { canManageSettings } from "@lumo/contracts/permissions";
import { Button, Card, ErrorMessage, Loading, PageHeading } from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { activityQuery, api, workspaceQuery } from "../../lib/api";
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
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section className="max-w-3xl">
          <form
            className="grid gap-4"
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
            {save.isSuccess && (
              <output className="my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
                Workspace settings saved.
              </output>
            )}
            <Button variant="primary" type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </section>
      </Card>
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <h2>Recent workspace activity</h2>
          <ErrorMessage error={activity.error} />
          {activity.isPending ? (
            <Loading label="Loading activity…" />
          ) : (
            activity.data?.events.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-4 text-sm last:border-0 [&_time]:text-xs [&_time]:text-muted-foreground"
              >
                <span>
                  {item.action.replaceAll(".", " ")}
                  <small>{item.actorName ?? "Former member"}</small>
                </span>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </div>
            ))
          )}
        </section>
      </Card>
    </>
  );
}
