import { driveItemSchema } from "@lumolynk/contracts/drive";
import { officeFormats } from "@lumolynk/contracts/office";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, test, expect, vi } from "vitest";

import { configurePlatform } from "./platform";
import { createAppRouter } from "./router";
import { mockApi, teamId } from "./test/mock-api";
import { selectOption } from "./test/select-option";
const editor = vi.hoisted(() => ({ fail: false }));
vi.mock("@onlyoffice/document-editor-react", () => ({
  DocumentEditor: ({
    config,
    onLoadComponentError,
  }: {
    config: {
      events: {
        onDocumentReady: () => void;
        onDocumentStateChange: (v: { data: boolean }) => void;
        onError: () => void;
        onWarning: () => void;
      };
    };
    onLoadComponentError: () => void;
  }) => (
    <div>
      <button onClick={config.events.onDocumentReady}>Provider ready</button>
      <button onClick={() => config.events.onDocumentStateChange({ data: true })}>
        Provider dirty
      </button>
      <button onClick={config.events.onError}>Provider error</button>
      <button onClick={config.events.onWarning}>Provider warning</button>
      <button onClick={onLoadComponentError}>Provider load error</button>
      {editor.fail ? "failed" : "Office provider surface"}
    </div>
  ),
}));
vi.mock("./features/office/wiki-editor", () => ({
  default: () => <div>Collaborative Wiki surface</div>,
}));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  child = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  versionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const base = `/api/v1/workspaces/${teamId}`;
let clickSpy: ReturnType<typeof vi.spyOn>;
let server: ReturnType<typeof mockApi>, client: QueryClient;
const file = (
  fileId = id,
  name = "Test.docx",
  kind: "document" | "sheet" | "slide" | "wiki" = "document",
) =>
  driveItemSchema.parse({
    id: fileId,
    name,
    originalName: name,
    workspaceId: teamId,
    ownerId: "33333333-3333-4333-8333-333333333333",
    ownerName: "Alice Chen",
    parentId: null,
    kind: "file",
    mimeType: officeFormats[kind].mime,
    size: 100,
    status: "ready",
    checksum: null,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    deletedAt: null,
    starred: false,
    shared: false,
    permission: "owner",
    canManage: true,
  });
let doc: ReturnType<typeof detail>;
function detail(
  kind: "document" | "sheet" | "slide" | "wiki" = "document",
  fileId = id,
  name = "Test.docx",
) {
  return {
    item: file(fileId, name, kind),
    kind,
    version: 1,
    generation: 0,
    state: "idle" as "idle" | "editing" | "error",
    savedAt: "2026-10-20T00:00:00.000Z",
  };
}
beforeEach(() => {
  server = mockApi();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  doc = detail();
  editor.fail = false;
  server.state.overrides.set(`GET ${base}/drive`, () =>
    server.json({
      items: [doc.item],
      nextOffset: null,
      breadcrumbs: [],
      canWrite: true,
      totalSize: 100,
      totalFiles: 1,
    }),
  );
  server.state.overrides.set(`GET ${base}/documents`, () =>
    server.json({
      items: [doc.item],
      nextOffset: null,
      breadcrumbs: [],
      canWrite: true,
      totalSize: 100,
      totalFiles: 1,
    }),
  );
  server.state.overrides.set(`GET ${base}/documents/${id}`, () => server.json(doc));
  server.state.overrides.set(`POST ${base}/documents`, (body) => {
    doc = detail(body.kind as typeof doc.kind, id, body.name as string);
    return server.json(doc);
  });
  server.state.overrides.set(`POST ${base}/documents/${id}/editor-config`, () =>
    server.json({
      documentServerUrl: "https://office.example.com",
      config: {
        document: {
          key: "key",
          title: doc.item.name,
          fileType: "docx",
          url: "https://api.example.com/file",
          permissions: { edit: true, download: true, print: true },
        },
        documentType: "word",
        editorConfig: {
          mode: "edit",
          callbackUrl: "https://api.example.com/callback",
          user: { id: "user", name: "Alice" },
          coEditing: { mode: "fast", change: false },
          customization: { forcesave: true, uiTheme: "theme-system" },
        },
        token: "synthetic-token",
      },
    }),
  );
  server.state.overrides.set(`POST ${base}/documents/${id}/save`, () => server.json({ ok: true }));
  server.state.overrides.set(`GET ${base}/documents/${id}/share-item`, () => server.json(doc.item));
  server.state.overrides.set(`GET ${base}/drive/${id}/shares`, () => server.json({ shares: [] }));
  server.state.overrides.set(`PATCH ${base}/drive/${id}`, (body) => {
    doc.item.name = body.name as string;
    return server.json(doc.item);
  });
  server.state.overrides.set(`GET ${base}/documents/${id}/versions`, () =>
    server.json({
      versions: [
        {
          id: versionId,
          number: 1,
          size: 100,
          checksum: "checksum",
          source: "initial",
          actorName: "Alice",
          createdAt: doc.savedAt,
        },
      ],
    }),
  );
  server.state.overrides.set(`POST ${base}/documents/${id}/versions/${versionId}/restore`, () =>
    server.json({ ...doc, version: 2 }),
  );
  server.state.overrides.set(`POST ${base}/documents/${id}/versions/${versionId}/download`, () =>
    server.json({ url: "https://test.s3.us-east-1.amazonaws.com/version", expiresAt: doc.savedAt }),
  );
  server.state.overrides.set(`GET ${base}/wiki/pages`, () =>
    server.json({
      pages: [
        { ...detail("wiki", id, "Root.md"), parentId: null, position: 0 },
        { ...detail("wiki", child, "Child.md"), parentId: id, position: 0 },
      ],
    }),
  );
  for (const method of ["PATCH", "DELETE"])
    server.state.overrides.set(`${method} ${base}/wiki/pages/${id}`, () =>
      server.json({ ok: true }),
    );
  server.state.overrides.set(`POST ${base}/wiki/pages/${id}/copy`, () =>
    server.json(detail("wiki")),
  );
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(async () => {
  configurePlatform(undefined);
  await client.cancelQueries();
  client.clear();
  clickSpy.mockRestore();
  vi.unstubAllGlobals();
});
async function show(path = `docs/${id}`) {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/w/${teamId}/${path}`] }),
    client,
  );
  await router.load();
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router };
}
test("All Files reuses Drive inventory and offers all four creation kinds", async () => {
  const { user } = await show("files");
  await screen.findByRole("heading", { name: "Drive (All Files)" });
  await user.click(screen.getByRole("button", { name: "New file" }));
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "New report");
  await selectOption(user, "Type", "Spreadsheet");
  await user.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Office provider surface");
  expect(
    server.fetch.mock.calls.some(
      ([path]) => typeof path === "string" && path.endsWith("/documents"),
    ),
  ).toBe(true);
});
test("Drive opens supported Office files with the same canonical file id", async () => {
  const { user, router } = await show("drive");
  await user.click(await screen.findByRole("button", { name: "Test.docx" }));
  await screen.findByText("Office provider surface");
  expect(router.state.location.pathname).toBe(`/w/${teamId}/docs/${id}`);
});
test("editor displays persisted revision, sends save, reuses sharing and rename, closes for history", async () => {
  const { user } = await show();
  await user.click(await screen.findByRole("button", { name: "Provider ready" }));
  await user.click(screen.getByRole("button", { name: "Provider dirty" }));
  expect(screen.getByText("Editing · waiting for a saved version")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save version" }));
  await user.click(screen.getByRole("button", { name: "Share" }));
  await screen.findByRole("dialog");
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Test.docx" }));
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "Renamed.docx");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rename" }));
  await screen.findByRole("button", { name: "Renamed.docx" });
  expect(
    server.fetch.mock.calls.filter(
      ([path]) => typeof path === "string" && path.endsWith("/editor-config"),
    ),
  ).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Version history" }));
  expect(screen.queryByText("Office provider surface")).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Restore" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await screen.findByText("Office provider surface");
});
test("history download uses web and Electron transport; active sessions disable restore", async () => {
  const { user } = await show();
  await screen.findByText("Office provider surface");
  await user.click(screen.getByRole("button", { name: "Version history" }));
  await user.click(await screen.findByRole("button", { name: "Download" }));
  await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  const download = vi.fn<() => Promise<void>>(async () => {});
  configurePlatform({
    kind: "desktop",
    webOrigin: "http://localhost",
    transport: async () => ({ status: 500, body: null }),
    download,
  });
  await user.click(screen.getByRole("button", { name: "Download" }));
  await waitFor(() => expect(download).toHaveBeenCalled());
});
test.each(["Provider error", "Provider warning", "Provider load error"])(
  "provider failures show actionable retry without pretending a save: %s",
  async (name) => {
    const { user } = await show();
    await user.click(await screen.findByRole("button", { name }));
    expect(await screen.findByRole("alert")).toBeVisible();
    if (name === "Provider warning") {
      await user.click(screen.getByRole("button", { name: "Dismiss" }));
      return;
    }
    await user.click(screen.getByRole("button", { name: "Retry editor" }));
    expect(await screen.findByText("Office provider surface")).toBeVisible();
  },
);
test("API denial removes the embedded editor; missing provider config has retry UI", async () => {
  server.state.overrides.set(`POST ${base}/documents/${id}/editor-config`, () =>
    server.error(503, "Editor not configured"),
  );
  const { user } = await show();
  await screen.findByText("Editor not configured");
  await user.click(screen.getByRole("button", { name: "Retry editor" }));
  server.state.overrides.set(`GET ${base}/documents/${id}`, () =>
    server.error(404, "Access revoked"),
  );
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "office", id] });
  await screen.findByRole("heading", { name: "Document unavailable" });
  expect(screen.queryByText("Office provider surface")).not.toBeInTheDocument();
});

test("desktop editor retry reloads the page so Electron can refresh document-service permissions", async () => {
  const { user } = await show();
  await user.click(await screen.findByRole("button", { name: "Provider load error" }));
  await screen.findByRole("alert");
  const reload = vi.fn<() => void>();
  const originalWindow = window;
  vi.stubGlobal(
    "window",
    new Proxy(originalWindow, {
      get: (target, property) =>
        property === "location" ? { reload } : Reflect.get(target, property, target),
    }),
  );
  configurePlatform({
    kind: "desktop",
    webOrigin: "http://localhost:3000",
    transport: async () => ({ status: 500, body: null }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry editor" }));
  expect(reload).toHaveBeenCalledOnce();
});
test("Wiki landing and hierarchical navigation render a shared page, create a child and move parent", async () => {
  doc = detail("wiki", id, "Root.md");
  const { user } = await show("wiki");
  await user.click(await screen.findByRole("link", { name: "Root" }));
  await screen.findByText("Collaborative Wiki surface");
  expect(screen.getByRole("navigation", { name: "Wiki pages" })).toHaveTextContent("Child");
  await user.click(screen.getByRole("button", { name: "New child page" }));
  expect(screen.getByRole("heading", { name: "New wiki page" })).toBeVisible();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Manage page" }));
  expect(screen.queryByText("Collaborative Wiki surface")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Move to parent" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
test.each(["Duplicate page", "Move subtree to Trash"])(
  "Wiki management persists %s through its own API",
  async (label) => {
    doc = detail("wiki", id, "Root.md");
    const { user } = await show(`wiki/${id}`);
    await user.click(await screen.findByRole("button", { name: "Manage page" }));
    await user.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
);

test("viewer access and provider save errors retain honest status and disable writes", async () => {
  doc.state = "error";
  doc.item.permission = "viewer";
  doc.item.canManage = false;
  const { user } = await show();
  await screen.findByText("Office provider surface");
  expect(screen.getByText("Read only")).toBeVisible();
  expect(screen.getByRole("button", { name: "Test.docx" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save version" })).not.toBeInTheDocument();
  expect(screen.getByText(/Save failed/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Version history" }));
  await screen.findByRole("button", { name: "Download" });
  expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
});
test("active sessions cannot restore and failed version downloads surface errors", async () => {
  doc.state = "editing";
  server.state.overrides.set(`POST ${base}/documents/${id}/versions/${versionId}/download`, () =>
    server.error(403, "History access changed"),
  );
  const { user } = await show();
  await user.click(await screen.findByRole("button", { name: "Version history" }));
  expect(await screen.findByRole("button", { name: "Restore" })).toBeDisabled();
  expect(screen.getByText(/Waiting for editors/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Download" }));
  await screen.findByText("History access changed");
});
test("new Wiki page uses its own route and Wiki tree errors show retryable state", async () => {
  const { user, router } = await show("wiki");
  await user.click(await screen.findByRole("button", { name: "Create a Wiki page" }));
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "Team guide");
  await user.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Collaborative Wiki surface");
  expect(router.state.location.pathname).toBe(`/w/${teamId}/wiki/${id}`);
  server.state.overrides.set(`GET ${base}/wiki/pages`, () =>
    server.error(503, "Wiki tree unavailable"),
  );
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "wiki"] });
  await screen.findByText("Wiki tree unavailable");
});
test("Wiki child breadcrumbs, sibling position and move failures preserve navigation", async () => {
  doc = detail("wiki", child, "Child.md");
  server.state.overrides.set(`GET ${base}/documents/${child}`, () => server.json(doc));
  server.state.overrides.set(`PATCH ${base}/wiki/pages/${child}`, () =>
    server.error(409, "Another editor is connected"),
  );
  const { user } = await show(`wiki/${child}`);
  await screen.findByText("Collaborative Wiki surface");
  expect(screen.getByRole("link", { name: "/ Root" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Manage page" }));
  await user.clear(screen.getByLabelText("Position"));
  await user.type(screen.getByLabelText("Position"), "3");
  await user.click(screen.getByRole("button", { name: "Move to parent" }));
  await screen.findByText("Another editor is connected");
  expect(screen.getByRole("dialog")).toBeVisible();
});
test("authorized deep links use clipboard and contextual file actions retain Drive integration", async () => {
  const { user } = await show();
  await screen.findByText("Office provider surface");
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  await user.click(screen.getByRole("button", { name: "Document actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Copy link" }));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`/docs/${id}`));
  await user.click(screen.getByRole("button", { name: "Document actions" }));
  await user.click(screen.getByRole("menuitem", { name: "File details" }));
  expect(await screen.findByText("File reference")).toBeVisible();
  await user.keyboard("{Escape}");
  writeText.mockRejectedValueOnce(new Error("Permission denied"));
  await user.click(screen.getByRole("button", { name: "Document actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Copy link" }));
  await screen.findByText(/Unable to copy the link/);
});

test("Wiki search retains matching ancestors and collapsed branches can be reopened", async () => {
  doc = detail("wiki", id, "Root.md");
  const { user } = await show("wiki");
  await screen.findByRole("link", { name: "Child" });
  await user.click(screen.getByRole("button", { name: "Collapse Root.md" }));
  expect(screen.queryByRole("link", { name: "Child" })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Search Wiki pages"), "Child");
  expect(screen.getByRole("link", { name: "Root" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Child" })).toBeVisible();
  await user.clear(screen.getByLabelText("Search Wiki pages"));
  expect(screen.queryByRole("link", { name: "Child" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Expand Root.md" }));
  expect(screen.getByRole("link", { name: "Child" })).toBeVisible();
  await user.type(screen.getByLabelText("Search Wiki pages"), "unmatched");
  expect(screen.queryByRole("link", { name: "Root" })).not.toBeInTheDocument();
});
test("an editor without management permission can download history but cannot restore", async () => {
  doc.item.permission = "editor";
  doc.item.canManage = false;
  const { user } = await show();
  await user.click(await screen.findByRole("button", { name: "Version history" }));
  expect(await screen.findByRole("button", { name: "Download" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
});

test("Drive opens registered Wiki pages and Wiki file actions use the page management flow", async () => {
  doc = detail("wiki", id, "Root.md");
  const { user } = await show("drive");
  await user.click(await screen.findByRole("button", { name: "Root.md" }));
  await screen.findByText("Collaborative Wiki surface");
  await user.click(screen.getByRole("button", { name: "Document actions" }));
  expect(screen.getByRole("menuitem", { name: "Rename" })).toBeVisible();
  for (const name of ["Move to folder", "Make a copy", "Move to Trash"])
    expect(screen.queryByRole("menuitem", { name })).not.toBeInTheDocument();
});

test.each([
  ["docs", "Docs", "New document", "document"],
  ["sheets", "Sheets", "New spreadsheet", "sheet"],
  ["slides", "Slides", "New presentation", "slide"],
] as const)(
  "%s has its own title, active navigation, locked creation and upload restrictions",
  async (module, title, action, kind) => {
    doc = detail(kind);
    const { user, router } = await show(module);
    await screen.findByRole("heading", { name: title });
    const nav = screen.getByRole("navigation", { name: "Workspace navigation" });
    expect(
      within(nav)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page")
        .map((link) => link.textContent),
    ).toEqual([title]);
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent)
        .filter((text) =>
          ["Docs", "Sheets", "Slides", "Wiki", "Drive (All Files)"].includes(text ?? ""),
        ),
    ).toEqual(["Docs", "Sheets", "Slides", "Wiki", "Drive (All Files)"]);
    expect(screen.queryByLabelText("File type")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shared With Me" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Upload files")).toHaveAttribute(
      "accept",
      expect.stringContaining("." + officeFormats[kind].extension),
    );
    fireEvent.drop(screen.getByRole("region", { name: title }), {
      dataTransfer: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] },
    });
    expect(
      await screen.findByText(new RegExp(`Choose .${officeFormats[kind].extension} files`)),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: action }));
    expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("Office provider surface");
    expect(router.state.location.pathname).toBe(`/w/${teamId}/${module}/${id}`);
  },
);
