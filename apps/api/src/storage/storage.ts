import type { Readable } from "node:stream";

type ObjectMetadata = {
  size: number;
  mimeType: string;
  etag: string;
  checksum: string | null;
};
export type StoragePart = {
  partNumber: number;
  etag: string;
  size: number;
  checksum: string | null;
};
export interface Storage {
  putUrl(
    this: void,
    key: string,
    size: number,
    mimeType: string,
    checksum: string,
  ): Promise<string>;
  startMultipart(this: void, key: string, mimeType: string): Promise<string>;
  partUrl(
    this: void,
    key: string,
    uploadId: string,
    partNumber: number,
    size: number,
    checksum: string,
  ): Promise<string>;
  parts(this: void, key: string, uploadId: string): Promise<StoragePart[]>;
  complete(this: void, key: string, uploadId: string, parts: StoragePart[]): Promise<void>;
  abort(this: void, key: string, uploadId: string): Promise<void>;
  stat(this: void, key: string): Promise<ObjectMetadata>;
  sample(this: void, key: string, size: number): Promise<Uint8Array>;
  copy(this: void, source: string, destination: string, etag: string): Promise<void>;
  remove(this: void, key: string): Promise<void>;
  downloadUrl(this: void, key: string, name: string, mimeType?: string): Promise<string>;
  read(this: void, key: string): Promise<Readable>;
  write(this: void, key: string, stream: Readable, mimeType?: string): Promise<void>;
}
export const PART_SIZE = 8 * 1024 ** 2;
export const MULTIPART_THRESHOLD = 16 * 1024 ** 2;
export const URL_TTL_SECONDS = 120;
