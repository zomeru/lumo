import { createFileRoute } from "@tanstack/react-router";

import { ApprovalsPage } from "../features/hr/approvals-page";
import { hrSearchSchema } from "../features/hr/hr-search";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/approvals")({
  validateSearch: hrSearchSchema,
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <ApprovalsPage workspaceId={workspaceId} />;
  },
});
