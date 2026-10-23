import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { readProductionEmailEnv, type ServerEnv } from "@lumo/env/server";
import type { Logger } from "pino";
import { Resend } from "resend";

import type { EmailMessage, EmailProvider } from "./email.ts";

const maxAttempts = 3;
const maxRetryDelay = 30_000;

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;
  private readonly logger: Pick<Logger, "warn" | "error">;

  constructor(
    env: Pick<ServerEnv, "RESEND_API_KEY" | "EMAIL_FROM" | "EMAIL_FROM_NAME">,
    logger: Pick<Logger, "warn" | "error">,
  ) {
    const config = readProductionEmailEnv(env);
    this.logger = logger;
    this.client = new Resend(config.RESEND_API_KEY);
    this.from = `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`;
  }

  async send(message: EmailMessage): Promise<void> {
    const payload = {
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html === undefined ? {} : { html: message.html }),
    };
    // Reuse an opaque key across retries without placing recipient data or tokens in headers.
    const idempotencyKey = randomUUID();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let statusCode: number | null = null;
      let retryable = true;
      let retryAfter = 0;
      try {
        const result = await this.client.emails.send(payload, {
          idempotencyKey,
          signal: AbortSignal.timeout(10_000),
        });
        if (!result.error && result.data?.id) return;
        if (result.error) {
          const error = result.error;
          statusCode = error.statusCode ?? null;
          retryable =
            (statusCode === null && error.name === "application_error") ||
            statusCode === 408 ||
            (statusCode !== null && statusCode >= 500 && statusCode <= 599) ||
            error.name === "internal_server_error" ||
            error.name === "rate_limit_exceeded" ||
            error.name === "concurrent_idempotent_requests";
          const header = result.headers?.["retry-after"];
          if (header) {
            const seconds = Number(header);
            retryAfter = Number.isFinite(seconds)
              ? seconds * 1000
              : Date.parse(header) - Date.now();
          }
        }
      } catch {
        // Network/timeout failures can be ambiguous; retry with the same idempotency key.
        // Never attach the original error, which may include secrets or email content.
      }
      const fields = { provider: "resend", attempt, statusCode, retryable };
      if (!retryable || attempt === maxAttempts || retryAfter > maxRetryDelay) {
        this.logger.error(fields, "Transactional email delivery failed");
        throw new Error(
          retryable
            ? "Resend email delivery failed; check Resend service status and sending limits before retrying"
            : "Resend rejected email delivery; check RESEND_API_KEY, EMAIL_FROM, lumolynk.com domain verification and sending quota",
        );
      }
      this.logger.warn(fields, "Retrying transactional email delivery");
      const backoff = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      await setTimeout(Math.max(backoff, Number.isFinite(retryAfter) ? retryAfter : 0));
    }
  }
}
