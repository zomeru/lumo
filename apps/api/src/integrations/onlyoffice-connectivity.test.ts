import { expect, test, vi } from "vitest";

import { checkOnlyOfficeConnectivity } from "./onlyoffice-connectivity";

const config = {
  documentServerUrl: "https://docs.example.com",
  publicApiUrl: "https://api.example.com",
};
const script = () =>
  new Response("window.DocsAPI = {};", { headers: { "content-type": "application/javascript" } });
const ready = () => Response.json({ status: "ready" });

test("checks both HTTPS endpoints without credentials, redirects or unbounded requests", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(script())
    .mockResolvedValueOnce(ready());
  const result = await checkOnlyOfficeConnectivity(config, request);
  expect(result.map((check) => check.ok)).toEqual([true, true]);
  expect(
    request.mock.calls.map(([url]) =>
      url instanceof URL ? url.href : url instanceof Request ? url.url : url,
    ),
  ).toEqual([
    "https://docs.example.com/web-apps/apps/api/documents/api.js",
    "https://api.example.com/ready",
  ]);
  for (const [, options] of request.mock.calls) {
    expect(options).toMatchObject({
      redirect: "error",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toBeUndefined();
    expect(options?.body).toBeUndefined();
  }
});

test.each([
  () => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }),
  () => new Response("window.OtherAPI = {};", { headers: { "content-type": "text/javascript" } }),
  () => new Response("DocsAPI", { status: 500 }),
  () => new Response(null, { status: 204 }),
  () => new Response("DocsAPI", { headers: { "content-length": String(256 * 1024 + 1) } }),
  () => new Response("DocsAPI".repeat(40_000)),
])("rejects failed, invalid and oversized script responses", async (response) => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(ready());
  expect((await checkOnlyOfficeConnectivity(config, request)).map((check) => check.ok)).toEqual([
    false,
    true,
  ]);
});

test.each([
  () => Response.json({ status: "ok" }),
  () => Response.json(null),
  () => new Response("not json", { headers: { "content-type": "application/json" } }),
  () => new Response('{"status":"ready"}', { headers: { "content-type": "text/html" } }),
])("rejects non-LumoLynk or malformed readiness responses", async (response) => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(script())
    .mockResolvedValueOnce(response());
  expect((await checkOnlyOfficeConnectivity(config, request)).map((check) => check.ok)).toEqual([
    true,
    false,
  ]);
});

test("network and response failures never expose URLs or response content", async () => {
  const sensitive = "private-token-do-not-print";
  const request = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error(`https://docs.example.com?token=${sensitive}`))
    .mockResolvedValueOnce(new Response(sensitive, { status: 503 }));
  const result = await checkOnlyOfficeConnectivity(config, request);
  expect(result.every((check) => !check.ok)).toBe(true);
  expect(JSON.stringify(result)).not.toContain(sensitive);
  expect(JSON.stringify(result)).not.toContain("https://");
});
