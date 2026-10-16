import {
  idSchema,
  invitationInputSchema,
  memberRoleInputSchema,
  paginationSchema,
  tokenInputSchema,
  transferInputSchema,
  workspaceInputSchema,
  workspaceUpdateSchema,
} from "@lumo/contracts";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context.ts";
import { parse } from "../../lib/errors.ts";
import type { createWorkspaceService } from "./workspace.service.ts";

export function workspaceRoutes(service: ReturnType<typeof createWorkspaceService>) {
  const app = new Hono<ApiContext>();
  app.get("/workspaces", async (c) => c.json({ workspaces: await service.list(c.get("user").id) }));
  app.post("/workspaces", async (c) =>
    c.json(
      await service.create(c.get("user").id, parse(workspaceInputSchema, await c.req.json())),
      201,
    ),
  );
  app.get("/workspaces/discover", async (c) => {
    const { q, offset, limit } = parse(paginationSchema, c.req.query());
    return c.json(await service.discover(c.get("user").id, q, offset, limit));
  });
  app.post("/workspaces/:workspaceId/join", async (c) =>
    c.json(await service.join(parse(idSchema, c.req.param("workspaceId")), c.get("user").id)),
  );
  app.post("/invitations/preview", async (c) =>
    c.json(await service.preview(parse(tokenInputSchema, await c.req.json()).token, c.get("user"))),
  );
  app.post("/invitations/accept", async (c) =>
    c.json(await service.accept(parse(tokenInputSchema, await c.req.json()).token, c.get("user"))),
  );

  app.use("/workspaces/:workspaceId/*", async (c, next) => {
    const id = parse(idSchema, c.req.param("workspaceId"));
    const { member } = await service.requireAccess(id, c.get("user").id);
    c.set("workspaceId", id);
    c.set("role", member.role);
    await next();
  });
  // The exact root endpoint is explicitly checked by get/update as well.
  app.get("/workspaces/:workspaceId", async (c) =>
    c.json(await service.get(parse(idSchema, c.req.param("workspaceId")), c.get("user").id)),
  );
  app.patch("/workspaces/:workspaceId", async (c) =>
    c.json(
      await service.update(
        parse(idSchema, c.req.param("workspaceId")),
        c.get("user").id,
        parse(workspaceUpdateSchema, await c.req.json()),
      ),
    ),
  );
  app.get("/workspaces/:workspaceId/members", async (c) => {
    const { q, offset, limit } = parse(paginationSchema, c.req.query());
    return c.json(await service.members(c.get("workspaceId"), c.get("user").id, q, offset, limit));
  });
  app.patch("/workspaces/:workspaceId/members/:userId", async (c) => {
    const { role } = parse(memberRoleInputSchema, await c.req.json());
    await service.changeRole(
      c.get("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("userId")),
      role,
    );
    return c.json({ ok: true });
  });
  app.delete("/workspaces/:workspaceId/members/:userId", async (c) => {
    await service.remove(
      c.get("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("userId")),
    );
    return c.json({ ok: true });
  });
  app.post("/workspaces/:workspaceId/leave", async (c) => {
    await service.leave(c.get("workspaceId"), c.get("user").id);
    return c.json({ ok: true });
  });
  app.post("/workspaces/:workspaceId/transfer-ownership", async (c) => {
    await service.transfer(
      c.get("workspaceId"),
      c.get("user").id,
      parse(transferInputSchema, await c.req.json()).userId,
    );
    return c.json({ ok: true });
  });
  app.get("/workspaces/:workspaceId/invitations", async (c) =>
    c.json({ invitations: await service.invitations(c.get("workspaceId"), c.get("user").id) }),
  );
  app.post("/workspaces/:workspaceId/invitations", async (c) => {
    const { email, role } = parse(invitationInputSchema, await c.req.json());
    return c.json(await service.invite(c.get("workspaceId"), c.get("user").id, email, role), 201);
  });
  app.delete("/workspaces/:workspaceId/invitations/:invitationId", async (c) => {
    await service.revoke(
      c.get("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("invitationId")),
    );
    return c.json({ ok: true });
  });
  app.get("/workspaces/:workspaceId/activity", async (c) =>
    c.json({ events: await service.activity(c.get("workspaceId"), c.get("user").id) }),
  );
  return app;
}
