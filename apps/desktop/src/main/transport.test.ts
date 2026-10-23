import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi, test, expect, beforeEach, afterEach } from "vitest";
const storage = vi.hoisted(() => ({ available: true, backend: "gnome_libsecret" }));
vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => storage.available,
    getSelectedStorageBackend: () => storage.backend,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => {
      if (!value.toString().startsWith("encrypted:")) throw new Error("Invalid ciphertext");
      return value.toString().slice(10);
    },
  },
}));
import { createSessionTransport } from "./transport";
let dir: string;
beforeEach(async () => {
  storage.available = true;
  storage.backend = "gnome_libsecret";
  dir = await mkdtemp(join(tmpdir(), "lumolynk-session-"));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});
test("main owns cookie transport, encrypted persistence, renewal and logout", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response('{"ok":true}', {
        headers: { "Set-Cookie": "session=secret-session; HttpOnly; Path=/; SameSite=Lax" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const path = join(dir, "session.enc");
  let transport = await createSessionTransport(
    "http://localhost:3001",
    "http://localhost:3000",
    path,
  );
  expect(
    await transport({
      path: "/api/auth/sign-in/email",
      method: "POST",
      body: { email: "alice@example.com" },
    }),
  ).toEqual({ status: 200, body: { ok: true } });
  expect((await readFile(path, "utf8")).startsWith("encrypted:")).toBe(true);
  transport = await createSessionTransport("http://localhost:3001", "http://localhost:3000", path);
  await transport({ path: "/api/v1/me" });
  expect(fetch).toHaveBeenLastCalledWith(
    new URL("http://localhost:3001/api/v1/me"),
    expect.objectContaining({
      headers: expect.objectContaining({
        Cookie: "session=secret-session",
        Origin: "http://localhost:3000",
      }),
    }),
  );
  fetch.mockResolvedValueOnce(new Response('{"ok":true}'));
  await transport({ path: "/api/auth/sign-out", method: "POST", body: {} });
  await expect(readFile(path)).rejects.toThrow(/./);
  await transport({ path: "/api/v1/me" });
  expect(fetch).toHaveBeenLastCalledWith(
    expect.any(URL),
    expect.objectContaining({ headers: expect.objectContaining({ Cookie: "" }) }),
  );
});
test.each([false, true])(
  "unprotected Linux key store never writes cookies (available=%s)",
  async (available) => {
    storage.available = available;
    storage.backend = "basic_text";
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response('{"ok":true}', { headers: { "Set-Cookie": "session=value; Path=/" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const path = join(dir, "session.enc");
    const transport = await createSessionTransport(
      "http://localhost:3001",
      "http://localhost:3000",
      path,
    );
    await transport({ path: "/api/v1/me" });
    await expect(readFile(path)).rejects.toThrow(/./);
  },
);
test("corrupt persisted sessions are discarded and network failures expose safe errors", async () => {
  const path = join(dir, "session.enc");
  await writeFile(path, "bad");
  const transport = await createSessionTransport("https://api.test", "https://web.test", path);
  await expect(readFile(path)).rejects.toThrow(/./);
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof globalThis.fetch>(async () => {
      throw new Error("secret internal failure");
    }),
  );
  expect(await transport({ path: "/api/v1/me" })).toMatchObject({
    status: 503,
    body: { error: { code: "OFFLINE" } },
  });
  expect(() => transport({ path: "https://evil.test" })).toThrow(/./);
});
test("renewal and signout are serialized so stale requests cannot restore a logged-out session", async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof globalThis.fetch>(async (url) => {
      calls.push(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
      return new Response("{}");
    }),
  );
  const transport = await createSessionTransport(
    "https://api.test",
    "https://web.test",
    join(dir, "session.enc"),
  );
  await Promise.all([
    transport({ path: "/api/v1/me" }),
    transport({ path: "/api/auth/sign-out", method: "POST" }),
  ]);
  expect(calls).toEqual(["https://api.test/api/v1/me", "https://api.test/api/auth/sign-out"]);
});
