import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "../features/workspaces/members-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/members")({
  component: function RoutePage() {
    return <MembersPage workspaceId={Route.useParams().workspaceId} />;
  },
});
