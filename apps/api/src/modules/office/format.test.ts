import { Readable } from "node:stream";

import { expect, test } from "vitest";
import { ZipFile } from "yazl";

import { validateOfficeFile } from "./format";
import { officeBytes } from "./office.service";
import { officeTemplate } from "./templates";
async function zip(entries: Record<string, string>) {
  const file = new ZipFile();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    file.outputStream.on("data", (b: Buffer) => chunks.push(b));
    file.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    file.outputStream.on("error", reject);
  });
  for (const [name, value] of Object.entries(entries)) file.addBuffer(Buffer.from(value), name);
  file.end();
  return done;
}
test("authored blank templates are real Office packages and Markdown", async () => {
  for (const kind of ["document", "sheet", "slide", "wiki"] as const)
    await expect(validateOfficeFile(officeTemplate(kind), kind)).resolves.toBeUndefined();
  await expect(validateOfficeFile(officeTemplate("document"), "sheet")).rejects.toThrow(
    "required document parts",
  );
});
test("rejects forged ZIPs, macros, invalid UTF8, NUL and bounded source overflow", async () => {
  for (const bytes of [Buffer.from("PK fake"), Buffer.alloc(0)])
    await expect(validateOfficeFile(bytes, "document")).rejects.toThrow("valid ZIP");
  await expect(
    validateOfficeFile(
      await zip({
        "[Content_Types].xml": "x",
        "word/document.xml": "x",
        "word/vbaProject.bin": "x",
      }),
      "document",
    ),
  ).rejects.toThrow("macro-enabled");
  await expect(
    validateOfficeFile(await zip({ "[Content_Types].xml": "x" }), "document"),
  ).rejects.toThrow("required document parts");
  for (const bytes of [Buffer.from([0]), Buffer.from([255]), Buffer.alloc(2 * 1024 ** 2 + 1, 65)])
    await expect(validateOfficeFile(bytes, "wiki")).rejects.toThrow("supported, bounded");
  await expect(
    officeBytes(Readable.from([Buffer.alloc(64 * 1024 ** 2), Buffer.from("x")])),
  ).rejects.toThrow("64 MiB");
});
