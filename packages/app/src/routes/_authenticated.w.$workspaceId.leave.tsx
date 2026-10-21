import { createFileRoute } from "@tanstack/react-router";

import { hrSearchSchema } from "../features/hr/hr-search";
import { LeavePage } from "../features/hr/leave-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/leave")({
  validateSearch: hrSearchSchema,
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <LeavePage workspaceId={workspaceId} />;
  },
});
