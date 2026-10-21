import { createFileRoute } from "@tanstack/react-router";

import { hrSearchSchema } from "../features/hr/hr-search";
import { PeoplePage } from "../features/hr/people-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/people")({
  validateSearch: hrSearchSchema,
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <PeoplePage workspaceId={workspaceId} />;
  },
});
