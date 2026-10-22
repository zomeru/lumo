import { idSchema, paginationSchema } from "@lumo/contracts";
import * as schemas from "@lumo/contracts/messenger";
import type { Database } from "@lumo/database";
import { Hono } from "hono";
import { z } from "zod";

import type { ApiContext } from "../../lib/context";
import { parse } from "../../lib/errors";
import { enforceRateLimit } from "../../middleware/rate-limit";
import type { MessengerService } from "./messenger.service";

export function messengerRoutes(db: Database, chat: MessengerService) {
  const app = new Hono<ApiContext>();
  app.use("/workspaces/:workspaceId/*", async (c, next) => {
    parse(idSchema, c.req.param("workspaceId"));
    await next();
  });
  app.get("/workspaces/:workspaceId/channels", async (c) => {
    const { offset, limit } = parse(paginationSchema, c.req.query());
    const q = parse(z.string().max(100), c.req.query("q") ?? "");
    return c.json(
      await chat.list(c.req.param("workspaceId"), c.get("user").id, offset, limit, true, q),
    );
  });
  app.post("/workspaces/:workspaceId/channels", async (c) => {
    await enforceRateLimit(db, `channel-create:${c.get("user").id}`, 20);
    return c.json(
      await chat.createChannel(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(schemas.channelInputSchema, await c.req.json()),
      ),
      201,
    );
  });
  app.patch("/workspaces/:workspaceId/channels/:id", async (c) =>
    c.json(
      await chat.update(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
        parse(schemas.channelUpdateSchema, await c.req.json()),
      ),
    ),
  );
  for (const action of ["join", "leave"] as const)
    app.post(`/workspaces/:workspaceId/conversations/:id/${action}`, async (c) => {
      await chat[action](
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
      );
      return c.json({ ok: true });
    });
  app.get("/workspaces/:workspaceId/conversations/:id/activity", async (c) => {
    const { offset, limit } = parse(paginationSchema, c.req.query());
    return c.json(
      await chat.auditHistory(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
        offset,
        limit,
      ),
    );
  });
  app.get("/workspaces/:workspaceId/conversations/:id/members", async (c) => {
    const { offset, limit } = parse(paginationSchema, c.req.query());
    return c.json(
      await chat.members(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
        offset,
        limit,
        parse(z.string().max(100), c.req.query("q") ?? ""),
      ),
    );
  });
  app.post("/workspaces/:workspaceId/channels/:id/members", async (c) => {
    await enforceRateLimit(db, `channel-members:${c.get("user").id}`, 40);
    const input = parse(schemas.channelMemberInputSchema, await c.req.json());
    await chat.member(
      c.req.param("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("id")),
      input.userId,
      input.role,
    );
    return c.json({ ok: true });
  });
  app.delete("/workspaces/:workspaceId/channels/:id/members/:userId", async (c) => {
    await chat.member(
      c.req.param("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("id")),
      parse(idSchema, c.req.param("userId")),
      null,
    );
    return c.json({ ok: true });
  });
  app.post("/workspaces/:workspaceId/conversations/:id/preferences", async (c) => {
    const input = parse(schemas.messengerPreferencesSchema, await c.req.json());
    await chat.preferences(
      c.req.param("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("id")),
      input.notifications,
    );
    return c.json({ ok: true });
  });
  app.post("/workspaces/:workspaceId/conversations/:id/cursor", async (c) => {
    const { messageId } = parse(schemas.messengerReadSchema, await c.req.json());
    await chat.read(
      c.req.param("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("id")),
      messageId,
    );
    return c.json({ ok: true });
  });
  app.get("/workspaces/:workspaceId/conversations/:id/messages", async (c) =>
    c.json(
      await chat.history(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
        parse(schemas.messengerHistoryQuerySchema, c.req.query()),
      ),
    ),
  );
  app.post("/workspaces/:workspaceId/conversations/:id/messages", async (c) => {
    await enforceRateLimit(db, `message-send:${c.get("user").id}`, 60);
    return c.json(
      await chat.send(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
        parse(schemas.messageInputSchema, await c.req.json()),
      ),
      201,
    );
  });
  app.patch("/workspaces/:workspaceId/messages/:id", async (c) => {
    await chat.mutateMessage(
      c.req.param("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("id")),
      "edit",
      parse(schemas.messageEditSchema, await c.req.json()),
    );
    return c.json({ ok: true });
  });
  app.delete("/workspaces/:workspaceId/messages/:id", async (c) => {
    await chat.mutateMessage(
      c.req.param("workspaceId"),
      c.get("user").id,
      parse(idSchema, c.req.param("id")),
      "delete",
      {},
    );
    return c.json({ ok: true });
  });
  for (const action of ["reaction", "pin"] as const)
    app.post(`/workspaces/:workspaceId/messages/:id/${action}`, async (c) => {
      await chat.mutateMessage(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(idSchema, c.req.param("id")),
        action,
        parse(
          action === "reaction" ? schemas.messageReactionSchema : schemas.messagePinSchema,
          await c.req.json(),
        ),
      );
      return c.json({ ok: true });
    });
  app.get("/workspaces/:workspaceId/messenger/notifications", async (c) => {
    const { offset, limit } = parse(paginationSchema, c.req.query());
    return c.json(
      await chat.notifications(c.req.param("workspaceId"), c.get("user").id, offset, limit),
    );
  });
  app.get("/workspaces/:workspaceId/messenger/search", async (c) => {
    await enforceRateLimit(db, `message-search:${c.get("user").id}`, 60);
    return c.json(
      await chat.search(
        c.req.param("workspaceId"),
        c.get("user").id,
        parse(schemas.messengerSearchQuerySchema, c.req.query()),
      ),
    );
  });
  return app;
}
