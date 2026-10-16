import { canInvite } from "@lumo/contracts/permissions";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ErrorMessage, Loading, PageHeading } from "@/components/ui";
import { membersQuery, sessionQuery, workspaceQuery } from "@/lib/api";

export function HomePage({ workspaceId }: { workspaceId: string }) {
  const [today] = useState(() => new Date());
  const ws = useQuery(workspaceQuery(workspaceId));
  const session = useQuery(sessionQuery());
  const members = useQuery(membersQuery(workspaceId));
  if (!ws.data || !session.data) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat(undefined, {
          dateStyle: "full",
          timeZone: ws.data.timezone,
        }).format(today)}
        title={`Make yourself at home, ${session.data.user.name.split(" ")[0]}`}
      >
        This is {ws.data.name}. A little space to do great things together.
      </PageHeading>
      <div className="actions home-actions">
        <Link className="button primary" to="/w/$workspaceId/contacts" params={{ workspaceId }}>
          Explore contacts <span aria-hidden="true">→</span>
        </Link>
        {canInvite(ws.data.role) && (
          <Link className="button" to="/w/$workspaceId/members" params={{ workspaceId }}>
            Invite your team
          </Link>
        )}
      </div>
      <div className="dashboard-grid">
        <article className="card welcome-card">
          <span className="eyebrow">Your workspace</span>
          <h2>
            Everything starts
            <br />
            with your people.
          </h2>
          <p>
            {ws.data.description ||
              "Build a shared space for your team. Invite colleagues, get to know one another, and make it your own."}
          </p>
          <Link to="/w/$workspaceId/members" params={{ workspaceId }}>
            Meet your team →
          </Link>
        </article>
        <article className="card">
          <span className="feature-icon">♧</span>
          <h2>Connected people</h2>
          <ErrorMessage error={members.error} />
          {members.data && (
            <p className="metric">
              {members.data.members.length}
              {members.data.nextOffset !== null ? "+" : ""}
              <small>workspace member{members.data.members.length === 1 ? "" : "s"}</small>
            </p>
          )}
          <Link to="/w/$workspaceId/contacts" params={{ workspaceId }}>
            Open directory →
          </Link>
        </article>
        <article className="card">
          <span className="feature-icon">◇</span>
          <h2>A space of your own</h2>
          <p>
            <span className="badge">
              {ws.data.isPersonal ? "Personal · private" : ws.data.visibility}
            </span>
          </p>
          <p>Only members can access your workspace’s protected content.</p>
          <Link to="/workspaces">Switch workspace →</Link>
        </article>
      </div>
      <section className="card roadmap-card">
        <div>
          <span className="eyebrow">Growing with your team</span>
          <h2>More ways to work together</h2>
          <p>
            Messaging, meetings, Drive, office editing, work management and HR are coming in later
            releases.
          </p>
        </div>
        <span className="badge">Coming soon</span>
      </section>
    </>
  );
}
