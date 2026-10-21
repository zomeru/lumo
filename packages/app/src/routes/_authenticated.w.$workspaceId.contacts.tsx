import { createFileRoute, redirect } from "@tanstack/react-router";

import { hrSearchSchema } from "../features/hr/hr-search";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/contacts")({
  validateSearch: hrSearchSchema,
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/w/$workspaceId/people", params, search, replace: true });
  },
});
