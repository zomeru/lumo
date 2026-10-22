import { z } from "zod";

/** Upload extensions, display metadata and preview capability share one bounded allowlist. */
export const messengerAttachmentFormats = {
  "image/png": { extensions: ["png"], label: "PNG image", kind: "image" },
  "image/jpeg": { extensions: ["jpg", "jpeg"], label: "JPEG image", kind: "image" },
  "image/webp": { extensions: ["webp"], label: "WebP image", kind: "image" },
  "image/gif": { extensions: ["gif"], label: "GIF image", kind: "image" },
  "video/mp4": { extensions: ["mp4", "m4v"], label: "MP4 video", kind: "video" },
  "video/webm": { extensions: ["webm"], label: "WebM video", kind: "video" },
  "application/pdf": { extensions: ["pdf"], label: "PDF document", kind: "pdf" },
  "text/plain": { extensions: ["txt"], label: "Text file", kind: "text" },
  "text/csv": { extensions: ["csv"], label: "CSV spreadsheet", kind: "sheet" },
  "text/markdown": { extensions: ["md", "markdown"], label: "Markdown", kind: "text" },
  "application/json": { extensions: ["json"], label: "JSON file", kind: "text" },
  "application/msword": { extensions: ["doc"], label: "Word document", kind: "document" },
  "application/vnd.ms-excel": { extensions: ["xls"], label: "Excel spreadsheet", kind: "sheet" },
  "application/vnd.ms-powerpoint": {
    extensions: ["ppt"],
    label: "PowerPoint",
    kind: "presentation",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: ["docx"],
    label: "Word document",
    kind: "document",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: ["xlsx"],
    label: "Excel spreadsheet",
    kind: "sheet",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extensions: ["pptx"],
    label: "PowerPoint",
    kind: "presentation",
  },
  "application/zip": { extensions: ["zip"], label: "ZIP archive", kind: "archive" },
  "application/x-7z-compressed": { extensions: ["7z"], label: "7-Zip archive", kind: "archive" },
  "application/vnd.rar": { extensions: ["rar"], label: "RAR archive", kind: "archive" },
} as const;
type Mime = keyof typeof messengerAttachmentFormats;
export const messengerAttachmentMimeSchema = z.enum(
  Object.keys(messengerAttachmentFormats) as [Mime, ...Mime[]],
);
export const messengerAttachmentUrlSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export function attachmentFormat(mime: string) {
  return Object.hasOwn(messengerAttachmentFormats, mime)
    ? messengerAttachmentFormats[mime as Mime]
    : undefined;
}
export function attachmentMimeFromName(name: string) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  return (
    Object.entries(messengerAttachmentFormats) as [Mime, { extensions: readonly string[] }][]
  ).find(([, format]) => extension && format.extensions.includes(extension))?.[0];
}
export function isMessengerMedia(mime: string) {
  const kind = attachmentFormat(mime)?.kind;
  return kind === "image" || kind === "video";
}
