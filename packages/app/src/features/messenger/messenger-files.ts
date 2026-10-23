import {
  messengerAttachmentSchema,
  attachmentMimeFromName,
  messengerAttachmentUrlSchema,
} from "@lumolynk/contracts/messenger";
import { z } from "zod";

import { api } from "../../lib/api";
import { getPlatform } from "../../platform";
import { putFile } from "../drive/upload";
import { messengerPath } from "./messenger-api";

export async function uploadAttachment(
  workspaceId: string,
  conversationId: string,
  file: File,
  signal: AbortSignal,
) {
  if (file.size < 1 || file.size > 20 * 1024 ** 2)
    throw new Error("Choose a file between 1 byte and 20 MB.");
  const mimeType = attachmentMimeFromName(file.name);
  if (!mimeType)
    throw new Error(
      "This file type is not supported. Choose an image, MP4/WebM video, document, spreadsheet, text file or archive.",
    );
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
    checksum = btoa(String.fromCharCode(...hash));
  const upload = await api(
    `${messengerPath(workspaceId, conversationId)}/attachments`,
    z.object({ id: z.uuid(), url: z.url() }),
    { method: "POST", body: { name: file.name, mimeType, size: file.size, checksum }, signal },
  );
  await putFile(
    upload.url,
    file,
    { "Content-Type": mimeType, "x-amz-checksum-sha256": checksum },
    signal,
    () => {},
  );
  return api(
    `/workspaces/${workspaceId}/messenger/attachments/${upload.id}/complete`,
    messengerAttachmentSchema,
    { method: "POST", body: {}, signal },
  );
}
export async function downloadAttachment(workspaceId: string, id: string) {
  const path = `/workspaces/${workspaceId}/messenger/attachments/${id}/download`,
    platform = getPlatform();
  if (platform?.download) return platform.download(`/api/v1${path}`, {});
  const result = await api(path, z.object({ url: z.url() }), { method: "POST", body: {} });
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.rel = "noreferrer";
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export const attachmentPreviewQuery = (workspaceId: string, id: string) => ({
  queryKey: ["workspace", workspaceId, "messenger", "attachment-preview", id],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    api(
      `/workspaces/${workspaceId}/messenger/attachments/${id}/preview`,
      messengerAttachmentUrlSchema,
      { method: "POST", body: {}, signal },
    ),
  staleTime: 60000,
  gcTime: 0,
  retry: false,
});
