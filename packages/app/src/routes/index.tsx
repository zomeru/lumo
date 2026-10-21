import { Button, Card, ThemeMenu } from "@lumo/ui";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Building2, Users, ShieldCheck } from "lucide-react";

import { BrandLink } from "../components/brand-link";
import { PublicFooter } from "../features/public/public-layout";
import { getPlatform } from "../platform";
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (getPlatform()?.kind === "desktop") throw redirect({ to: "/login" });
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-6 sm:px-8 [&_nav]:flex [&_nav]:items-center [&_nav]:gap-4 [&_nav]:text-sm">
        <BrandLink to="/" compact />
        <nav aria-label="Main navigation">
          <ThemeMenu />
          <Link className="hidden text-muted-foreground hover:text-foreground sm:block" to="/about">
            About
          </Link>
          <Link to="/login">Sign in</Link>
          <Button asChild variant="primary">
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-5 pt-14 pb-10 sm:px-8 sm:pt-20">
        <span className="mb-3 block text-xs font-medium text-primary">
          A little less scattered. A lot more connected.
        </span>
        <h1>Welcome to Lumo</h1>
        <p className="mt-5 text-5xl leading-[1.08] font-semibold tracking-tight text-foreground sm:text-7xl [&_span]:text-primary">
          Make room for
          <br />
          <span>your best work.</span>
        </p>
        <p className="mt-6 max-w-xl text-base">
          Your people, your teams, your shared space. Bring everyone together in a workspace that
          feels like yours.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild variant="primary">
            <Link to="/register">
              Create your account <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild>
            <Link to="/login">Go to your workspace</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
            <article>
              <span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <h2>A space for every team</h2>
              <p>Create separate workspaces and move between them with one account.</p>
            </article>
          </Card>
          <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
            <article>
              <span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <h2>Your people, connected</h2>
              <p>Invite your team, find your colleagues, and manage who belongs.</p>
            </article>
          </Card>
          <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
            <article>
              <span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <h2>Private by default</h2>
              <p>Workspace membership and clear roles keep your team’s space protected.</p>
            </article>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
