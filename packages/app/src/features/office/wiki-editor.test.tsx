import { EditorView } from "@codemirror/view";
import { act, render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";

import { mockApi, teamId } from "../../test/mock-api";
import WikiEditor from "./wiki-editor";
const network = vi.hoisted(() => ({
  instances: [] as {
    doc: Y.Doc;
    emit: (event: string, value: unknown) => void;
    params: Record<string, string>;
    disconnect: () => void;
    destroy: () => void;
    awareness: { setLocalStateField: (key: string, value: unknown) => void };
  }[],
}));
vi.mock("y-websocket", () => ({
  WebsocketProvider: class {
    doc: Y.Doc;
    awareness: Awareness;
    params: Record<string, string>;
    listeners = new Map<string, ((value: unknown) => void)[]>();
    constructor(
      _url: string,
      _name: string,
      doc: Y.Doc,
      options: { params: Record<string, string> },
    ) {
      this.doc = doc;
      this.awareness = new Awareness(doc);
      this.params = options.params;
      doc.getMap("wiki").set("format", "markdown-v1");
      doc.getText("markdown").insert(0, "Durable Wiki");
      network.instances.push(this);
      queueMicrotask(() => {
        this.emit("status", { status: "connected" });
        this.emit("sync", true);
      });
    }
    on(event: string, callback: (value: unknown) => void) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
    }
    emit(event: string, value: unknown) {
      for (const fn of this.listeners.get(event) ?? []) fn(value);
    }
    disconnect = vi.fn<() => void>(() => {});
    destroy = vi.fn<() => void>(() => this.awareness.destroy());
  },
}));
let server: ReturnType<typeof mockApi>;
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  server = mockApi();
  network.instances = [];
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/wiki/pages/${id}/session`, () =>
    server.json({
      url: "ws://localhost/api/internal/wiki",
      name: id,
      editable: true,
      user: { id: "alice", name: "Alice" },
      token: "scoped-ticket",
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("real CodeMirror renders durable Yjs content and stays bound across awareness rerenders", async () => {
  render(<WikiEditor workspaceId={teamId} id={id} />);
  const surface = await screen.findByRole("textbox", { name: "Wiki content" });
  await waitFor(() => expect(surface).toHaveTextContent("Durable Wiki"));
  expect(surface).toHaveAttribute("contenteditable", "true");
  act(() => network.instances[0]!.awareness.setLocalStateField("user", { name: "Alice" }));
  expect(await screen.findByText("Alice")).toBeVisible();
  expect(surface).toHaveTextContent("Durable Wiki");
  act(() => network.instances[0]!.emit("status", { status: "disconnected" }));
  expect(screen.getByText(/Offline/)).toBeVisible();
  expect(surface).toHaveTextContent("Durable Wiki");
});
test("Wiki transport rejection clears stale content and reconnect rebuilds the editor", async () => {
  const user = userEvent.setup();
  render(<WikiEditor workspaceId={teamId} id={id} />);
  await screen.findByRole("textbox", { name: "Wiki content" });
  act(() => network.instances[0]!.emit("connection-close", { code: 1008 }));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reconnect" }));
  await screen.findByRole("textbox", { name: "Wiki content" });
  expect(network.instances).toHaveLength(2);
  expect(network.instances[0]!.destroy).toHaveBeenCalled();
});
test("ticket failures are visible and read-only sessions disable source editing", async () => {
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/wiki/pages/${id}/session`, () =>
    server.error(403, "Wiki access denied"),
  );
  const user = userEvent.setup();
  render(<WikiEditor workspaceId={teamId} id={id} />);
  await screen.findByText("Wiki access denied");
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/wiki/pages/${id}/session`, () =>
    server.json({
      url: "ws://localhost/api/internal/wiki",
      name: id,
      editable: false,
      user: { id: "bob", name: "Bob" },
      token: "viewer-ticket",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Reconnect" }));
  expect(await screen.findByRole("article", { name: "Wiki preview" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
  expect(await screen.findByRole("textbox", { name: "Wiki content" })).toHaveAttribute(
    "contenteditable",
    "false",
  );
});
test("ticket renewal updates reconnect parameters and closes on authorization failure", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  render(<WikiEditor workspaceId={teamId} id={id} />);
  await screen.findByRole("textbox", { name: "Wiki content" });
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/wiki/pages/${id}/session`, () =>
    server.json({
      url: "ws://localhost/api/internal/wiki",
      name: id,
      editable: true,
      user: { id: "alice", name: "Alice" },
      token: "renewed",
    }),
  );
  await act(() => vi.advanceTimersByTimeAsync(45000));
  expect(network.instances[0]!.params.ticket).toBe("renewed");
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/wiki/pages/${id}/session`, () =>
    server.error(403),
  );
  await act(() => vi.advanceTimersByTimeAsync(45000));
  expect(screen.getByText(/Unable to renew Wiki access/)).toBeVisible();
  expect(network.instances[0]!.disconnect).toHaveBeenCalled();
});

test("temporary renewal failures retain unsynchronized edits and the same editor", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  render(<WikiEditor workspaceId={teamId} id={id} />);
  const surface = await screen.findByRole("textbox", { name: "Wiki content" });
  const view = EditorView.findFromDOM(surface.closest(".cm-editor")!)!;
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: " local draft" } }));
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/wiki/pages/${id}/session`, () =>
    server.error(503),
  );
  await act(() => vi.advanceTimersByTimeAsync(45000));
  expect(screen.getByText(/Offline/)).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Wiki content" })).toBe(surface);
  expect(network.instances[0]!.doc.getText("markdown").toJSON()).toContain("local draft");
  expect(network.instances[0]!.disconnect).not.toHaveBeenCalled();
});

test("formatting keyboard shortcuts update source and local undo works", async () => {
  render(<WikiEditor workspaceId={teamId} id={id} />);
  const surface = await screen.findByRole("textbox", { name: "Wiki content" });
  const view = EditorView.findFromDOM(surface.closest(".cm-editor")!)!;
  for (const [key, expected] of [
    ["b", "**Durable**"],
    ["i", "*Durable*"],
    ["x", "~~Durable~~"],
    ["e", "`Durable`"],
  ]) {
    act(() => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "Durable" },
        selection: { anchor: 0, head: 7 },
      });
      view.focus();
    });
    fireEvent.keyDown(surface, {
      key,
      code: `Key${key!.toUpperCase()}`,
      keyCode: key!.toUpperCase().charCodeAt(0),
      ctrlKey: true,
      shiftKey: key === "x",
    });
    expect(network.instances[0]!.doc.getText("markdown").toJSON()).toBe(expected);
    fireEvent.keyDown(surface, { key: "z", code: "KeyZ", keyCode: 90, ctrlKey: true });
    expect(network.instances[0]!.doc.getText("markdown").toJSON()).toBe("Durable");
  }
});

test("formatting acts on the current selection, synchronizes Markdown and keeps undo across viewing modes", async () => {
  const user = userEvent.setup();
  render(<WikiEditor workspaceId={teamId} id={id} />);
  const surface = await screen.findByRole("textbox", { name: "Wiki content" });
  const view = EditorView.findFromDOM(surface.closest(".cm-editor")!)!;
  act(() => view.dispatch({ selection: { anchor: 0, head: 7 } }));
  await user.click(screen.getByRole("button", { name: "Bold" }));
  expect(network.instances[0]!.doc.getText("markdown").toJSON()).toBe("**Durable** Wiki");
  expect(
    screen.getByRole("article", { name: "Wiki preview" }).querySelector("strong"),
  ).toHaveTextContent("Durable");
  const selection = view.state.selection.main;
  await user.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Wiki content" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("textbox", { name: "Wiki content" })).toBe(surface);
  expect(view.state.selection.main.from).toBe(selection.from);
  expect(screen.queryByRole("article", { name: "Wiki preview" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(network.instances[0]!.doc.getText("markdown").toJSON()).toBe("Durable Wiki");
  await user.click(screen.getByRole("button", { name: "Redo" }));
  await user.click(screen.getByRole("button", { name: "Split" }));
  expect(
    screen.getByRole("article", { name: "Wiki preview" }).querySelector("strong"),
  ).toHaveTextContent("Durable");
});
test("live preview renders GFM and highlighted code while stripping unsafe embedded content", async () => {
  render(<WikiEditor workspaceId={teamId} id={id} />);
  await screen.findByRole("textbox", { name: "Wiki content" });
  const doc = network.instances[0]!.doc,
    text = doc.getText("markdown");
  const value =
    "###### Small heading\n\n~~removed~~\n\n- [x] done\n\n| A | B |\n| --- | --- |\n| one | two |\n\n```js\nconst n = 1;\n```\n\n![safe](https://example.com/image.png)\n\n[bad](javascript:alert(1))\n\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>";
  act(() =>
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, value);
    }, "remote"),
  );
  const preview = await screen.findByRole("article", { name: "Wiki preview" });
  await waitFor(() => expect(preview.querySelector("h6")).toHaveTextContent("Small heading"));
  expect(preview.querySelector("del")).toHaveTextContent("removed");
  expect(preview.querySelector('input[type="checkbox"]')).toBeChecked();
  expect(preview.querySelector("table")).toHaveTextContent("one");
  expect(preview.querySelector("code .hljs-keyword")).toHaveTextContent("const");
  expect(preview.querySelector("img")).toHaveAttribute("src", "https://example.com/image.png");
  expect(preview.querySelector("script, [onerror], a[href^='javascript:']")).toBeNull();
});

test("toolbar inserts lists, tables, headings, links and images with URL validation", async () => {
  const { selectOption } = await import("../../test/select-option");
  const user = userEvent.setup();
  render(<WikiEditor workspaceId={teamId} id={id} />);
  const surface = await screen.findByRole("textbox", { name: "Wiki content" });
  const view = EditorView.findFromDOM(surface.closest(".cm-editor")!)!,
    doc = network.instances[0]!.doc,
    text = doc.getText("markdown");
  for (const name of [
    "Italic",
    "Strikethrough",
    "Bullet list",
    "Numbered list",
    "Task list",
    "Blockquote",
    "Inline code",
    "Code block",
    "Table",
    "Horizontal rule",
  ]) {
    act(() => {
      doc.transact(() => {
        text.delete(0, text.length);
        text.insert(0, "Selected");
      }, "remote");
      view.dispatch({ selection: { anchor: 0, head: 8 } });
    });
    await user.click(screen.getByRole("button", { name }));
    expect(text.toJSON()).not.toBe("Selected");
  }
  act(() => {
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, "Title");
    }, "remote");
    view.dispatch({ selection: { anchor: 0 } });
  });
  await selectOption(user, "Heading", "H3");
  expect(text.toJSON()).toBe("### Title");
  await user.click(screen.getByRole("button", { name: "Insert link" }));
  await user.type(screen.getByLabelText("URL"), "javascript:alert(1)");
  await user.click(screen.getByRole("button", { name: "Insert" }));
  expect(await screen.findByText("Use an HTTP, HTTPS or email link.")).toBeVisible();
  await user.clear(screen.getByLabelText("URL"));
  await user.type(screen.getByLabelText("URL"), "https://example.com");
  await user.clear(screen.getByLabelText("Link text"));
  await user.type(screen.getByLabelText("Link text"), "Example");
  await user.click(screen.getByRole("button", { name: "Insert" }));
  expect(text.toJSON()).toContain("[Example](<https://example.com>)");
  await user.click(screen.getByRole("button", { name: "Insert image" }));
  await user.type(screen.getByLabelText("URL"), "https://example.com/image.png");
  await user.type(screen.getByLabelText("Alternative text"), "Image");
  await user.click(screen.getByRole("button", { name: "Insert" }));
  expect(text.toJSON()).toContain("![Image]");
  await user.click(screen.getByRole("button", { name: "Insert link" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
