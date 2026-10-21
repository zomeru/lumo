import { idSchema, okSchema } from "@lumo/contracts";
import { hrGrantSchema, hrPageSchema } from "@lumo/contracts/hr";
import { hrAudit, hrEmployee, hrGrant, hrNotification } from "@lumo/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { ApiContext } from "../../lib/context";
import { denied, parse } from "../../lib/errors";
import type { createWorkspaceService } from "../workspaces/workspace.service";
import { auditHr, createHrCore, requireHrMember } from "./core";
import { peopleRoutes } from "./people.routes";

export function hrRoutes(workspaces: ReturnType<typeof createWorkspaceService>) {
  const app = new Hono<ApiContext>();
  const core = createHrCore(workspaces);
  app.use("/workspaces/:workspaceId/hr/*", async (c, next) => {
    const id = parse(idSchema, c.req.param("workspaceId"));
    await workspaces.requireAccess(id, c.get("user").id);
    c.set("workspaceId", id);
    await next();
  });
  const run = <T>(c: Context<ApiContext>, action: Parameters<typeof core.run<T>>[2]) =>
    core.run(c.get("workspaceId"), c.get("user").id, action);
  app.get("/workspaces/:workspaceId/hr/access", async (c) =>
    c.json(
      await run(c, async (ctx) => ({
        userId: ctx.actorId,
        owner: ctx.owner,
        grants: ctx.grants.map(({ userId, capability, scope }) => ({ userId, capability, scope })),
        hasReports:
          (
            await ctx.tx
              .select()
              .from(hrEmployee)
              .where(
                and(
                  eq(hrEmployee.workspaceId, ctx.workspaceId),
                  eq(hrEmployee.managerId, ctx.actorId),
                ),
              )
              .limit(1)
          ).length > 0,
        timezone: ctx.timezone,
        currency: ctx.currency,
      })),
    ),
  );
  app.get("/workspaces/:workspaceId/hr/grants", async (c) =>
    c.json(
      await run(c, async (ctx) => {
        await ctx.require("hr.permissions.manage");
        return {
          grants: await ctx.tx
            .select({
              userId: hrGrant.userId,
              capability: hrGrant.capability,
              scope: hrGrant.scope,
            })
            .from(hrGrant)
            .where(eq(hrGrant.workspaceId, ctx.workspaceId)),
        };
      }),
    ),
  );
  app.post("/workspaces/:workspaceId/hr/grants", async (c) => {
    const input = parse(
      hrGrantSchema.extend({ revoke: z.boolean().default(false) }).strict(),
      await c.req.json(),
    );
    await run(c, async (ctx) => {
      await ctx.require("hr.permissions.manage");
      if (input.userId === ctx.actorId) denied();
      if (
        input.scope === "direct_reports" &&
        !["hr.leave.read_team", "hr.attendance.read_team"].includes(input.capability)
      )
        denied();
      await requireHrMember(ctx, input.userId);
      const where = and(
        eq(hrGrant.workspaceId, ctx.workspaceId),
        eq(hrGrant.userId, input.userId),
        eq(hrGrant.capability, input.capability),
      );
      const before = await ctx.tx.select().from(hrGrant).where(where);
      await ctx.tx.delete(hrGrant).where(where);
      if (!input.revoke)
        await ctx.tx.insert(hrGrant).values({
          workspaceId: ctx.workspaceId,
          userId: input.userId,
          capability: input.capability,
          scope: input.scope,
          grantedBy: ctx.actorId,
        });
      await auditHr(ctx, "permissions.changed", input.userId, { before, after: input });
    });
    return c.json(okSchema.parse({ ok: true }));
  });
  app.get("/workspaces/:workspaceId/hr/audit", async (c) => {
    const { offset, limit } = parse(hrPageSchema, c.req.query());
    return c.json(
      await run(c, async (ctx) => {
        // Includes salary change history; read_all alone must not expose confidential audit.
        await ctx.require("hr.permissions.manage");
        const events = await ctx.tx
          .select()
          .from(hrAudit)
          .where(eq(hrAudit.workspaceId, ctx.workspaceId))
          .orderBy(desc(hrAudit.createdAt), desc(hrAudit.id))
          .offset(offset)
          .limit(limit + 1);
        return {
          events: events.slice(0, limit),
          nextOffset: events.length > limit ? offset + limit : null,
        };
      }),
    );
  });
  app.get("/workspaces/:workspaceId/hr/notifications", async (c) =>
    c.json(
      await run(c, async (ctx) => ({
        notifications: await ctx.tx
          .select({
            id: hrNotification.id,
            title: hrNotification.title,
            module: hrNotification.module,
            targetId: hrNotification.targetId,
            readAt: hrNotification.readAt,
            createdAt: hrNotification.createdAt,
          })
          .from(hrNotification)
          .where(
            and(
              eq(hrNotification.workspaceId, ctx.workspaceId),
              eq(hrNotification.userId, ctx.actorId),
            ),
          )
          .orderBy(desc(hrNotification.createdAt))
          .limit(100),
      })),
    ),
  );
  app.post("/workspaces/:workspaceId/hr/notifications/:id/read", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    await run(c, async (ctx) => {
      await ctx.tx
        .update(hrNotification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(hrNotification.workspaceId, ctx.workspaceId),
            eq(hrNotification.userId, ctx.actorId),
            eq(hrNotification.id, id),
          ),
        );
    });
    return c.json({ ok: true });
  });
  app.route("/workspaces/:workspaceId/hr", peopleRoutes(core));
  return app;
}
