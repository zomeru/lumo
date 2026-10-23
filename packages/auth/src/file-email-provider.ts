import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ServerEnv } from "@lumolynk/env/server";

import type { EmailMessage, EmailProvider } from "./email.ts";

export class FileEmailProvider implements EmailProvider {
  private readonly env: Pick<ServerEnv, "MAIL_DIR" | "EMAIL_FROM" | "EMAIL_FROM_NAME">;

  constructor(env: Pick<ServerEnv, "MAIL_DIR" | "EMAIL_FROM" | "EMAIL_FROM_NAME">) {
    this.env = env;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      const dir = resolve(this.env.MAIL_DIR);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(
        resolve(dir, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify({
          from: `${this.env.EMAIL_FROM_NAME} <${this.env.EMAIL_FROM}>`,
          ...message,
        }),
        { mode: 0o600, flag: "wx" },
      );
    } catch {
      throw new Error("Local email could not be saved; check MAIL_DIR and filesystem permissions");
    }
  }
}
