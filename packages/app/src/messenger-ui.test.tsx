import { conversationSchema, type Conversation } from "@lumo/contracts/collaboration";
import { messengerMessageSchema, type MessengerMessage } from "@lumo/contracts/messenger";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type * as MessengerApi from "./features/messenger/messenger-api";
import { createAppRouter } from "./router";
import { hrFixture } from "./test/hr-fixture";
import type { mockApi } from "./test/mock-api";
import { teamId, bobId } from "./test/mock-api";
import { selectOption } from "./test/select-option";

vi.mock("./features/messenger/messenger-api", async (importOriginal) => ({
  ...(await importOriginal<typeof MessengerApi>()),
  connectMessenger: (_id: string, _client: QueryClient, state: (value: string) => void) => {
    state("Connected");
    return { close: () => {}, typing: () => {} };
  },
}));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  messageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  extraId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
let server: ReturnType<typeof mockApi>,
  client: QueryClient,
  items: Conversation[],
  messages: MessengerMessage[],
  memberRole: "member" | "manager",
  calls: { path: string; body: Record<string, unknown> }[];
const base = `/api/v1/workspaces/${teamId}`;
const item = (extra: Partial<Conversation> = {}) =>
  conversationSchema.parse({
    id,
    workspaceId: teamId,
    kind: "channel",
    name: "Launch",
    description: "Launch topic",
    slug: "launch",
    visibility: "public",
    joined: true,
    role: "owner",
    memberIds: [bobId],
    memberCount: 2,
    createdAt: new Date().toISOString(),
    ...extra,
  });
beforeEach(() => {
  server = hrFixture().server;
  items = [
    item(),
    item({ id: otherId, name: "Other", visibility: "private", joined: false, role: null }),
  ];
  memberRole = "member";
  calls = [];
  messages = [
    messengerMessageSchema.parse({
      id: messageId,
      workspaceId: teamId,
      conversationId: id,
      senderId: bobId,
      senderName: "Bob",
      senderImage: null,
      nonce: messageId,
      sequence: 1,
      body: "Launch decision",
      parentId: null,
      mentionIds: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      pinnedAt: null,
      replies: 0,
      reactions: [],
      attachments: [],
    }),
  ];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  server.state.overrides.set(`GET ${base}/conversations`, (_body, url) =>
    server.json({
      conversations: items.filter(
        (v) =>
          v.joined &&
          v.name.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase()),
      ),
      nextOffset: url.searchParams.get("offset") === "50" ? null : 50,
    }),
  );
  for (const currentId of [id, otherId]) {
    server.state.overrides.set(`GET ${base}/conversations/${currentId}`, () =>
      server.json(items.find((v) => v.id === currentId)),
    );
    server.state.overrides.set(`GET ${base}/conversations/${currentId}/messages`, () =>
      server.json({ messages, nextBefore: null }),
    );
    server.state.overrides.set(`POST ${base}/conversations/${currentId}/leave`, (body) => {
      items = items.filter((v) => v.id !== currentId);
      calls.push({ path: "leave", body });
      return server.json({ ok: true });
    });
    server.state.overrides.set(`POST ${base}/conversations/${currentId}/preferences`, (body) => {
      calls.push({ path: "preferences", body });
      return server.json({ ok: true });
    });
    server.state.overrides.set(`GET ${base}/conversations/${currentId}/members`, (_body, url) =>
      server.json({
        members: [{ userId: bobId, name: "Bob Rivera", image: null, role: memberRole }],
        nextOffset: url.searchParams.get("offset") === "50" ? null : 50,
      }),
    );
    server.state.overrides.set(`PATCH ${base}/channels/${currentId}`, (body) => {
      items = items.map((v) =>
        v.id === currentId
          ? {
              ...v,
              ...body,
              archivedAt:
                body.archived === undefined
                  ? v.archivedAt
                  : body.archived
                    ? new Date().toISOString()
                    : null,
            }
          : v,
      );
      calls.push({ path: "update", body });
      return server.json(items.find((v) => v.id === currentId));
    });
    server.state.overrides.set(`POST ${base}/channels/${currentId}/members`, (body) => {
      if (body.role === "manager") memberRole = "manager";
      if (body.role === "member") memberRole = "member";
      calls.push({ path: "member", body });
      return server.json({ ok: true });
    });
    server.state.overrides.set(`DELETE ${base}/channels/${currentId}/members/${bobId}`, (body) => {
      calls.push({ path: "remove", body });
      return server.json({ ok: true });
    });
  }
  server.state.overrides.set(`GET ${base}/messenger/search`, (_body, url) =>
    server.json({
      results: url.searchParams.has("before")
        ? []
        : messages.map((m) => ({ ...m, conversationName: "Launch" })),
      nextBefore: url.searchParams.has("before") ? null : 1,
    }),
  );
  server.state.overrides.set(`GET ${base}/messenger/notifications`, (_body, url) =>
    server.json({
      conversations:
        url.searchParams.get("offset") === "50"
          ? []
          : [{ id, name: "Launch", unread: 101, mentions: 1 }],
      totalUnread: 101,
      nextOffset: url.searchParams.get("offset") === "50" ? null : 50,
    }),
  );
  server.state.overrides.set(`GET ${base}/members`, (_body, url) =>
    server.json({
      members: server.state.members,
      nextOffset: url.searchParams.get("offset") === "50" ? null : 50,
    }),
  );
  server.state.overrides.set(`POST ${base}/channels`, (body) => {
    items[0] = item({
      name: String(body.name),
      description: String(body.description),
      visibility: body.visibility as "public" | "private",
    });
    calls.push({ path: "create-channel", body });
    return server.json(items[0], 201);
  });
  server.state.overrides.set(`POST ${base}/conversations`, (body) => {
    items[0] = item({ name: String(body.name), kind: body.kind as "direct" | "group", slug: null });
    calls.push({ path: "create-dm", body });
    return server.json(items[0], 201);
  });
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
});
async function show(selected = false) {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/w/${teamId}/messenger${selected ? `/${id}` : ""}`] }),
    client,
  );
  await router.load();
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}
test("public conversations are immediately usable without browse or join steps", async () => {
  const user = await show(true);
  await screen.findByText("Launch decision");
  expect(screen.queryByRole("button", { name: "Browse channels" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Join channel" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Message")).toBeVisible();
  await user.type(screen.getByLabelText("Find conversations"), "Missing");
  await screen.findByText("No matching conversations.");
  await user.clear(screen.getByLabelText("Find conversations"));
  await user.click(await screen.findByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Previous" }));
  await user.click(screen.getByRole("button", { name: "Conversation settings" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByLabelText("Find members")).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Leave channel" })).not.toBeInTheDocument();
  expect(
    within(dialog).queryByRole("button", { name: "Remove Bob Rivera" }),
  ).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Make manager" })).toBeVisible();
});

test("public creation hides the member picker and discards selections when switching visibility", async () => {
  const user = await show();
  await user.click(await screen.findByRole("button", { name: "Create channel" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByLabelText("Find members")).not.toBeInTheDocument();
  await user.type(within(dialog).getByLabelText("Channel name"), "Everyone");
  await selectOption(user, "Visibility", "Private");
  await user.click(await within(dialog).findByRole("checkbox", { name: "Bob Rivera" }));
  await selectOption(user, "Visibility", "Public");
  expect(within(dialog).queryByLabelText("Find members")).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Create channel" }));
  await screen.findByRole("heading", { name: "# Everyone" });
  expect(calls).toContainEqual({
    path: "create-channel",
    body: { name: "Everyone", description: "", visibility: "public", memberIds: [] },
  });
});

test.each(["owner", "admin", "moderator", "member"] as const)(
  "channel creation controls reflect workspace role %s",
  async (role) => {
    server.state.workspaces.find((ws) => ws.id === teamId)!.role = role;
    await show();
    await screen.findByRole("link", { name: /Launch/ });
    expect(Boolean(screen.queryByRole("button", { name: "Create channel" }))).toBe(
      role !== "member",
    );
  },
);

test("channel creation and settings persist privacy, member roles, topic, preferences and archive state", async () => {
  const user = await show();
  await user.click(await screen.findByRole("button", { name: "Create channel" }));
  let dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Channel name"), "Private planning");
  await user.type(within(dialog).getByLabelText("Description"), "Private topic");
  await selectOption(user, "Visibility", "Private");
  await user.type(within(dialog).getByLabelText("Find members"), "Bob");
  await user.click(await within(dialog).findByRole("checkbox", { name: "Bob Rivera" }));
  await user.click(within(dialog).getByRole("checkbox", { name: "Bob Rivera" }));
  await user.click(within(dialog).getByRole("button", { name: "More workspace members" }));
  await user.click(within(dialog).getByRole("button", { name: "Previous workspace members" }));
  await user.click(within(dialog).getByRole("checkbox", { name: "Bob Rivera" }));
  await user.click(within(dialog).getByRole("button", { name: "Create channel" }));
  await screen.findByRole("heading", { name: "🔒 Private planning" });
  await user.click(screen.getByRole("button", { name: "Conversation settings" }));
  dialog = screen.getByRole("dialog");
  await user.clear(within(dialog).getByLabelText("Description"));
  await user.type(within(dialog).getByLabelText("Description"), "Updated topic");
  await user.click(within(dialog).getByRole("button", { name: "Save channel" }));
  await selectOption(user, "Notifications", "Mentions only");
  await user.click(within(dialog).getByRole("button", { name: "More members" }));
  await user.click(within(dialog).getByRole("button", { name: "Previous members" }));
  await user.click(within(dialog).getByRole("button", { name: "Make manager" }));
  await user.click(await within(dialog).findByRole("button", { name: "Make member" }));
  await user.click(within(dialog).getByRole("button", { name: "Remove Bob Rivera" }));
  await user.click(within(dialog).getByText("Add workspace members"));
  await user.click(await within(dialog).findByRole("checkbox", { name: "Bob Rivera" }));
  await user.click(within(dialog).getByRole("button", { name: "Add selected members" }));
  await user.click(within(dialog).getByRole("button", { name: "Archive channel" }));
  await within(dialog).findByRole("button", { name: "Unarchive channel" });
  expect(items[0]!.description).toBe("Updated topic");
  await user.click(within(dialog).getByRole("button", { name: "Unarchive channel" }));
  await user.click(
    within(dialog).getByRole("button", { name: "Transfer ownership to Bob Rivera" }),
  );
  await user.click(within(dialog).getByRole("button", { name: "Close dialog" }));
  expect(calls.some((v) => v.path === "preferences" && v.body.notifications === "mentions")).toBe(
    true,
  );
});
test("group DM membership changes start a new conversation and leaving returns to the list", async () => {
  server.state.members.push({ ...server.state.members[1]!, userId: extraId, name: "Carol" });
  items[0] = item({ kind: "group", slug: null, memberIds: [bobId, extraId] });
  const user = await show(true);
  await screen.findByText("Launch decision");
  await user.click(screen.getByRole("button", { name: "Conversation settings" }));
  await user.click(
    screen.getByRole("button", { name: "Start a group with different participants" }),
  );
  let dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("combobox", { name: "Type" })).toHaveTextContent(
    "Group direct message",
  );
  await user.type(within(dialog).getByLabelText("Conversation name"), "New private team");
  await user.click(within(dialog).getByRole("button", { name: "Create conversation" }));
  await screen.findByRole("heading", { name: "New private team" });
  await user.click(screen.getByRole("button", { name: "Conversation settings" }));
  dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Leave conversation" }));
  await screen.findByRole("heading", { name: "Start a conversation" });
  expect(calls.some((v) => v.path === "leave")).toBe(true);
});
test("message search navigates results and paginates without exposing private resources", async () => {
  const user = await show(true);
  await screen.findByText("Launch decision");
  await user.click(screen.getByRole("button", { name: "Search messages" }));
  await user.type(screen.getByLabelText("Search workspace messages"), "Launch");
  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.click(await screen.findByRole("button", { name: "More results" }));
  await screen.findByText("No matching messages.");
  await user.click(screen.getByRole("button", { name: "First results" }));
  await user.click(
    await within(screen.getByRole("region", { name: "Message search" })).findByRole("link"),
  );
  expect(await screen.findByRole("link", { name: "Return to latest messages" })).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Return to latest messages" }));
  await user.click(screen.getByRole("button", { name: "Search messages" }));
  await user.click(screen.getByRole("button", { name: "Close search" }));
});
test("notification inbox paginates authorized unread totals and opens a conversation", async () => {
  const user = await show();
  await user.click(
    await screen.findByRole("button", { name: "Messenger notifications, 101 unread messages" }),
  );
  let dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("1 mentions")).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "More notifications" }));
  await screen.findByText("You’re all caught up.");
  await user.click(within(dialog).getByRole("button", { name: "Previous notifications" }));
  await user.click(await within(dialog).findByRole("link"));
  await screen.findByText("Launch decision");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("suggested teammates open DMs in one step and author profiles support focus", async () => {
  const user = await show(true);
  await screen.findByText("Launch decision");
  await user.click(screen.getByRole("button", { name: /Bob Rivera/ }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      path: "create-dm",
      body: { kind: "direct", name: "Bob Rivera", memberIds: [bobId] },
    }),
  );
  const profile = screen.getAllByRole("button", { name: /View .*'s profile/ })[0]!;
  profile.focus();
  await user.keyboard("{Enter}");
  const card = await screen.findByRole("dialog");
  expect(within(card).getByRole("button", { name: "Message" })).toBeVisible();
  expect(within(card).queryByText(/@example.com/)).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("profile hover respects device capability while explicit activation works on touch", async () => {
  let hover = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(hover: hover)" && hover,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const user = await show(true);
  await screen.findByText("Launch decision");
  const profile = screen.getAllByRole("button", { name: /View Bob's profile/ })[0]!;
  await user.hover(profile);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(profile);
  expect(await screen.findByRole("dialog")).toBeVisible();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  hover = true;
  await user.unhover(profile);
  await user.hover(profile);
  expect(await screen.findByRole("dialog")).toBeVisible();
});

test("member cards expose Message to the keyboard and let Tab leave without stealing focus", async () => {
  const user = await show(true);
  await screen.findByText("Launch decision");
  const author = screen.getAllByRole("button", { name: /View Bob's profile/ })[0]!;
  author.focus();
  await user.keyboard("{ArrowDown}");
  const card = await screen.findByRole("dialog", { name: "Bob profile" });
  expect(within(card).getByRole("button", { name: "Message" })).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(author).toHaveFocus());
  await user.keyboard("{Enter}");
  const reopened = await screen.findByRole("dialog");
  expect(within(reopened).getByRole("button", { name: "Message" })).toHaveFocus();
  await user.keyboard("{Tab}");
  await waitFor(() => expect(reopened).not.toBeInTheDocument());
  expect(author).not.toHaveFocus();
});

test("own profile cards show public role and title and Shift+Tab returns to their trigger", async () => {
  messages[0] = {
    ...messages[0]!,
    senderId: server.state.user.id,
    senderName: "Alice",
    senderJobTitle: "Design lead",
    senderRole: "owner",
  };
  const user = await show(true);
  await screen.findByText("Launch decision");
  const author = screen.getAllByRole("button", { name: /View Alice's profile/ })[0]!;
  author.focus();
  await user.keyboard(" ");
  const card = await screen.findByRole("dialog", { name: "Alice profile" });
  expect(within(card).getByText("Design lead · owner")).toBeVisible();
  expect(within(card).queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
  expect(card).toHaveFocus();
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  await waitFor(() => expect(card).not.toBeInTheDocument());
  expect(author).toHaveFocus();
});

test("member card DM failures remain retryable without exposing private fields", async () => {
  messages[0] = { ...messages[0]!, senderRole: "member" };
  server.state.overrides.set(`POST ${base}/conversations`, () =>
    server.error(503, "Direct messages temporarily unavailable"),
  );
  const user = await show(true);
  await screen.findByText("Launch decision");
  const author = screen.getAllByRole("button", { name: /View Bob's profile/ })[0]!;
  author.focus();
  await user.keyboard("{Enter}");
  const card = await screen.findByRole("dialog", { name: "Bob profile" });
  expect(within(card).getByText("member")).toBeVisible();
  await user.keyboard("{Enter}");
  expect(await within(card).findByRole("alert")).toHaveTextContent(
    "Direct messages temporarily unavailable",
  );
  expect(within(card).getByRole("button", { name: "Message" })).toBeEnabled();
  expect(within(card).queryByText(/@example.com/)).not.toBeInTheDocument();
  server.state.overrides.set(`POST ${base}/conversations`, (body) => {
    calls.push({ path: "retry-dm", body });
    return server.json(item({ kind: "direct" }), 201);
  });
  await user.click(within(card).getByRole("button", { name: "Message" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      path: "retry-dm",
      body: { kind: "direct", name: "Bob", memberIds: [bobId] },
    }),
  );
});
