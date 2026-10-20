import { readServerEnv } from "@lumo/env/server";

import { checkOnlyOfficeConnectivity } from "../integrations/onlyoffice-connectivity";

try {
  const env = readServerEnv();
  if (
    !env.ONLYOFFICE_DOCUMENT_SERVER_URL ||
    !env.ONLYOFFICE_JWT_SECRET ||
    !env.ONLYOFFICE_PUBLIC_API_BASE_URL
  ) {
    console.error(
      "ONLYOFFICE is not configured. Set ONLYOFFICE_DOCUMENT_SERVER_URL, ONLYOFFICE_JWT_SECRET and ONLYOFFICE_PUBLIC_API_BASE_URL in apps/api/.env. Keep secrets out of chat and source control.",
    );
    process.exitCode = 1;
  } else {
    const checks = await checkOnlyOfficeConnectivity({
      documentServerUrl: env.ONLYOFFICE_DOCUMENT_SERVER_URL,
      publicApiUrl: env.ONLYOFFICE_PUBLIC_API_BASE_URL,
    });
    for (const check of checks)
      console.info(`${check.ok ? "PASS" : "FAIL"} ${check.target}: ${check.message}`);
    if (checks.some((check) => !check.ok)) process.exitCode = 1;
    console.info(
      "Reachability only. Live signed opening, provider file download/callback, durable saving, two-user collaboration and Markdown round-trip remain required by plan §2.1.",
    );
  }
} catch {
  console.error(
    "Configuration invalid. Check apps/api/.env against apps/api/.env.example; no environment values have been printed.",
  );
  process.exitCode = 1;
}
