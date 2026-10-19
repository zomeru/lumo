import { createFileRoute } from "@tanstack/react-router";

import { MessengerPage } from "../features/messenger/messenger-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/messenger/")({
  component: function Page() {
    return <MessengerPage workspaceId={Route.useParams().workspaceId} />;
  },
});
