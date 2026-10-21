import { okSchema, workspaceSchema } from "@lumo/contracts";
import { formatDate } from "@lumo/shared/date-time";
import { Brand, Button, Card, ErrorMessage, Loading } from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  api,
  clearWorkspaceCache,
  invitePreviewQuery,
  refreshWorkspaces,
  sessionQuery,
} from "../../lib/api";
import { ProfileButton } from "../auth/profile-dialog";

export function InvitePage({ token }: { token: string }) {
  const preview = useQuery(invitePreviewQuery(token));
  const session = useQuery(sessionQuery());
  const client = useQueryClient();
  const navigate = useNavigate();
  const decline = useMutation({
    mutationFn: () => api("/invitations/decline", okSchema, { method: "POST", body: { token } }),
    onSuccess: async () => {
      client.removeQueries({ queryKey: ["invitation"] });
      await navigate({ to: "/workspaces", replace: true });
    },
  });
  const accept = useMutation({
    mutationFn: () =>
      api("/invitations/accept", workspaceSchema, { method: "POST", body: { token } }),
    onSuccess: async (ws) => {
      await clearWorkspaceCache(client);
      client.removeQueries({ queryKey: ["invitation"] });
      await refreshWorkspaces(client);
      await navigate({ to: "/w/$workspaceId", params: { workspaceId: ws.id }, replace: true });
    },
  });
  return (
    <main
      id="main-content"
      className="mx-auto grid min-h-dvh max-w-2xl content-start gap-6 px-5 py-10 sm:py-14"
    >
      <Brand />
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <h1>You’re invited</h1>
          {preview.isPending ? (
            <Loading label="Checking your invitation…" />
          ) : preview.data ? (
            <>
              <p>
                Join <strong>{preview.data.workspaceName}</strong> as a {preview.data.role}.
              </p>
              <p>This invitation expires {formatDate(preview.data.expiresAt)}.</p>
              {session.data?.user.emailVerified ? (
                <Button
                  variant="primary"

                  disabled={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  {accept.isPending ? "Joining…" : "Accept invitation"}
                </Button>
              ) : (
                <p className="my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
                  Verify your email before accepting.{" "}
                  <ProfileButton variant="link">Open your profile</ProfileButton>, then return to
                  this invitation link.
                </p>
              )}
            </>
          ) : (
            <p>
              This invitation is unavailable. It may have expired, been used or revoked, or belong
              to another email address.
            </p>
          )}
          {preview.data && (
            <Button disabled={decline.isPending} onClick={() => decline.mutate()}>
              Decline invitation
            </Button>
          )}
          <ErrorMessage error={accept.error ?? decline.error} />
          <Link
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            to="/workspaces"
          >
            Your workspaces
          </Link>
        </section>
      </Card>
    </main>
  );
}
