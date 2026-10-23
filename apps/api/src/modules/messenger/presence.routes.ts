import { idSchema } from "@lumolynk/contracts";
import { presenceQuerySchema, presencePreferenceSchema } from "@lumolynk/contracts/presence";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context";
import { parse } from "../../lib/errors";
import type { createPresenceService } from "./presence.service";
export function presenceRoutes(presence: ReturnType<typeof createPresenceService>) {
  const app = new Hono<ApiContext>();
  app.get("/me/presence", async (c) => c.json(await presence.preference(c.get("user").id)));
  app.put("/me/presence", async (c) =>
    c.json(
      await presence.setPreference(
        c.get("user").id,
        parse(presencePreferenceSchema, await c.req.json()).dnd,
      ),
    ),
  );
  app.post("/workspaces/:workspaceId/presence", async (c) =>
    c.json(
      await presence.query(
        parse(idSchema, c.req.param("workspaceId")),
        c.get("user").id,
        parse(presenceQuerySchema, await c.req.json()).userIds,
      ),
    ),
  );
  return app;
}
