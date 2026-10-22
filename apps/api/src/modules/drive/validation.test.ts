import { expect, test } from "vitest";

import { previewType, validateSignature } from "./validation";

test("recognizes previewable formats and verifies common signatures", () => {
  expect(previewType("image/svg+xml")).toBeUndefined();
  expect(previewType("text/html")).toBeUndefined();
  expect(previewType("application/pdf")).toBe("application/pdf");
  expect(previewType("text/markdown")).toBe("text/plain");
  for (const [mime, bytes] of [
    ["image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
    ["image/jpeg", [255, 216, 255]],
    ["image/gif", [...Buffer.from("GIF89a")]],
    ["image/webp", [...Buffer.from("RIFFxxxxWEBP")]],
    ["video/mp4", [...Buffer.from("\0\0\0\x18ftypisom")]],
    ["video/webm", [0x1a, 0x45, 0xdf, 0xa3, ...Buffer.from("webm")]],
    ["application/x-7z-compressed", [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]],
    ["application/vnd.rar", [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]],
    ["application/msword", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
    ["application/vnd.ms-excel", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
    ["application/vnd.ms-powerpoint", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
    ["application/pdf", [...Buffer.from("%PDF-1.7")]],
    ["application/zip", [80, 75, 5, 6]],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [80, 75, 3, 4]],
    ["text/plain", [...Buffer.from("Hello 世界")]],
    ["application/json", [...Buffer.from('{"a":1}')]],
  ] as const)
    expect(() => validateSignature(mime, new Uint8Array(bytes))).not.toThrow();
  for (const [mime, bytes] of [
    ["image/png", [1, 2]],
    ["video/mp4", [...Buffer.from("<html>not a video</html>")]],
    ["video/webm", [0x1a, 0x45, 0xdf, 0xa3, ...Buffer.from("matroska")]],
    ["application/msword", [77, 90]],
    ["application/vnd.rar", [80, 75]],
    ["application/x-7z-compressed", [80, 75]],
    ["text/plain", [0, 1]],
    ["text/plain", [255, 255]],
    ["application/octet-stream", [77, 90]],
    ["application/octet-stream", [127, 69, 76, 70]],
  ] as const)
    expect(() => validateSignature(mime, new Uint8Array(bytes))).toThrow(
      "The file contents do not match",
    );
});
