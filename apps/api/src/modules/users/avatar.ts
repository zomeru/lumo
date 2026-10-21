import { AVATAR_MAX_DIMENSION, AVATAR_MAX_PIXELS } from "@lumo/contracts/avatar";
import sharp from "sharp";

import { AppError } from "../../lib/errors";
/** Decode only raster formats, bound memory, orient, strip metadata and encode fresh pixels. */
export async function processAvatar(data: Buffer, mimeType: string, maxBytes: number) {
  if (!data.length || data.length > maxBytes)
    throw new AppError(413, "AVATAR_TOO_LARGE", "The profile image exceeds the upload limit.");
  try {
    const image = sharp(data, { failOn: "warning", limitInputPixels: AVATAR_MAX_PIXELS });
    const metadata = await image.metadata();
    const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mimeType];
    if (
      !expected ||
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > AVATAR_MAX_DIMENSION ||
      metadata.height > AVATAR_MAX_DIMENSION ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Invalid image");
    return await image
      .autoOrient()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      "INVALID_AVATAR",
      "Choose a valid, still JPEG, PNG or WebP image up to 8192 pixels per side and 16 megapixels.",
    );
  }
}
