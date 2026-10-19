import { expect, test } from "vitest";

import { previewType, validateSignature } from "./validation";

test("recognizes previewable formats and verifies common signatures", () => {
  expect(previewType("image/svg+xml")).toBeUndefined();
  expect(previewType("text/html")).toBeUndefined();
  expect(previewType("application/pdf")).toBe("application/pdf");
  for (const [mime, bytes] of [
    ["image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
    ["image/jpeg", [255, 216, 255]],
    ["image/gif", [...Buffer.from("GIF89a")]],
    ["image/webp", [...Buffer.from("RIFFxxxxWEBP")]],
    ["application/pdf", [...Buffer.from("%PDF-1.7")]],
    ["application/zip", [80, 75, 5, 6]],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [80, 75, 3, 4]],
    ["text/plain", [...Buffer.from("Hello 世界")]],
    ["application/json", [...Buffer.from('{"a":1}')]],
  ] as const)
    expect(() => validateSignature(mime, new Uint8Array(bytes))).not.toThrow();
  for (const [mime, bytes] of [
    ["image/png", [1, 2]],
    ["text/plain", [0, 1]],
    ["text/plain", [255, 255]],
    ["application/octet-stream", [77, 90]],
    ["application/octet-stream", [127, 69, 76, 70]],
  ] as const)
    expect(() => validateSignature(mime, new Uint8Array(bytes))).toThrow(
      "The file contents do not match",
    );
});
