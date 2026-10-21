import { createFileRoute } from "@tanstack/react-router";

import { hrSearchSchema } from "../features/hr/hr-search";
import { PayrollPage } from "../features/hr/payroll-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/payroll")({
  validateSearch: hrSearchSchema,
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <PayrollPage workspaceId={workspaceId} />;
  },
});
