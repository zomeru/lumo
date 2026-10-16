import { createDatabase } from "@lumo/database";
import { readServerEnv } from "@lumo/env/server";
import nodemailer from "nodemailer";
import { describe, expect, test, vi } from "vitest";

import { createAuth } from "./server.ts";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn<() => unknown>(() => ({
      sendMail: vi.fn<() => Promise<void>>(async () => {}),
    })),
  },
}));

describe("secure authentication configuration", () => {
  test.each([
    "smtps://user:password@smtp.example.com",
    "smtp://smtp.example.com",
    "smtp://user:password@smtp.example.com:2525",
  ])("sends verification through configured SMTP: %s", async (SMTP_URL) => {
    const database = createDatabase("postgresql://localhost/unused");
    const env = readServerEnv({
      DATABASE_URL: "postgresql://localhost/unused",
      BETTER_AUTH_SECRET: "a".repeat(48),
      NODE_ENV: "production",
      API_ORIGIN: "https://api.example.com",
      WEB_ORIGIN: "https://example.com",
      SMTP_URL,
    });
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
      url: "https://api.example.com/api/auth/verify-email?token=example",
      token: "example",
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true, host: "smtp.example.com" }),
    );
    const options = vi.mocked(nodemailer.createTransport).mock.results.at(-1)?.value;
    expect(options?.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        text: expect.stringContaining(encodeURIComponent("https://example.com/workspaces")),
      }),
    );
    expect(auth.options.advanced?.defaultCookieAttributes).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    await database.pool.end();
  });
});
