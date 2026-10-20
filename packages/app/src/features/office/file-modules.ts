import { type OfficeKind } from "@lumo/contracts/files";
import { BookOpen, FileText, Folder, Files, Sheet, Presentation } from "lucide-react";

export const moduleIcons = {
  docs: FileText,
  sheets: Sheet,
  slides: Presentation,
  wiki: BookOpen,
  drive: Folder,
  all: Files,
};
export const moduleRoutes = {
  docs: "/w/$workspaceId/docs",
  sheets: "/w/$workspaceId/sheets",
  slides: "/w/$workspaceId/slides",
  wiki: "/w/$workspaceId/wiki",
  drive: "/w/$workspaceId/drive",
  all: "/w/$workspaceId/files",
} as const;
export const kindModules = {
  document: "docs",
  sheet: "sheets",
  slide: "slides",
  wiki: "wiki",
} as const;
export function officeLocation(workspaceId: string, id: string, kind: OfficeKind) {
  if (kind === "wiki")
    return { to: "/w/$workspaceId/wiki/$pageId", params: { workspaceId, pageId: id } } as const;
  const to = {
    document: "/w/$workspaceId/docs/$documentId",
    sheet: "/w/$workspaceId/sheets/$documentId",
    slide: "/w/$workspaceId/slides/$documentId",
  } as const;
  return { to: to[kind], params: { workspaceId, documentId: id } };
}
