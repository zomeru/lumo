import { z } from "zod";

import { remoteOrigin, rendererCsp } from "./policy";

const officeConfigSchema = z.object({ documentServerUrl: z.string().optional() });

export function createRendererPolicy(
  apiOrigin: string,
  developmentOrigin?: string,
  nonce?: string,
  request: typeof fetch = fetch,
) {
  let officeOrigin: string | undefined;
  return async () => {
    // Resolve the approved host for each HTML document, including Retry editor reloads.
    // Retain the last approved host during outages; never broaden script/frame sources.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await request(`${apiOrigin}/api/config/office`, {
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("Office configuration unavailable");
        }
        const config = officeConfigSchema.parse(await response.json());
        officeOrigin = config.documentServerUrl
          ? remoteOrigin(config.documentServerUrl)
          : undefined;
        break;
      } catch {
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    return rendererCsp(developmentOrigin, nonce, officeOrigin, apiOrigin);
  };
}
