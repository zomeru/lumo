import { randomUUID, createHash } from "node:crypto";

import type { Storage } from "../storage/storage";

// OPTIONS never writes an object and requires no bucket-administration permissions.
export async function checkDriveCors(storage: Storage, origins: string[], fetcher = fetch) {
  const key = `drive-staging/diagnostic/${randomUUID()}`;
  const url = await storage.putUrl(key, 0, "text/plain", createHash("sha256").digest("base64"));
  const results: { origin: string; method: string; allowed: boolean }[] = [];
  for (const origin of origins) {
    for (const method of ["PUT", "GET"]) {
      try {
        const response = await fetcher(url, {
          method: "OPTIONS",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers":
              method === "PUT" ? "content-type,x-amz-checksum-sha256" : "range",
          },
        });
        const allowedOrigin = response.headers.get("access-control-allow-origin");
        const allowed =
          response.ok &&
          (allowedOrigin === origin || allowedOrigin === "*") &&
          (response.headers.get("access-control-allow-methods") ?? "")
            .split(/,\s*/)
            .includes(method);
        await response.body?.cancel();
        results.push({ origin, method, allowed });
      } catch {
        results.push({ origin, method, allowed: false });
      }
    }
  }
  return results;
}
