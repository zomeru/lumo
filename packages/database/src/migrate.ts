import { fileURLToPath } from "node:url";

import { databaseUrlSchema } from "@lumolynk/env/server";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "./client.ts";

const { db, pool } = createDatabase(databaseUrlSchema.parse(process.env.DATABASE_URL));
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  console.log("Database migrations applied.");
} finally {
  await pool.end();
}
