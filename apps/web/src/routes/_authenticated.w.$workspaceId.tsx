import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "@/features/workspaces/workspace-shell";
import { command, workspaceQuery } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/w/$workspaceId")({
  beforeLoad: async ({ context, params, preload }) => {
    await context.queryClient.fetchQuery(workspaceQuery(params.workspaceId));
    if (!preload) await command("/me/active-workspace", "PUT", { workspaceId: params.workspaceId });
  },
  component: function RoutePage() {
    return <WorkspaceShell workspaceId={Route.useParams().workspaceId} />;
  },
});
