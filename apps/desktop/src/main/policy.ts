import { z } from "zod";
export const requestSchema = z
  .object({
    path: z
      .string()
      .max(2048)
      .refine(
        (path) =>
          /^\/api\/(v1\/|auth\/(sign-in\/email|sign-up\/email|sign-out|send-verification-email)$)/.test(
            path,
          ) &&
          !/[\\#\r\n]/.test(path) &&
          !/%(?:2e|2f|5c)/i.test(path) &&
          !path.split("?")[0]!.split("/").includes(".."),
      ),
    method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).default("GET"),
    body: z.unknown().optional(),
  })
  .strict()
  .refine((value) => JSON.stringify(value).length <= 32768);
export function trustedRenderer(url: string, developmentOrigin?: string) {
  try {
    const u = new URL(url);
    return (
      u.origin === developmentOrigin ||
      (u.protocol === "lumo:" && u.hostname === "app" && !u.username && !u.password && !u.port)
    );
  } catch {
    return false;
  }
}
export function remoteOrigin(value: string) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw new Error("Desktop requires an HTTPS API/web origin, or loopback HTTP for development.");
  return value;
}
export function externalUrl(value: unknown, webOrigin: string) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Invalid link");
  const url = new URL(value);
  if (
    url.origin !== webOrigin ||
    url.username ||
    url.password ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw new Error("Link is not allowed");
  return url.href;
}

export function rendererCsp(
  developmentOrigin?: string,
  nonce?: string,
  officeOrigin?: string,
  apiOrigin?: string,
) {
  const office = officeOrigin ? ` ${remoteOrigin(officeOrigin)}` : "";
  const scripts = developmentOrigin && nonce ? ` 'nonce-${nonce}'` : "";
  const websocket = [developmentOrigin, apiOrigin]
    .filter((value): value is string => Boolean(value))
    .map((value) => ` ${remoteOrigin(value).replace(/^http/, "ws")}`)
    .join("");
  return `default-src 'self'; script-src 'self'${scripts}${office}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:${websocket}; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src https://*.amazonaws.com https://*.amazonaws.com.cn${office}; frame-ancestors 'none'; form-action 'self'`;
}
