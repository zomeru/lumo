import { Button, ErrorMessage } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, TriangleAlert } from "lucide-react";

import { sessionQuery } from "../../lib/api";
import { PublicLayout } from "./public-layout";

export function RouteFailure({ error }: { error?: unknown }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  // The root error boundary can render outside RootLayout's QueryClientProvider.
  const { data: session } = useQuery(sessionQuery(), router.options.context.queryClient);
  const Icon = error ? TriangleAlert : FileQuestion;
  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center sm:py-12">
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-accent text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-medium text-primary">
          {error ? "Let’s get you back to work" : "A small detour"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {error ? "Unable to load this page" : "404 | Page Not Found"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {error
            ? "Something interrupted this page. Try again, or return to a familiar place."
            : "This page may have moved, or the address may be incomplete. Your next step is right here."}
        </p>
        {Boolean(error) && (
          <div className="mt-4 w-full text-left">
            <ErrorMessage error={error} />
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {error ? (
            <Button onClick={() => void router.invalidate()}>Try again</Button>
          ) : (
            <Button
              onClick={() => {
                if (canGoBack) router.history.back();
                else void router.navigate({ to: session ? "/workspaces" : "/" });
              }}
            >
              <ArrowLeft aria-hidden="true" />
              Go Back
            </Button>
          )}
          <Button asChild variant="primary">
            <Link to={session ? "/workspaces" : "/"}>{session ? "Dashboard" : "Home"}</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
