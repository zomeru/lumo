import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readServerEnv } from "@lumo/env/server";
import type { Logger } from "pino";
import { Resend } from "resend";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createEmailProvider, type EmailMessage } from "./email.ts";
import { FileEmailProvider } from "./file-email-provider.ts";
import { ResendEmailProvider } from "./resend-email-provider.ts";

// Route promise timers through the fake clock so backoff tests never wait in real time.
vi.mock("node:timers/promises", () => ({
  setTimeout: (delay: number) =>
    new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay)),
}));

const base = {
  DATABASE_URL: "postgresql://localhost/unused",
  BETTER_AUTH_SECRET: "a".repeat(48),
  API_ORIGIN: "https://api.example.com",
  WEB_ORIGIN: "https://example.com",
  RESEND_API_KEY: "re_synthetic_secret",
  EMAIL_FROM: "hello@lumolynk.com",
  EMAIL_FROM_NAME: "Lumo",
  LOG_LEVEL: "silent",
};
const message: EmailMessage = {
  to: "alice@example.com",
  subject: "Verify your Lumo email",
  text: "Verify your email: https://example.com/verify?token=sensitive-token",
  html: '<a href="https://example.com/verify?token=sensitive-token">Verify</a>',
  url: "https://example.com/verify?token=sensitive-token",
};
const dirs: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function outbox() {
  const dir = await mkdtemp(join(tmpdir(), "lumo-email-test-"));
  dirs.push(dir);
  return dir;
}
function mockResend() {
  // Exercise the real SDK with an intercepted transport; no test can reach Resend.
  vi.stubEnv("NODE_ENV", "production");
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ id: "email-id" }));
  vi.stubGlobal("fetch", fetch);
  const logger = { warn: vi.fn<Logger["warn"]>(), error: vi.fn<Logger["error"]>() };
  const provider = new ResendEmailProvider(
    readServerEnv({ ...base, NODE_ENV: "production" }),
    logger,
  );
  return { fetch, logger, provider };
}
function apiError(status: number, name: string, headers?: HeadersInit) {
  return Response.json(
    {
      name,
      statusCode: status,
      message: `${base.RESEND_API_KEY} sensitive-token alice@example.com`,
    },
    { status, headers },
  );
}

describe("file delivery and environment selection", () => {
  test.each(["development", "test"] as const)(
    "%s only writes private previews even with credentials",
    async (NODE_ENV) => {
      const root = await outbox();
      const dir = join(root, "mail");
      const fetch = vi.fn<typeof globalThis.fetch>(() => {
        throw new Error("Real email is forbidden");
      });
      vi.stubGlobal("fetch", fetch);
      const provider = createEmailProvider(readServerEnv({ ...base, NODE_ENV, MAIL_DIR: dir }));
      expect(provider).toBeInstanceOf(FileEmailProvider);
      await Promise.all([provider.send(message), provider.send(message)]);
      const files = await readdir(dir);
      expect(files).toHaveLength(2);
      for (const file of files) {
        expect(JSON.parse(await readFile(join(dir, file), "utf8"))).toEqual({
          from: "Lumo <hello@lumolynk.com>",
          ...message,
        });
      }
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test.skipIf(process.platform === "win32")(
    "outbox and previews have private POSIX permissions",
    async () => {
      const dir = join(await outbox(), "mail");
      const provider = createEmailProvider(readServerEnv({ ...base, MAIL_DIR: dir }));
      await provider.send(message);
      const files = await readdir(dir);
      expect((await stat(dir)).mode & 0o777).toBe(0o700);
      expect((await stat(join(dir, files[0]!))).mode & 0o777).toBe(0o600);
    },
  );

  test("local defaults need no Resend credentials", async () => {
    const env = readServerEnv({
      DATABASE_URL: base.DATABASE_URL,
      BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET,
      MAIL_DIR: await outbox(),
    });
    expect(createEmailProvider(env)).toBeInstanceOf(FileEmailProvider);
    await createEmailProvider(env).send(message);
  });

  test("filesystem errors are actionable without exposing message content", async () => {
    const path = join(await outbox(), "blocked");
    await writeFile(path, "file");
    const provider = createEmailProvider(readServerEnv({ ...base, MAIL_DIR: path }));
    await expect(provider.send(message)).rejects.toThrow(
      "check MAIL_DIR and filesystem permissions",
    );
  });

  test("production only selects Resend and rejects bypassed configuration", async () => {
    const dir = await outbox();
    const env = readServerEnv({ ...base, NODE_ENV: "production", MAIL_DIR: dir });
    expect(createEmailProvider(env)).toBeInstanceOf(ResendEmailProvider);
    expect(() => createEmailProvider({ ...env, RESEND_API_KEY: undefined })).toThrow(
      "RESEND_API_KEY",
    );
    expect(() => createEmailProvider({ ...env, EMAIL_FROM: "hello@other.com" })).toThrow(
      "lumolynk.com",
    );
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("Resend delivery", () => {
  test("sends from the configured notification subdomain", async () => {
    const { fetch, logger } = mockResend();
    const provider = new ResendEmailProvider(
      readServerEnv({
        ...base,
        NODE_ENV: "production",
        EMAIL_FROM: "noreply@notify.lumolynk.com",
      }),
      logger,
    );
    await provider.send(message);
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string).from).toBe(
      "Lumo <noreply@notify.lumolynk.com>",
    );
  });

  test("uses the official SDK with the configured sender and content", async () => {
    const { fetch, provider, logger } = mockResend();
    await provider.send(message);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(options?.headers).get("authorization")).toBe(
      `Bearer ${base.RESEND_API_KEY}`,
    );
    expect(JSON.parse(options?.body as string)).toEqual({
      from: "Lumo <hello@lumolynk.com>",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    await provider.send(message);
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("idempotency-key")).not.toBe(
      new Headers(fetch.mock.calls[1]![1]?.headers).get("idempotency-key"),
    );
  });

  test.each([
    [408, "application_error"],
    [500, "application_error"],
    [503, "service_unavailable"],
    [429, "rate_limit_exceeded"],
    [409, "concurrent_idempotent_requests"],
  ])("retries transient %i %s using the same payload and idempotency key", async (status, name) => {
    const { fetch, provider, logger } = mockResend();
    fetch.mockResolvedValueOnce(apiError(status, name));
    const delivery = provider.send(message);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![1]?.body).toBe(fetch.mock.calls[0]![1]?.body);
    const keys = fetch.mock.calls.map(([, options]) =>
      new Headers(options?.headers).get("idempotency-key"),
    );
    expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
      /sensitive-token|alice@example.com|re_synthetic_secret/,
    );
  });

  test.each(["seconds", "date"])("honors Retry-After in %s format", async (format) => {
    const { fetch, provider } = mockResend();
    const header = format === "seconds" ? "5" : new Date(Date.now() + 5000).toUTCString();
    fetch.mockResolvedValueOnce(apiError(429, "rate_limit_exceeded", { "retry-after": header }));
    const delivery = provider.send(message);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test.each(["invalid", "-1"])("ignores unusable Retry-After %s", async (header) => {
    const { fetch, provider } = mockResend();
    fetch.mockResolvedValueOnce(apiError(503, "application_error", { "retry-after": header }));
    const delivery = provider.send(message);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("fails explicitly when Retry-After exceeds the synchronous retry budget", async () => {
    const { fetch, provider } = mockResend();
    fetch.mockResolvedValueOnce(apiError(429, "rate_limit_exceeded", { "retry-after": "60" }));
    await expect(provider.send(message)).rejects.toThrow("sending limits");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("network failures from the SDK are retried", async () => {
    const { fetch, provider } = mockResend();
    fetch.mockRejectedValueOnce(new TypeError("network failure sensitive-token"));
    const delivery = provider.send(message);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("unexpected SDK exceptions are sanitized and retried", async () => {
    const { fetch, provider, logger } = mockResend();
    vi.spyOn(Resend.prototype, "post").mockRejectedValueOnce(
      new Error("re_synthetic_secret sensitive-token"),
    );
    const delivery = provider.send(message);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
      /sensitive-token|re_synthetic_secret/,
    );
  });

  test("malformed success responses do not count as delivered", async () => {
    const { fetch, provider } = mockResend();
    fetch.mockResolvedValueOnce(Response.json({}));
    const delivery = provider.send(message);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test.each([
    [401, "invalid_api_key"],
    [403, "validation_error"],
    [422, "invalid_parameter"],
    [409, "invalid_idempotent_request"],
    [429, "daily_quota_exceeded"],
    [429, "monthly_quota_exceeded"],
  ])("does not retry permanent %i %s or expose upstream messages", async (status, name) => {
    const { fetch, provider, logger } = mockResend();
    fetch.mockResolvedValueOnce(apiError(status, name));
    await expect(provider.send(message)).rejects.toThrow(
      "check RESEND_API_KEY, EMAIL_FROM, lumolynk.com",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(
      /sensitive-token|alice@example.com|re_synthetic_secret/,
    );
  });

  test("exhausted retries propagate an actionable error and never create local mail", async () => {
    const { fetch } = mockResend();
    const dir = await outbox();
    fetch.mockImplementation(async () => apiError(503, "application_error"));
    const provider = createEmailProvider(
      readServerEnv({ ...base, NODE_ENV: "production", MAIL_DIR: dir }),
    );
    await Promise.all([
      expect(provider.send(message)).rejects.toThrow("check Resend service status"),
      vi.runAllTimersAsync(),
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(await readdir(dir)).toEqual([]);
  });
});
