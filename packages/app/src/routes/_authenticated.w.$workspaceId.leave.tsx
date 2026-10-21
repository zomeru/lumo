import { createFileRoute } from "@tanstack/react-router";

import { LeavePage } from "../features/hr/leave-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/leave")({
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <LeavePage workspaceId={workspaceId} />;
  },
});
