import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { credentialsSchema, registrationSchema } from "@lumo/contracts";
import type { Database } from "@lumo/database";
import * as schema from "@lumo/database/schema";
import type { ServerEnv } from "@lumo/env/server";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import nodemailer from "nodemailer";

export function createAuth(db: Database, env: ServerEnv) {
  const smtp = env.SMTP_URL ? new URL(env.SMTP_URL) : undefined;
  const transport = smtp
    ? nodemailer.createTransport({
        host: smtp.hostname,
        port: Number(smtp.port || (smtp.protocol === "smtps:" ? 465 : 587)),
        secure: smtp.protocol === "smtps:",
        requireTLS: env.NODE_ENV === "production",
        auth: smtp.username
          ? { user: decodeURIComponent(smtp.username), pass: decodeURIComponent(smtp.password) }
          : undefined,
      })
    : undefined;
  return betterAuth({
    appName: "Lumo",
    baseURL: env.API_ORIGIN,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN, env.API_ORIGIN],
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    user: {
      additionalFields: {
        registrationTermsVersion: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
        registrationPrivacyVersion: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
        registrationAcceptedAt: { type: "date", required: false, input: false, returned: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            const result = registrationSchema.strict().safeParse(context?.body);
            if (context?.path !== "/sign-up/email" || !result.success)
              throw new APIError("BAD_REQUEST", {
                message:
                  "Review and accept the current legal documents before creating an account.",
              });
            // Persist in the user INSERT, inside Better Auth's registration transaction.
            return {
              data: {
                ...user,
                registrationTermsVersion: result.data.consent.termsVersion,
                registrationPrivacyVersion: result.data.consent.privacyVersion,
                registrationAcceptedAt: new Date(),
              },
            };
          },
        },
      },
    },
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        const verificationUrl = new URL(url);
        verificationUrl.searchParams.set("callbackURL", `${env.WEB_ORIGIN}/workspaces`);
        const link = verificationUrl.toString();
        if (transport) {
          await transport.sendMail({
            from: env.MAIL_FROM,
            to: user.email,
            subject: "Verify your Lumo email",
            text: `Verify your email to accept workspace invitations:\n${link}`,
          });
        } else {
          const dir = resolve(env.MAIL_DIR);
          await mkdir(dir, { recursive: true, mode: 0o700 });
          await writeFile(
            resolve(dir, `${Date.now()}-${randomUUID()}.json`),
            JSON.stringify({ to: user.email, subject: "Verify your Lumo email", url: link }),
            { mode: 0o600 },
          );
        }
      },
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
      },
      // The HTTP boundary overwrites this header with the actual socket address.
      ipAddress: { ipAddressHeaders: ["x-lumo-client-ip"] },
    },
    session: { expiresIn: 7 * 24 * 3600, updateAge: 24 * 3600, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        const input =
          context.path === "/sign-up/email"
            ? registrationSchema.strict()
            : context.path === "/sign-in/email"
              ? credentialsSchema.strict()
              : undefined;
        if (input) {
          const result = input.safeParse(context.body);
          if (!result.success)
            throw new APIError("BAD_REQUEST", {
              message: result.error.issues[0]?.message ?? "Check your registration details.",
            });
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
