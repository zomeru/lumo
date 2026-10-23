import { canInvite } from "@lumolynk/contracts/permissions";
import { formatDate } from "@lumolynk/shared/date-time";
import { Badge, Button, Card, ErrorMessage, Loading, PageHeading, Skeleton } from "@lumolynk/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  MessageSquare,
  Plus,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { useState } from "react";

import { AppAvatar as Avatar } from "../../components/app-avatar";
import { membersQuery, sessionQuery, workspaceQuery } from "../../lib/api";

export function HomePage({ workspaceId }: { workspaceId: string }) {
  const [today] = useState(() => new Date());
  const ws = useQuery(workspaceQuery(workspaceId));
  const session = useQuery(sessionQuery());
  const members = useQuery(membersQuery(workspaceId));
  if (!ws.data || !session.data) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow={formatDate(today, ws.data.timezone)}
        title={`Make yourself at home, ${session.data.user.name.split(" ")[0]}`}
        actions={
          canInvite(ws.data.role) && (
            <Button asChild variant="primary">
              <Link to="/w/$workspaceId/members" params={{ workspaceId }}>
                <Plus aria-hidden="true" />
                Invite your team
              </Link>
            </Button>
          )
        }
      >
        This is {ws.data.name}. A little space to do great things together.
      </PageHeading>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card className="flex flex-col justify-between gap-8 border-primary/15 bg-accent/40 sm:p-7">
          <div>
            <span className="mb-4 flex items-center gap-2 text-xs font-medium text-primary">
              <Building2 className="size-4" aria-hidden="true" />
              YOUR WORKSPACE
            </span>
            <h2 className="max-w-md text-2xl leading-snug sm:text-3xl">
              Everything starts
              <br />
              with your people.
            </h2>
            <p className="mt-3 max-w-md">
              {ws.data.description ||
                "Build a shared space for your team. Invite colleagues, get to know one another, and make it your own."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex -space-x-2" aria-hidden="true">
              {(members.data?.members ?? []).slice(0, 4).map((member) => (
                <Avatar
                  key={member.userId}
                  name={member.name}
                  src={member.image ?? undefined}
                  className="border-2 border-surface"
                />
              ))}
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link to="/w/$workspaceId/people" params={{ workspaceId }}>
                Explore people
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Card>
        <div className="grid gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Connected people</h2>
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <ErrorMessage error={members.error} />
            {members.isPending ? (
              <Skeleton className="my-4 h-10 w-16" />
            ) : (
              members.data && (
                <div className="my-4 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {members.data.members.length}
                    {members.data.nextOffset !== null ? "+" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    workspace member{members.data.members.length === 1 ? "" : "s"}
                  </span>
                </div>
              )
            )}
            <Link
              className="inline-flex items-center gap-2 text-xs font-medium text-primary"
              to="/w/$workspaceId/people"
              params={{ workspaceId }}
            >
              Meet your team
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">A space of your own</h2>
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <Badge className="capitalize">
              {ws.data.isPersonal ? "Personal · private" : ws.data.visibility}
            </Badge>
            <p className="mt-3 text-xs">
              Only members can access your workspace’s protected content.
            </p>
          </Card>
        </div>
      </div>
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm">Keep things moving</h2>
          <span className="text-xs text-muted-foreground">Made for working together</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            to="/w/$workspaceId/messenger"
            params={{ workspaceId }}
            className="group flex items-start gap-3 rounded-lg border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <MessageSquare className="size-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="text-sm">Start a conversation</strong>
              <small className="mt-1">Bring your next idea to the team.</small>
            </span>
            <ArrowUpRight
              className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/w/$workspaceId/meetings"
            params={{ workspaceId }}
            className="group flex items-start gap-3 rounded-lg border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <Video className="size-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="text-sm">Make time to connect</strong>
              <small className="mt-1">View meetings or plan a catch-up.</small>
            </span>
            <ArrowUpRight
              className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/workspaces"
            className="group flex items-start gap-3 rounded-lg border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="text-sm">Find your shared spaces</strong>
              <small className="mt-1">Your teams, under one account.</small>
            </span>
            <ArrowUpRight
              className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-5 py-4">
        <Badge>Coming soon</Badge>
        <p className="flex-1 text-xs">More ways to work together: tasks, projects and hiring.</p>
      </div>
    </>
  );
}
