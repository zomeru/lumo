import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "../features/workspaces/settings-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/settings")({
  component: function RoutePage() {
    return <SettingsPage workspaceId={Route.useParams().workspaceId} />;
  },
});
