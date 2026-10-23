import {
  driveItemSchema,
  drivePartSchema,
  driveUploadSchema,
  type DriveUpload,
} from "@lumo/contracts/drive";
import { officeUploadFormat, type OfficeUploadModule } from "@lumo/contracts/files";

import { api } from "../../lib/api";
import { drivePath } from "./drive-api";

async function sha256(blob: Blob) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return btoa(String.fromCharCode(...hash));
}
export function putFile(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  signal: AbortSignal,
  progress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => progress(event.loaded);
    xhr.onload = () =>
      finish(
        xhr.status >= 200 && xhr.status < 300
          ? undefined
          : new Error("S3 upload failed. Check your connection or bucket CORS configuration."),
      );
    xhr.onerror = () =>
      finish(
        new Error(
          "Unable to upload to storage. Check your connection or the storage CORS configuration.",
        ),
      );
    xhr.ontimeout = () => finish(new Error("The upload timed out."));
    xhr.onabort = () => finish(new DOMException("Upload canceled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(blob);
  });
}
async function retry<T>(action: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await action();
    } catch (error) {
      if (signal.aborted || attempt >= 2) throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Upload canceled", "AbortError"));
        };
        const timer = setTimeout(
          () => {
            signal.removeEventListener("abort", abort);
            resolve();
          },
          500 * 2 ** attempt,
        );
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  }
}
export async function uploadDriveFile({
  workspaceId,
  parentId,
  file,
  signal,
  onProgress,
  onInitialized,
  previous,
  finalizeOnly,
  module,
}: {
  workspaceId: string;
  parentId: string | null;
  file: File;
  signal: AbortSignal;
  onProgress: (percent: number) => void;
  onInitialized: (session: DriveUpload) => void;
  previous?: DriveUpload;
  finalizeOnly?: boolean;
  module?: OfficeUploadModule;
}) {
  const base = drivePath(workspaceId);
  const checksum = file.size < 16 * 1024 ** 2 ? await sha256(file) : undefined;
  signal.throwIfAborted();
  const session =
    previous ??
    (await api(`${base}/uploads`, driveUploadSchema, {
      method: "POST",
      body: {
        parentId,
        name: file.name,
        mimeType: module
          ? officeUploadFormat(module).mime
          : file.type || "application/octet-stream",
        module,
        size: file.size,
        checksum,
      },
      signal,
    }));
  onInitialized(session);
  if (finalizeOnly) {
    onProgress(97);
    const item = await retry(
      () =>
        api(`${base}/${session.item.id}/complete`, driveItemSchema, {
          method: "POST",
          body: {},
          signal,
        }),
      signal,
    );
    onProgress(100);
    return item;
  }
  const count = session.multipart ? Math.ceil(file.size / session.partSize) : 1;
  const loaded = new Array<number>(count).fill(0);
  let cursor = 0;
  // Three bounded part transfers; hashing reads at most one part per worker.
  const workers = Array.from({ length: Math.min(3, count) }, async () => {
    while (cursor < count) {
      const index = cursor++;
      const blob = session.multipart
        ? file.slice(index * session.partSize, (index + 1) * session.partSize)
        : file;
      const partChecksum = checksum ?? (await sha256(blob));
      await retry(async () => {
        const signed = await api(`${base}/${session.item.id}/parts`, drivePartSchema, {
          method: "POST",
          body: { partNumber: index + 1, checksum: partChecksum },
          signal,
        });
        await putFile(signed.url, blob, signed.headers, signal, (bytes) => {
          loaded[index] = bytes;
          onProgress(
            Math.min(
              95,
              Math.round((loaded.reduce((sum, v) => sum + v, 0) / Math.max(1, file.size)) * 95),
            ),
          );
        });
      }, signal);
    }
  });
  // Drain other workers before surfacing a failure so Retry never overlaps writes.
  const results = await Promise.allSettled(workers);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  onProgress(97);
  const item = await retry(
    () =>
      api(`${base}/${session.item.id}/complete`, driveItemSchema, {
        method: "POST",
        body: {},
        signal,
      }),
    signal,
  );
  onProgress(100);
  return item;
}
