import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { idSchema } from "@lumo/contracts";
import { avatarIdentity, avatarInputSchema } from "@lumo/contracts/avatar";
import type { Database } from "@lumo/database";
import { membership, user } from "@lumo/database/schema";
import type { ServerEnv } from "@lumo/env/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context";
import { missing, parse } from "../../lib/errors";
import { enforceRateLimit } from "../../middleware/rate-limit";
import type { Storage } from "../../storage/storage";
import { processAvatar } from "./avatar";
const objectKey = (id: string, version: string) => `avatars/${id}/${version}.webp`;
export function avatarRoutes(db: Database, storage: Storage, env: ServerEnv) {
  const app = new Hono<ApiContext>();
  app.get("/me/avatar/config", (c) => c.json({ maxBytes: env.AVATAR_MAX_BYTES }));
  async function replace(id: string, data: Buffer | null) {
    const version = randomUUID(),
      key = objectKey(id, version);
    let previous: string | null = null;
    try {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select({ image: user.image })
          .from(user)
          .where(eq(user.id, id))
          .for("update");
        if (!row) missing();
        previous = row.image;
        if (data) await storage.write(key, Readable.from(data), "image/webp");
        await tx
          .update(user)
          .set({ image: data ? `avatar:${id}:${version}` : null, updatedAt: new Date() })
          .where(eq(user.id, id));
        const spaces = await tx
          .select({ id: membership.workspaceId })
          .from(membership)
          .where(eq(membership.userId, id));
        for (const space of spaces)
          await tx.execute(sql`select pg_notify('lumo_messenger', ${space.id})`);
      });
    } catch (error) {
      if (data) await storage.remove(key).catch(() => {});
      throw error;
    }
    const old = avatarIdentity(previous);
    if (old?.userId === id) await storage.remove(objectKey(id, old.version)).catch(() => {});
    return { image: data ? `avatar:${id}:${version}` : null };
  }
  app.put("/me/avatar", async (c) => {
    const id = c.get("user").id;
    await enforceRateLimit(db, `avatar:${id}`, 20);
    const input = parse(avatarInputSchema, await c.req.json());
    const data = await processAvatar(
      Buffer.from(input.data, "base64"),
      input.mimeType,
      env.AVATAR_MAX_BYTES,
    );
    return c.json(await replace(id, data));
  });
  app.delete("/me/avatar", async (c) => c.json(await replace(c.get("user").id, null)));
  app.get("/avatars/:id/:version", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      version = parse(idSchema, c.req.param("version")),
      actorId = c.get("user").id;
    if (actorId !== id) {
      const shared = await db
        .select({ id: membership.workspaceId })
        .from(membership)
        .where(
          and(
            eq(membership.userId, id),
            inArray(
              membership.workspaceId,
              db
                .select({ id: membership.workspaceId })
                .from(membership)
                .where(eq(membership.userId, actorId)),
            ),
          ),
        )
        .limit(1);
      if (!shared.length) missing();
    }
    const [row] = await db.select({ image: user.image }).from(user).where(eq(user.id, id));
    if (row?.image !== `avatar:${id}:${version}`) missing();
    c.header("Cache-Control", "private, no-store");
    return c.json({
      url: await storage.downloadUrl(objectKey(id, version), "avatar.webp", "image/webp"),
    });
  });
  return app;
}
