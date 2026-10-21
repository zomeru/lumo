import { randomUUID } from "node:crypto";

import { idSchema } from "@lumo/contracts";
import { hrFileInputSchema } from "@lumo/contracts/hr";
import { hrFile, storageCleanup } from "@lumo/database/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context";
import { AppError, denied, missing, parse } from "../../lib/errors";
import type { Storage } from "../../storage/storage";
import { readRequest } from "./approvals";
import { auditHr, type HrCore, type HrContext } from "./core";

type FileAccess = (c: HrContext, id: string, write: boolean) => Promise<void>;
export function hrFilesRoutes(core: HrCore, storage: Storage, taskAccess: FileAccess) {
  const app = new Hono<ApiContext>();
  async function access(c: HrContext, type: string, id: string, write = false) {
    if (type === "request") {
      const request = await readRequest(c, id);
      if (
        write &&
        (request.requesterId !== c.actorId || !["draft", "pending"].includes(request.status))
      )
        denied();
    } else if (type === "task") await taskAccess(c, id, write);
    else missing();
  }
  app.post("/files/:type/:targetId/uploads", async (c) => {
    const targetId = parse(idSchema, c.req.param("targetId")),
      type = c.req.param("type"),
      input = parse(hrFileInputSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await access(ctx, type, targetId, true);
        const id = randomUUID(),
          key = `hr/${ctx.workspaceId}/${id}/staging`;
        await ctx.tx.insert(hrFile).values({
          id,
          workspaceId: ctx.workspaceId,
          targetType: type,
          targetId,
          ownerId: ctx.actorId,
          ...input,
        });
        await ctx.tx
          .insert(storageCleanup)
          .values({ key, notBefore: new Date(Date.now() + 86400000) });
        return { id, url: await storage.putUrl(key, input.size, input.mimeType, input.checksum) };
      }),
      201,
    );
  });
  app.post("/files/:id/complete", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      const [file] = await ctx.tx
        .select()
        .from(hrFile)
        .where(and(eq(hrFile.workspaceId, ctx.workspaceId), eq(hrFile.id, id)));
      if (!file) missing();
      await access(ctx, file.targetType, file.targetId, true);
      if (file.ownerId !== ctx.actorId) denied();
      if (file.state === "ready") return;
      const staging = `hr/${ctx.workspaceId}/${id}/staging`,
        key = `hr/${ctx.workspaceId}/${id}/content`;
      const metadata = await storage.stat(staging);
      if (
        metadata.size !== file.size ||
        metadata.checksum !== file.checksum ||
        metadata.mimeType !== file.mimeType
      )
        throw new AppError(
          400,
          "INVALID_UPLOAD",
          "Uploaded file does not match its declared metadata.",
        );
      // Copy to an immutable key: a still-live upload URL cannot mutate a submitted document.
      await storage.copy(staging, key, metadata.etag);
      await ctx.tx
        .update(hrFile)
        .set({ state: "ready" })
        .where(and(eq(hrFile.workspaceId, ctx.workspaceId), eq(hrFile.id, id)));
      await auditHr(ctx, "file.attached", id, {
        targetType: file.targetType,
        targetId: file.targetId,
      });
    });
    return c.json({ ok: true });
  });
  app.post("/files/:id/download", async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const [file] = await ctx.tx
          .select()
          .from(hrFile)
          .where(
            and(
              eq(hrFile.workspaceId, ctx.workspaceId),
              eq(hrFile.id, id),
              eq(hrFile.state, "ready"),
            ),
          );
        if (!file) missing();
        await access(ctx, file.targetType, file.targetId);
        await auditHr(ctx, "file.downloaded", id);
        return {
          url: await storage.downloadUrl(
            `hr/${ctx.workspaceId}/${id}/content`,
            file.name,
            file.mimeType,
          ),
        };
      }),
    );
  });
  return app;
}
