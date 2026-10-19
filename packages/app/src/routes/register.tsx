import { createFileRoute } from "@tanstack/react-router";

import { AuthPage } from "../features/auth/auth-page";

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite:
      typeof search.invite === "string" && /^[a-f0-9]{64}$/.test(search.invite)
        ? search.invite
        : undefined,
  }),
  component: function RoutePage() {
    return <AuthPage mode="register" invite={Route.useSearch().invite} />;
  },
});
