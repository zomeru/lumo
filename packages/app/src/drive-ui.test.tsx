import { driveItemSchema, type DriveItem } from "@lumo/contracts/drive";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, test, vi, type MockInstance } from "vitest";

import type { uploadDriveFile } from "./features/drive/upload";
import { createAppRouter } from "./router";
import { mockApi, teamId, bobId } from "./test/mock-api";
import { selectOption } from "./test/select-option";

const upload = vi.hoisted(() => ({ run: vi.fn<typeof uploadDriveFile>() }));
vi.mock("./features/drive/upload", () => ({ uploadDriveFile: upload.run }));
const folderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  fileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  childId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let server: ReturnType<typeof mockApi>,
  client: QueryClient,
  items: DriveItem[],
  grants: { userId: string; name: string; permission: string; inheritedFrom: string | null }[];
let canWrite = true;
let clickSpy: MockInstance<() => void>;
const base = `/api/v1/workspaces/${teamId}/drive`;
const item = (id: string, name: string, props: Partial<DriveItem> = {}) =>
  driveItemSchema.parse({
    id,
    name,
    originalName: name,
    workspaceId: teamId,
    ownerId: "33333333-3333-4333-8333-333333333333",
    ownerName: "Alice Chen",
    parentId: null,
    kind: "file",
    mimeType: "text/plain",
    size: 10,
    status: "ready",
    checksum: null,
    createdAt: "2026-10-19T00:00:00.000Z",
    updatedAt: "2026-10-19T00:00:00.000Z",
    deletedAt: null,
    starred: false,
    shared: false,
    permission: "owner",
    canManage: true,
    ...props,
  });
beforeEach(() => {
  server = mockApi();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  items = [
    item(folderId, "Design", { kind: "folder", size: 0, mimeType: "" }),
    item(fileId, "notes.txt"),
    item(childId, "inside.txt", { parentId: folderId }),
  ];
  grants = [];
  canWrite = true;
  server.state.overrides.set(`GET ${base}`, (_body, url) => {
    const view = url.searchParams.get("view") ?? "my",
      parent = url.searchParams.get("parentId"),
      q = url.searchParams.get("q") ?? "",
      type = url.searchParams.get("type") ?? "all";
    const rows = items.filter(
      (v) =>
        (view === "trash" ? Boolean(v.deletedAt) : !v.deletedAt) &&
        (view !== "starred" || v.starred) &&
        (q ? v.name.includes(q) : v.parentId === parent) &&
        (type !== "folder" || v.kind === "folder"),
    );
    return server.json({
      items: rows,
      nextOffset: null,
      breadcrumbs: parent ? [{ id: folderId, name: "Design" }] : [],
      canWrite,
      totalSize: 20,
      totalFiles: 2,
    });
  });
  server.state.overrides.set(`POST ${base}/folders`, (body) => {
    const row = item(crypto.randomUUID(), body.name as string, {
      parentId: body.parentId as string | null,
      kind: "folder",
      mimeType: "",
      size: 0,
    });
    items.push(row);
    return server.json(row, 201);
  });
  for (const row of items) {
    server.state.overrides.set(`PATCH ${base}/${row.id}`, (body) => {
      Object.assign(row, body);
      return server.json(row);
    });
    server.state.overrides.set(`PUT ${base}/${row.id}/star`, (body) => {
      row.starred = body.starred as boolean;
      return server.json({ ok: true });
    });
    server.state.overrides.set(`POST ${base}/${row.id}/restore`, () => {
      row.deletedAt = null;
      return server.json({ ok: true });
    });
    server.state.overrides.set(`DELETE ${base}/${row.id}`, () => {
      row.deletedAt = new Date().toISOString();
      return server.json({ ok: true });
    });
    server.state.overrides.set(`DELETE ${base}/${row.id}/permanent`, () => {
      items = items.filter((v) => v.id !== row.id);
      return server.json({ ok: true });
    });
    server.state.overrides.set(`POST ${base}/${row.id}/copy`, (body) => {
      const copy = {
        ...row,
        id: crypto.randomUUID(),
        name: body.name as string,
        parentId: body.parentId as string | null,
      };
      items.push(copy);
      return server.json(copy, 201);
    });
    server.state.overrides.set(`GET ${base}/${row.id}/shares`, () =>
      server.json({ shares: grants }),
    );
    server.state.overrides.set(`PUT ${base}/${row.id}/shares`, (body) => {
      grants = [
        {
          userId: body.userId as string,
          name: "Bob Rivera",
          permission: body.permission as string,
          inheritedFrom: null,
        },
      ];
      return server.json({ ok: true });
    });
    server.state.overrides.set(`DELETE ${base}/${row.id}/shares/${bobId}`, () => {
      grants = [];
      return server.json({ ok: true });
    });
    server.state.overrides.set(`POST ${base}/${row.id}/preview`, () =>
      server.json({
        url: "https://test.s3.us-east-1.amazonaws.com/preview-text",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      }),
    );
    server.state.overrides.set(`POST ${base}/${row.id}/download`, () =>
      server.json({
        url: "https://test.s3.us-east-1.amazonaws.com/file",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      }),
    );
  }
  server.state.overrides.set(
    "GET /preview-text",
    () => new Response("Preview contents <script>rendered as text</script>"),
  );
  server.state.overrides.set(`POST ${base}/archive`, () =>
    server.json({
      url: "https://test.s3.us-east-1.amazonaws.com/archive.zip",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    }),
  );
  upload.run.mockReset();
  vi.stubGlobal("fetch", server.fetch);
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
  clickSpy.mockRestore();
});
async function show(search = "") {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/w/${teamId}/drive${search}`] }),
    client,
  );
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Drive" });
  return { user: userEvent.setup(), router };
}
async function menu(user: ReturnType<typeof userEvent.setup>, name: string, action: string) {
  await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  await user.click(await screen.findByRole("menuitem", { name: action }));
}
test("shared route lists files, switches layout, selects files and downloads a ZIP", async () => {
  const { user } = await show();
  expect(await screen.findByRole("button", { name: "notes.txt" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Drive" })).toHaveAttribute("href", `/w/${teamId}/drive`);
  await user.click(screen.getByRole("button", { name: "Grid view" }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: "Select notes.txt" }));
  await user.click(screen.getByRole("button", { name: "Download 1 selected" }));
  await waitFor(() => expect(clickSpy).toHaveBeenCalledOnce());
  await user.click(screen.getByRole("button", { name: "List view" }));
  await user.click(screen.getByRole("checkbox", { name: "Select all files on this page" }));
  await user.click(screen.getByRole("button", { name: "Download 2 selected" }));
  await waitFor(() =>
    expect(
      server.fetch.mock.calls.some(
        ([url]) => typeof url === "string" && url.endsWith("/drive/archive"),
      ),
    ).toBe(true),
  );
});
test("nested navigation, breadcrumbs and new folders update without refresh", async () => {
  const { user, router } = await show();
  await user.click(await screen.findByRole("button", { name: "Design" }));
  expect(await screen.findByRole("button", { name: "inside.txt" })).toBeVisible();
  expect(router.state.location.search.parentId).toBe(folderId);
  await user.click(screen.getByRole("button", { name: "New folder" }));
  await user.type(screen.getByLabelText("Name"), "Subfolder");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "New folder" }));
  expect(await screen.findByRole("button", { name: "Subfolder" })).toBeVisible();
  await user.click(
    within(screen.getByRole("navigation", { name: "Folder breadcrumbs" })).getByRole("button", {
      name: "My Files",
    }),
  );
  expect(await screen.findByRole("button", { name: "notes.txt" })).toBeVisible();
});
test("stars, search, filters and sorting persist in the route", async () => {
  const { user, router } = await show();
  await user.click(await screen.findByRole("button", { name: "Star notes.txt" }));
  await screen.findByRole("button", { name: "Unstar notes.txt" });
  await user.click(screen.getByRole("button", { name: "Starred" }));
  expect(await screen.findByRole("button", { name: "notes.txt" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Design" })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Search files and folders"), "missing");
  expect(await screen.findByRole("heading", { name: "No matching files" })).toBeVisible();
  await selectOption(user, "File type", "Images");
  await selectOption(user, "Sort by", "Size · largest first");
  expect(router.state.location.search.type).toBe("image");
  expect(router.state.location.search.sort).toBe("size");
});
test("rename, copy and move use the shared dialogs and invalidate the listing", async () => {
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  await menu(user, "notes.txt", "Rename");
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "renamed.txt");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rename" }));
  await screen.findByRole("button", { name: "renamed.txt" });
  await menu(user, "renamed.txt", "Make a copy");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Make a copy" }));
  await screen.findByRole("button", { name: "renamed.txt (copy)" });
  await menu(user, "renamed.txt", "Move");
  await user.click(
    await within(screen.getByRole("dialog")).findByRole("button", { name: "Design" }),
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Move to folder" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "renamed.txt" })).not.toBeInTheDocument(),
  );
  expect(items.find((v) => v.id === fileId)?.parentId).toBe(folderId);
});
test("Trash requires confirmation, supports restore, and permanently deletes with confirmation", async () => {
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  await menu(user, "notes.txt", "Move to Trash");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(items[1]!.deletedAt).toBeNull();
  await menu(user, "notes.txt", "Move to Trash");
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Move to Trash" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "notes.txt" })).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole("button", { name: "Trash" }));
  await screen.findByRole("button", { name: "notes.txt" });
  expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  await menu(user, "notes.txt", "Restore");
  expect(await screen.findByRole("heading", { name: "Trash is empty" })).toBeVisible();
  await user.click(screen.getAllByRole("button", { name: "My Files" })[0]!);
  await screen.findByRole("button", { name: "notes.txt" });
  await menu(user, "notes.txt", "Move to Trash");
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Move to Trash" }),
  );
  await user.click(screen.getByRole("button", { name: "Trash" }));
  await screen.findByRole("button", { name: "notes.txt" });
  await menu(user, "notes.txt", "Delete permanently");
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete permanently",
    }),
  );
  expect(await screen.findByRole("heading", { name: "Trash is empty" })).toBeVisible();
});
test("sharing adds members, edits permissions, revokes direct grants and labels inheritance", async () => {
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  await menu(user, "notes.txt", "Sharing & access");
  await user.type(screen.getByLabelText("Search workspace members"), "Bob");
  await selectOption(user, "Member", "Bob Rivera");
  await selectOption(user, "Permission", "Editor · view, upload and edit");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Share" }));
  await screen.findByLabelText("Access for Bob Rivera");
  await selectOption(user, "Access for Bob Rivera", "Viewer");
  await waitFor(() => expect(grants[0]?.permission).toBe("viewer"));
  await user.click(screen.getByRole("button", { name: "Revoke" }));
  await waitFor(() => expect(grants).toHaveLength(0));
  grants = [{ userId: bobId, name: "Bob Rivera", permission: "viewer", inheritedFrom: folderId }];
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "drive"] });
  expect(await screen.findByText("Inherited from a parent folder")).toBeVisible();
});
test("safe text preview escapes active content and details expose reusable file references", async () => {
  const { user } = await show();
  await user.click(await screen.findByRole("button", { name: "notes.txt" }));
  expect(
    await screen.findByText("Preview contents <script>rendered as text</script>"),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Download original · 10 B" }));
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  await menu(user, "notes.txt", "Details");
  expect(screen.getByText(fileId)).toBeVisible();
  expect(screen.getByText("File reference")).toBeVisible();
});
test("read-only folders hide uploads and mutation errors remain actionable", async () => {
  canWrite = false;
  items[1]!.permission = "viewer";
  items[1]!.canManage = false;
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  expect(screen.getByRole("button", { name: "New folder" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Actions for notes.txt" }));
  expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{Escape}");
  server.state.overrides.set(`PUT ${base}/${fileId}/star`, () =>
    server.error(403, "Access changed"),
  );
  await user.click(screen.getByRole("button", { name: "Star notes.txt" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Access changed");
});
test("API errors hide stale files and offer a retry", async () => {
  server.state.overrides.set(`GET ${base}`, () => server.error(503, "Drive unavailable"));
  const { user } = await show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Drive unavailable");
  expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry loading files" }));
});
test("multiple uploads report progress, show errors, retry and clear finished notifications", async () => {
  upload.run.mockImplementationOnce(async ({ onProgress, onInitialized }) => {
    onInitialized({
      item: items[1]!,
      multipart: false,
      partSize: 8,
      headers: {},
      expiresAt: new Date().toISOString(),
    });
    onProgress(50);
    throw new Error("Temporary upload failure");
  });
  upload.run.mockImplementation(async ({ onProgress }) => {
    onProgress(100);
    return items[1]!;
  });
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  await user.upload(screen.getByLabelText("Upload files"), [
    new globalThis.File(["hello"], "first.txt", { type: "text/plain" }),
    new globalThis.File(["world"], "second.txt", { type: "text/plain" }),
  ]);
  expect(await screen.findByRole("alert")).toHaveTextContent("Temporary upload failure");
  await user.click(screen.getByRole("button", { name: "Retry upload" }));
  await waitFor(() => expect(upload.run).toHaveBeenCalledTimes(3));
  await user.click(screen.getByRole("button", { name: "Clear finished" }));
  expect(screen.queryByRole("complementary", { name: "Uploads" })).not.toBeInTheDocument();
});
test("drag/drop shows an overlay and active uploads can be canceled", async () => {
  upload.run.mockImplementation(async ({ signal, onInitialized }) => {
    onInitialized({
      item: items[1]!,
      multipart: false,
      partSize: 8,
      headers: {},
      expiresAt: new Date().toISOString(),
    });
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), {
        once: true,
      });
    });
  });
  server.state.overrides.set(`POST ${base}/${fileId}/cancel`, () => server.json({ ok: true }));
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  const region = screen.getByRole("region", { name: "Drive" });
  fireEvent.dragOver(region);
  expect(screen.getByText("Drop files to upload")).toBeVisible();
  fireEvent.drop(region, { dataTransfer: { files: [new globalThis.File(["drop"], "drop.txt")] } });
  await user.click(await screen.findByRole("button", { name: "Cancel upload drop.txt" }));
  expect(await screen.findByText("canceled")).toBeVisible();
});

test.each(["image/png", "application/pdf", "application/zip"])(
  "preview safely handles %s",
  async (mimeType) => {
    items[1]!.mimeType = mimeType;
    items[1]!.shared = true;
    const { user } = await show();
    await user.click(await screen.findByRole("button", { name: "notes.txt" }));
    const element =
      mimeType === "application/zip"
        ? await screen.findByText("No preview available for this file type.")
        : mimeType === "application/pdf"
          ? await screen.findByTitle("Preview of notes.txt")
          : await screen.findByRole("img", { name: "notes.txt" });
    expect(element).toBeVisible();
    expect(element.getAttribute("sandbox")).toBe(mimeType === "application/pdf" ? "" : null);
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    await user.click(screen.getByRole("button", { name: "Grid view" }));
    await user.click(screen.getByRole("checkbox", { name: "Select notes.txt" }));
    await user.click(screen.getByRole("checkbox", { name: "Select notes.txt" }));
  },
);
test("text previews surface fetch and download failures and explain truncation", async () => {
  items[1]!.size = 300000;
  server.state.overrides.set(
    "GET /preview-text",
    () => new Response("unavailable", { status: 503 }),
  );
  server.state.overrides.set(`POST ${base}/${fileId}/download`, () =>
    server.error(503, "Download unavailable"),
  );
  const { user } = await show();
  await user.click(await screen.findByRole("button", { name: "notes.txt" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the preview.");
  await user.click(screen.getByRole("button", { name: /Download original/ }));
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  server.state.overrides.set("GET /preview-text", () => new Response("Large text preview"));
  await user.click(screen.getByRole("button", { name: "notes.txt" }));
  expect(
    await screen.findByText("Showing the first 256 KB. Download to read the full file."),
  ).toBeVisible();
});
test("folder picker search works, sharing adds viewers and folder details remain readable", async () => {
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  await menu(user, "notes.txt", "Move");
  await user.type(screen.getByLabelText("Find a destination folder"), "Design");
  await user.click(
    await within(screen.getByRole("dialog")).findByRole("button", { name: "Design" }),
  );
  await user.click(
    within(screen.getByRole("navigation", { name: "Destination folder" })).getByRole("button", {
      name: "My Files",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await menu(user, "Design", "Details");
  expect(screen.getByText("File reference")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  await menu(user, "notes.txt", "Sharing & access");
  await selectOption(user, "Member", "Bob Rivera");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Share" }));
  await screen.findByLabelText("Access for Bob Rivera");
  await selectOption(user, "Access for Bob Rivera", "Editor");
  await waitFor(() => expect(grants[0]?.permission).toBe("editor"));
});
test("pagination clears selections and read-only empty views explain shared content", async () => {
  server.state.overrides.set(`GET ${base}`, (_body, url) =>
    server.json({
      items: url.searchParams.get("offset") === "50" ? [] : items.slice(0, 2),
      nextOffset: url.searchParams.get("offset") === "50" ? null : 50,
      breadcrumbs: [],
      canWrite: false,
      totalSize: 20,
      totalFiles: 2,
    }),
  );
  const { user } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  await user.click(screen.getByRole("checkbox", { name: "Select all files on this page" }));
  await user.click(screen.getByRole("checkbox", { name: "Select all files on this page" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Files shared with you will appear here.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByRole("button", { name: "notes.txt" })).toBeVisible();
  fireEvent.drop(screen.getByRole("region", { name: "Drive" }), {
    dataTransfer: { files: [new globalThis.File(["x"], "x.txt")] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a folder you can upload to.");
});
test("upload queue is bounded, queued transfers cancel and page navigation cancels active work", async () => {
  upload.run.mockImplementation(async ({ signal, onInitialized }) => {
    onInitialized({
      item: items[1]!,
      multipart: false,
      partSize: 8,
      headers: {},
      expiresAt: new Date().toISOString(),
    });
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Canceled")), { once: true });
    });
  });
  server.state.overrides.set(`POST ${base}/${fileId}/cancel`, () => server.json({ ok: true }));
  const { user, router } = await show();
  await screen.findByRole("button", { name: "notes.txt" });
  const input = screen.getByLabelText("Upload files");
  await user.upload(
    input,
    Array.from({ length: 101 }, (_, index) => new globalThis.File(["x"], `too-many-${index}.txt`)),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose up to 100 files per upload.");
  await user.upload(
    input,
    ["one", "two", "three"].map((name) => new globalThis.File(["x"], `${name}.txt`)),
  );
  expect(upload.run).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Cancel upload three.txt" }));
  expect(await screen.findByText("canceled")).toBeVisible();
  fireEvent.dragOver(screen.getByRole("region", { name: "Drive" }));
  fireEvent.dragLeave(screen.getByRole("region", { name: "Drive" }), {
    relatedTarget: document.body,
  });
  await router.navigate({ to: "/w/$workspaceId", params: { workspaceId: teamId } });
  await waitFor(() =>
    expect(
      server.fetch.mock.calls.some(
        ([path]) => typeof path === "string" && path.endsWith("/cancel"),
      ),
    ).toBe(true),
  );
});
