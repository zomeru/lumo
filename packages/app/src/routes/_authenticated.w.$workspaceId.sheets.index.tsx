import { driveListInputSchema } from "@lumo/contracts/drive";
import { createFileRoute } from "@tanstack/react-router";

import { DrivePage } from "../features/drive/drive-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/sheets/")({
  validateSearch: driveListInputSchema,
  component: function Page() {
    const search = Route.useSearch(),
      navigate = Route.useNavigate();
    return (
      <DrivePage
        module="sheets"
        workspaceId={Route.useParams().workspaceId}
        search={search}
        navigate={(patch) => {
          void navigate({ search: (previous) => ({ ...previous, ...patch }) });
        }}
      />
    );
  },
});
