import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { BlockList } from "node:net";
import { Transform, type Readable } from "node:stream";

import type { ServerEnv } from "@lumolynk/env/server";
import { sign, verify } from "hono/jwt";
import { z } from "zod";

import { AppError } from "../../lib/errors";

const callbackSchema = z
  .object({
    key: z.string().min(1).max(128),
    status: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(6),
      z.literal(7),
    ]),
    url: z.url().optional(),
    filetype: z.string().optional(),
    users: z.array(z.string().max(128)).max(200).optional(),
  })
  .refine((v) => ![2, 6].includes(v.status) || Boolean(v.url));
const deniedNetworks = new BlockList();
const deniedIPv6 = new BlockList();
for (const [network, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  deniedNetworks.addSubnet(network, bits, "ipv4");
for (const [network, bits] of [
  ["::", 96],
  ["::ffff:0:0", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const)
  deniedIPv6.addSubnet(network, bits, "ipv6");
export const OFFICE_MAX_BYTES = 64 * 1024 ** 2;
export function officeKey(workspaceId: string, id: string, generation: number, origin: string) {
  return createHash("sha256").update(`${origin}:${workspaceId}:${id}:${generation}`).digest("hex");
}
export function createOfficeProvider(env: ServerEnv) {
  function configured() {
    if (
      !env.ONLYOFFICE_JWT_SECRET ||
      !env.ONLYOFFICE_DOCUMENT_SERVER_URL ||
      !env.ONLYOFFICE_PUBLIC_API_BASE_URL
    )
      throw new AppError(
        503,
        "OFFICE_UNAVAILABLE",
        "The document editor is not configured. Your saved files remain available in Drive.",
      );
    return {
      secret: env.ONLYOFFICE_JWT_SECRET,
      server: env.ONLYOFFICE_DOCUMENT_SERVER_URL,
      api: env.ONLYOFFICE_PUBLIC_API_BASE_URL,
    };
  }
  async function verified(token: string) {
    try {
      return await verify(token, configured().secret, "HS256");
    } catch {
      throw new AppError(
        403,
        "INVALID_OFFICE_TOKEN",
        "Document authorization is invalid or expired.",
      );
    }
  }
  return {
    configured,
    sign: (value: Record<string, unknown>) => sign(value, configured().secret, "HS256"),
    verify: verified,
    async callback(body: unknown, authorization: string | undefined) {
      const wrapper = z.object({ token: z.string().optional() }).passthrough().safeParse(body);
      const token =
        authorization?.replace(/^Bearer\s+/i, "") ??
        (wrapper.success ? wrapper.data.token : undefined);
      if (!token)
        throw new AppError(403, "INVALID_OFFICE_TOKEN", "A signed provider callback is required.");
      const signed = await verified(token);
      const result = callbackSchema.safeParse(signed.payload ?? signed);
      if (!result.success)
        throw new AppError(400, "INVALID_OFFICE_CALLBACK", "Invalid document callback.");
      return result.data;
    },
    async download(value: string): Promise<Readable> {
      const url = new URL(value),
        config = configured();
      if (url.origin !== config.server || url.protocol !== "https:" || url.username || url.password)
        throw new AppError(
          400,
          "UNSAFE_OFFICE_URL",
          "The save URL is not an approved provider endpoint.",
        );
      const addresses = await lookup(url.hostname, { all: true, verbatim: true });
      if (
        !addresses.length ||
        addresses.some((v) =>
          v.family === 4
            ? deniedNetworks.check(v.address, "ipv4")
            : deniedIPv6.check(v.address, "ipv6"),
        )
      )
        throw new AppError(
          400,
          "UNSAFE_OFFICE_URL",
          "The provider endpoint must resolve to a public address.",
        );
      const address = addresses[0]!;
      // Pin the checked address to this TLS connection; DNS cannot rebind between validation and fetch.
      return new Promise((resolve, reject) => {
        const request = get(
          url,
          {
            signal: AbortSignal.timeout(30_000),
            family: address.family,
            lookup: (_host, _options, callback) => callback(null, address.address, address.family),
          },
          (response) => {
            if (
              response.statusCode !== 200 ||
              Number(response.headers["content-length"] ?? 0) > OFFICE_MAX_BYTES
            ) {
              response.destroy();
              reject(
                new AppError(
                  502,
                  "OFFICE_DOWNLOAD_FAILED",
                  "The provider could not supply a bounded saved file.",
                ),
              );
              return;
            }
            let size = 0;
            const bounded = new Transform({
              transform(chunk: Buffer, _encoding, callback) {
                size += chunk.length;
                callback(
                  size > OFFICE_MAX_BYTES
                    ? new AppError(
                        413,
                        "OFFICE_FILE_TOO_LARGE",
                        "The edited file exceeds the editor limit.",
                      )
                    : null,
                  chunk,
                );
              },
            });
            response.on("error", (error) => bounded.destroy(error));
            bounded.on("close", () => response.destroy());
            response.pipe(bounded);
            resolve(bounded);
          },
        );
        request.on("error", () =>
          reject(
            new AppError(
              502,
              "OFFICE_DOWNLOAD_FAILED",
              "Unable to retrieve the saved file. The previous revision is retained.",
            ),
          ),
        );
      });
    },
    async command(command: Record<string, unknown>) {
      const config = configured();
      const response = await fetch(new URL("/command", config.server), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...command, token: await sign(command, config.secret, "HS256") }),
      });
      const result = z
        .object({ error: z.number().int() })
        .safeParse(await response.json().catch(() => null));
      if (!response.ok || !result.success || ![0, 4].includes(result.data.error))
        throw new AppError(
          502,
          "OFFICE_COMMAND_FAILED",
          "The editor could not complete this request. Retry after checking the saved revision.",
        );
      return result.data;
    },
  };
}
export type OfficeProvider = ReturnType<typeof createOfficeProvider>;
