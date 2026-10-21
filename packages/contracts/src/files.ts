import { z } from "zod";

export const officeKindSchema = z.enum(["document", "sheet", "slide", "wiki"]);
export type OfficeKind = z.infer<typeof officeKindSchema>;
export const officeFormats = {
  document: {
    extension: "docx",
    documentType: "word",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  sheet: {
    extension: "xlsx",
    documentType: "cell",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  slide: {
    extension: "pptx",
    documentType: "slide",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  wiki: { extension: "md", documentType: "word", mime: "text/markdown" },
} as const;

export const fileModuleSchema = z.enum(["docs", "sheets", "slides", "wiki", "drive", "all"]);
export type FileModule = z.infer<typeof fileModuleSchema>;
export const fileModules = {
  docs: { title: "Docs", singular: "document", kind: "document" },
  sheets: { title: "Sheets", singular: "spreadsheet", kind: "sheet" },
  slides: { title: "Slides", singular: "presentation", kind: "slide" },
  wiki: { title: "Wiki", singular: "Wiki page", kind: "wiki" },
  drive: { title: "Drive (All Files)", singular: "file", kind: null },
  all: { title: "Drive (All Files)", singular: "file", kind: null },
} as const;
export const officeUploadModuleSchema = z.enum(["docs", "sheets", "slides"]);
export type OfficeUploadModule = z.infer<typeof officeUploadModuleSchema>;
export function officeUploadFormat(module: OfficeUploadModule) {
  return officeFormats[fileModules[module].kind];
}
export function acceptsOfficeUpload(module: OfficeUploadModule, name: string, mime: string) {
  const format = officeUploadFormat(module);
  return (
    name.toLowerCase().endsWith(`.${format.extension}`) &&
    ["", "application/octet-stream", "application/zip", format.mime].includes(mime)
  );
}
export function fileOwnership(ownerId: string, actorId: string) {
  return ownerId === actorId ? "Owner" : "Shared";
}
