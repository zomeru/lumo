import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { mockApi, teamId, bobId } from "../../test/mock-api";
import { MentionInput } from "./mention-input";
import { encodeMentionDraft, type MentionDraft } from "./mention-text";
const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let server: ReturnType<typeof mockApi>, client: QueryClient;
const submit = vi.fn<(value: ReturnType<typeof encodeMentionDraft>) => void>();
beforeEach(() => {
  server = mockApi();
  submit.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  server.state.overrides.set(
    `GET /api/v1/workspaces/${teamId}/conversations/${conversationId}/members`,
    () =>
      server.json({
        members: [
          { userId: bobId, name: "Bob", image: null, role: "member" },
          { userId: otherId, name: "Bob", image: null, role: "manager" },
        ],
        nextOffset: null,
      }),
  );
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
});
function Harness() {
  const [draft, setDraft] = useState<MentionDraft>({ text: "", mentions: [] });
  return (
    <>
      <MentionInput
        workspaceId={teamId}
        conversationId={conversationId}
        draft={draft}
        onDraft={setDraft}
        aria-label="Message"
        onSubmit={() => submit(encodeMentionDraft(draft))}
      />
      <output data-testid="encoded">{JSON.stringify(encodeMentionDraft(draft))}</output>
    </>
  );
}
function show() {
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
test("keyboard choice distinguishes duplicate names and deletion removes stable identity", async () => {
  const user = show(),
    input = screen.getByLabelText("Message");
  await user.type(input, "Hello @Bo");
  await screen.findAllByRole("option");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(input).toHaveValue("Hello @Bob ");
  expect(screen.getByTestId("encoded")).toHaveTextContent(otherId);
  await user.type(input, "there");
  await user.keyboard("{Enter}");
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ mentionIds: [otherId] }));
  fireEvent.change(input, { target: { value: "Hello @Bo there" } });
  expect(screen.getByTestId("encoded")).toHaveTextContent('"mentionIds":[]');
});
test("Escape preserves draft, IME cannot submit, and Tab selects at the caret", async () => {
  const user = show(),
    input = screen.getByLabelText<HTMLTextAreaElement>("Message");
  await user.type(input, "Hi @Bo");
  await screen.findAllByRole("option");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.compositionStart(input);
  fireEvent.change(input, {
    target: { value: "Hi @Bo remainder", selectionStart: 6, selectionEnd: 6 },
  });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await screen.findAllByRole("option");
  await user.keyboard("{Tab}");
  await waitFor(() => expect(input).toHaveValue("Hi @Bob  remainder"));
  expect(input).toHaveFocus();
  expect(screen.getByTestId("encoded")).toHaveTextContent(bobId);
});
test("plain pasted names have no identity and failed suggestions stay visible without sending", async () => {
  const user = show(),
    input = screen.getByLabelText("Message");
  fireEvent.change(input, { target: { value: "Plain @Bob text", selectionStart: 15 } });
  expect(screen.getByTestId("encoded")).toHaveTextContent('"mentionIds":[]');
  server.state.overrides.set(
    `GET /api/v1/workspaces/${teamId}/conversations/${conversationId}/members`,
    () => server.error(404, "Conversation access changed"),
  );
  await user.clear(input);
  await user.type(input, "@Unavailable");
  expect(await screen.findByRole("alert")).toHaveTextContent("Conversation access changed");
  await user.keyboard("{Enter}");
  expect(submit).not.toHaveBeenCalled();
});
