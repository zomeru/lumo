import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createAppRouter } from "../../router";
import { mockApi } from "../../test/mock-api";

let server: ReturnType<typeof mockApi>;
let client: QueryClient;
beforeEach(() => {
  server = mockApi();
  server.state.authenticated = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
});
async function setup(path = "/") {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }), client);
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

test("footer links reach every informational page without authentication or a reload", async () => {
  const { user, router } = await setup();
  for (const [label, path, heading] of [
    ["About Us", "/about", "About Lumo"],
    ["Contact Us", "/contact", "Contact Us"],
    ["Privacy Policy", "/privacy", "Privacy Policy"],
    ["Terms of Use", "/terms", "Terms of Use"],
    ["Cookie Policy", "/cookies", "Cookie Policy"],
    ["Security", "/security", "Security"],
  ]) {
    await user.click(
      within(screen.getByRole("navigation", { name: "Footer navigation" })).getByRole("link", {
        name: label,
      }),
    );
    expect(await screen.findByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  }
});

test("unknown routes render in place and offer safe back navigation without history", async () => {
  const { router, user } = await setup("/unknown/nested/page");
  expect(screen.getByRole("heading", { name: "404 | Page Not Found" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/unknown/nested/page");
  await user.click(screen.getByRole("button", { name: "Go Back" }));
  expect(await screen.findByRole("heading", { name: "Welcome to Lumo" })).toBeInTheDocument();
});

test("authenticated not-found recovery returns to the workspace picker", async () => {
  server.state.authenticated = true;
  const { router } = await setup("/missing");
  expect(await screen.findByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/workspaces",
  );
  expect(router.state.location.pathname).toBe("/missing");
});

test("Go Back uses the router history after internal navigation", async () => {
  const { router, user } = await setup("/about");
  await act(() => router.navigate({ to: "/", hash: "missing" }));
  await act(async () => {
    router.history.push("/not-a-page");
    await router.load();
  });
  await screen.findByRole("heading", { name: "404 | Page Not Found" });
  await user.click(screen.getByRole("button", { name: "Go Back" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
});
