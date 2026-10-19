import { z } from "zod";

import { idSchema, paginationSchema } from "./index";

export const driveNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (name) =>
      name !== "." &&
      name !== ".." &&
      !/[\\/]/.test(name) &&
      !Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    "Use a filename without path separators or control characters.",
  );
export const driveViewSchema = z.enum(["my", "recent", "starred", "shared", "trash"]);
export const driveListInputSchema = paginationSchema.extend({
  view: driveViewSchema.default("my"),
  parentId: idSchema.optional(),
  sort: z.enum(["name", "size", "type", "updatedAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  type: z.enum(["all", "folder", "image", "pdf", "text", "other"]).default("all"),
});
export const driveFolderInputSchema = z
  .object({ name: driveNameSchema, parentId: idSchema.nullable().default(null) })
  .strict();
export const driveUploadInputSchema = driveFolderInputSchema.extend({
  size: z
    .number()
    .int()
    .min(0)
    .max(5 * 1024 ** 3),
  mimeType: z
    .string()
    .max(150)
    .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/),
  checksum: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/)
    .optional(),
});
export const driveUpdateInputSchema = z
  .object({ name: driveNameSchema.optional(), parentId: idSchema.nullable().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const driveCopyInputSchema = driveFolderInputSchema.partial();
export const drivePartInputSchema = z
  .object({
    partNumber: z.number().int().min(1).max(10000),
    checksum: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  })
  .strict();
export const driveShareInputSchema = z
  .object({ userId: idSchema, permission: z.enum(["viewer", "editor"]) })
  .strict();
export const driveArchiveInputSchema = z
  .object({ ids: z.array(idSchema).min(1).max(100) })
  .strict();
export const driveStarInputSchema = z.object({ starred: z.boolean() }).strict();
export const driveItemSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  ownerId: idSchema,
  ownerName: z.string(),
  parentId: idSchema.nullable(),
  name: z.string(),
  originalName: z.string(),
  kind: z.enum(["file", "folder"]),
  mimeType: z.string(),
  size: z.number(),
  status: z.enum(["uploading", "ready", "failed", "deleting"]),
  checksum: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  starred: z.boolean(),
  shared: z.boolean(),
  permission: z.enum(["owner", "editor", "viewer"]),
  canManage: z.boolean(),
});
export const driveListSchema = z.object({
  items: z.array(driveItemSchema),
  nextOffset: z.number().nullable(),
  breadcrumbs: z.array(z.object({ id: idSchema, name: z.string() })),
  canWrite: z.boolean(),
  totalSize: z.number(),
  totalFiles: z.number(),
});
export const driveUploadSchema = z.object({
  item: driveItemSchema,
  multipart: z.boolean(),
  partSize: z.number(),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});
export const driveUrlSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export const drivePartSchema = driveUrlSchema.extend({ headers: z.record(z.string(), z.string()) });
export const driveSharesSchema = z.object({
  shares: z.array(
    z.object({
      userId: idSchema,
      name: z.string(),
      permission: z.enum(["viewer", "editor"]),
      inheritedFrom: idSchema.nullable(),
    }),
  ),
});
export const driveDetailsSchema = z.object({
  item: driveItemSchema,
  breadcrumbs: driveListSchema.shape.breadcrumbs,
});
export type DriveItem = z.infer<typeof driveItemSchema>;
export type DriveListInput = z.infer<typeof driveListInputSchema>;
export type DriveUploadInput = z.infer<typeof driveUploadInputSchema>;
export type DriveUpload = z.infer<typeof driveUploadSchema>;
export type DriveView = z.infer<typeof driveViewSchema>;
