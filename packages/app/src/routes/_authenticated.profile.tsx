import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/profile")({
  beforeLoad: ({ context }) => {
    if (context.session.activeWorkspaceId)
      throw redirect({
        to: "/w/$workspaceId",
        params: { workspaceId: context.session.activeWorkspaceId },
        search: { profile: true },
        replace: true,
      });
    throw redirect({ to: "/workspaces", search: { profile: true }, replace: true });
  },
});
