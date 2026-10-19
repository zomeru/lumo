import { createFileRoute } from "@tanstack/react-router";

import { MeetingsPage } from "../features/meetings/meetings-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/meetings")({
  component: function Page() {
    return <MeetingsPage workspaceId={Route.useParams().workspaceId} />;
  },
});
