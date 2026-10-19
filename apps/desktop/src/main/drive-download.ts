import { z } from "zod";

const id = "[0-9a-fA-F-]{36}";
const downloadRequest = z
  .object({
    path: z
      .string()
      .regex(new RegExp(`^/api/v1/workspaces/${id}/drive/(?:${id}/download|archive)$`)),
    body: z.object({ ids: z.array(z.uuid()).min(1).max(100).optional() }).strict(),
  })
  .strict();

export async function driveDownload(
  input: unknown,
  request: (input: unknown) => Promise<{ status: number; body: unknown }>,
  save: (url: string) => void,
) {
  const value = downloadRequest.parse(input);
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
  save(url.href);
}
