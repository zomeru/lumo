import { webcrypto } from "node:crypto";

import { afterEach, expect, test, vi } from "vitest";

const fake = vi.hoisted(() => ({
  api: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  put: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
}));
vi.mock("../../lib/api", () => ({ api: fake.api }));
vi.mock("../drive/upload", () => ({ putFile: fake.put }));
import { configurePlatform } from "../../platform";
import { downloadAttachment, uploadAttachment } from "./messenger-files";

afterEach(() => {
  fake.api.mockReset();
  fake.put.mockClear();
  configurePlatform(undefined);
  vi.unstubAllGlobals();
});
test("attachment uploads use checksums, immutable completion and abortable storage transfers", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const file = new File(["file"], "notes.txt", { type: "text/plain" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode("file").buffer,
  });
  fake.api
    .mockResolvedValueOnce({ id: "file-id", url: "https://storage.test/upload" })
    .mockResolvedValueOnce({ id: "file-id", name: "notes.txt" });
  const controller = new AbortController(),
    result = await uploadAttachment("workspace", "conversation", file, controller.signal);
  expect(result).toMatchObject({ id: "file-id" });
  expect(fake.api.mock.calls[0]?.[2]).toMatchObject({
    body: { name: "notes.txt", mimeType: "text/plain", size: 4, checksum: expect.any(String) },
    signal: controller.signal,
  });
  expect(fake.put.mock.calls[0]?.[2]).toMatchObject({
    "Content-Type": "text/plain",
    "x-amz-checksum-sha256": expect.any(String),
  });
  expect(fake.api.mock.calls[1]?.[0]).toBe(
    "/workspaces/workspace/messenger/attachments/file-id/complete",
  );
  await expect(
    uploadAttachment("workspace", "conversation", new File([], "empty.txt"), controller.signal),
  ).rejects.toThrow("Choose a file between 1 byte and 20 MB.");
});
test("downloads use authenticated desktop bridge or a browser download link", async () => {
  const download = vi.fn<(path: string, body: unknown) => Promise<void>>(async () => {});
  configurePlatform({
    kind: "desktop",
    webOrigin: "https://lumo.test",
    transport: async () => ({ status: 200, body: {} }),
    download,
  });
  await downloadAttachment("workspace", "file");
  expect(download).toHaveBeenCalledWith(
    "/api/v1/workspaces/workspace/messenger/attachments/file/download",
    {},
  );
  configurePlatform(undefined);
  fake.api.mockResolvedValue({ url: "https://storage.test/file" });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await downloadAttachment("workspace", "file");
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a[download]")).toBeNull();
  } finally {
    click.mockRestore();
  }
});
