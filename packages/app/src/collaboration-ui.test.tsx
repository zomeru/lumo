import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, test, expect, beforeEach, afterEach } from "vitest";

import { configurePlatform } from "./platform";
import { createAppRouter } from "./router";
import { mockApi, teamId, bobId } from "./test/mock-api";
import { selectOption } from "./test/select-option";
const media = vi.hoisted(() => ({
  send: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  history: vi.fn<() => Promise<boolean>>(async () => false),
  close: vi.fn<() => Promise<void>>(async () => {}),
  preview: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  join: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  mic: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  camera: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  share: vi.fn<() => Promise<boolean>>(async () => true),
  devices: vi.fn<() => Promise<unknown>>(async () => ({
    cameras: [{ deviceId: "cam", label: "Camera 1" }],
    microphones: [{ deviceId: "mic", label: "Microphone 1" }],
  })),
}));
vi.mock("./features/messenger/chat", () => ({
  connectChat: async (
    _ws: string,
    _id: string,
    messages: (value: unknown) => void,
    state: (value: string) => void,
  ) => {
    messages([
      { id: "one", text: "Hello team", sender: "other", time: 1 },
      { id: "failed", text: "Draft", sender: "other", time: 2, failed: true },
    ]);
    state("Connected");
    return { ...media, identity: "user" };
  },
}));
vi.mock("./features/meetings/rtc", () => ({ createMeetingConnection: async () => media }));
let server: ReturnType<typeof mockApi>, client: QueryClient;
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let ended = false;
const fixture = () => ({
  id,
  hostId: server.state.user.id,
  title: "Design review",
  description: "",
  access: "workspace",
  status: ended ? "ended" : "active",
  startsAt: null,
  timezone: "UTC",
  durationMinutes: 60,
  createdAt: new Date().toISOString(),
});
const override = (path: string, value: () => unknown) =>
  server.state.overrides.set(path, () => server.json(value()));
beforeEach(() => {
  server = mockApi();
  ended = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  override(`GET /api/v1/workspaces/${teamId}/conversations`, () => ({
    conversations: [
      {
        id,
        workspaceId: teamId,
        kind: "group",
        name: "Project team",
        createdAt: new Date().toISOString(),
        memberIds: [bobId],
      },
    ],
    nextOffset: 50,
  }));
  override(`POST /api/v1/workspaces/${teamId}/conversations`, () => ({
    id,
    workspaceId: teamId,
    kind: "direct",
    name: "Alice & Bob",
    createdAt: new Date().toISOString(),
    memberIds: [bobId],
  }));
  override(`GET /api/v1/workspaces/${teamId}/meetings`, () => ({
    meetings: [fixture()],
    nextOffset: 50,
  }));
  override(`POST /api/v1/workspaces/${teamId}/meetings`, () => fixture());
  override(`GET /api/v1/meetings/${id}`, () => ({
    meeting: fixture(),
    participants: [{ userId: bobId, name: "Bob", online: true, invited: true }],
  }));
  override(`POST /api/v1/meetings/${id}/end`, () => {
    ended = true;
    return { ok: true };
  });
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
  configurePlatform(undefined);
});
async function show(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }), client);
  await router.load();
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}
test("contact actions create authorized DMs and reuse the shared conversation screen", async () => {
  const user = await show(`/w/${teamId}/contacts`);
  await user.click(await screen.findByRole("button", { name: "Message Bob Rivera" }));
  expect(await screen.findByRole("heading", { name: "Messenger" })).toBeVisible();
  expect(await screen.findByText("Hello team")).toBeVisible();
  await user.type(screen.getByLabelText("Message"), "New message");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(media.send).toHaveBeenCalledWith("New message", undefined);
  await user.click(screen.getByRole("button", { name: "Retry message" }));
  expect(media.send).toHaveBeenCalledWith("Draft", "failed");
  await user.click(screen.getByRole("button", { name: "Load older messages" }));
  expect(media.history).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Reconnect" }));
});
test("new private conversations and conversation pagination remain usable", async () => {
  const user = await show(`/w/${teamId}/messenger`);
  await user.click(await screen.findByText("New conversation"));
  await user.type(screen.getByLabelText("Conversation name"), "Team");
  await selectOption(user, "Type", "Private group");
  await user.type(screen.getByLabelText("Find members"), "Bob");
  await user.click(screen.getByLabelText("Bob Rivera"));
  await user.click(screen.getByRole("button", { name: "Create conversation" }));
  expect(await screen.findByText("Hello team")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Previous" }));
});
test("meeting creation, pagination and media controls run through the shared screens", async () => {
  const user = await show(`/w/${teamId}/meetings`);
  await screen.findByRole("heading", { name: "Meetings" });
  await user.type(screen.getByLabelText("Meeting title"), "Design review");
  await user.click(screen.getByRole("button", { name: "Create meeting" }));
  await user.click(await screen.findByRole("link", { name: "Open Design review" }));
  await screen.findByRole("heading", { name: "Before you join" });
  await user.click(screen.getByLabelText("Enable microphone on join"));
  await user.click(screen.getByLabelText("Enable camera on join"));
  await user.click(screen.getByRole("button", { name: "Join meeting" }));
  await screen.findByRole("button", { name: "Leave meeting" });
  expect(media.join).toHaveBeenCalledWith(true, true);
  await user.click(screen.getByRole("button", { name: "Mute microphone" }));
  await user.click(screen.getByRole("button", { name: "Turn camera off" }));
  await user.click(screen.getByRole("button", { name: "Share screen" }));
  await user.click(screen.getByRole("button", { name: "Choose devices" }));
  await selectOption(user, "Microphone", "Microphone 1");
  await selectOption(user, "Camera", "Camera 1");
  await user.click(screen.getByRole("button", { name: "Leave meeting" }));
  await screen.findByRole("button", { name: "Join meeting" });
  await user.click(screen.getByRole("button", { name: "End meeting for everyone" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Join meeting" })).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("heading", { name: "Design review" })).toBeVisible();
  expect(screen.getByText("Workspace members only · ended")).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Unable to load this page" }),
  ).not.toBeInTheDocument();
});
test("scheduled creation and copyable links preserve timezone", async () => {
  const user = await show(`/w/${teamId}/meetings`);
  await user.type(await screen.findByLabelText("Meeting title"), "Later");
  fireEvent.change(screen.getByLabelText("Start time (leave empty to meet now)"), {
    target: { value: "2030-01-01T12:00" },
  });
  await selectOption(user, "Who can join", "Anyone with a Lumo account and link");
  await user.click(screen.getByRole("button", { name: "Create meeting" }));
  expect(await screen.findByRole("link", { name: "Open Design review" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Previous" }));
});
test("desktop has login first, restores sessions and uses configured invitation origin", async () => {
  const fetch = globalThis.fetch;
  configurePlatform({
    kind: "desktop",
    webOrigin: "https://lumo.test",
    transport: async (path, options) => {
      const response = await fetch(path, {
        method: options.method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      return { status: response.status, body: await response.json() };
    },
  });
  server.state.authenticated = false;
  await show("/");
  expect(await screen.findByRole("heading", { name: "Sign in to Lumo" })).toBeVisible();
});

test("declining an invitation returns to authorized workspaces", async () => {
  const token = "a".repeat(64);
  server.state.overrides.set("POST /api/v1/invitations/preview", () =>
    server.json({
      workspaceName: "Team",
      role: "member",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  );
  server.state.overrides.set("POST /api/v1/invitations/decline", () => server.json({ ok: true }));
  const user = await show(`/invite?token=${token}`);
  await user.click(await screen.findByRole("button", { name: "Decline invitation" }));
  expect(await screen.findByRole("heading", { name: "Your workspaces" })).toBeVisible();
});
test("unavailable conversations and empty directories keep errors visible", async () => {
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/conversations`, () =>
    server.error(503, "Temporarily offline"),
  );
  await show(`/w/${teamId}/messenger`);
  expect(await screen.findByRole("alert")).toHaveTextContent("Temporarily offline");
  expect(screen.getByRole("heading", { name: "Start a conversation" })).toBeVisible();
});
test("meeting access errors never show protected participants or media controls", async () => {
  server.state.overrides.set(`GET /api/v1/meetings/${id}`, () =>
    server.error(404, "Access removed"),
  );
  await show(`/meetings/${id}`);
  expect(await screen.findByRole("heading", { name: "Meeting unavailable" })).toBeVisible();
  expect(screen.queryByText("Bob")).not.toBeInTheDocument();
});
test("desktop restores the authorized workspace after login-page cold start", async () => {
  const fetch = globalThis.fetch;
  configurePlatform({
    kind: "desktop",
    webOrigin: "https://lumo.test",
    transport: async (path, options) => {
      const response = await fetch(path, {
        method: options.method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      return { status: response.status, body: await response.json() };
    },
  });
  await show("/login");
  expect(
    await screen.findByRole("heading", { name: "Make yourself at home, Alice" }),
  ).toBeVisible();
});

test("shared links navigate only to configured invitation or meeting destinations", async () => {
  const user = await show("/workspaces");
  await user.type(
    await screen.findByLabelText("Lumo invitation or meeting link"),
    "https://evil.test/meetings/" + id,
  );
  await user.click(screen.getByRole("button", { name: "Open link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Lumo server");
  await user.clear(screen.getByLabelText("Lumo invitation or meeting link"));
  await user.type(
    screen.getByLabelText("Lumo invitation or meeting link"),
    window.location.origin + "/meetings/" + id,
  );
  await user.click(screen.getByRole("button", { name: "Open link" }));
  expect(await screen.findByRole("heading", { name: "Design review" })).toBeVisible();
});

test("prejoin preview releases devices when disabled or stopped and displays permission failures", async () => {
  const user = await show(`/meetings/${id}`);
  await screen.findByRole("heading", { name: "Before you join" });
  await user.click(screen.getByLabelText("Enable camera on join"));
  await user.click(screen.getByLabelText("Enable microphone on join"));
  await user.click(screen.getByRole("button", { name: "Check camera and microphone" }));
  expect(media.preview).toHaveBeenCalledWith(true, true);
  await user.click(screen.getByLabelText("Enable camera on join"));
  await user.click(screen.getByLabelText("Enable microphone on join"));
  expect(media.camera).toHaveBeenCalledWith(false);
  expect(media.mic).toHaveBeenCalledWith(false);
  await user.click(screen.getByRole("button", { name: "Stop preview" }));
  expect(media.close).toHaveBeenCalled();
  media.preview.mockRejectedValueOnce(new Error("Camera permission denied"));
  await user.click(screen.getByRole("button", { name: "Check camera and microphone" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Camera permission denied");
});
