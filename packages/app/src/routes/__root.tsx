import { ErrorMessage, Loading } from "@lumo/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  pendingComponent: Loading,
  errorComponent: ({ error, reset }) => (
    <main className="centered">
      <h1>Unable to load this page</h1>
      <ErrorMessage error={error} />
      <button onClick={reset}>Try again</button>
      <Link to="/workspaces">Your workspaces</Link>
    </main>
  ),
  notFoundComponent: () => (
    <section className="centered">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <Link className="mt-4 inline-block underline" to="/">
        Return home
      </Link>
    </section>
  ),
});

function RootLayout() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Outlet />
    </QueryClientProvider>
  );
}
