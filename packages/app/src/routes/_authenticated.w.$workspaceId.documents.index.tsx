import { driveListInputSchema } from "@lumolynk/contracts/drive";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { moduleRoutes } from "../features/office/file-modules";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/documents/")({
  validateSearch: driveListInputSchema,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: moduleRoutes[
        search.type === "sheet"
          ? "sheets"
          : search.type === "slide"
            ? "slides"
            : search.type === "wiki"
              ? "wiki"
              : "docs"
      ],
      params,
      search,
    });
  },
});
