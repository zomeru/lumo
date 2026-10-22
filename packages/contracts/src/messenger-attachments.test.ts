import { expect, test } from "vitest";

import { messengerAttachmentInputSchema } from "./messenger";
import {
  attachmentFormat,
  attachmentMimeFromName,
  isMessengerMedia,
  messengerAttachmentFormats,
} from "./messenger-attachments";

test("recognized Messenger formats have bounded upload metadata and deterministic display types", () => {
  for (const [mimeType, format] of Object.entries(messengerAttachmentFormats)) {
    for (const extension of format.extensions) {
      const name = `Report.${extension.toUpperCase()}`;
      expect(attachmentMimeFromName(name)).toBe(mimeType);
      expect(attachmentFormat(mimeType)?.label).toBeTruthy();
      expect(
        messengerAttachmentInputSchema.safeParse({
          name,
          mimeType,
          size: 10,
          checksum: "A".repeat(43) + "=",
        }).success,
      ).toBe(true);
    }
    expect(isMessengerMedia(mimeType)).toBe(["image", "video"].includes(format.kind));
  }
  for (const mimeType of ["image/svg+xml", "text/html", "application/x-msdownload"])
    expect(
      messengerAttachmentInputSchema.safeParse({
        name: "bad.exe",
        mimeType,
        size: 10,
        checksum: "A".repeat(43) + "=",
      }).success,
    ).toBe(false);
  expect(attachmentFormat("application/unknown")).toBeUndefined();
  expect(attachmentMimeFromName("payload.exe")).toBeUndefined();
  expect(attachmentMimeFromName("file")).toBeUndefined();
});
