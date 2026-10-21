import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
async function setup() {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ["/register"] }), client);
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Alice Chen");
  await user.type(screen.getByLabelText("Email address"), "alice@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "Strong-password-2026!");
  await user.type(screen.getByLabelText("Confirm Password"), "Strong-password-2026!");
}
async function review(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("link", { name: title }));
  const dialog = screen.getByRole("dialog", { name: title });
  const region = within(dialog).getByRole("region");
  expect(within(dialog).getByRole("button", { name: "Acknowledge document" })).toBeDisabled();
  Object.defineProperties(region, {
    clientHeight: { value: 300 },
    scrollHeight: { value: 900 },
    scrollTop: { value: 599, configurable: true },
  });
  fireEvent.scroll(region);
  await user.click(within(dialog).getByRole("button", { name: "Acknowledge document" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

test("requires matching passwords, separate document acknowledgements and explicit agreement", async () => {
  const { user, router } = await setup();
  const button = screen.getByRole("button", { name: "Create account" });
  expect(button).toBeDisabled();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  await fill(user);
  await user.clear(screen.getByLabelText("Confirm Password"));
  await user.type(screen.getByLabelText("Confirm Password"), "Different-password!");
  await user.tab();
  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
  expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("aria-invalid", "true");
  await user.clear(screen.getByLabelText("Confirm Password"));
  await user.type(screen.getByLabelText("Confirm Password"), "Strong-password-2026!");
  await review(user, "Terms of Use");
  expect(screen.getByRole("checkbox")).toBeDisabled();
  await review(user, "Privacy Policy");
  expect(screen.getByRole("checkbox")).toBeEnabled();
  expect(button).toBeDisabled();
  await user.click(screen.getByRole("checkbox"));
  expect(button).toBeEnabled();
  await user.click(screen.getByRole("link", { name: "Terms of Use" }));
  expect(screen.getByText("You have already acknowledged this version.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByLabelText("Full name")).toHaveValue("Alice Chen");
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("Strong-password-2026!");
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(button).toBeEnabled();
  server.state.overrides.set("POST /api/auth/sign-up/email", (body) => {
    expect(body).toMatchObject({
      confirmPassword: "Strong-password-2026!",
      consent: { accepted: true, termsVersion: "2026-10-21.1", privacyVersion: "2026-10-21.1" },
    });
    return server.error(400, "An account with this email already exists.");
  });
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "An account with this email already exists.",
  );
  expect(router.state.location.pathname).toBe("/register");
  expect(screen.getByRole("checkbox")).toBeChecked();
});

test("closing an unread document preserves form data, returns focus and does not acknowledge", async () => {
  const { user } = await setup();
  await fill(user);
  const trigger = screen.getByRole("link", { name: "Terms of Use" });
  await user.click(trigger);
  const region = screen.getByRole("region");
  Object.defineProperties(region, {
    clientHeight: { value: 200 },
    scrollHeight: { value: 900 },
    scrollTop: { value: 100 },
  });
  fireEvent.scroll(region);
  expect(screen.getByRole("button", { name: "Acknowledge document" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.getByLabelText("Email address")).toHaveValue("alice@example.com");
});

test("rejects programmatic invalid submission and keeps both visibility toggles independent", async () => {
  const { user } = await setup();
  fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  const toggles = screen.getAllByRole("button", { name: "Show password" });
  await user.click(toggles[1]!);
  expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "text");
  expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "Hide password" }));
  expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password");
});

test("acknowledgement also works when the whole document fits without scrolling", async () => {
  const { user } = await setup();
  const callbacks: (() => void)[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  await user.click(screen.getByRole("link", { name: "Privacy Policy" }));
  const region = screen.getByRole("region");
  Object.defineProperties(region, {
    clientHeight: { value: 500 },
    scrollHeight: { value: 500 },
    scrollTop: { value: 0 },
  });
  await act(async () => {
    for (const callback of callbacks) callback();
  });
  expect(screen.getByRole("button", { name: "Acknowledge document" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Acknowledge document" }));
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
