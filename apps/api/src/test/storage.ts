import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { vi } from "vitest";

import type { Storage } from "../storage/storage";

export function memoryStorage() {
  const objects = new Map<
    string,
    { data: Buffer; mimeType: string; etag: string; checksum: string }
  >();
  const uploads = new Map<string, { key: string; mimeType: string; parts: Map<number, Buffer> }>();
  const sha = (data: Buffer) => createHash("sha256").update(data).digest("base64");
  function put(key: string, data: Buffer, mimeType: string) {
    objects.set(key, { data, mimeType, checksum: sha(data), etag: `"${sha(data)}"` });
  }
  function get(key: string) {
    const value = objects.get(key);
    if (!value) throw Object.assign(new Error("Missing object"), { name: "NoSuchKey" });
    return value;
  }
  const storage: Storage = {
    putUrl: vi.fn<Storage["putUrl"]>(
      async (key) => `https://test.s3.us-east-1.amazonaws.com/${key}`,
    ),
    startMultipart: vi.fn<Storage["startMultipart"]>(async (key, mimeType) => {
      const id = randomUUID();
      uploads.set(id, { key, mimeType, parts: new Map() });
      return id;
    }),
    partUrl: vi.fn<Storage["partUrl"]>(
      async (key, id, part) =>
        `https://test.s3.us-east-1.amazonaws.com/${key}?uploadId=${id}&partNumber=${part}`,
    ),
    parts: vi.fn<Storage["parts"]>(async (_key, id) => {
      const upload = uploads.get(id);
      if (!upload) throw Object.assign(new Error("Missing upload"), { name: "NoSuchUpload" });
      return [...upload.parts]
        .sort(([a], [b]) => a - b)
        .map(([partNumber, data]) => ({
          partNumber,
          size: data.length,
          etag: sha(data),
          checksum: sha(data),
        }));
    }),
    complete: vi.fn<Storage["complete"]>(async (key, id) => {
      const upload = uploads.get(id)!;
      put(
        key,
        Buffer.concat([...upload.parts].sort(([a], [b]) => a - b).map(([, b]) => b)),
        upload.mimeType,
      );
      uploads.delete(id);
    }),
    abort: vi.fn<Storage["abort"]>(async (_key, id) => {
      uploads.delete(id);
    }),
    stat: vi.fn<Storage["stat"]>(async (key) => {
      const value = get(key);
      return {
        size: value.data.length,
        mimeType: value.mimeType,
        etag: value.etag,
        checksum: value.checksum,
      };
    }),
    sample: vi.fn<Storage["sample"]>(async (key) => get(key).data.subarray(0, 8192)),
    copy: vi.fn<Storage["copy"]>(async (source, destination, etag) => {
      const value = get(source);
      if (etag !== value.etag) throw new Error("Precondition failed");
      put(destination, value.data, value.mimeType);
    }),
    remove: vi.fn<Storage["remove"]>(async (key) => {
      objects.delete(key);
    }),
    downloadUrl: vi.fn<Storage["downloadUrl"]>(
      async (key) => `https://test.s3.us-east-1.amazonaws.com/${key}?signed=true`,
    ),
    read: vi.fn<Storage["read"]>(async (key) => Readable.from(get(key).data)),
    write: vi.fn<Storage["write"]>(async (key, stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
      put(key, Buffer.concat(chunks), "application/zip");
    }),
  };
  return { storage, objects, uploads, put, sha };
}
