import { workspaceSchema } from "@lumo/contracts";
import { parseLumoLink } from "@lumo/shared";
import {
  Badge,
  Brand,
  Button,
  Card,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  ThemeMenu,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "../../chrome";
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
    <main id="main-content" className="mx-auto max-w-6xl px-5 pt-6 pb-16 sm:px-8">
      <AppHeader className="mb-12 flex items-center justify-between gap-4">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <Button asChild>
            <Link to="/profile">Your profile</Link>
          </Button>
        </div>
      </AppHeader>
      <PageHeading
        eyebrow="Your shared spaces"
        title={`Welcome${session.data ? `, ${session.data.user.name.split(" ")[0]}` : ""}`}
      >
        Choose where you’d like to work today.
      </PageHeading>
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <h2>Open a shared link</h2>
          <form
            className="grid gap-4"
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
            <Button type="submit">Open link</Button>
          </form>
        </section>
      </Card>
      <div className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2>Your workspaces</h2>
        <Button asChild variant="primary">
          <Link to="/onboarding">+ Create workspace</Link>
        </Button>
      </div>
      <ErrorMessage error={joined.error} />
      {joined.isPending ? (
        <Loading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {joined.data?.workspaces.map((ws) => (
            <Card asChild key={ws.id} className="[&>p]:my-3 [&>form]:mt-4">
              <Link
                to="/w/$workspaceId"
                params={{ workspaceId: ws.id }}
                key={ws.id}
                className="group block transition-colors hover:border-primary/40 hover:bg-accent/25"
              >
                <span className="mb-4 flex size-10 items-center justify-center rounded-lg border border-primary/15 bg-accent font-semibold text-accent-foreground">
                  {ws.name[0]?.toUpperCase()}
                </span>
                <h3>{ws.name}</h3>
                <p>
                  {ws.description ||
                    (ws.isPersonal
                      ? "Your private space to get started."
                      : "A space for your team.")}
                </p>
                <div className="flex items-center gap-3">
                  <Badge>{ws.role}</Badge>
                  <span>{ws.isPersonal ? "Personal" : ws.visibility}</span>
                  <ArrowRight className="ml-auto size-4" aria-hidden="true" />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
      <section className="mt-12 border-t pt-8">
        <PageHeading eyebrow="Find your community" title="Discover workspaces">
          Public workspaces are open to join. Their content is available to members.
        </PageHeading>
        <Field
          label="Search public workspaces"
          type="search"
          className="mb-5 max-w-md"
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {discover.data.workspaces.map((ws) => (
              <Card asChild key={ws.id} className="[&>p]:my-3 [&>form]:mt-4">
                <article key={ws.id}>
                  <h3>{ws.name}</h3>
                  <p>{ws.description || "An open space for collaboration."}</p>
                  <Button disabled={join.isPending} onClick={() => join.mutate(ws.id)}>
                    Join workspace <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </article>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-surface px-5 py-10 text-center text-muted-foreground">
            <h3>No public workspaces found</h3>
            <p>Create a workspace or ask your team for an invitation link.</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {offset > 0 && (
            <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
          )}
          {discover.data?.nextOffset != null && (
            <Button onClick={() => setOffset(discover.data!.nextOffset!)}>Next</Button>
          )}
        </div>
      </section>
    </main>
  );
}
