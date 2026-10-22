import { AppError } from "../../lib/errors";

// Active content is always an attachment. Only these formats receive inline URLs.
export function previewType(mime: string) {
  if (mime === "text/markdown") return "text/plain";
  return [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
  ].includes(mime)
    ? mime
    : undefined;
}
export function validateSignature(mime: string, bytes: Uint8Array) {
  const starts = (...prefix: number[]) => prefix.every((b, i) => bytes[i] === b);
  const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  const signatures: Record<string, () => boolean> = {
    "image/png": () => starts(137, 80, 78, 71, 13, 10, 26, 10),
    "image/jpeg": () => starts(255, 216, 255),
    "image/gif": () => ["GIF87a", "GIF89a"].includes(ascii(0, 6)),
    "image/webp": () => ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
    "video/mp4": () =>
      ascii(4, 8) === "ftyp" && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(ascii(8, 12)),
    "video/webm": () => starts(0x1a, 0x45, 0xdf, 0xa3) && ascii(0, bytes.length).includes("webm"),
    "application/x-7z-compressed": () => starts(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c),
    "application/vnd.rar": () => starts(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07),
    "application/msword": () => starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
    "application/vnd.ms-excel": () => starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
    "application/vnd.ms-powerpoint": () => starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
    "application/pdf": () => ascii(0, 5) === "%PDF-",
    "application/zip": () => starts(80, 75, 3, 4) || starts(80, 75, 5, 6),
  };
  const office = mime.startsWith("application/vnd.openxmlformats-officedocument.");
  let valid = office ? starts(80, 75, 3, 4) : (signatures[mime]?.() ?? true);
  if (mime.startsWith("text/") || mime === "application/json") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
      valid = !bytes.includes(0);
    } catch {
      valid = false;
    }
  }
  // Never accept an executable disguised as a harmless file.
  if (starts(77, 90) || starts(127, 69, 76, 70)) valid = false;
  if (!valid)
    throw new AppError(
      400,
      "INVALID_FILE_CONTENT",
      "The file contents do not match the declared type or contain an executable.",
    );
}
