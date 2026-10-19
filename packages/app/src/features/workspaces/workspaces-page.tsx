import { workspaceSchema } from "@lumo/contracts";
import { parseLumoLink } from "@lumo/shared";
import { Brand, ErrorMessage, Field, Loading, PageHeading } from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  api,
  clearWorkspaceCache,
  discoveryQuery,
  refreshWorkspaces,
  sessionQuery,
  workspacesQuery,
} from "../../lib/api";
import { getPlatform } from "../../platform";

export function WorkspacesPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const joined = useQuery(workspacesQuery());
  const session = useQuery(sessionQuery());
  const [linkError, setLinkError] = useState<unknown>(null);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const discover = useQuery(discoveryQuery(q, offset));
  const join = useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${id}/join`, workspaceSchema, { method: "POST", body: {} }),
    onSuccess: async (ws) => {
      await clearWorkspaceCache(client);
      await refreshWorkspaces(client);
      await navigate({ to: "/w/$workspaceId", params: { workspaceId: ws.id } });
    },
  });
  return (
    <main id="main-content" className="workspace-picker">
      <header className="picker-header">
        <Brand />
        <Link className="button" to="/profile">
          Your profile
        </Link>
      </header>
      <PageHeading
        eyebrow="Your shared spaces"
        title={`Welcome${session.data ? `, ${session.data.user.name.split(" ")[0]}` : ""}`}
      >
        Choose where you’d like to work today.
      </PageHeading>
      <section className="card">
        <h2>Open a shared link</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const value = new FormData(event.currentTarget).get("link") as string;
              const target = parseLumoLink(
                value,
                getPlatform()?.webOrigin ?? window.location.origin,
              );
              setLinkError(null);
              void navigate(
                target.kind === "invite"
                  ? { to: "/invite", search: { token: target.token } }
                  : { to: "/meetings/$meetingId", params: { meetingId: target.id } },
              );
            } catch (error) {
              setLinkError(error);
            }
          }}
        >
          <Field
            label="Lumo invitation or meeting link"
            type="url"
            name="link"
            required
            maxLength={2048}
          />
          <ErrorMessage error={linkError} />
          <button>Open link</button>
        </form>
      </section>
      <div className="section-heading">
        <h2>Your workspaces</h2>
        <Link className="button primary" to="/onboarding">
          + Create workspace
        </Link>
      </div>
      <ErrorMessage error={joined.error} />
      {joined.isPending ? (
        <Loading />
      ) : (
        <div className="workspace-grid">
          {joined.data?.workspaces.map((ws) => (
            <Link
              to="/w/$workspaceId"
              params={{ workspaceId: ws.id }}
              key={ws.id}
              className="card workspace-card"
            >
              <span className="workspace-icon">{ws.name[0]?.toUpperCase()}</span>
              <h3>{ws.name}</h3>
              <p>
                {ws.description ||
                  (ws.isPersonal ? "Your private space to get started." : "A space for your team.")}
              </p>
              <div className="row">
                <span className="badge">{ws.role}</span>
                <span>{ws.isPersonal ? "Personal" : ws.visibility}</span>
                <span className="push" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <section className="discovery">
        <PageHeading eyebrow="Find your community" title="Discover workspaces">
          Public workspaces are open to join. Their content is available to members.
        </PageHeading>
        <Field
          label="Search public workspaces"
          type="search"
          maxLength={100}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <ErrorMessage error={discover.error ?? join.error} />
        {discover.isPending ? (
          <Loading label="Finding workspaces…" />
        ) : discover.data?.workspaces.length ? (
          <div className="workspace-grid">
            {discover.data.workspaces.map((ws) => (
              <article className="card" key={ws.id}>
                <h3>{ws.name}</h3>
                <p>{ws.description || "An open space for collaboration."}</p>
                <button disabled={join.isPending} onClick={() => join.mutate(ws.id)}>
                  Join workspace <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No public workspaces found</h3>
            <p>Create a workspace or ask your team for an invitation link.</p>
          </div>
        )}
        <div className="actions">
          {offset > 0 && (
            <button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
          )}
          {discover.data?.nextOffset != null && (
            <button onClick={() => setOffset(discover.data!.nextOffset!)}>Next</button>
          )}
        </div>
      </section>
    </main>
  );
}
