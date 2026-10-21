import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createAppRouter } from "./router";
import { mockApi, bobId, inviteToken, personalId, teamId } from "./test/mock-api";
import { selectOption } from "./test/select-option";

let server: ReturnType<typeof mockApi>;
let client: QueryClient;
beforeEach(() => {
  server = mockApi();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
});
async function renderRoute(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }), client);
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}
async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email address"), "alice@example.com");
  await user.type(screen.getByLabelText("Password"), "Strong-password-2026!");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}
function expectRouteError(message: string, status: number) {
  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    "%o\n\n%s\n\n%s\n",
    expect.objectContaining({ message, status }),
    expect.stringContaining("The above error occurred in"),
    expect.stringContaining("React will try to recreate this component tree"),
  );
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("Warning: Error in route match: __root__/");
  vi.mocked(console.error).mockClear();
  vi.mocked(console.warn).mockClear();
}

describe("authentication and guards", () => {
  test("redirects anonymous deep links and preserves invitation intent", async () => {
    server.state.authenticated = false;
    const { router } = await renderRoute(`/invite?token=${inviteToken}`);
    expect(await screen.findByRole("heading", { name: "Sign in to Lumo" })).toBeInTheDocument();
    expect(router.state.location.searchStr).toContain(inviteToken);
    expect(screen.queryByRole("group", { name: "Window controls" })).not.toBeInTheDocument();
  });
  test("signs in and restores the last workspace", async () => {
    server.state.authenticated = false;
    const { user } = await renderRoute("/login");
    await signIn(user);
    expect(
      await screen.findByRole("heading", { name: "Make yourself at home, Alice" }),
    ).toBeInTheDocument();
  });
  test("registers an account and opens the personal workspace", async () => {
    const { user } = await renderRoute("/register");
    await user.type(screen.getByLabelText("Full name"), "Alice Chen");
    await user.type(screen.getByLabelText("Email address"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "Strong-password-2026!");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByRole("heading", { name: "Make yourself at home, Alice" }),
    ).toBeInTheDocument();
  });
  test("sign-in errors remain visible and do not enter a workspace", async () => {
    server.state.overrides.set("POST /api/auth/sign-in/email", () =>
      server.error(401, "Invalid email or password"),
    );
    const { user, router } = await renderRoute("/login");
    await signIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(router.state.location.pathname).toBe("/login");
  });
  test("signs in from an invitation link", async () => {
    const { user } = await renderRoute(`/login?invite=${inviteToken}`);
    await signIn(user);
    expect(await screen.findByRole("heading", { name: "You’re invited" })).toBeInTheDocument();
  });
  test("shows unexpected loader errors and a recovery link", async () => {
    server.state.overrides.set("GET /api/v1/me", () =>
      server.error(500, "Temporarily unavailable"),
    );
    await renderRoute("/workspaces");
    expect(
      await screen.findByRole("heading", { name: "Unable to load this page" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Temporarily unavailable");
    expectRouteError("Temporarily unavailable", 500);
  });
});

describe("workspace setup and discovery", () => {
  test("creates a workspace through all three steps and preserves back navigation", async () => {
    const { user } = await renderRoute("/onboarding");
    await user.type(screen.getByLabelText("Company or team name"), "New Studio");
    await selectOption(user, "Industry", "Technology");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await user.type(screen.getByLabelText("Job title"), "Engineer");
    await user.type(screen.getByLabelText("Department"), "Product");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Company or team name")).toHaveValue("New Studio");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(
      await screen.findByRole("heading", { name: "Ready to create New Studio" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Make yourself at home, Alice" }),
    ).toBeInTheDocument();
    expect(server.state.workspaces.at(-1)?.name).toBe("New Studio");
  });
  test("validates time zones before leaving company setup", async () => {
    const { user } = await renderRoute("/onboarding");
    await user.type(screen.getByLabelText("Company or team name"), "Studio");
    await user.clear(screen.getByLabelText("Time zone"));
    await user.type(screen.getByLabelText("Time zone"), "Mars");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
  test("joins a public workspace from discovery", async () => {
    const { user } = await renderRoute("/workspaces");
    expect(await screen.findByRole("heading", { name: "Alice's Workspace" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search public workspaces"), "Public");
    await user.click(await screen.findByRole("button", { name: /Join workspace/ }));
    expect(
      await screen.findByRole("heading", { name: "Make yourself at home, Alice" }),
    ).toBeInTheDocument();
  });
  test("discovery shows empty, error and pagination states", async () => {
    server.state.overrides.set("GET /api/v1/workspaces/discover", (_body, url) =>
      server.json({
        workspaces: [],
        nextOffset: url.searchParams.get("offset") === "0" ? 50 : null,
      }),
    );
    const { user } = await renderRoute("/workspaces");
    expect(
      await screen.findByRole("heading", { name: "No public workspaces found" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Previous" }));
    server.state.overrides.set("GET /api/v1/workspaces/discover", () =>
      server.error(500, "Discovery unavailable"),
    );
    await act(() => client.invalidateQueries({ queryKey: ["discovery"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Discovery unavailable");
  });
});

describe("workspace shell and contacts", () => {
  test("switches workspaces and removes old cache entries", async () => {
    const { user, router } = await renderRoute(`/w/${teamId}/contacts`);
    expect(await screen.findByRole("heading", { name: "Bob Rivera" })).toBeInTheDocument();
    await selectOption(user, "Workspace", "Alice's Workspace");
    await waitFor(() => expect(router.state.location.pathname).toContain(personalId));
    expect(
      await screen.findByRole("heading", { name: "Make yourself at home, Alice" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Acme-only description")).not.toBeInTheDocument();
    expect(client.getQueryCache().findAll({ queryKey: ["workspace", teamId] })).toHaveLength(0);
  });
  test("searches members and shows empty results", async () => {
    const { user } = await renderRoute(`/w/${teamId}/contacts`);
    await screen.findByRole("heading", { name: "Bob Rivera" });
    await user.type(screen.getByLabelText("Search members by name"), "No matching person");
    expect(await screen.findByRole("heading", { name: "No members found" })).toBeInTheDocument();
  });
  test("opens mobile navigation and exposes only implemented actions", async () => {
    const { user } = await renderRoute(`/w/${teamId}`);
    await screen.findByRole("heading", { name: "Make yourself at home, Alice" });
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Messenger/ })).toHaveAttribute(
      "href",
      `/w/${teamId}/messenger`,
    );
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
  test("blocks revoked workspace routes", async () => {
    server.state.overrides.set(`GET /api/v1/workspaces/${teamId}`, () =>
      server.error(404, "Workspace unavailable"),
    );
    await renderRoute(`/w/${teamId}/contacts`);
    expect(
      await screen.findByRole("heading", { name: "Unable to load this page" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bob Rivera")).not.toBeInTheDocument();
    expectRouteError("Workspace unavailable", 404);
  });
  test("hides protected content when membership is revoked during a session", async () => {
    await renderRoute(`/w/${teamId}/contacts`);
    await screen.findByRole("heading", { name: "Bob Rivera" });
    server.state.overrides.set(`GET /api/v1/workspaces/${teamId}`, () =>
      server.error(404, "Access revoked"),
    );
    await act(() => client.invalidateQueries({ queryKey: ["workspace", teamId] }));
    expect(
      await screen.findByRole("heading", { name: "Workspace unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bob Rivera")).not.toBeInTheDocument();
  });
});

describe("member administration", () => {
  test("invites a colleague, copies and revokes the link", async () => {
    const { user } = await renderRoute(`/w/${teamId}/members`);
    await screen.findByRole("heading", { name: "Members" });
    await user.type(screen.getByLabelText("Colleague’s email"), "bob@example.com");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));
    expect((await screen.findByLabelText<HTMLInputElement>("Invitation link")).value).toContain(
      inviteToken,
    );
    fireEvent.focus(screen.getByLabelText("Invitation link"));
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke invitation" }));
    expect(await screen.findByText("No pending invitations.")).toBeInTheDocument();
  });
  test("changes a member role and confirms removal", async () => {
    const { user } = await renderRoute(`/w/${teamId}/members`);
    await screen.findByLabelText("Role for Bob Rivera");
    await selectOption(user, "Role for Bob Rivera", "moderator");
    await user.click(screen.getByRole("button", { name: "Save role" }));
    await waitFor(() =>
      expect(server.state.members.find((m) => m.userId === bobId)?.role).toBe("moderator"),
    );
    await user.click(screen.getByRole("button", { name: "Remove member" }));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "Remove member?" })).getByRole("button", {
        name: "Cancel",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Remove member" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove member" }));
    await waitFor(() => expect(screen.queryByText("Bob Rivera")).not.toBeInTheDocument());
  });
  test("transfers ownership with explicit confirmation", async () => {
    const { user } = await renderRoute(`/w/${teamId}/members`);
    await user.click(await screen.findByRole("button", { name: "Transfer ownership" }));
    await user.click(screen.getByRole("button", { name: "Confirm transfer ownership" }));
    expect(await screen.findByRole("button", { name: "Leave workspace" })).toBeInTheDocument();
  });
  test("members can leave but cannot manage invitations or roles", async () => {
    server.state.workspaces[1]!.role = "member";
    const { user, router } = await renderRoute(`/w/${teamId}/members`);
    expect(await screen.findByRole("heading", { name: "Members" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create invitation" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role for Bob Rivera")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Leave workspace" }));
    await user.click(screen.getByRole("button", { name: "Confirm leave workspace" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/workspaces"));
  });
});

describe("profile, settings and invitations", () => {
  test("updates profile and signs out", async () => {
    const { user, router } = await renderRoute("/profile");
    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Alice Updated");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    expect(server.state.user.name).toBe("Alice Updated");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });
  test("resends verification for an unverified account", async () => {
    server.state.user.emailVerified = false;
    const { user } = await renderRoute("/profile");
    await user.click(screen.getByRole("button", { name: "Send verification email" }));
    expect(await screen.findByRole("button", { name: "Verification link sent" })).toBeDisabled();
  });
  test("validates and saves workspace settings", async () => {
    const { user } = await renderRoute(`/w/${teamId}/settings`);
    await user.clear(screen.getByLabelText("Time zone"));
    await user.type(screen.getByLabelText("Time zone"), "Invalid/Timezone");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Time zone"));
    await user.type(screen.getByLabelText("Time zone"), "Asia/Shanghai");
    await user.clear(screen.getByLabelText("Company or team name"));
    await user.type(screen.getByLabelText("Company or team name"), "New Acme");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Workspace settings saved.")).toBeInTheDocument();
    expect(server.state.workspaces[1]?.timezone).toBe("Asia/Shanghai");
    expect(await screen.findByText("workspace created")).toBeInTheDocument();
  });
  test("personal settings lock visibility and members cannot open settings", async () => {
    const { router } = await renderRoute(`/w/${personalId}/settings`);
    expect(screen.getByLabelText("Visibility")).toBeDisabled();
    server.state.workspaces[1]!.role = "member";
    await act(() =>
      router.navigate({ to: "/w/$workspaceId/settings", params: { workspaceId: teamId } }),
    );
    expect(await screen.findByRole("heading", { name: "Permission required" })).toBeInTheDocument();
  });
  test("accepts an invitation and clears sensitive preview data", async () => {
    const { user, router } = await renderRoute(`/invite?token=${inviteToken}`);
    await user.click(await screen.findByRole("button", { name: "Accept invitation" }));
    await waitFor(() => expect(router.state.location.pathname).toContain(teamId));
    expect(client.getQueryCache().findAll({ queryKey: ["invitation"] })).toHaveLength(0);
  });
  test("unverified users receive verification guidance", async () => {
    server.state.user.emailVerified = false;
    await renderRoute(`/invite?token=${inviteToken}`);
    expect(await screen.findByRole("link", { name: "Open your profile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
  });
  test("expired or wrong-identity invitations reveal no protected details", async () => {
    server.state.overrides.set("POST /api/v1/invitations/preview", () => server.error(404));
    await renderRoute(`/invite?token=${inviteToken}`);
    expect(await screen.findByText(/This invitation is unavailable/)).toBeInTheDocument();
  });
});

describe("failure, pagination and stale-session recovery", () => {
  test("client validation rejects invalid credentials even when native validation is bypassed", async () => {
    await renderRoute("/register?invite=invalid");
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
  test("valid registration invitation context is displayed", async () => {
    await renderRoute(`/register?invite=${inviteToken}`);
    expect(screen.getByText(/Sign in with the email address/)).toBeInTheDocument();
  });
  test("invalid invitation tokens show the unavailable state", async () => {
    server.state.overrides.set("POST /api/v1/invitations/preview", () => server.error(404));
    await renderRoute("/invite?token=bad");
    expect(await screen.findByText(/This invitation is unavailable/)).toBeInTheDocument();
  });
  test("session revocation hides protected data and redirects to sign-in", async () => {
    const { router } = await renderRoute(`/w/${teamId}/contacts`);
    await screen.findByRole("heading", { name: "Bob Rivera" });
    server.state.authenticated = false;
    await act(() => client.invalidateQueries({ queryKey: ["session"] }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(screen.queryByText("Bob Rivera")).not.toBeInTheDocument();
  });
  test("a failed session refresh hides protected content", async () => {
    await renderRoute(`/w/${teamId}/contacts`);
    await screen.findByRole("heading", { name: "Bob Rivera" });
    server.state.overrides.set("GET /api/v1/me", () =>
      server.error(503, "Session service unavailable"),
    );
    await act(() => client.invalidateQueries({ queryKey: ["session"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Session service unavailable");
    expect(screen.queryByText("Bob Rivera")).not.toBeInTheDocument();
  });
  test("contacts paginate without preserving the previous page", async () => {
    server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/members`, (_body, url) =>
      server.json({
        members: url.searchParams.get("offset") === "0" ? server.state.members : [],
        nextOffset: url.searchParams.get("offset") === "0" ? 50 : null,
      }),
    );
    const { user } = await renderRoute(`/w/${teamId}/contacts`);
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "No members found" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByRole("heading", { name: "Bob Rivera" })).toBeInTheDocument();
  });
  test("member administration paginates and searches empty pages", async () => {
    server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/members`, (_body, url) =>
      server.json({
        members: [],
        nextOffset:
          url.searchParams.get("offset") === "0" && !url.searchParams.get("q") ? 50 : null,
      }),
    );
    const { user } = await renderRoute(`/w/${teamId}/members`);
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Previous" }));
    await user.type(screen.getByLabelText("Search members", { exact: true }), "Not here");
    expect(await screen.findByText("No members match your search.")).toBeInTheDocument();
  });
  test("clipboard failures keep a manually copyable link", async () => {
    const { user } = await renderRoute(`/w/${teamId}/members`);
    await user.type(screen.getByLabelText("Colleague’s email"), "bob@example.com");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));
    await screen.findByLabelText("Invitation link");
    const spy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new Error("Unavailable"));
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Select and copy the invitation link above.",
    );
    spy.mockRestore();
  });
  test("members see permission-limited invitations and public leave guidance", async () => {
    server.state.workspaces[1]!.role = "moderator";
    server.state.workspaces[1]!.visibility = "public";
    server.state.invitations.push({
      id: "77777777-7777-4777-8777-777777777777",
      email: "colleague@example.com",
      role: "moderator",
      createdAt: "2026-10-16T00:00:00.000Z",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    await renderRoute(`/w/${teamId}/members`);
    expect(await screen.findByRole("button", { name: "Revoke invitation" })).toBeDisabled();
    expect(screen.getByText(/or by joining again/)).toBeInTheDocument();
  });
  test("member query errors expose a retryable message without stale contacts", async () => {
    server.state.overrides.set(
      `GET /api/v1/workspaces/${teamId}/members`,
      () => new Response("service unavailable", { status: 503 }),
    );
    await renderRoute(`/w/${teamId}/contacts`);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The request failed. Please try again.",
    );
    expect(screen.queryByText("Bob Rivera")).not.toBeInTheDocument();
  });
  test("profile falls back to workspace selection if there is no current workspace", async () => {
    server.state.overrides.set("GET /api/v1/me", () =>
      server.json({ user: server.state.user, activeWorkspaceId: null }),
    );
    const { user, router } = await renderRoute("/login?invite=invalid");
    await signIn(user);
    await waitFor(() => expect(router.state.location.pathname).toBe("/workspaces"));
  });
  test("preloading workspace routes never changes the active workspace", async () => {
    const { router } = await renderRoute("/");
    await router.preloadRoute({ to: "/w/$workspaceId", params: { workspaceId: teamId } });
    expect(
      server.fetch.mock.calls.some(
        ([path, init]) =>
          typeof path === "string" &&
          path.endsWith("/me/active-workspace") &&
          init?.method === "PUT",
      ),
    ).toBe(false);
  });
});

test("section navigation rechecks access without rewriting an unchanged active workspace", async () => {
  const { router } = await renderRoute(`/w/${personalId}`);
  const writes = () =>
    server.fetch.mock.calls.filter(
      ([path, init]) =>
        typeof path === "string" && path.endsWith("/me/active-workspace") && init?.method === "PUT",
    );
  expect(writes()).toHaveLength(0);
  await act(async () => {
    await router.navigate({ to: "/w/$workspaceId/contacts", params: { workspaceId: personalId } });
  });
  expect(writes()).toHaveLength(0);
  expect(
    server.fetch.mock.calls.filter(
      ([path]) => typeof path === "string" && path.endsWith(`/workspaces/${personalId}`),
    ).length,
  ).toBeGreaterThan(1);
  await act(async () => {
    await router.navigate({ to: "/w/$workspaceId", params: { workspaceId: teamId } });
  });
  expect(writes()).toHaveLength(1);
  expect(server.state.activeWorkspaceId).toBe(teamId);
  await act(async () => {
    await router.navigate({ to: "/w/$workspaceId/contacts", params: { workspaceId: teamId } });
  });
  expect(writes()).toHaveLength(1);
});
