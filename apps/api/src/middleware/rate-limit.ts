import { createHash } from "node:crypto";

import type { Database } from "@lumolynk/database";
import { requestLimit } from "@lumolynk/database/schema";
import { sql } from "drizzle-orm";

import { AppError } from "../lib/errors.ts";

export async function enforceRateLimit(
  db: Database,
  identity: string,
  max: number,
  now = new Date(),
) {
  const key = createHash("sha256").update(identity).digest("hex");
  const cutoff = new Date(now.getTime() - 60_000);
  const [result] = await db
    .insert(requestLimit)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: requestLimit.key,
      set: {
        count: sql`case when ${requestLimit.windowStart} <= ${cutoff} then 1 else ${requestLimit.count} + 1 end`,
        windowStart: sql`case when ${requestLimit.windowStart} <= ${cutoff} then ${now} else ${requestLimit.windowStart} end`,
      },
    })
    .returning({ count: requestLimit.count });
  if (!result || result.count > max)
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
}
