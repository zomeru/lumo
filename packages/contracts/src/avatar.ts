import { z } from "zod";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_PIXELS = 16 * 1024 * 1024;
export const AVATAR_MAX_DIMENSION = 8192;
export const avatarInputSchema = z.strictObject({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z
    .string()
    .min(4)
    .max(Math.ceil(AVATAR_MAX_BYTES / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
export const avatarResultSchema = z.object({ image: z.string().nullable() });
export const avatarUrlSchema = z.object({ url: z.url() });
export const avatarConfigSchema = z.object({
  maxBytes: z.number().int().positive().max(AVATAR_MAX_BYTES),
});
export function avatarIdentity(image: string | null | undefined) {
  const match = /^avatar:([a-f0-9-]{36}):([a-f0-9-]{36})$/.exec(image ?? "");
  return match ? { userId: match[1]!, version: match[2]! } : null;
}
