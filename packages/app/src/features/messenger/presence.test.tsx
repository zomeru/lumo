import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { mockApi, teamId, bobId } from "../../test/mock-api";
import { MemberAvatar, PresencePreference, PresenceProvider } from "./presence";
let client: QueryClient;
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
});
test("visible avatars share bounded presence reads and DND is an explicit saved preference", async () => {
  const server = mockApi();
  let dnd = false;
  const batches: string[][] = [];
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/presence`, (body) => {
    batches.push(body.userIds as string[]);
    return server.json({ members: [{ userId: bobId, status: dnd ? "dnd" : "online" }] });
  });
  server.state.overrides.set("GET /api/v1/me/presence", () => server.json({ dnd }));
  server.state.overrides.set("PUT /api/v1/me/presence", (body) => {
    dnd = body.dnd as boolean;
    return server.json({ dnd });
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <PresenceProvider workspaceId={teamId}>
        <MemberAvatar userId={bobId} name="Bob" />
        <MemberAvatar userId={bobId} name="Bob again" />
        <PresencePreference />
      </PresenceProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getAllByText("Online")).toHaveLength(2));
  expect(batches.every((ids) => ids.length === 1 && ids[0] === bobId)).toBe(true);
  await user.click(screen.getByRole("button", { name: "Set Do Not Disturb" }));
  await waitFor(() => expect(screen.getAllByText("Do Not Disturb")).toHaveLength(2));
  expect(screen.getByRole("button", { name: "Do Not Disturb · Change" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("availability preference explains loading errors and retries without claiming a failed save", async () => {
  const server = mockApi();
  const unavailable = () =>
    server.json({ error: { code: "UNAVAILABLE", message: "Availability interrupted" } }, 503);
  server.state.overrides.set("GET /api/v1/me/presence", unavailable);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <PresencePreference />
    </QueryClientProvider>,
  );
  await screen.findByText("Availability interrupted");
  expect(screen.getByRole("button", { name: "Set Do Not Disturb" })).toBeDisabled();
  server.state.overrides.set("GET /api/v1/me/presence", () => server.json({ dnd: false }));
  await user.click(screen.getByRole("button", { name: "Retry availability preference" }));
  const toggle = screen.getByRole("button", { name: "Set Do Not Disturb" });
  await waitFor(() => expect(toggle).toBeEnabled());
  server.state.overrides.set("PUT /api/v1/me/presence", unavailable);
  await user.click(toggle);
  await screen.findByText("Availability interrupted");
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  server.state.overrides.set("PUT /api/v1/me/presence", () => server.json({ dnd: true }));
  await user.click(toggle);
  await screen.findByRole("button", { name: "Do Not Disturb · Change" });
  expect(screen.queryByText("Availability interrupted")).not.toBeInTheDocument();
});
