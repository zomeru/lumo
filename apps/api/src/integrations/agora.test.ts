import { readServerEnv } from "@lumo/env/server";
import { test, expect, vi, afterEach } from "vitest";

import { createAgora } from "./agora";
const env = readServerEnv({
  DATABASE_URL: "postgresql://localhost/lumo_test",
  BETTER_AUTH_SECRET: "test-secret-over-thirty-two-characters",
  AGORA_APP_ID: "a".repeat(32),
  AGORA_APP_CERTIFICATE: "b".repeat(32),
  AGORA_CHAT_APP_KEY: "org#app",
  AGORA_CHAT_REST_ORIGIN: "https://a61.chat.agora.io",
});
afterEach(() => vi.unstubAllGlobals());
test("signs short-lived matching RTC and Chat AccessToken2 credentials without exposing certificate", () => {
  const provider = createAgora(env);
  const rtc = provider.rtcToken("meeting-channel", "user-identity");
  const chat = provider.chatToken("provider-user-uuid");
  expect(rtc).toMatchObject({
    appId: env.AGORA_APP_ID,
    channel: "meeting-channel",
    uid: "user-identity",
  });
  expect(rtc.token).toMatch(/^007/);
  expect(chat.token).toMatch(/^007/);
  expect(new Date(rtc.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(60000);
  expect(JSON.stringify({ rtc, chat })).not.toContain(env.AGORA_APP_CERTIFICATE);
});
test("missing product configuration fails closed before network calls", async () => {
  const provider = createAgora({ ...env, AGORA_APP_CERTIFICATE: undefined });
  expect(() => provider.rtcToken("channel", "user")).toThrow("configuration");
  await expect(
    createAgora({ ...env, AGORA_CHAT_APP_KEY: undefined }).chatUser("user"),
  ).rejects.toMatchObject({ code: "CHAT_NOT_CONFIGURED" });
  expect(() => createAgora({ ...env, AGORA_CHAT_APP_KEY: undefined }).chatToken("uuid")).toThrow(
    /./,
  );
});
test("registered users are looked up by UUID and private groups use a service-owned account", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    const path = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (path.endsWith("/activate") || path.endsWith("/deactivate")) return new Response("{}");
    if (path.endsWith("/chatgroups")) return new Response('{"data":{"groupid":"private-group"}}');
    if (init?.method === "DELETE") return new Response("", { status: 404 });
    return new Response('{"entities":[{"uuid":"provider-uuid"}]}');
  });
  vi.stubGlobal("fetch", fetch);
  const provider = createAgora(env);
  expect(await provider.chatUser("identity")).toBe("provider-uuid");
  expect(await provider.createGroup("Secret team", ["one", "two"])).toBe("private-group");
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/chatgroups"),
    expect.objectContaining({ body: expect.stringContaining('"public":false') }),
  );
  await provider.deactivate("identity");
  await provider.removeMember("private-group", "identity");
});
test("provisions missing users and returns a safe provider error on failures", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response("", { status: 404 }))
    .mockResolvedValueOnce(new Response('{"entities":[{"uuid":"new-user"}]}'));
  vi.stubGlobal("fetch", fetch);
  expect(await createAgora(env).chatUser("new")).toBe("new-user");
  fetch.mockResolvedValueOnce(new Response("secret upstream error", { status: 500 }));
  await expect(createAgora(env).chatUser("one")).rejects.toMatchObject({
    status: 503,
    code: "CHAT_UNAVAILABLE",
  });
  fetch.mockRejectedValueOnce(new Error("network secret"));
  await expect(createAgora(env).chatUser("one")).rejects.not.toThrow("network secret");
});

test("credential refresh never activates a provider identity", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response('{"entities":[{"uuid":"uuid","activated":true}]}'),
  );
  vi.stubGlobal("fetch", fetch);
  const provider = createAgora(env);
  await provider.chatUser("user");
  await provider.chatUser("user");
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockResolvedValueOnce(new Response('{"entities":[{"uuid":"uuid","activated":false}]}'));
  expect(await provider.chatUser("user")).toBe("uuid");
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("creating a fresh authorized group activates a previously revoked identity", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    const path = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (path.endsWith("/chatgroups")) return new Response('{"data":{"groupid":"group"}}');
    if (path.endsWith("/activate")) return new Response("{}");
    return new Response('{"entities":[{"uuid":"uuid","activated":false}]}');
  });
  vi.stubGlobal("fetch", fetch);
  await createAgora(env).createGroup("Team", ["user"]);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/users/user/activate"),
    expect.objectContaining({ method: "POST" }),
  );
});
