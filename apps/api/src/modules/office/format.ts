import type { OfficeKind } from "@lumo/contracts/office";
import { fromBuffer } from "yauzl";

import { AppError } from "../../lib/errors";
import { OFFICE_MAX_BYTES } from "./provider";

export async function validateOfficeFile(bytes: Buffer, kind: OfficeKind) {
  function invalid(): never {
    throw new AppError(
      400,
      "INVALID_OFFICE_FILE",
      "The file is not a supported, bounded Office document.",
    );
  }
  if (bytes.length > OFFICE_MAX_BYTES) invalid();
  if (kind === "wiki") {
    if (bytes.length > 2 * 1024 ** 2 || bytes.includes(0)) invalid();
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      invalid();
    }
    return;
  }
  const required = new Set([
    "[Content_Types].xml",
    { document: "word/document.xml", sheet: "xl/workbook.xml", slide: "ppt/presentation.xml" }[
      kind
    ],
  ]);
  await new Promise<void>((resolve, reject) =>
    fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) {
        reject(
          new AppError(400, "INVALID_OFFICE_FILE", "The Office file is not a valid ZIP package."),
        );
        return;
      }
      let expanded = 0,
        count = 0;
      zip.on("error", () => {
        zip.close();
        reject(new AppError(400, "INVALID_OFFICE_FILE", "The Office ZIP package is invalid."));
      });
      zip.on("entry", (entry) => {
        expanded += entry.uncompressedSize;
        count++;
        if (
          expanded > 512 * 1024 ** 2 ||
          count > 10000 ||
          entry.generalPurposeBitFlag & 1 ||
          /(?:vbaProject\.bin|(?:^|\/)ActiveX\/)/i.test(entry.fileName)
        ) {
          zip.close();
          reject(
            new AppError(
              400,
              "INVALID_OFFICE_FILE",
              "Encrypted, macro-enabled or oversized Office packages cannot be edited.",
            ),
          );
          return;
        }
        required.delete(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => {
        zip.close();
        if (required.size)
          reject(
            new AppError(
              400,
              "INVALID_OFFICE_FILE",
              "The Office package is missing its required document parts.",
            ),
          );
        else resolve();
      });
      zip.readEntry();
    }),
  );
}
