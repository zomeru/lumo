import type { z } from "zod";
export type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal };
export type Transport = (
  path: string,
  options: RequestOptions,
) => Promise<{ status: number; body: unknown }>;
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function createApi(transport: Transport) {
  return async <S extends z.ZodType>(
    path: string,
    schema: S,
    options: RequestOptions = {},
  ): Promise<z.infer<S>> => {
    const url = path.startsWith("/api/") ? path : `/api/v1${path}`;
    const response = await transport(url, options);
    if (options.signal?.aborted) throw new Error("Request aborted");
    if (response.status < 200 || response.status >= 300) {
      const body = response.body as { error?: { code?: string; message?: string } } | null;
      throw new ApiError(
        response.status,
        body?.error?.code ?? "REQUEST_FAILED",
        body?.error?.message ?? "The request failed. Please try again.",
      );
    }
    return schema.parse(response.body);
  };
}
export function fetchTransport(baseUrl: string): Transport {
  return async (path, options) => {
    const response = await fetch(`${baseUrl}${path}`, {
      credentials: "include",
      method: options.method ?? "GET",
      signal: options.signal,
      headers: { "Content-Type": "application/json" },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
}
