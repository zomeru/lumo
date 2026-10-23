import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createRendererPolicy } from "./renderer-policy";

const api = "http://localhost:3001";
const office = "https://office.example.com";
const configured = () => Response.json({ documentServerUrl: office });
const scriptPolicy = (csp: string) => csp.split(";").find((value) => value.includes("script-src"));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function load(policy: () => Promise<string>) {
  const pending = policy();
  await vi.runAllTimersAsync();
  return pending;
}

test("retries an API startup failure and grants only the exact configured editor host", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("API not listening yet"))
    .mockResolvedValueOnce(configured());
  const csp = await load(createRendererPolicy(api, "http://127.0.0.1:5174", "nonce", request));
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenLastCalledWith(`${api}/api/config/office`, {
    cache: "no-store",
    redirect: "error",
    signal: expect.any(AbortSignal),
  });
  expect(scriptPolicy(csp)).toBe(` script-src 'self' 'nonce-nonce' ${office}`);
  expect(csp).toContain(` ${office}; frame-ancestors`);
  expect(csp).not.toContain("unsafe-eval");
});

test("a later page reload recovers after the API was unavailable for the whole first load", async () => {
  const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
  const policy = createRendererPolicy(api, undefined, undefined, request);
  expect(scriptPolicy(await load(policy))).toBe(" script-src 'self'");
  expect(request).toHaveBeenCalledTimes(3);
  request.mockImplementation(async () => configured());
  expect(scriptPolicy(await load(policy))).toBe(` script-src 'self' ${office}`);
  expect(request).toHaveBeenCalledTimes(4);
});

test("preserves the approved host during outages and removes it when the API disables Office", async () => {
  const request = vi.fn<typeof fetch>(async () => configured());
  const policy = createRendererPolicy(api, undefined, undefined, request);
  expect(scriptPolicy(await load(policy))).toContain(office);
  request.mockRejectedValue(new TypeError("offline"));
  expect(scriptPolicy(await load(policy))).toContain(office);
  request.mockImplementation(async () => Response.json({}));
  expect(scriptPolicy(await load(policy))).toBe(" script-src 'self'");
});

test.each([
  { documentServerUrl: "javascript:alert(1)" },
  { documentServerUrl: "http://evil.example.com" },
  { documentServerUrl: "https://office.example.com/path" },
  { documentServerUrl: "https://user:password@office.example.com" },
  { documentServerUrl: 42 },
  null,
  "not a configuration object",
])("invalid configuration does not grant a remote script host: %j", async (config) => {
  const request = vi.fn<typeof fetch>(async () => Response.json(config));
  const csp = await load(createRendererPolicy(api, undefined, undefined, request));
  expect(scriptPolicy(csp)).toBe(" script-src 'self'");
  expect(csp).not.toContain("office.example.com");
  expect(csp).not.toContain("evil.example.com");
});

test("replaces the host after an authorized provider configuration change", async () => {
  const request = vi.fn<typeof fetch>(async () => configured());
  const policy = createRendererPolicy(api, undefined, undefined, request);
  await load(policy);
  request.mockImplementation(async () =>
    Response.json({ documentServerUrl: "https://new.example.com" }),
  );
  const csp = await load(policy);
  expect(scriptPolicy(csp)).toBe(" script-src 'self' https://new.example.com");
  expect(csp).not.toContain(office);
});
