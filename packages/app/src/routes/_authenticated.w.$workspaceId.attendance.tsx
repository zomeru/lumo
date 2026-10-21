import { createFileRoute } from "@tanstack/react-router";

import { AttendancePage } from "../features/hr/attendance-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/attendance")({
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <AttendancePage workspaceId={workspaceId} />;
  },
});
