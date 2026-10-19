import { Brand } from "@lumo/ui";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { getPlatform } from "../platform";
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (getPlatform()?.kind === "desktop") throw redirect({ to: "/login" });
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <Link to="/about">About</Link>
          <Link to="/login">Sign in</Link>
          <Link className="button primary" to="/register">
            Get started
          </Link>
        </nav>
      </header>
      <main id="main-content" className="hero">
        <span className="eyebrow">A little less scattered. A lot more connected.</span>
        <h1>Welcome to Lumo</h1>
        <p className="hero-title">
          Make room for
          <br />
          <span>your best work.</span>
        </p>
        <p>
          Your people, your teams, your shared space. Bring everyone together in a workspace that
          feels like yours.
        </p>
        <div className="actions">
          <Link className="button primary" to="/register">
            Create your account <span aria-hidden="true">→</span>
          </Link>
          <Link className="button" to="/login">
            Go to your workspace
          </Link>
        </div>
        <div className="hero-cards">
          <article className="card">
            <span className="feature-icon">01</span>
            <h2>A space for every team</h2>
            <p>Create separate workspaces and move between them with one account.</p>
          </article>
          <article className="card">
            <span className="feature-icon">02</span>
            <h2>Your people, connected</h2>
            <p>Invite your team, find your colleagues, and manage who belongs.</p>
          </article>
          <article className="card">
            <span className="feature-icon">03</span>
            <h2>Private by default</h2>
            <p>Workspace membership and clear roles keep your team’s space protected.</p>
          </article>
        </div>
      </main>
      <footer>One Workspace. Everything Connected.</footer>
    </div>
  );
}
