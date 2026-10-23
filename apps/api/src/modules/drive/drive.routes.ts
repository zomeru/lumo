import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { idSchema, okSchema, errorSchema } from "@lumolynk/contracts";
import {
  driveListInputSchema,
  driveListSchema,
  driveFolderInputSchema,
  driveUploadInputSchema,
  driveUpdateInputSchema,
  driveCopyInputSchema,
  drivePartInputSchema,
  driveShareInputSchema,
  driveArchiveInputSchema,
  driveStarInputSchema,
  driveItemSchema,
  driveUploadSchema,
  driveUrlSchema,
  drivePartSchema,
  driveSharesSchema,
  driveDetailsSchema,
} from "@lumolynk/contracts/drive";
import type { Database } from "@lumolynk/database";
import type { ServerEnv } from "@lumolynk/env/server";

import type { ApiContext } from "../../lib/context";
import { AppError } from "../../lib/errors";
import { enforceRateLimit } from "../../middleware/rate-limit";
import type { Storage } from "../../storage/storage";
import type { createWorkspaceService } from "../workspaces/workspace.service";
import { createDriveService } from "./drive.service";

export function driveRoutes(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  storage: Storage,
  env: ServerEnv,
  service?: ReturnType<typeof createDriveService>,
) {
  const app = new OpenAPIHono<ApiContext>({
    defaultHook: (result) => {
      if (!result.success)
        throw new AppError(400, "INVALID_INPUT", "Check the request fields and try again.");
    },
  });
  const drive = service ?? createDriveService(db, workspaces, storage, env);
  const params = z.object({ workspaceId: idSchema });
  const itemParams = params.extend({ itemId: idSchema });
  const shareParams = itemParams.extend({ userId: idSchema });
  const json = (schema: z.ZodType) => ({
    content: { "application/json": { schema } },
    description: "Success",
  });
  const errors = {
    400: json(errorSchema),
    401: json(errorSchema),
    403: json(errorSchema),
    404: json(errorSchema),
    409: json(errorSchema),
    413: json(errorSchema),
    429: json(errorSchema),
    503: json(errorSchema),
  };
  app.use("/workspaces/:workspaceId/drive/*", async (c, next) => {
    c.set("workspaceId", c.req.param("workspaceId")!);
    await next();
  });
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/drive",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: params, query: driveListInputSchema },
      responses: { 200: json(driveListSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const actor = c.get("user").id;
      return c.json(await drive.list(workspaceId, actor, c.req.valid("query")), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/folders",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: params,
        body: {
          content: { "application/json": { schema: driveFolderInputSchema } },
          required: true,
        },
      },
      responses: { 201: json(driveItemSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.folder(workspaceId, actor, c.req.valid("json")), 201);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/uploads",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: params,
        body: {
          content: { "application/json": { schema: driveUploadInputSchema } },
          required: true,
        },
      },
      responses: { 201: json(driveUploadSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.initialize(workspaceId, actor, c.req.valid("json")), 201);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/archive",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: params,
        body: {
          content: { "application/json": { schema: driveArchiveInputSchema } },
          required: true,
        },
      },
      responses: { 200: json(driveUrlSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.archive(workspaceId, actor, c.req.valid("json").ids), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/drive/{itemId}",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(driveDetailsSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      return c.json(await drive.details(workspaceId, actor, itemId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/workspaces/{workspaceId}/drive/{itemId}",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: itemParams,
        body: {
          content: { "application/json": { schema: driveUpdateInputSchema } },
          required: true,
        },
      },
      responses: { 200: json(driveItemSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.update(workspaceId, actor, itemId, c.req.valid("json")), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/parts",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: itemParams,
        body: { content: { "application/json": { schema: drivePartInputSchema } }, required: true },
      },
      responses: { 200: json(drivePartSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(
        await drive.part(
          workspaceId,
          actor,
          itemId,
          c.req.valid("json").partNumber,
          c.req.valid("json").checksum,
        ),
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/complete",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(driveItemSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.complete(workspaceId, actor, itemId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/cancel",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.cancel(workspaceId, actor, itemId);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/copy",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: itemParams,
        body: { content: { "application/json": { schema: driveCopyInputSchema } }, required: true },
      },
      responses: { 201: json(driveItemSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.copy(workspaceId, actor, itemId, c.req.valid("json")), 201);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/workspaces/{workspaceId}/drive/{itemId}",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.trash(workspaceId, actor, itemId);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/restore",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.restore(workspaceId, actor, itemId);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/workspaces/{workspaceId}/drive/{itemId}/permanent",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.purge(workspaceId, actor, itemId);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "put",
      path: "/workspaces/{workspaceId}/drive/{itemId}/star",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: itemParams,
        body: { content: { "application/json": { schema: driveStarInputSchema } }, required: true },
      },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.favorite(workspaceId, actor, itemId, c.req.valid("json").starred);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/drive/{itemId}/shares",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(driveSharesSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      return c.json(await drive.shares(workspaceId, actor, itemId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "put",
      path: "/workspaces/{workspaceId}/drive/{itemId}/shares",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: {
        params: itemParams,
        body: {
          content: { "application/json": { schema: driveShareInputSchema } },
          required: true,
        },
      },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.grant(
        workspaceId,
        actor,
        itemId,
        c.req.valid("json").userId,
        c.req.valid("json").permission,
      );
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/workspaces/{workspaceId}/drive/{itemId}/shares/{userId}",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: shareParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      await drive.grant(workspaceId, actor, itemId, c.req.valid("param").userId, null);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/download",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(driveUrlSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.download(workspaceId, actor, itemId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/drive/{itemId}/preview",
      tags: ["Drive"],
      security: [{ cookieAuth: [] }],
      request: { params: itemParams },
      responses: { 200: json(driveUrlSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, itemId } = c.req.valid("param");
      const actor = c.get("user").id;
      await enforceRateLimit(db, `drive:${actor}`, 240);
      return c.json(await drive.download(workspaceId, actor, itemId, true), 200);
    },
  );
  return app;
}
