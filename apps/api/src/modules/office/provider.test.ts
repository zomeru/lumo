import { readServerEnv } from "@lumolynk/env/server";
import { sign } from "hono/jwt";
import { expect, test, vi, afterEach } from "vitest";

import { createOfficeProvider, officeKey } from "./provider";
const env = readServerEnv({
  DATABASE_URL: "postgres://localhost/test",
  BETTER_AUTH_SECRET: "test-secret-with-thirty-two-characters",
  ONLYOFFICE_DOCUMENT_SERVER_URL: "https://office.example.com",
  ONLYOFFICE_JWT_SECRET: "provider-secret-with-thirty-two-characters",
  ONLYOFFICE_PUBLIC_API_BASE_URL: "https://api.example.com",
});
const provider = createOfficeProvider(env);
afterEach(() => vi.unstubAllGlobals());
test("provider requires complete configuration, HS256 and actual JWT claims", async () => {
  expect(() =>
    createOfficeProvider({ ...env, ONLYOFFICE_JWT_SECRET: undefined }).configured(),
  ).toThrow("not configured");
  await expect(provider.verify("bad")).rejects.toThrow("invalid or expired");
  await expect(
    provider.verify(await sign({ exp: 1 }, env.ONLYOFFICE_JWT_SECRET!, "HS256")),
  ).rejects.toThrow("invalid or expired");
  await expect(
    provider.verify(await sign({ status: 4 }, env.ONLYOFFICE_JWT_SECRET!, "HS384")),
  ).rejects.toThrow("invalid or expired");
  const token = await provider.sign({ payload: { key: "key", status: 4 } });
  expect(await provider.callback({ status: 2, url: "http://attacker" }, `Bearer ${token}`)).toEqual(
    { key: "key", status: 4 },
  );
  await expect(
    provider.callback({ token: await provider.sign({ key: "key", status: 6 }) }, undefined),
  ).rejects.toThrow("Invalid document callback");
  await expect(provider.callback({}, undefined)).rejects.toThrow("signed provider callback");
});
test("callback downloads reject untrusted origins, credentials, private literal IPs and schemes before fetching", async () => {
  for (const url of [
    "http://office.example.com/x",
    "https://office.example.com.attacker/x",
    "https://evil.example/x",
    "https://user:pass@office.example.com/x",
    "file:///etc/passwd",
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest",
  ])
    await expect(provider.download(url)).rejects.toThrow(/./);
  const local = createOfficeProvider({
    ...env,
    ONLYOFFICE_DOCUMENT_SERVER_URL: "https://127.0.0.1",
  });
  await expect(local.download("https://127.0.0.1/file")).rejects.toThrow(/./);
});
test("commands use signed JSON and reject redirects/HTTP/provider failures without exposing secrets", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(JSON.stringify({ error: 0 }), {
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  await provider.command({ c: "forcesave", key: "key" });
  const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
  expect((await provider.verify(body.token)).c).toBe("forcesave");
  expect(fetch.mock.calls[0]![1]!.redirect).toBe("error");
  for (const response of [
    new Response('{"error":1}'),
    new Response("invalid"),
    new Response("{}", { status: 503 }),
  ]) {
    fetch.mockResolvedValueOnce(response);
    await expect(provider.command({ c: "drop", key: "key" })).rejects.toThrow(
      "editor could not complete",
    );
  }
  fetch.mockResolvedValueOnce(new Response('{"error":4}'));
  await expect(provider.command({ c: "forcesave", key: "key" })).resolves.toEqual({ error: 4 });
  expect(officeKey("w", "d", 0, "https://api")).not.toBe(officeKey("w", "d", 1, "https://api"));
  expect(officeKey("w", "d", 0, "https://api")).not.toBe(officeKey("other", "d", 0, "https://api"));
});
