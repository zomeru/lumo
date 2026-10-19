import { Brand } from "@lumo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <section className="mx-auto my-16 grid max-w-xl gap-5 px-6" id="main-content">
      <Brand />
      <h1 className="text-4xl font-semibold tracking-tight">About Lumo</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Built with React, Vite, and TanStack Router.
      </p>
      <p>
        Lumo connects accounts, workspaces and people through messages and meetings. Drive, office
        editing, work management and HR are planned for later releases.
      </p>
      <Link className="text-primary hover:underline" to="/">
        Home
      </Link>
    </section>
  );
}
