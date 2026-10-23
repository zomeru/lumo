import { Button, ErrorMessage, Loading } from "@lumolynk/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { ProfileProvider } from "../features/auth/profile-dialog";
import { ApiError, sessionQuery } from "../lib/api";

export const Route = createFileRoute("/_authenticated")({
  validateSearch: (search: Record<string, unknown>): { profile?: boolean } =>
    search.profile === true || search.profile === "true" ? { profile: true } : {},
  beforeLoad: async ({ context, location }) => {
    try {
      return { session: await context.queryClient.fetchQuery(sessionQuery()) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await context.queryClient.cancelQueries();
        context.queryClient.clear();
        const token = new URLSearchParams(location.searchStr).get("token");
        throw redirect({
          to: "/login",
          search: { invite: token && /^[a-f0-9]{64}$/.test(token) ? token : undefined },
        });
      }
      throw error;
    }
  },
  component: SessionBoundary,
});

function SessionBoundary() {
  const session = useQuery(sessionQuery());
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) {
      void (async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await navigate({ to: "/login" });
      })();
    }
  }, [session.error, queryClient, navigate]);
  if (session.error instanceof ApiError && session.error.status === 401)
    return <Loading label="Returning to sign in…" />;
  if (session.isError)
    return (
      <main className="mx-auto my-16 grid max-w-xl gap-5 px-6">
        <h1>Connection interrupted</h1>
        <p>Your account could not be refreshed. Try again once the connection is available.</p>
        <ErrorMessage error={session.error} />
        <Button loading={session.isFetching} onClick={() => void session.refetch()}>
          Try again
        </Button>
      </main>
    );
  if (!session.data) return <Loading label="Restoring your session…" />;
  return (
    <ProfileProvider>
      <Outlet />
    </ProfileProvider>
  );
}
