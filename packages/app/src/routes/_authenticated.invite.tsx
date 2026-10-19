import { createFileRoute } from "@tanstack/react-router";

import { InvitePage } from "../features/workspaces/invite-page";
export const Route = createFileRoute("/_authenticated/invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token:
      typeof search.token === "string" && /^[a-f0-9]{64}$/.test(search.token) ? search.token : "",
  }),
  component: function RoutePage() {
    return <InvitePage token={Route.useSearch().token} />;
  },
});
