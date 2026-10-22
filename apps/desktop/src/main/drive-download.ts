import { z } from "zod";

const id = "[0-9a-fA-F-]{36}";
const downloadRequest = z
  .object({
    path: z
      .string()
      .regex(
        new RegExp(
          `^/api/v1/workspaces/${id}/(?:drive/(?:${id}/download|archive)|documents/${id}/versions/${id}/download|hr/files/${id}/download|messenger/attachments/${id}/download)$`,
        ),
      ),
    body: z.object({ ids: z.array(z.uuid()).min(1).max(100).optional() }).strict(),
  })
  .strict();

export async function driveDownload(
  input: unknown,
  request: (input: unknown) => Promise<{ status: number; body: unknown }>,
  save: (url: string) => void,
) {
  const value = downloadRequest.parse(input);
  save(await authorizedStorageUrl(value, request));
}

/** Renderer supplies an attachment identity path; the main process obtains the actual URL. */
export async function openMessengerAttachment(
  path: unknown,
  request: (input: unknown) => Promise<{ status: number; body: unknown }>,
  open: (url: string) => void | Promise<void>,
) {
  const value = z
    .string()
    .regex(new RegExp(`^/api/v1/workspaces/${id}/messenger/attachments/${id}/preview$`))
    .parse(path);
  await open(await authorizedStorageUrl({ path: value, body: {} }, request));
}

async function authorizedStorageUrl(
  value: { path: string; body: unknown },
  request: (input: unknown) => Promise<{ status: number; body: unknown }>,
) {
  const result = await request({ ...value, method: "POST" });
  if (result.status !== 200) {
    const failure = z.object({ error: z.object({ message: z.string() }) }).safeParse(result.body);
    throw new Error(failure.success ? failure.data.error.message : "Unable to start the download.");
  }
  const body = z.object({ url: z.url() }).parse(result.body);
  const url = new URL(body.url);
  // The URL must come from the authenticated API and point to an HTTPS S3 host.
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^(?:[a-z0-9.-]+\.)?s3[.-][a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/.test(url.hostname)
  )
    throw new Error("Invalid storage download URL");
  return url.href;
}
