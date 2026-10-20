type ConnectivityResult = {
  target: "document-server" | "public-api";
  ok: boolean;
  message: string;
};

// This is a reachability diagnostic, not proof of JWT acceptance, saving or co-editing.
// Never return provider bodies, URLs or network error messages: those may contain secrets.
export async function checkOnlyOfficeConnectivity(
  config: { documentServerUrl: string; publicApiUrl: string },
  request: typeof fetch = fetch,
): Promise<ConnectivityResult[]> {
  async function check(
    target: ConnectivityResult["target"],
    url: URL,
    validate: (body: string, contentType: string) => boolean,
  ): Promise<ConnectivityResult> {
    try {
      const response = await request(url, {
        redirect: "error",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(10_000),
      });
      const limit = 256 * 1024;
      if (!response.ok || Number(response.headers.get("content-length") ?? 0) > limit) {
        await response.body?.cancel();
        return { target, ok: false, message: "Endpoint failed or response exceeded the limit." };
      }
      if (!response.body) return { target, ok: false, message: "Endpoint returned no body." };
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > limit) {
            await reader.cancel();
            return { target, ok: false, message: "Endpoint response exceeded the limit." };
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      const body = Buffer.concat(chunks).toString("utf8");
      const ok = validate(body, response.headers.get("content-type") ?? "");
      return {
        target,
        ok,
        message: ok ? "Reachable with the expected response." : "Unexpected endpoint response.",
      };
    } catch {
      return { target, ok: false, message: "Endpoint unavailable; check HTTPS, DNS and routing." };
    }
  }
  return Promise.all([
    check(
      "document-server",
      new URL("/web-apps/apps/api/documents/api.js", config.documentServerUrl),
      (body, contentType) =>
        /^(?:application|text)\/(?:javascript|x-javascript|ecmascript)(?:;|$)/i.test(contentType) &&
        body.includes("DocsAPI"),
    ),
    check("public-api", new URL("/ready", config.publicApiUrl), (body, contentType) => {
      if (!/^application\/json(?:;|$)/i.test(contentType)) return false;
      const value: unknown = JSON.parse(body);
      return (
        typeof value === "object" && value !== null && "status" in value && value.status === "ready"
      );
    }),
  ]);
}
