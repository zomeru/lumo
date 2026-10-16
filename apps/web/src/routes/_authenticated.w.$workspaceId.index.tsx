import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/features/workspaces/home-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/")({
  component: function RoutePage() {
    return <HomePage workspaceId={Route.useParams().workspaceId} />;
  },
});
