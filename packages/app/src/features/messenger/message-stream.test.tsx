import { messengerMessageSchema, type MessengerMessage } from "@lumo/contracts/messenger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, test, vi } from "vitest";

import { mockApi, teamId, bobId } from "../../test/mock-api";
import { MessageStream } from "./message-stream";

// The virtualized third-party grid needs layout; real search/categories/tones are verified in Chromium.
vi.mock("emoji-picker-react", () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (data: { emoji: string }) => void }) => (
    <div>
      <input
        role="combobox"
        aria-label="Type to search for an emoji"
        aria-expanded="true"
        aria-controls="emoji-test-grid"
      />
      <div id="emoji-test-grid">
        <button aria-label="thumbs up" onClick={() => onEmojiClick({ emoji: "👍" })}>
          👍
        </button>

        <button aria-label="party popper" onClick={() => onEmojiClick({ emoji: "🎉" })}>
          🎉
        </button>
      </div>
    </div>
  ),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
const filesMock = vi.hoisted(() => ({
  upload: vi.fn<(...args: unknown[]) => Promise<{ id: string; name: string }>>(async () => ({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "notes.txt",
  })),
  download: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
}));
vi.mock("./messenger-files", () => ({
  uploadAttachment: filesMock.upload,
  downloadAttachment: filesMock.download,
}));
const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  messageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  nonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let restoreFocus = () => {};
let server: ReturnType<typeof mockApi>,
  client: QueryClient,
  rows: MessengerMessage[],
  reads: string[];
const path = `/api/v1/workspaces/${teamId}/conversations/${conversationId}`;
function fixture() {
  return messengerMessageSchema.parse({
    id: messageId,
    nonce,
    sequence: 1,
    workspaceId: teamId,
    conversationId,
    senderId: server.state.user.id,
    senderName: "Alice",
    senderImage: null,
    body: "Existing message",
    parentId: null,
    mentionIds: [],
    createdAt: "2026-10-22T08:00:00.000Z",
    editedAt: null,
    deletedAt: null,
    pinnedAt: null,
    replies: 0,
    reactions: [],
    attachments: [],
  });
}
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  server = mockApi();
  rows = [fixture()];
  reads = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  server.state.overrides.set(`GET ${path}/messages`, () =>
    server.json({ messages: rows, nextBefore: null }),
  );
  server.state.overrides.set(`POST ${path}/cursor`, (body) => {
    reads.push(String(body.messageId));
    return server.json({ ok: true });
  });
  server.state.overrides.set(`GET ${path}/members`, () =>
    server.json({
      members: [{ userId: bobId, name: "Bob", image: null, role: "member" }],
      nextOffset: null,
    }),
  );
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
  restoreFocus();
  restoreFocus = () => {};
});
function show(
  props: {
    canPost?: boolean;
    parentId?: string;
    around?: string;
    pinned?: boolean;
    files?: boolean;
  } = {},
) {
  render(
    <QueryClientProvider client={client}>
      <MessageStream
        workspaceId={teamId}
        conversationId={conversationId}
        canPost
        {...props}
        onReply={() => {}}
        onTyping={() => {}}
      />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
test("failed optimistic sends retry the same nonce and mentions are persisted", async () => {
  const sent: Record<string, unknown>[] = [];
  let failed = false;
  server.state.overrides.set(`POST ${path}/messages`, (body) => {
    sent.push(body);
    if (!failed) {
      failed = true;
      return server.error(503, "Offline");
    }
    const row = {
      ...fixture(),
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      nonce: String(body.nonce),
      body: String(body.body),
      mentionIds: body.mentionIds as string[],
      sequence: 2,
    };
    rows = [...rows, row];
    return server.json(row, 201);
  });
  const user = show();
  await screen.findByText("Existing message");
  await user.type(screen.getByLabelText("Message"), "@Bo");
  await user.click(await screen.findByRole("option", { name: /Bob/ }));
  await user.type(screen.getByLabelText("Message"), "Retried message");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("Offline");
  await user.click(screen.getByRole("button", { name: "Retry message" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Retry message" })).not.toBeInTheDocument(),
  );
  expect(sent).toHaveLength(2);
  expect(sent[0]?.nonce).toBe(sent[1]?.nonce);
  expect(sent[1]?.mentionIds).toEqual([bobId]);
  expect(await screen.findAllByText(/Retried message/)).toHaveLength(1);
});
test("read cursors wait for visibility and focus and are never sent for pinned or search views", async () => {
  let focused = false;
  const focusMock = vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
  restoreFocus = () => focusMock.mockRestore();
  show();
  await screen.findByText("Existing message");
  expect(reads).toEqual([]);
  focused = true;
  window.dispatchEvent(new Event("focus"));
  await waitFor(() => expect(reads).toEqual([messageId]));
  window.dispatchEvent(new Event("focus"));
  expect(reads).toHaveLength(1);
});
test("public non-members can read without composer or mutation controls", async () => {
  show({ canPost: false });
  await screen.findByText("Existing message");
  expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  expect(screen.queryByText("Message actions")).not.toBeInTheDocument();
});
test("sender edits, reactions, pins and deletes use real API command shapes", async () => {
  const calls: unknown[] = [];
  for (const [method, suffix] of [
    ["PATCH", ""],
    ["DELETE", ""],
    ["POST", "/reaction"],
    ["POST", "/pin"],
  ])
    server.state.overrides.set(
      `${method} /api/v1/workspaces/${teamId}/messages/${messageId}${suffix}`,
      (body) => {
        calls.push({ method, suffix, body });
        if (method === "PATCH")
          rows = [{ ...rows[0]!, body: String(body.body), editedAt: new Date().toISOString() }];
        return server.json({ ok: true });
      },
    );
  const user = show();
  await screen.findByText("Existing message");
  await user.click(screen.getByRole("button", { name: "Add reaction" }));
  await user.type(
    await screen.findByRole("combobox", { name: "Type to search for an emoji" }),
    "thumbs up",
  );
  await user.click(await screen.findByRole("button", { name: /^thumbs up$/ }));
  await user.click(screen.getByRole("button", { name: "Pin" }));
  await user.click(screen.getByRole("button", { name: "More message actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Edit message" }));
  let dialog = screen.getByRole("dialog");
  await user.clear(within(dialog).getByLabelText("Edit message body"));
  await user.type(within(dialog).getByLabelText("Edit message body"), "Edited body");
  await user.click(within(dialog).getByRole("button", { name: "Save message" }));
  await screen.findByText("Edited body");
  await user.click(screen.getByRole("button", { name: "More message actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete message" }));
  dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Delete message" }));
  await waitFor(() => expect(calls).toHaveLength(4));
  expect(calls).toContainEqual({
    method: "PATCH",
    suffix: "",
    body: { body: "Edited body", mentionIds: [] },
  });
});

test.each([{ pinned: true }, { files: true }, { around: messageId }])(
  "reading a filtered history does not advance the durable cursor: %j",
  async (props) => {
    const focusMock = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    restoreFocus = () => focusMock.mockRestore();
    show(props);
    await screen.findByText("Existing message");
    window.dispatchEvent(new Event("focus"));
    expect(reads).toEqual([]);
  },
);

test("older history, thread sends and scroll-to-latest remain usable", async () => {
  server.state.overrides.set(`GET ${path}/messages`, (_body, url) =>
    server.json({
      messages: url.searchParams.has("before")
        ? [
            {
              ...fixture(),
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              sequence: 0,
              body: "Older history",
              createdAt: "2026-10-21T08:00:00.000Z",
            },
          ]
        : rows,
      nextBefore: url.searchParams.has("before") ? null : 1,
    }),
  );
  const sent: Record<string, unknown>[] = [];
  server.state.overrides.set(`POST ${path}/messages`, (body) => {
    sent.push(body);
    return server.json(
      { ...fixture(), body: body.body, nonce: body.nonce, parentId: messageId },
      201,
    );
  });
  const user = show({ parentId: messageId });
  await screen.findByText("Existing message");
  const list = screen.getByRole("list", { name: "Thread messages" });
  Object.defineProperty(list, "scrollTo", { value: () => {} });
  await user.click(screen.getByRole("button", { name: "Load older messages" }));
  await screen.findByText("Older history");
  await user.click(screen.getByRole("button", { name: "Latest messages" }));
  await user.type(screen.getByLabelText("Message"), "A reply{Shift>}{Enter}{/Shift}Second line");
  await user.keyboard("{Enter}");
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toMatchObject({ parentId: messageId, body: "A reply\nSecond line" });
  fireEvent.scroll(list, { target: { scrollTop: 0 } });
});
test("attachment selection, removal, download errors, deleted messages and existing reactions have working states", async () => {
  rows = [
    {
      ...fixture(),
      senderId: bobId,
      senderName: "Bob",
      pinnedAt: new Date().toISOString(),
      editedAt: new Date().toISOString(),
      mentionIds: [bobId],
      replies: 2,
      reactions: [{ emoji: "👍", count: 1, mine: true }],
      attachments: [
        {
          id: messageId,
          name: "existing.txt",
          size: 4,
          mimeType: "text/plain",
          scanStatus: "unscanned",
        },
      ],
    },
  ];
  filesMock.download.mockRejectedValueOnce(new Error("File access removed"));
  const commands: unknown[] = [];
  for (const action of ["reaction", "pin"])
    server.state.overrides.set(
      `POST /api/v1/workspaces/${teamId}/messages/${messageId}/${action}`,
      (body) => {
        commands.push(body);
        return server.json({ ok: true });
      },
    );
  const user = show();
  await screen.findByText("Existing message");
  await user.click(screen.getByRole("button", { name: "existing.txt · Download" }));
  await screen.findByText("File access removed");
  await user.click(screen.getByRole("button", { name: "👍 1" }));
  await user.click(screen.getByRole("button", { name: "Unpin" }));
  await waitFor(() => expect(commands).toContainEqual({ emoji: "👍", active: false }));
  await user.upload(
    screen.getByLabelText("Attach file"),
    new File(["file"], "notes.txt", { type: "text/plain" }),
  );
  await user.click(await screen.findByRole("button", { name: "Remove notes.txt" }));
  expect(screen.queryByRole("button", { name: "Remove notes.txt" })).not.toBeInTheDocument();
  rows = [
    { ...rows[0]!, deletedAt: new Date().toISOString(), body: "", attachments: [], reactions: [] },
  ];
  await client.invalidateQueries();
  await screen.findByText("Message deleted");
  expect(screen.queryByText("Message actions")).not.toBeInTheDocument();
});
test("history authorization failures clear content and keep the error visible", async () => {
  server.state.overrides.set(`GET ${path}/messages`, () =>
    server.error(404, "History access removed"),
  );
  show();
  await screen.findByText("History access removed");
  expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
});

test("composer inserts emoji at the selection, retains focus and sends persisted text", async () => {
  const sent: Record<string, unknown>[] = [];
  server.state.overrides.set(`POST ${path}/messages`, (body) => {
    sent.push(body);
    return server.json({ ...fixture(), ...body, id: crypto.randomUUID(), sequence: 2 }, 201);
  });
  const user = show();
  await screen.findByText("Existing message");
  const input = screen.getByLabelText<HTMLTextAreaElement>("Message");
  await user.type(input, "Hello team");
  input.setSelectionRange(6, 10);
  await user.click(screen.getByRole("button", { name: "Emoji" }));
  await user.type(
    await screen.findByRole("combobox", { name: "Type to search for an emoji" }),
    "party popper",
  );
  await user.click(await screen.findByRole("button", { name: "party popper" }));
  expect(input).toHaveValue("Hello 🎉");
  await waitFor(() => expect(input).toHaveFocus());
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]?.body).toBe("Hello 🎉");
});

test("message grouping retains date and unread boundaries", async () => {
  rows = [
    { ...fixture(), sequence: 1 },
    { ...fixture(), id: crypto.randomUUID(), sequence: 2, createdAt: "2026-10-22T08:01:00.000Z" },
    { ...fixture(), id: crypto.randomUUID(), sequence: 3, createdAt: "2026-10-23T08:01:00.000Z" },
  ];
  show();
  const history = await screen.findByRole("list", { name: "Messages" });
  await waitFor(() => expect(history.querySelectorAll("li[data-message-id]")).toHaveLength(3));
  const items = history.querySelectorAll("li[data-message-id]");
  expect(items[0]).not.toHaveAttribute("data-grouped");
  expect(items[1]).toHaveAttribute("data-grouped", "true");
  expect(items[2]).not.toHaveAttribute("data-grouped");
  expect(within(history).getByText("Oct. 23, 2026")).toBeVisible();
});

test("threads keep original context separate from replies and show aggregated participant names", async () => {
  const parent = {
    ...fixture(),
    body: "Original decision",
    replies: 2,
    replyParticipants: [{ userId: bobId, name: "Bob", image: null }],
  };
  server.state.overrides.set(`GET ${path}/messages`, () =>
    server.json({
      parent,
      messages: [
        {
          ...fixture(),
          id: crypto.randomUUID(),
          parentId: messageId,
          body: "A reply",
          sequence: 2,
        },
      ],
      nextBefore: null,
    }),
  );
  show({ parentId: messageId });
  expect(await screen.findByText("Original decision")).toBeVisible();
  expect(screen.getByText("Original message")).toBeVisible();
  expect(screen.getByText("Replies")).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Original message" })).getByText("Original decision"),
  ).toBeVisible();
  expect(
    within(screen.getByRole("list", { name: "Thread messages" })).queryByText("Original decision"),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText("A reply")).toHaveLength(1);
});
