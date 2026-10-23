import { Loading, ThemeProvider, ToastProvider, TooltipProvider } from "@lumolynk/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { RouteFailure } from "../features/public/route-failure";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  pendingComponent: Loading,
  errorComponent: ({ error }) => (
    <ThemeProvider>
      <RouteFailure error={error} />
    </ThemeProvider>
  ),
  notFoundComponent: () => <RouteFailure />,
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
