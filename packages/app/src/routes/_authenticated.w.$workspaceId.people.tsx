import { createFileRoute } from "@tanstack/react-router";

import { PeoplePage } from "../features/hr/people-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/people")({
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <PeoplePage workspaceId={workspaceId} />;
  },
});
