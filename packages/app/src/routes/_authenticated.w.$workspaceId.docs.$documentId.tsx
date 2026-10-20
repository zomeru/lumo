import { createFileRoute } from "@tanstack/react-router";

import { OfficePage } from "../features/office/office-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/docs/$documentId")({
  component: function Page() {
    const { workspaceId, documentId } = Route.useParams();
    return <OfficePage workspaceId={workspaceId} id={documentId} />;
  },
});
