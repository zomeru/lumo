import { Readable } from "node:stream";

import {
  S3Client,
  type CopyObjectCommand,
  CompleteMultipartUploadCommand,
  type GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { readServerEnv } from "@lumo/env/server";
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from "vitest";

import { createS3Storage } from "./s3";

const env = readServerEnv({
  DATABASE_URL: "postgresql://test@localhost/lumo_test",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  AWS_REGION: "us-east-1",
  AWS_S3_BUCKET: "lumo-test-bucket",
});
function mockSend() {
  const send = vi.fn<(command: unknown) => Promise<Record<string, unknown>>>();
  // The adapter uses only the promise overload, while Vitest infers the SDK's callback overload.
  const spy = vi.spyOn(S3Client.prototype, "send") as unknown as MockInstance<
    (command: unknown) => Promise<Record<string, unknown>>
  >;
  spy.mockImplementation(send);
  return send;
}
const hash = Buffer.alloc(32, 1).toString("base64");
beforeEach(() => {
  // Synthetic signing keys. Every network operation is intercepted below.
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIAEXAMPLEFORTESTING");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "synthetic-test-signing-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
test("signs short-lived PUT, part and GET URLs with exact sizes/checksums and safe dispositions", async () => {
  const storage = createS3Storage(env);
  const put = new URL(await storage.putUrl("drive-staging/workspace/file", 12, "text/plain", hash));
  expect(put.protocol).toBe("https:");
  expect(put.searchParams.get("X-Amz-Expires")).toBe("120");
  expect(put.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
  expect(put.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
  expect(put.searchParams.get("X-Amz-SignedHeaders")).toContain("x-amz-checksum-sha256");
  const part = new URL(await storage.partUrl("drive-staging/workspace/file", "upload", 2, 8, hash));
  expect(part.searchParams.get("partNumber")).toBe("2");
  expect(part.searchParams.get("uploadId")).toBe("upload");
  // Browser part PUTs send only the checksum. Signing the SDK's implicit type
  // produces SignatureDoesNotMatch for every multipart transfer.
  expect(part.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual([
    "content-length",
    "host",
    "x-amz-checksum-sha256",
  ]);
  const download = new URL(await storage.downloadUrl("drive/workspace/file", 'file"名.pdf'));
  expect(download.searchParams.get("response-content-disposition")).toContain("attachment;");
  expect(download.searchParams.get("response-content-type")).toBe("application/octet-stream");
  const preview = new URL(
    await storage.downloadUrl("drive/workspace/file", "file.png", "image/png"),
  );
  expect(preview.searchParams.get("response-content-disposition")).toContain("inline;");
});
test("multipart operations paginate and preserve server-derived checksums", async () => {
  const send = mockSend();
  const storage = createS3Storage(env);
  send.mockResolvedValueOnce({ UploadId: "upload" });
  expect(await storage.startMultipart("key", "text/plain")).toBe("upload");
  send.mockResolvedValueOnce({
    Parts: [{ PartNumber: 1, Size: 8, ETag: "etag1", ChecksumSHA256: hash }],
    IsTruncated: true,
    NextPartNumberMarker: "1",
  });
  send.mockResolvedValueOnce({
    Parts: [{ PartNumber: 2, Size: 4, ETag: "etag2", ChecksumSHA256: hash }],
  });
  const parts = await storage.parts("key", "upload");
  expect(parts).toHaveLength(2);
  send.mockResolvedValueOnce({});
  await storage.complete("key", "upload", parts);
  const command = send.mock.calls.at(-1)![0];
  expect(command).toBeInstanceOf(CompleteMultipartUploadCommand);
  expect(
    (command as CompleteMultipartUploadCommand).input.MultipartUpload?.Parts?.[0]?.ChecksumSHA256,
  ).toBe(hash);
  send.mockResolvedValueOnce({});
  await storage.abort("key", "upload");
  send.mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "NoSuchUpload" }));
  await storage.abort("key", "upload");
  send.mockRejectedValueOnce(new Error("offline"));
  await expect(storage.abort("key", "upload")).rejects.toThrow("offline");
  send.mockResolvedValueOnce({});
  await expect(storage.startMultipart("key", "text/plain")).rejects.toThrow(
    "Missing multipart upload ID",
  );
  send.mockResolvedValueOnce({ Parts: [{}] });
  await expect(storage.parts("key", "upload")).rejects.toThrow("Invalid S3 part metadata");
});
test("uses bounded range reads, conditional copies, object deletion and streaming archives", async () => {
  const send = mockSend();
  const storage = createS3Storage(env);
  send.mockResolvedValueOnce({
    ContentLength: 12,
    ContentType: "text/plain",
    ETag: "etag",
    ChecksumSHA256: hash,
  });
  expect((await storage.stat("key")).size).toBe(12);
  send.mockResolvedValueOnce({ ContentLength: 0, ETag: "empty" });
  expect((await storage.stat("empty")).mimeType).toBe("application/octet-stream");
  send.mockResolvedValueOnce({});
  await expect(storage.stat("key")).rejects.toThrow("Missing S3 metadata");
  expect(await storage.sample("empty", 0)).toHaveLength(0);
  send.mockResolvedValueOnce({
    Body: { transformToByteArray: async () => new Uint8Array([1, 2]) },
  });
  expect(await storage.sample("key", 10000)).toEqual(new Uint8Array([1, 2]));
  expect((send.mock.calls.at(-1)![0] as GetObjectCommand).input.Range).toBe("bytes=0-8191");
  send.mockResolvedValueOnce({});
  await expect(storage.sample("key", 2)).rejects.toThrow("Missing S3 object body");
  send.mockResolvedValueOnce({});
  await storage.copy("source/key", "dest/key", "etag");
  expect((send.mock.calls.at(-1)![0] as CopyObjectCommand).input.CopySourceIfMatch).toBe("etag");
  send.mockResolvedValueOnce({});
  await storage.remove("key");
  send.mockResolvedValueOnce({ Body: Readable.from(["contents"]) });
  const stream = await storage.read("key");
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(chunks.join("")).toBe("contents");
  send.mockResolvedValueOnce({});
  await expect(storage.read("key")).rejects.toThrow("Missing S3 stream");
  const done = vi.spyOn(Upload.prototype, "done").mockResolvedValue({ $metadata: {} });
  await storage.write("key", Readable.from(["zip"]));
  expect(done).toHaveBeenCalledOnce();
});
test("missing storage configuration fails closed without contacting S3", async () => {
  const storage = createS3Storage({ ...env, AWS_REGION: undefined, AWS_S3_BUCKET: undefined });
  await expect(storage.stat("key")).rejects.toThrow("Drive storage is not configured.");
});
