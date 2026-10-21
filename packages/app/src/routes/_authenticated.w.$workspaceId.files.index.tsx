import { driveListInputSchema } from "@lumo/contracts/drive";
import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/files/")({
  validateSearch: driveListInputSchema,
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/w/$workspaceId/drive", params, search, replace: true });
  },
});
