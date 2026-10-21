import { createFileRoute } from "@tanstack/react-router";

import { CalendarPage } from "../features/meetings/calendar-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/calendar")({
  validateSearch: (search: Record<string, unknown>): { compose?: boolean } => ({
    ...(search.compose === true || search.compose === "true" ? { compose: true } : {}),
  }),
  component: function Page() {
    const { workspaceId } = Route.useParams();
    const { compose } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <CalendarPage
        key={workspaceId}
        workspaceId={workspaceId}
        compose={Boolean(compose)}
        onComposeClosed={() => {
          if (compose) void navigate({ search: {}, replace: true });
        }}
      />
    );
  },
});
