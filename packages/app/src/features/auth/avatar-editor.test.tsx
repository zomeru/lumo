import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { mockApi } from "../../test/mock-api";
import { AvatarEditor } from "./avatar-editor";
let server: ReturnType<typeof mockApi>, client: QueryClient;
const close = vi.fn<() => void>();
const draw = vi.fn<(...args: unknown[]) => void>();
beforeEach(() => {
  server = mockApi();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn<() => Promise<Partial<ImageBitmap>>>(async () => ({ width: 800, height: 400, close })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/webp;base64,YWJjZA==",
  );
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockRestore();
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockRestore();
  vi.unstubAllGlobals();
});
async function show(image: string | null = null) {
  render(
    <QueryClientProvider client={client}>
      <AvatarEditor name="Alice" image={image} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText("Choose profile photo")).toBeEnabled());
  return userEvent.setup({ applyAccept: false });
}
test("validates source file type and size before decoding", async () => {
  const user = await show();
  await user.upload(
    screen.getByLabelText("Choose profile photo"),
    new File(["bad"], "bad.svg", { type: "image/svg+xml" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("JPEG, PNG or WebP");
  await user.upload(
    screen.getByLabelText("Choose profile photo"),
    new File([new Uint8Array(5242881)], "large.png", { type: "image/png" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("upload limit");
  expect(globalThis.createImageBitmap).not.toHaveBeenCalled();
});
test("previews, zooms, repositions, saves cropped pixels and reports upload failures", async () => {
  server.state.overrides.set("PUT /api/v1/me/avatar", () =>
    server.error(503, "Photo could not be saved"),
  );
  const user = await show();
  await user.upload(
    screen.getByLabelText("Choose profile photo"),
    new File(["pixels"], "photo.png", { type: "image/png" }),
  );
  expect(await screen.findByRole("img", { name: "Circular crop preview" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Photo zoom"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Horizontal position"), { target: { value: "100" } });
  await user.click(screen.getByRole("button", { name: "Save photo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Photo could not be saved");
  expect(draw).toHaveBeenLastCalledWith(expect.anything(), 600, 100, 200, 200, 0, 0, 256, 256);
  server.state.overrides.set("PUT /api/v1/me/avatar", () => server.json({ image: "avatar:new" }));
  await user.click(screen.getByRole("button", { name: "Save photo" }));
  expect(await screen.findByText("Profile photo updated.")).toBeVisible();
  expect(screen.queryByLabelText("Circular crop preview")).not.toBeInTheDocument();
  expect(close).toHaveBeenCalled();
});
test("cancels an edit without an upload and allows removing the existing photo", async () => {
  server.state.overrides.set("DELETE /api/v1/me/avatar", () => server.json({ image: null }));
  const user = await show("https://example.com/avatar.webp");
  await user.upload(
    screen.getByLabelText("Choose profile photo"),
    new File(["pixels"], "photo.webp", { type: "image/webp" }),
  );
  await screen.findByLabelText("Circular crop preview");
  await user.click(screen.getByRole("button", { name: "Cancel photo" }));
  expect(server.fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  await user.click(screen.getByRole("button", { name: "Remove photo" }));
  expect(await screen.findByText("Profile photo updated.")).toBeVisible();
});
test("rejects oversized image dimensions and corrupt source pixels", async () => {
  const user = await show();
  vi.mocked(globalThis.createImageBitmap).mockResolvedValueOnce({
    width: 9000,
    height: 1,
    close,
  } as unknown as ImageBitmap);
  await user.upload(
    screen.getByLabelText("Choose profile photo"),
    new File(["pixels"], "photo.png", { type: "image/png" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("8192 pixels");
  vi.mocked(globalThis.createImageBitmap).mockRejectedValueOnce(new Error("Image decoding failed"));
  await user.upload(
    screen.getByLabelText("Choose profile photo"),
    new File(["broken"], "broken.png", { type: "image/png" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Image decoding failed");
});
