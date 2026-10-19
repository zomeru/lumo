import { Brand } from "@lumo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <section className="centered" id="main-content">
      <Brand />
      <h1 className="text-4xl font-semibold tracking-tight">About Lumo</h1>
      <p className="mt-4 text-lg text-slate-600">Built with React, Vite, and TanStack Router.</p>
      <p>
        Lumo’s foundation connects accounts, workspaces and people. Messaging, calls, Drive, office
        editing, work management and HR are planned for later releases.
      </p>
      <Link to="/">Home</Link>
    </section>
  );
}
