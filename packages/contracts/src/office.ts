import { z } from "zod";

import { driveFolderInputSchema, driveItemSchema, driveListInputSchema } from "./drive";
import { officeKindSchema, officeFormats, type OfficeKind } from "./files";
import { idSchema } from "./index";
export { officeKindSchema, officeFormats, type OfficeKind } from "./files";
export function officeFileKind(item: {
  kind: string;
  mimeType: string;
  name: string;
}): OfficeKind | undefined {
  if (item.kind !== "file") return;
  for (const kind of officeKindSchema.options)
    if (
      item.mimeType === officeFormats[kind].mime ||
      (kind === "wiki" && item.mimeType === "text/plain" && /\.md$/i.test(item.name))
    )
      return kind;
}
export const officeCreateSchema = driveFolderInputSchema.extend({
  name: driveFolderInputSchema.shape.name.max(235),
  kind: officeKindSchema,
  parentPageId: idSchema.nullable().optional(),
});
export const officeListInputSchema = driveListInputSchema.extend({
  kind: officeKindSchema.optional(),
});
export const officeDetailSchema = z.object({
  item: driveItemSchema,
  kind: officeKindSchema,
  version: z.number().int(),
  generation: z.number().int(),
  state: z.enum(["idle", "editing", "error"]),
  savedAt: z.iso.datetime(),
});
export const officeVersionSchema = z.object({
  id: idSchema,
  number: z.number().int(),
  size: z.number(),
  checksum: z.string(),
  source: z.string(),
  actorName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export const officeVersionsSchema = z.object({ versions: z.array(officeVersionSchema) });
export const officeEditorSchema = z.object({
  documentServerUrl: z.url(),
  config: z.object({
    document: z.object({
      key: z.string(),
      fileType: z.enum(["docx", "xlsx", "pptx"]),
      title: z.string(),
      url: z.url(),
      permissions: z.object({ edit: z.boolean(), download: z.boolean(), print: z.boolean() }),
    }),
    documentType: z.enum(["word", "cell", "slide"]),
    editorConfig: z.object({
      mode: z.enum(["edit", "view"]),
      callbackUrl: z.url(),
      user: z.object({ id: z.string(), name: z.string() }),
      coEditing: z.object({ mode: z.literal("fast"), change: z.literal(false) }),
      customization: z.object({ forcesave: z.literal(true), uiTheme: z.literal("theme-system") }),
    }),
    token: z.string(),
  }),
});
export const wikiTreeSchema = z.object({
  pages: z.array(
    officeDetailSchema.extend({ parentId: idSchema.nullable(), position: z.number().int() }),
  ),
});
export const wikiMoveSchema = z
  .object({ parentId: idSchema.nullable(), position: z.number().int().min(0).max(100000) })
  .strict();
export const wikiSessionSchema = z.object({
  token: z.string(),
  url: z.url(),
  name: z.string(),
  editable: z.boolean(),
  user: z.object({ id: z.string(), name: z.string() }),
});
