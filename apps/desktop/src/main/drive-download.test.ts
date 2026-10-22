import { expect, test, vi } from "vitest";

import { driveDownload } from "./drive-download";

const path =
  "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/drive/22222222-2222-4222-8222-222222222222/download";
test("desktop downloads only through an authenticated Drive endpoint and S3 HTTPS URLs", async () => {
  const save = vi.fn<(url: string) => void>();
  const request = vi.fn<(input: unknown) => Promise<{ status: number; body: unknown }>>(
    async () => ({
      status: 200,
      body: { url: "https://bucket.s3.us-east-1.amazonaws.com/key?signed=yes" },
    }),
  );
  await driveDownload({ path, body: {} }, request, save);
  expect(request).toHaveBeenCalledWith({ path, method: "POST", body: {} });
  expect(save).toHaveBeenCalledOnce();
  for (const url of [
    "file:///etc/passwd",
    "https://evil.test/a",
    "https://user:pass@bucket.s3.us-east-1.amazonaws.com/a",
    "http://bucket.s3.us-east-1.amazonaws.com/a",
  ]) {
    request.mockResolvedValueOnce({ status: 200, body: { url } });
    await expect(driveDownload({ path, body: {} }, request, save)).rejects.toThrow(
      "Invalid storage download URL",
    );
  }
  await expect(driveDownload({ path: "/api/v1/me", body: {} }, request, save)).rejects.toThrow(/./);
  await expect(driveDownload({ path, body: { arbitrary: true } }, request, save)).rejects.toThrow(
    /./,
  );
  request.mockResolvedValueOnce({ status: 404, body: { error: { message: "Access revoked" } } });
  await expect(driveDownload({ path, body: {} }, request, save)).rejects.toThrow("Access revoked");
  request.mockResolvedValueOnce({ status: 500, body: null });
  await expect(driveDownload({ path, body: {} }, request, save)).rejects.toThrow(
    "Unable to start the download",
  );
});

test("desktop HR downloads retain the authenticated path and storage-host checks", async () => {
  const request = vi.fn<() => Promise<{ status: number; body: unknown }>>(async () => ({
      status: 200,
      body: { url: "https://bucket.s3.us-east-1.amazonaws.com/hr/signed" },
    })),
    save = vi.fn<(url: string) => void>();
  const hrPath = path.replace("/drive/", "/hr/files/");
  await driveDownload({ path: hrPath, body: {} }, request, save);
  expect(save).toHaveBeenCalledWith("https://bucket.s3.us-east-1.amazonaws.com/hr/signed");
  await expect(
    driveDownload({ path: hrPath.replace("/download", "/complete"), body: {} }, request, save),
  ).rejects.toThrow(/./);
});

test("Messenger downloads keep the same endpoint and private S3 host restrictions", async () => {
  const request = vi.fn<() => Promise<{ status: number; body: unknown }>>(async () => ({
      status: 200,
      body: { url: "https://bucket.s3.us-east-1.amazonaws.com/messenger/signed" },
    })),
    save = vi.fn<(url: string) => void>();
  const filePath = path.replace("/drive/", "/messenger/attachments/");
  await driveDownload({ path: filePath, body: {} }, request, save);
  expect(save).toHaveBeenCalledTimes(1);
  await expect(
    driveDownload({ path: filePath.replace("/download", "/complete"), body: {} }, request, save),
  ).rejects.toThrow(/./);
});
