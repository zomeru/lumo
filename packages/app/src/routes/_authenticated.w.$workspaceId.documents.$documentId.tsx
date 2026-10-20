import { createFileRoute, redirect } from "@tanstack/react-router";

import { officeLocation } from "../features/office/file-modules";
import { officeQuery } from "../features/office/office-api";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/documents/$documentId")({
  loader: async ({ params, context }) => {
    const doc = await context.queryClient.ensureQueryData(
      officeQuery(params.workspaceId, params.documentId),
    );
    throw redirect(officeLocation(params.workspaceId, params.documentId, doc.kind));
  },
});
