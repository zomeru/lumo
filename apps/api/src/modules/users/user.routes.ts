import { activeWorkspaceInputSchema, profileInputSchema } from "@lumolynk/contracts";
import type { Database } from "@lumolynk/database";
import { profile, user } from "@lumolynk/database/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context.ts";
import { missing, parse } from "../../lib/errors.ts";
import type { createWorkspaceService } from "../workspaces/workspace.service.ts";

export function userRoutes(db: Database, workspaces: ReturnType<typeof createWorkspaceService>) {
  const app = new Hono<ApiContext>();
  app.get("/me", async (c) => {
    const id = c.get("user").id;
    const [result] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        jobTitle: profile.jobTitle,
        department: profile.department,
        activeWorkspaceId: profile.activeWorkspaceId,
      })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, id));
    if (!result) missing();
    const joined = await workspaces.list(id);
    const { activeWorkspaceId, ...currentUser } = result;
    const active = joined.some((ws) => ws.id === activeWorkspaceId)
      ? activeWorkspaceId
      : (joined[0]?.id ?? null);
    if (active !== activeWorkspaceId)
      await db.update(profile).set({ activeWorkspaceId: active }).where(eq(profile.userId, id));
    return c.json({ user: currentUser, activeWorkspaceId: active });
  });
  app.patch("/me", async (c) => {
    const input = parse(profileInputSchema, await c.req.json());
    const id = c.get("user").id;
    await db.transaction(async (tx) => {
      await tx.update(user).set({ name: input.name, updatedAt: new Date() }).where(eq(user.id, id));
      await tx
        .update(profile)
        .set({ jobTitle: input.jobTitle, department: input.department })
        .where(eq(profile.userId, id));
    });
    return c.json({ ok: true });
  });
  app.put("/me/active-workspace", async (c) => {
    const { workspaceId } = parse(activeWorkspaceInputSchema, await c.req.json());
    await workspaces.activate(workspaceId, c.get("user").id);
    return c.json({ ok: true });
  });
  return app;
}
