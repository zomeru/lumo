import { createFileRoute } from "@tanstack/react-router";

import { WikiPage } from "../features/office/wiki-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/wiki/")({
  component: function Page() {
    const params = Route.useParams();
    return <WikiPage workspaceId={params.workspaceId} />;
  },
});
