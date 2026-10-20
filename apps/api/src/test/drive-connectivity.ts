import { readServerEnv } from "@lumo/env/server";

import { checkDriveCors } from "../integrations/drive-cors";
import { createS3Storage } from "../storage/s3";
try {
  const env = readServerEnv();
  const results = await checkDriveCors(createS3Storage(env), [
    env.WEB_ORIGIN,
    "lumo://app",
    ...(env.NODE_ENV !== "production" ? ["http://127.0.0.1:5174"] : []),
  ]);
  for (const [index, result] of results.entries())
    console.log(
      `Browser preflight ${index + 1} (${result.method}): ${result.allowed ? "allowed" : "blocked"}`,
    );
  if (results.some((result) => !result.allowed)) {
    console.error(
      "Drive bucket CORS needs attention. See docs/drive-storage.md and docs/drive-cors.example.json.",
    );
    process.exitCode = 1;
  }
} catch {
  console.error(
    "Unable to check Drive CORS. Check server storage configuration and AWS credentials.",
  );
  process.exitCode = 1;
}
