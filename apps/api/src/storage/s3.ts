import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ServerEnv } from "@lumolynk/env/server";

import { AppError } from "../lib/errors";
import { URL_TTL_SECONDS, type Storage, type StoragePart } from "./storage";

export function createS3Storage(env: ServerEnv): Storage {
  const spaces = env.STORAGE_PROVIDER === "digitalocean";
  // Preserve the AWS credential chain unless a dedicated S3 key pair is supplied.
  // Explicit credentials keep Spaces independent of AWS profiles/session tokens.
  const client = new S3Client({
    region: env.AWS_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  function object(Key: string) {
    if (!env.AWS_REGION || !env.AWS_S3_BUCKET)
      throw new AppError(503, "STORAGE_UNAVAILABLE", "Drive storage is not configured.");
    return { Bucket: env.AWS_S3_BUCKET, Key };
  }
  const signOptions = {
    expiresIn: URL_TTL_SECONDS,
    unhoistableHeaders: new Set(["x-amz-checksum-sha256"]),
    signableHeaders: new Set(["content-type", "content-length"]),
  };
  return {
    putUrl: (key, size, mimeType, checksum) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          ...object(key),
          ContentLength: size,
          ContentType: mimeType,
          ChecksumSHA256: checksum,
        }),
        signOptions,
      ),
    async startMultipart(key, mimeType) {
      const result = await client.send(
        new CreateMultipartUploadCommand({
          ...object(key),
          ContentType: mimeType,
          ...(!spaces && { ChecksumAlgorithm: "SHA256" }),
        }),
      );
      if (!result.UploadId) throw new Error("Missing multipart upload ID");
      return result.UploadId;
    },
    partUrl: (key, uploadId, partNumber, size, checksum) =>
      getSignedUrl(
        client,
        new UploadPartCommand({
          ...object(key),
          UploadId: uploadId,
          PartNumber: partNumber,
          ContentLength: size,
          ChecksumSHA256: checksum,
        }),
        {
          ...signOptions,
          // UploadPart inherits the object's type from CreateMultipartUpload.
          // The SDK adds a default Content-Type which browser part PUTs omit.
          // Bind the part's bytes/length, without signing that incidental header.
          signableHeaders: new Set(["content-length"]),
          unsignableHeaders: new Set(["content-type"]),
        },
      ),
    async parts(key, uploadId) {
      const parts: StoragePart[] = [];
      let marker: string | undefined;
      do {
        const result = await client.send(
          new ListPartsCommand({ ...object(key), UploadId: uploadId, PartNumberMarker: marker }),
        );
        for (const part of result.Parts ?? []) {
          if (
            !part.PartNumber ||
            !part.ETag ||
            part.Size === undefined ||
            (!spaces && !part.ChecksumSHA256)
          )
            throw new Error("Invalid S3 part metadata");
          parts.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
            size: part.Size,
            checksum: part.ChecksumSHA256 ?? null,
          });
        }
        marker = result.IsTruncated ? result.NextPartNumberMarker : undefined;
      } while (marker);
      return parts;
    },
    async complete(key, uploadId, parts) {
      await client.send(
        new CompleteMultipartUploadCommand({
          ...object(key),
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.etag,
              ...(part.checksum && { ChecksumSHA256: part.checksum }),
            })),
          },
        }),
      );
    },
    async abort(key, uploadId) {
      try {
        await client.send(new AbortMultipartUploadCommand({ ...object(key), UploadId: uploadId }));
      } catch (error) {
        if (!(error instanceof Error && error.name === "NoSuchUpload")) throw error;
      }
    },
    async stat(key) {
      const result = await client.send(
        new HeadObjectCommand({ ...object(key), ...(!spaces && { ChecksumMode: "ENABLED" }) }),
      );
      if (result.ContentLength === undefined || !result.ETag)
        throw new Error("Missing S3 metadata");
      let checksum = result.ChecksumSHA256;
      if (!checksum) {
        // Spaces can accept a checksum header without returning it from HEAD.
        // Hash the stored bytes, bound to this ETag, rather than trusting upload metadata.
        const { Body } = await client.send(
          new GetObjectCommand({ ...object(key), IfMatch: result.ETag }),
        );
        if (!(Body instanceof Readable)) throw new Error("Missing S3 stream");
        const hash = createHash("sha256");
        let size = 0;
        try {
          for await (const value of Body) {
            const chunk = Buffer.from(value as Uint8Array);
            size += chunk.length;
            if (size > result.ContentLength)
              throw new Error("S3 object size changed during verification");
            hash.update(chunk);
          }
          if (size !== result.ContentLength)
            throw new Error("S3 object size changed during verification");
          checksum = hash.digest("base64");
        } finally {
          Body.destroy();
        }
      }
      return {
        size: result.ContentLength,
        mimeType: result.ContentType ?? "application/octet-stream",
        etag: result.ETag,
        checksum,
      };
    },
    async sample(key, size) {
      if (!size) return new Uint8Array();
      const result = await client.send(
        new GetObjectCommand({ ...object(key), Range: `bytes=0-${Math.min(size, 8192) - 1}` }),
      );
      if (!result.Body) throw new Error("Missing S3 object body");
      return result.Body.transformToByteArray();
    },
    async copy(source, destination, etag) {
      const target = object(destination);
      await client.send(
        new CopyObjectCommand({
          ...target,
          CopySource: `${target.Bucket}/${source.split("/").map(encodeURIComponent).join("/")}`,
          CopySourceIfMatch: etag,
          ...(!spaces && { ChecksumAlgorithm: "SHA256" }),
        }),
      );
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand(object(key)));
    },
    downloadUrl: (key, name, mimeType) =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          ...object(key),
          ResponseContentDisposition: `${mimeType ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodeURIComponent(name).replaceAll("'", "%27")}`,
          ResponseContentType: mimeType ?? "application/octet-stream",
          ResponseCacheControl: "no-store",
        }),
        signOptions,
      ),
    async read(key) {
      const result = await client.send(new GetObjectCommand(object(key)));
      if (!(result.Body instanceof Readable)) throw new Error("Missing S3 stream");
      return result.Body;
    },
    async write(key, stream, mimeType = "application/zip") {
      const upload = new Upload({
        client,
        params: {
          ...object(key),
          Body: stream,
          ContentType: mimeType,
          ...(!spaces && { ChecksumAlgorithm: "SHA256" }),
        },
        queueSize: 2,
        leavePartsOnError: false,
      });
      await upload.done();
    },
  };
}
