import { workspaceSchema } from "@lumo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { Brand, ErrorMessage, Loading } from "@/components/ui";
import {
  api,
  clearWorkspaceCache,
  invitePreviewQuery,
  refreshWorkspaces,
  sessionQuery,
} from "@/lib/api";

export function InvitePage({ token }: { token: string }) {
  const preview = useQuery(invitePreviewQuery(token));
  const session = useQuery(sessionQuery());
  const client = useQueryClient();
  const navigate = useNavigate();
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
    <main id="main-content" className="onboarding">
      <Brand />
      <section className="card">
        <h1>You’re invited</h1>
        {preview.isPending ? (
          <Loading label="Checking your invitation…" />
        ) : preview.data ? (
          <>
            <p>
              Join <strong>{preview.data.workspaceName}</strong> as a {preview.data.role}.
            </p>
            <p>This invitation expires {new Date(preview.data.expiresAt).toLocaleDateString()}.</p>
            {session.data?.user.emailVerified ? (
              <button
                className="primary"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "Joining…" : "Accept invitation"}
              </button>
            ) : (
              <p className="notice">
                Verify your email before accepting. <Link to="/profile">Open your profile</Link>,
                then return to this invitation link.
              </p>
            )}
          </>
        ) : (
          <p>
            This invitation is unavailable. It may have expired, been used or revoked, or belong to
            another email address.
          </p>
        )}
        <ErrorMessage error={accept.error} />
        <Link className="back-link" to="/workspaces">
          Your workspaces
        </Link>
      </section>
    </main>
  );
}
