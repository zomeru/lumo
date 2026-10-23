import { existsSync } from "node:fs";

import { databaseUrlSchema } from "@lumolynk/env/server";
import { defineConfig } from "drizzle-kit";

const envFile = new URL("../../apps/api/.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: process.env.DATABASE_URL
    ? { url: databaseUrlSchema.parse(process.env.DATABASE_URL) }
    : undefined,
});
