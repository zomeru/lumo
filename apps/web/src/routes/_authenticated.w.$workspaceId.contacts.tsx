import { createFileRoute } from "@tanstack/react-router";

import { ContactsPage } from "@/features/workspaces/contacts-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/contacts")({
  component: function RoutePage() {
    return <ContactsPage workspaceId={Route.useParams().workspaceId} />;
  },
});
