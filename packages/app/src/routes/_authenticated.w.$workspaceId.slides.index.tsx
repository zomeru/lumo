import { driveListInputSchema } from "@lumolynk/contracts/drive";
import { createFileRoute } from "@tanstack/react-router";

import { DrivePage } from "../features/drive/drive-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/slides/")({
  validateSearch: driveListInputSchema,
  component: function Page() {
    const search = Route.useSearch(),
      navigate = Route.useNavigate();
    return (
      <DrivePage
        module="slides"
        workspaceId={Route.useParams().workspaceId}
        search={search}
        navigate={(patch) => {
          void navigate({ search: (previous) => ({ ...previous, ...patch }) });
        }}
      />
    );
  },
});
