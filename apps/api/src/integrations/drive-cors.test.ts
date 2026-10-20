import { expect, test, vi } from "vitest";

import { memoryStorage } from "../test/storage";
import { checkDriveCors } from "./drive-cors";
test("checks actual browser preflight headers without sending object bytes or leaking signed URLs", async () => {
  const memory = memoryStorage();
  const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
    const headers = new Headers(options?.headers);
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": headers.get("origin")!,
        "Access-Control-Allow-Methods": "GET, HEAD, PUT",
      },
    });
  });
  const results = await checkDriveCors(
    memory.storage,
    ["https://web.example.com", "lumo://app"],
    fetcher,
  );
  expect(results.every((v) => v.allowed)).toBe(true);
  expect(results).toHaveLength(4);
  expect(memory.objects.size).toBe(0);
  for (const [, options] of fetcher.mock.calls) {
    expect(options?.method).toBe("OPTIONS");
    expect(options?.redirect).toBe("error");
    expect(options?.body).toBeUndefined();
  }
  expect(JSON.stringify(results)).not.toContain("amazonaws");
});
test("denied, missing, foreign origins, missing methods and network failures fail safely", async () => {
  const memory = memoryStorage();
  for (const response of [
    new Response(null, { status: 403 }),
    new Response(null),
    new Response(null, {
      headers: { "Access-Control-Allow-Origin": "https://foreign.example.com" },
    }),
    new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "https://web.example.com",
        "Access-Control-Allow-Methods": "HEAD",
      },
    }),
  ]) {
    const results = await checkDriveCors(memory.storage, ["https://web.example.com"], async () =>
      response.clone(),
    );
    expect(results.every((v) => !v.allowed)).toBe(true);
  }
  const wildcard = await checkDriveCors(
    memory.storage,
    ["https://web.example.com"],
    async () =>
      new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT" },
      }),
  );
  expect(wildcard.every((v) => v.allowed)).toBe(true);
  const broken = await checkDriveCors(memory.storage, ["https://web.example.com"], async () => {
    throw new Error("sensitive URL");
  });
  expect(broken.every((v) => !v.allowed)).toBe(true);
  expect(JSON.stringify(broken)).not.toContain("sensitive");
});
