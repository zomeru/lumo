import sharp from "sharp";
import { expect, test } from "vitest";

import { processAvatar } from "./avatar";
const image = () =>
  sharp({ create: { width: 400, height: 200, channels: 3, background: "blue" } })
    .png()
    .toBuffer();
test("avatar processing re-encodes pixels as a compact square without metadata", async () => {
  const output = await processAvatar(await image(), "image/png", 5242880);
  const metadata = await sharp(output).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 256, height: 256 });
  expect(metadata.exif).toBeUndefined();
});
test("avatar validation rejects empty, oversized, mislabeled and invalid images", async () => {
  await expect(processAvatar(Buffer.alloc(0), "image/png", 100)).rejects.toMatchObject({
    status: 413,
  });
  await expect(processAvatar(await image(), "image/png", 1)).rejects.toMatchObject({ status: 413 });
  await expect(processAvatar(await image(), "image/jpeg", 5242880)).rejects.toMatchObject({
    status: 400,
  });
  await expect(
    processAvatar(Buffer.from("not an image"), "image/png", 5242880),
  ).rejects.toMatchObject({ status: 400 });
  const large = await sharp({ create: { width: 8193, height: 1, channels: 3, background: "blue" } })
    .png()
    .toBuffer();
  await expect(processAvatar(large, "image/png", 5242880)).rejects.toMatchObject({ status: 400 });
});
test("avatar JPEG orientation is applied before encoding", async () => {
  const jpeg = await sharp(await image())
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const output = await processAvatar(jpeg, "image/jpeg", 5242880);
  expect(await sharp(output).metadata()).toMatchObject({ width: 256, height: 256 });
});
