import {
  Button,
  ErrorMessage,
  Loading,
  ThemeProvider,
  ToastProvider,
  TooltipProvider,
} from "@lumo/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  pendingComponent: Loading,
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto my-16 grid max-w-xl gap-5 px-6">
      <h1>Unable to load this page</h1>
      <ErrorMessage error={error} />
      <Button onClick={reset}>Try again</Button>
      <Link to="/workspaces">Your workspaces</Link>
    </main>
  ),
  notFoundComponent: () => (
    <section className="mx-auto my-16 grid max-w-xl gap-5 px-6">
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
      <ThemeProvider>
        <TooltipProvider delayDuration={400}>
          <ToastProvider>
            <a
              href="#main-content"
              className="fixed top-3 left-4 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0"
            >
              Skip to content
            </a>
            <Outlet />
          </ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
