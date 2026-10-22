import { type MessengerMessage } from "@lumo/contracts/messenger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { configurePlatform } from "../../platform";
import { mockApi, teamId } from "../../test/mock-api";
import { AttachmentList } from "./attachment-list";

type Attachment = MessengerMessage["attachments"][number];
let client: QueryClient, server: ReturnType<typeof mockApi>;
const url = "https://bucket.s3.us-east-1.amazonaws.com/media";
const image: Attachment = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Photo.png",
  mimeType: "image/png",
  size: 2048,
  scanStatus: "unscanned",
};
const gif: Attachment = {
  ...image,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Animation.gif",
  mimeType: "image/gif",
};
const video: Attachment = {
  ...image,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Clip.webm",
  mimeType: "video/webm",
};
const result = () => ({ url, expiresAt: new Date(Date.now() + 120000).toISOString() });
const path = (id: string) => `/api/v1/workspaces/${teamId}/messenger/attachments/${id}/preview`;
function show(files: Attachment[]) {
  render(
    <QueryClientProvider client={client}>
      <AttachmentList workspaceId={teamId} files={files} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
beforeEach(() => {
  server = mockApi();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  for (const file of [image, gif, video])
    server.state.overrides.set(`POST ${path(file.id)}`, () => server.json(result()));
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  configurePlatform(undefined);
  vi.unstubAllGlobals();
});

test("attachments show type/size, real media thumbnails and safe download-only formats", async () => {
  const files: Attachment[] = [
    image,
    gif,
    video,
    { ...image, id: crypto.randomUUID(), name: "Report.pdf", mimeType: "application/pdf" },
    {
      ...image,
      id: crypto.randomUUID(),
      name: "Sheet.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { ...image, id: crypto.randomUUID(), name: "Archive.zip", mimeType: "application/zip" },
    { ...image, id: crypto.randomUUID(), name: "Note.txt", mimeType: "text/plain" },
    {
      ...image,
      id: crypto.randomUUID(),
      name: "Document.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    {
      ...image,
      id: crypto.randomUUID(),
      name: "Slides.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
  ];
  show(files);
  expect(await screen.findByAltText("Photo.png thumbnail")).toHaveAttribute("src", url);
  expect(await screen.findByAltText("Animation.gif thumbnail")).toBeVisible();
  expect(screen.getByText("PNG image · 2.0 KB")).toBeVisible();
  for (const label of [
    "PDF document",
    "Excel spreadsheet",
    "ZIP archive",
    "Text file",
    "Word document",
    "PowerPoint",
  ])
    expect(screen.getByText(new RegExp(`${label} ·`))).toBeVisible();
  expect(screen.queryByRole("button", { name: "Preview Report.pdf" })).not.toBeInTheDocument();
  const thumbnail = screen
    .getByRole("button", { name: "Preview Clip.webm" })
    .querySelector("video")!;
  expect(thumbnail).toHaveAttribute("preload", "metadata");
  expect(thumbnail.controls).toBe(false);
  fireEvent.error(screen.getByAltText("Photo.png thumbnail"));
  expect(screen.queryByAltText("Photo.png thumbnail")).not.toBeInTheDocument();
  expect(screen.getByText("Preview unavailable")).toBeVisible();
});

test("the gallery supports images, GIFs, video controls, navigation, Escape and return focus", async () => {
  const user = show([image, gif, video]);
  const trigger = screen.getByRole("button", { name: "Preview Photo.png" });
  await user.click(trigger);
  let dialog = await screen.findByRole("dialog", { name: "Photo.png" });
  expect(await within(dialog).findByAltText("Photo.png")).toBeVisible();
  expect(within(dialog).getByRole("button", { name: "Previous attachment" })).toBeDisabled();
  expect(within(dialog).getByRole("link", { name: "Open externally" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await user.click(within(dialog).getByRole("button", { name: "Next attachment" }));
  dialog = await screen.findByRole("dialog", { name: "Animation.gif" });
  await within(dialog).findByAltText("Animation.gif");
  await user.keyboard("{ArrowRight}");
  dialog = await screen.findByRole("dialog", { name: "Clip.webm" });
  const player = await within(dialog).findByLabelText<HTMLVideoElement>("Video: Clip.webm");
  expect(player.controls).toBe(true);
  expect(player.autoplay).toBe(false);
  expect(within(dialog).getByRole("button", { name: "Next attachment" })).toBeDisabled();
  player.focus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("dialog", { name: "Clip.webm" })).toBeVisible();
  player.currentTime = 12;
  fireEvent.error(player);
  await user.click(within(dialog).getByRole("button", { name: "Retry preview" }));
  const recovered = await within(dialog).findByLabelText<HTMLVideoElement>("Video: Clip.webm");
  fireEvent.loadedMetadata(recovered);
  expect(recovered.currentTime).toBe(12);
  await user.click(within(dialog).getByRole("button", { name: "Previous attachment" }));
  await screen.findByRole("dialog", { name: "Animation.gif" });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

test("denied and failed previews explain the problem and retry through authorization", async () => {
  server.state.overrides.set(`POST ${path(image.id)}`, () =>
    server.error(404, "Media access removed"),
  );
  const user = show([image]);
  await user.click(screen.getByRole("button", { name: "Preview Photo.png" }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("Media access removed")).toBeVisible();
  expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  server.state.overrides.set(`POST ${path(image.id)}`, () => server.json(result()));
  await user.click(within(dialog).getByRole("button", { name: "Retry preview" }));
  const imageElement = await within(dialog).findByAltText("Photo.png");
  fireEvent.error(imageElement);
  expect(await within(dialog).findByText(/The media could not load/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Retry preview" }));
  expect(await within(dialog).findByAltText("Photo.png")).toHaveAttribute("src", url);
});

test("desktop external-open uses an attachment identity and reports transport failures", async () => {
  const openAttachment = vi
    .fn<(path: string) => Promise<void>>()
    .mockRejectedValueOnce(new Error("Browser unavailable"))
    .mockResolvedValue(undefined);
  const download = vi
    .fn<(path: string, body: unknown) => Promise<void>>()
    .mockRejectedValue(new Error("Download unavailable"));
  configurePlatform({
    kind: "desktop",
    webOrigin: "https://lumo.test",
    transport: async () => ({ status: 200, body: result() }),
    openAttachment,
    download,
  });
  const user = show([image]);
  await user.click(screen.getByRole("button", { name: "Preview Photo.png" }));
  const dialog = await screen.findByRole("dialog");
  const external = within(dialog).getByRole("button", { name: "Open externally" });
  await waitFor(() => expect(external).toBeEnabled());
  await user.click(external);
  expect(await within(dialog).findByText("Browser unavailable")).toBeVisible();
  expect(openAttachment).toHaveBeenCalledWith(path(image.id));
  await user.click(external);
  await waitFor(() =>
    expect(within(dialog).queryByText("Browser unavailable")).not.toBeInTheDocument(),
  );
  await user.click(within(dialog).getByRole("button", { name: "Download" }));
  expect(await within(dialog).findByText("Download unavailable")).toBeVisible();
});
