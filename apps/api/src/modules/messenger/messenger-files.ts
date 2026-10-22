import { randomUUID } from "node:crypto";

import { idSchema } from "@lumo/contracts";
import {
  messengerAttachmentInputSchema,
  attachmentMimeFromName,
  isMessengerMedia,
} from "@lumo/contracts/messenger";
import type { Database } from "@lumo/database";
import {
  messengerAttachment as attachment,
  messengerMessage as message,
  storageCleanup,
} from "@lumo/database/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context";
import { AppError, denied, missing, parse } from "../../lib/errors";
import { enforceRateLimit } from "../../middleware/rate-limit";
import type { Storage } from "../../storage/storage";
import { validateSignature } from "../drive/validation";
import type { MessengerService } from "./messenger.service";

const keyFor = (workspaceId: string, id: string, staging = false) =>
  `messenger/${workspaceId}/${id}/${staging ? "staging" : "content"}`;
const fileDto = (file: typeof attachment.$inferSelect) => ({
  id: file.id,
  name: file.name,
  mimeType: file.mimeType,
  size: file.size,
  scanStatus: "unscanned" as const,
});
export function messengerFileRoutes(db: Database, chat: MessengerService, storage: Storage) {
  const app = new Hono<ApiContext>();
  app.post("/workspaces/:workspaceId/conversations/:id/attachments", async (c) => {
    await enforceRateLimit(db, `messenger-upload:${c.get("user").id}`, 20);
    const workspaceId = parse(idSchema, c.req.param("workspaceId")),
      conversationId = parse(idSchema, c.req.param("id")),
      input = parse(messengerAttachmentInputSchema, await c.req.json()),
      actor = c.get("user").id;
    if (attachmentMimeFromName(input.name) !== input.mimeType)
      throw new AppError(400, "INVALID_FILE", "The file extension must match its type.");
    return c.json(
      await chat.scoped(workspaceId, actor, conversationId, async (tx, item, member) => {
        chat.canPost(item, member);
        const id = randomUUID(),
          key = keyFor(workspaceId, id, true);
        await tx
          .insert(attachment)
          .values({ id, workspaceId, conversationId, ownerId: actor, ...input });
        await tx.insert(storageCleanup).values([
          { key, notBefore: new Date(Date.now() + 86400000) },
          { key: keyFor(workspaceId, id), notBefore: new Date(Date.now() + 86400000) },
        ]);
        return { id, url: await storage.putUrl(key, input.size, input.mimeType, input.checksum) };
      }),
      201,
    );
  });
  app.post("/workspaces/:workspaceId/messenger/attachments/:id/complete", async (c) => {
    const workspaceId = parse(idSchema, c.req.param("workspaceId")),
      id = parse(idSchema, c.req.param("id")),
      actor = c.get("user").id;
    const [file] = await db
      .select()
      .from(attachment)
      .where(and(eq(attachment.workspaceId, workspaceId), eq(attachment.id, id)));
    if (!file) missing();
    return c.json(
      await chat.scoped(workspaceId, actor, file.conversationId, async (tx, item, member) => {
        chat.canPost(item, member);
        if (file.ownerId !== actor) denied();
        const [current] = await tx.select().from(attachment).where(eq(attachment.id, id));
        if (!current) missing();
        if (current.state === "ready") return fileDto(current);
        if (current.createdAt.getTime() + 3600000 < Date.now())
          throw new AppError(409, "UPLOAD_EXPIRED", "Start a new upload.");
        const staging = keyFor(workspaceId, id, true),
          key = keyFor(workspaceId, id),
          metadata = await storage.stat(staging);
        if (
          metadata.size !== file.size ||
          metadata.mimeType !== file.mimeType ||
          metadata.checksum !== file.checksum
        )
          throw new AppError(
            400,
            "INVALID_UPLOAD",
            "Uploaded file does not match its declared metadata.",
          );
        validateSignature(file.mimeType, await storage.sample(staging, 8192));
        await storage.copy(staging, key, metadata.etag);
        await tx.update(attachment).set({ state: "ready" }).where(eq(attachment.id, id));
        return fileDto(file);
      }),
    );
  });
  for (const action of ["download", "preview"] as const)
    app.post(`/workspaces/:workspaceId/messenger/attachments/:id/${action}`, async (c) => {
      const workspaceId = parse(idSchema, c.req.param("workspaceId")),
        id = parse(idSchema, c.req.param("id")),
        actor = c.get("user").id;
      const [file] = await db
        .select()
        .from(attachment)
        .where(
          and(
            eq(attachment.workspaceId, workspaceId),
            eq(attachment.id, id),
            eq(attachment.state, "ready"),
          ),
        );
      if (!file?.messageId) missing();
      return c.json(
        await chat.scoped(workspaceId, actor, file.conversationId, async (tx) => {
          const [parent] = await tx.select().from(message).where(eq(message.id, file.messageId!));
          if (!parent || parent.deletedAt) missing();
          if (action === "preview" && !isMessengerMedia(file.mimeType))
            throw new AppError(
              415,
              "PREVIEW_UNSUPPORTED",
              "A preview is not available for this file type. Download the original instead.",
            );
          return {
            url: await storage.downloadUrl(
              keyFor(workspaceId, id),
              file.name,
              action === "preview" ? file.mimeType : undefined,
            ),
            expiresAt: new Date(Date.now() + 120000).toISOString(),
          };
        }),
      );
    });
  return app;
}
