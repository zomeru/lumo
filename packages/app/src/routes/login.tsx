import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuthPage } from "../features/auth/auth-page";
import { ApiError, sessionQuery } from "../lib/api";
import { getPlatform } from "../platform";
export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    if (getPlatform()?.kind !== "desktop") return;
    let session;
    try {
      session = await context.queryClient.fetchQuery(sessionQuery());
    } catch (error) {
      if (error instanceof ApiError && [401, 503].includes(error.status)) return;
      throw error;
    }
    throw redirect(
      session.activeWorkspaceId
        ? { to: "/w/$workspaceId", params: { workspaceId: session.activeWorkspaceId } }
        : { to: "/workspaces" },
    );
  },
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite:
      typeof search.invite === "string" && /^[a-f0-9]{64}$/.test(search.invite)
        ? search.invite
        : undefined,
  }),
  component: function RoutePage() {
    return <AuthPage mode="login" invite={Route.useSearch().invite} />;
  },
});
