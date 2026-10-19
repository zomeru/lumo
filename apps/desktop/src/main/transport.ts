import { readFile, writeFile, rename, rm } from "node:fs/promises";

import { safeStorage } from "electron";
import { CookieJar } from "tough-cookie";

import { requestSchema } from "./policy";
export async function createSessionTransport(
  apiOrigin: string,
  webOrigin: string,
  storePath: string,
) {
  let jar = new CookieJar();
  const protectedStore = () =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
  if (protectedStore()) {
    try {
      jar = CookieJar.deserializeSync(
        JSON.parse(safeStorage.decryptString(await readFile(storePath))),
      );
    } catch {
      await rm(storePath, { force: true });
    }
  }
  // Serialize session renewal/logout so a late response cannot restore a logged-out cookie.
  let queue: Promise<unknown> = Promise.resolve();
  return (input: unknown) => {
    const request = requestSchema.parse(input);
    const operation = queue.then(async () => {
      const url = new URL(request.path, apiOrigin);
      if (url.origin !== apiOrigin || !url.pathname.startsWith("/api/"))
        throw new Error("Invalid API path");
      try {
        const response = await fetch(url, {
          method: request.method,
          redirect: "error",
          signal: AbortSignal.timeout(20000),
          headers: {
            "Content-Type": "application/json",
            Origin: webOrigin,
            Cookie: await jar.getCookieString(url.href),
          },
          ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
        });
        for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, url.href);
        if (request.path === "/api/auth/sign-out" && response.ok) {
          await jar.removeAllCookies();
          await rm(storePath, { force: true });
        } else if (protectedStore()) {
          await writeFile(
            `${storePath}.tmp`,
            safeStorage.encryptString(JSON.stringify(jar.serializeSync())),
            { mode: 0o600 },
          );
          await rename(`${storePath}.tmp`, storePath);
        }
        const body: unknown = await response.json().catch(() => null);
        return { status: response.status, body };
      } catch {
        return {
          status: 503,
          body: {
            error: {
              code: "OFFLINE",
              message: "Unable to reach Lumo. Check your connection and try again.",
            },
          },
        };
      }
    });
    queue = operation.catch(() => undefined);
    return operation;
  };
}
