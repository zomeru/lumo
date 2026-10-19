import { test, expect, vi, afterEach } from "vitest";
import { z } from "zod";

import { createApi, fetchTransport, ApiError, type Transport } from "./index";
afterEach(() => vi.unstubAllGlobals());
test("injectable transports validate responses and normalize safe errors", async () => {
  const transport = vi.fn<Transport>(async () => ({ status: 200, body: { ok: true } }));
  const api = createApi(transport);
  await expect(api("/me", z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
  expect(transport).toHaveBeenCalledWith("/api/v1/me", {});
  transport.mockResolvedValueOnce({
    status: 403,
    body: { error: { code: "FORBIDDEN", message: "Denied" } },
  });
  await expect(api("/api/auth/sign-out", z.any())).rejects.toMatchObject({
    status: 403,
    code: "FORBIDDEN",
    message: "Denied",
  });
  transport.mockResolvedValueOnce({ status: 503, body: null });
  await expect(api("/me", z.any())).rejects.toBeInstanceOf(ApiError);
  transport.mockResolvedValueOnce({ status: 200, body: {} });
  await expect(api("/me", z.string())).rejects.toThrow(/./);
  const controller = new AbortController();
  controller.abort();
  await expect(api("/me", z.any(), { signal: controller.signal })).rejects.toThrow("aborted");
});
test("browser adapter forwards credentials, signal and JSON without platform imports", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify({ ok: true })),
  );
  vi.stubGlobal("fetch", fetch);
  const transport = fetchTransport("https://api.test");
  await transport("/api/v1/me", { method: "PATCH", body: { name: "Alice" } });
  expect(fetch).toHaveBeenCalledWith(
    "https://api.test/api/v1/me",
    expect.objectContaining({ credentials: "include", method: "PATCH", body: '{"name":"Alice"}' }),
  );
  fetch.mockResolvedValueOnce(new Response("bad"));
  expect((await transport("/api/v1/me", {})).body).toBeNull();
});
