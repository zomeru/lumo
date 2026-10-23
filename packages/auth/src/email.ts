import type { ServerEnv } from "@lumo/env/server";
import pino from "pino";

import { FileEmailProvider } from "./file-email-provider.ts";
import { ResendEmailProvider } from "./resend-email-provider.ts";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Action link retained in local JSON previews for debugging and acceptance tests. */
  url?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export function createEmailProvider(env: ServerEnv): EmailProvider {
  switch (env.NODE_ENV) {
    case "production":
      return new ResendEmailProvider(env, pino({ level: env.LOG_LEVEL }));
    case "development":
    case "test":
      return new FileEmailProvider(env);
    default:
      throw new Error(
        "Unsupported email environment; set NODE_ENV to development, test or production",
      );
  }
}
