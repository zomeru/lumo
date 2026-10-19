import { webcrypto } from "node:crypto";

import type { Transport } from "@lumo/api-client";
import { driveItemSchema, type DriveUpload } from "@lumo/contracts/drive";
import { beforeEach, afterEach, expect, test, vi } from "vitest";

import { configurePlatform } from "../../platform";
import { putFile, uploadDriveFile } from "./upload";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item = driveItemSchema.parse({
  id,
  workspaceId: id,
  ownerId: id,
  ownerName: "Alice",
  parentId: null,
  name: "file.txt",
  originalName: "file.txt",
  kind: "file",
  mimeType: "text/plain",
  size: 3,
  status: "ready",
  checksum: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  starred: false,
  shared: false,
  permission: "owner",
  canManage: true,
});
let multipart = false,
  transport: ReturnType<typeof vi.fn<Transport>>;
let session: DriveUpload;
class FakeXhr {
  static outcomes: string[] = [];
  static sent: FakeXhr[] = [];
  static hold = false;
  status = 200;
  timeout = 0;
  url = "";
  headers: Record<string, string> = {};
  upload: { onprogress?: (event: { loaded: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(blob: Blob) {
    FakeXhr.sent.push(this);
    if (FakeXhr.hold) return;
    queueMicrotask(() => {
      this.upload.onprogress?.({ loaded: blob.size });
      const outcome = FakeXhr.outcomes.shift();
      if (outcome === "network") this.onerror?.();
      else if (outcome === "timeout") this.ontimeout?.();
      else {
        if (outcome === "status") this.status = 500;
        this.onload?.();
      }
    });
  }
  abort() {
    this.onabort?.();
  }
}
function file(size = 3) {
  const data = new Uint8Array(size).fill(42);
  const value = new File([data], "file.txt", { type: "text/plain" });
  Object.defineProperty(value, "arrayBuffer", { value: async () => data.buffer });
  value.slice = (start = 0, end = size) => {
    const part = data.slice(start, end),
      blob = new Blob([part]);
    Object.defineProperty(blob, "arrayBuffer", { value: async () => part.buffer });
    return blob;
  };
  return value;
}
beforeEach(() => {
  multipart = false;
  FakeXhr.outcomes = [];
  FakeXhr.sent = [];
  FakeXhr.hold = false;
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  transport = vi.fn<Transport>(async (path) => {
    if (path.endsWith("/uploads")) {
      session = {
        item: { ...item, status: "uploading" },
        multipart,
        partSize: 8 * 1024 ** 2,
        headers: {},
        expiresAt: new Date().toISOString(),
      };
      return { status: 201, body: session };
    }
    if (path.endsWith("/parts"))
      return {
        status: 200,
        body: {
          url: "https://test.s3.us-east-1.amazonaws.com/key",
          headers: { "x-amz-checksum-sha256": "test-hash" },
          expiresAt: new Date().toISOString(),
        },
      };
    return { status: 200, body: item };
  });
  configurePlatform({ kind: "web", webOrigin: "https://lumo.test", transport });
});
afterEach(() => {
  vi.unstubAllGlobals();
  configurePlatform(undefined);
});
const options = () => ({
  workspaceId: id,
  parentId: null,
  file: file(),
  signal: new AbortController().signal,
  onProgress: vi.fn<(percent: number) => void>(),
  onInitialized: vi.fn<(value: DriveUpload) => void>(),
});

test("small file hashing, signed direct upload, progress and finalization are connected", async () => {
  const input = options();
  expect(await uploadDriveFile(input)).toEqual(item);
  const body = transport.mock.calls[0]![1].body as { checksum: string; name: string };
  expect(body.checksum).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  expect(body.name).toBe("file.txt");
  expect(FakeXhr.sent).toHaveLength(1);
  expect(FakeXhr.sent[0]!.headers["x-amz-checksum-sha256"]).toBe("test-hash");
  expect(input.onProgress).toHaveBeenLastCalledWith(100);
  expect(input.onInitialized).toHaveBeenCalledOnce();
});
test("multipart transfers are bounded and each part gets a SHA-256 checksum", async () => {
  multipart = true;
  const input = { ...options(), file: file(16 * 1024 ** 2 + 1) };
  await uploadDriveFile(input);
  expect(FakeXhr.sent).toHaveLength(3);
  const parts = transport.mock.calls.filter(([path]) => path.endsWith("/parts"));
  expect(parts).toHaveLength(3);
  for (const [, options] of parts)
    expect((options.body as { checksum: string }).checksum).toMatch(/^[A-Za-z0-9+/]{43}=$/);
});
test("retry refreshes signed URLs and recovery can retry finalization without reuploading", async () => {
  FakeXhr.outcomes = ["network", "timeout"];
  await uploadDriveFile(options());
  expect(FakeXhr.sent).toHaveLength(3);
  expect(transport.mock.calls.filter(([path]) => path.endsWith("/parts"))).toHaveLength(3);
  const before = FakeXhr.sent.length;
  await uploadDriveFile({ ...options(), previous: session, finalizeOnly: true });
  expect(FakeXhr.sent).toHaveLength(before);
});
test("permanent transfer failure is surfaced and an aborted request never finalizes", async () => {
  FakeXhr.outcomes = ["status", "status", "status"];
  await expect(uploadDriveFile(options())).rejects.toThrow("S3 upload failed");
  expect(transport.mock.calls.some(([path]) => path.endsWith("/complete"))).toBe(false);
  const controller = new AbortController();
  controller.abort();
  await expect(
    putFile("https://storage.test", file(), {}, controller.signal, () => {}),
  ).rejects.toThrow(/abort/i);
});
test("active cancellation aborts XHR and prevents completion", async () => {
  FakeXhr.hold = true;
  const controller = new AbortController();
  const pending = uploadDriveFile({ ...options(), signal: controller.signal });
  const outcome = pending.catch((error: unknown) => error);
  await vi.waitFor(() => expect(FakeXhr.sent).toHaveLength(1));
  controller.abort();
  expect(await outcome).toMatchObject({ message: "Upload canceled" });
  expect(transport.mock.calls.some(([path]) => path.endsWith("/complete"))).toBe(false);
});
