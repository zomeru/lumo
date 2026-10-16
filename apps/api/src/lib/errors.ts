import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, "INVALID_INPUT", "Check the request fields and try again.");
  return result.data;
}

export function denied(): never {
  throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");
}
export function missing(): never {
  throw new AppError(
    404,
    "NOT_FOUND",
    "This resource is unavailable or you no longer have access.",
  );
}
