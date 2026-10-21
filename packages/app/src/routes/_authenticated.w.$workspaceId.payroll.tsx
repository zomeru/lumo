import { createFileRoute } from "@tanstack/react-router";

import { PayrollPage } from "../features/hr/payroll-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/payroll")({
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <PayrollPage workspaceId={workspaceId} />;
  },
});
