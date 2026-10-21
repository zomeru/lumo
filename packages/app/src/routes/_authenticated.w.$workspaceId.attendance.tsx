import { createFileRoute } from "@tanstack/react-router";

import { AttendancePage } from "../features/hr/attendance-page";
import { hrSearchSchema } from "../features/hr/hr-search";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/attendance")({
  validateSearch: hrSearchSchema,
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <AttendancePage workspaceId={workspaceId} />;
  },
});
