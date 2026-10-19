import { z } from "zod";

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Use an exact HTTP(S) origin without a trailing slash");

export const databaseUrlSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      Boolean(url.hostname && url.pathname.slice(1))
    );
  } catch {
    return false;
  }
}, "Use a PostgreSQL connection URL");

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: databaseUrlSchema,
    BETTER_AUTH_SECRET: z.string().min(32),
    API_ORIGIN: origin.default("http://localhost:3001"),
    WEB_ORIGIN: origin.default("http://localhost:3000"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default("0.0.0.0"),
    SMTP_URL: z
      .url()
      .refine((value) => ["smtp:", "smtps:"].includes(new URL(value).protocol))
      .optional(),
    MAIL_FROM: z.email().default("hello@lumo.local"),
    MAIL_DIR: z.string().min(1).default("../../.local/mail"),
    AGORA_APP_ID: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    AGORA_APP_CERTIFICATE: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    AGORA_CHAT_APP_KEY: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+#[a-zA-Z0-9_-]+$/)
      .optional(),
    AGORA_CHAT_REST_ORIGIN: z
      .url()
      .refine((value) => new URL(value).protocol === "https:" && new URL(value).origin === value)
      .optional(),
    LOG_LEVEL: z.enum(["silent", "error", "warn", "info", "debug"]).default("info"),
    AWS_REGION: z.string().min(1).optional(),
    AWS_S3_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
      .optional(),
    DRIVE_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(5 * 1024 ** 3)
      .default(1024 ** 3),
    DRIVE_ALLOWED_MIME_TYPES: z
      .string()
      .refine(
        (value) =>
          value
            .split(",")
            .every((part) =>
              /^(?:\*|[a-z0-9!#$&^_.+-]+\/(?:\*|[a-z0-9!#$&^_.+-]+))$/.test(part.trim()),
            ),
        "Use comma-separated MIME types, type/*, or *",
      )
      .default("*"),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.AWS_REGION) !== Boolean(value.AWS_S3_BUCKET))
      ctx.addIssue({
        code: "custom",
        path: ["AWS_S3_BUCKET"],
        message: "Configure AWS_REGION and AWS_S3_BUCKET together",
      });
    if (value.NODE_ENV !== "production") return;
    for (const field of ["API_ORIGIN", "WEB_ORIGIN"] as const) {
      if (!value[field].startsWith("https://"))
        ctx.addIssue({ code: "custom", path: [field], message: "HTTPS is required in production" });
    }
    if (!value.SMTP_URL)
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "SMTP is required in production",
      });
  });

export type ServerEnv = z.infer<typeof serverSchema>;

export function readServerEnv(source: Record<string, unknown> = process.env): ServerEnv {
  const result = serverSchema.safeParse(source);
  // Never include raw environment values in startup errors.
  if (!result.success)
    throw new Error(
      `Invalid server environment: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  return result.data;
}
