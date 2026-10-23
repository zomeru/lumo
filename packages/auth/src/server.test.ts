import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDatabase } from "@lumolynk/database";
import { readServerEnv } from "@lumolynk/env/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createAuth } from "./server.ts";

afterEach(() => vi.unstubAllGlobals());

describe("authentication email delivery", () => {
  test.each(["production", "development", "test"] as const)(
    "%s preserves verification content and redirects through the selected provider",
    async (NODE_ENV) => {
      const mailDir = await mkdtemp(join(tmpdir(), "lumolynk-auth-mail-"));
      const database = createDatabase("postgresql://localhost/unused");
      const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ id: "mail-id" }));
      vi.stubGlobal("fetch", fetch);
      const env = readServerEnv({
        DATABASE_URL: "postgresql://localhost/unused",
        BETTER_AUTH_SECRET: "a".repeat(48),
        NODE_ENV,
        API_ORIGIN: "https://api.example.com",
        WEB_ORIGIN: "https://example.com",
        RESEND_API_KEY: "re_synthetic_test_key",
        EMAIL_FROM: "hello@lumolynk.com",
        EMAIL_FROM_NAME: "LumoLynk",
        MAIL_DIR: mailDir,
        LOG_LEVEL: "silent",
      });
      try {
        const auth = createAuth(database.db, env);
        const sender = auth.options.emailVerification!.sendVerificationEmail!;
        await sender({
          user: {
            id: "x",
            name: "Alice",
            email: "alice@example.com",
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          url: "https://api.example.com/api/auth/verify-email?token=example&callbackURL=untrusted",
          token: "example",
        });
        const link =
          "https://api.example.com/api/auth/verify-email?token=example&callbackURL=https%3A%2F%2Fexample.com%2Fworkspaces";
        const content = {
          from: "LumoLynk <hello@lumolynk.com>",
          to: "alice@example.com",
          subject: "Verify your LumoLynk email",
          text: `Verify your email to accept workspace invitations:\n${link}`,
        };
        const files = await readdir(mailDir);
        const production = NODE_ENV === "production";
        expect(fetch).toHaveBeenCalledTimes(production ? 1 : 0);
        expect(files).toHaveLength(production ? 0 : 1);
        const delivered = production
          ? JSON.parse(fetch.mock.calls[0]![1]!.body as string)
          : JSON.parse(await readFile(join(mailDir, files[0]!), "utf8"));
        expect(delivered).toMatchObject(production ? content : { ...content, url: link });
        expect(delivered.html).toContain("Verify email address");
        expect(delivered.html).toContain("Hi Alice,");
        expect(delivered.html).toContain(link.replaceAll("&", "&amp;"));
        expect(auth.options.advanced?.defaultCookieAttributes).toMatchObject({
          httpOnly: true,
          secure: NODE_ENV === "production",
          sameSite: "lax",
        });
        expect(auth.options.emailVerification).toMatchObject({
          sendOnSignUp: true,
          expiresIn: 3600,
        });
      } finally {
        await database.pool.end();
        await rm(mailDir, { recursive: true, force: true });
      }
    },
  );
});
