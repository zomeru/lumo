import { createFileRoute } from "@tanstack/react-router";

import { ApprovalsPage } from "../features/hr/approvals-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/approvals")({
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <ApprovalsPage workspaceId={workspaceId} />;
  },
});
