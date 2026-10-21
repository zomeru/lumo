import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

import { createAppRouter } from "./router";

async function renderRoute(path = "/") {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

test("renders the application shell and home page", async () => {
  await renderRoute();
  expect(screen.getByRole("heading", { name: "Welcome to Lumo" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
});

test("navigates between file-based routes", async () => {
  const user = userEvent.setup();
  const router = await renderRoute();
  await user.click(screen.getByRole("link", { name: "About Us" }));
  expect(await screen.findByRole("heading", { name: "About Lumo" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/about");
  await user.click(screen.getAllByRole("link", { name: "Home" })[0]!);
  expect(await screen.findByRole("heading", { name: "Welcome to Lumo" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});

test("renders a directly opened route", async () => {
  await renderRoute("/about");
  expect(screen.getByRole("heading", { name: "About Lumo" })).toBeInTheDocument();
});

test("provides a way home from an unknown route", async () => {
  const user = userEvent.setup();
  await renderRoute("/missing");
  expect(screen.getByRole("heading", { name: "404 | Page Not Found" })).toBeInTheDocument();
  await user.click(screen.getAllByRole("link", { name: "Home" })[0]!);
  expect(await screen.findByRole("heading", { name: "Welcome to Lumo" })).toBeInTheDocument();
});
