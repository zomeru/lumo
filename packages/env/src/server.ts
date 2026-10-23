import { z } from "zod";

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Use an exact HTTP(S) origin without a trailing slash");

const officeOrigin = origin.refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}, "Use an externally reachable HTTPS origin without credentials, paths or a trailing slash");

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
    LOG_LEVEL: z.enum(["silent", "error", "warn", "info", "debug"]).default("info"),
    ONLYOFFICE_DOCUMENT_SERVER_URL: officeOrigin.optional(),
    ONLYOFFICE_JWT_SECRET: z.string().min(32).optional(),
    ONLYOFFICE_PUBLIC_API_BASE_URL: officeOrigin.optional(),
    ONLYOFFICE_MODE: z.enum(["cloud", "self-hosted"]).default("cloud"),
    STORAGE_PROVIDER: z.enum(["aws", "digitalocean"]).default("aws"),
    AWS_REGION: z.string().min(1).optional(),
    AWS_S3_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
      .optional(),
    S3_ENDPOINT: origin
      .refine((value) => {
        const url = new URL(value);
        return !url.username && !url.password;
      }, "Use an HTTP(S) origin without credentials")
      .optional(),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    AVATAR_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(5 * 1024 * 1024)
      .default(5 * 1024 * 1024),
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
    if (value.STORAGE_PROVIDER === "digitalocean") {
      for (const field of [
        "AWS_REGION",
        "AWS_S3_BUCKET",
        "S3_ENDPOINT",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
      ] as const)
        if (!value[field])
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Required for DigitalOcean Spaces",
          });
      if (
        value.S3_ENDPOINT &&
        !/^https:\/\/[a-z0-9-]+\.digitaloceanspaces\.com$/.test(value.S3_ENDPOINT)
      )
        ctx.addIssue({
          code: "custom",
          path: ["S3_ENDPOINT"],
          message: "Use the regional Spaces HTTPS origin, e.g. https://nyc3.digitaloceanspaces.com",
        });
    }
    const officeFields = [
      "ONLYOFFICE_DOCUMENT_SERVER_URL",
      "ONLYOFFICE_JWT_SECRET",
      "ONLYOFFICE_PUBLIC_API_BASE_URL",
    ] as const;
    if (officeFields.some((field) => value[field] !== undefined))
      for (const field of officeFields)
        if (!value[field])
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Configure all three ONLYOFFICE connection settings together",
          });
    if (Boolean(value.AWS_REGION) !== Boolean(value.AWS_S3_BUCKET))
      ctx.addIssue({
        code: "custom",
        path: ["AWS_S3_BUCKET"],
        message: "Configure AWS_REGION and AWS_S3_BUCKET together",
      });
    if (Boolean(value.S3_ACCESS_KEY_ID) !== Boolean(value.S3_SECRET_ACCESS_KEY))
      ctx.addIssue({
        code: "custom",
        path: ["S3_ACCESS_KEY_ID"],
        message: "Configure S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together",
      });
    if (
      (value.S3_ENDPOINT || value.S3_ACCESS_KEY_ID || value.S3_FORCE_PATH_STYLE) &&
      !value.AWS_S3_BUCKET
    )
      ctx.addIssue({
        code: "custom",
        path: ["AWS_S3_BUCKET"],
        message: "Custom storage settings require AWS_REGION and AWS_S3_BUCKET",
      });
    if (
      value.S3_ENDPOINT &&
      !value.S3_ENDPOINT.startsWith("https://") &&
      value.NODE_ENV === "production"
    )
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "HTTPS is required in production",
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
