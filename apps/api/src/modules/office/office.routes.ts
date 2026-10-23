import { Readable } from "node:stream";

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { idSchema, okSchema, errorSchema } from "@lumolynk/contracts";
import { driveItemSchema, driveListSchema, driveUrlSchema } from "@lumolynk/contracts/drive";
import {
  officeCreateSchema,
  officeDetailSchema,
  officeEditorSchema,
  officeListInputSchema,
  officeVersionsSchema,
  wikiMoveSchema,
  wikiSessionSchema,
  wikiTreeSchema,
} from "@lumolynk/contracts/office";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";

import type { ApiContext } from "../../lib/context";
import { AppError, parse } from "../../lib/errors";
import type { createDriveService } from "../drive/drive.service";
import type { OfficeService } from "./office.service";

type SessionIssuer = (
  workspaceId: string,
  actor: string,
  name: string,
  id: string,
) => Promise<z.infer<typeof wikiSessionSchema>>;
const json = (schema: z.ZodType) => ({
  content: { "application/json": { schema } },
  description: "Result",
});
export function officeRoutes(
  office: OfficeService,
  drive: ReturnType<typeof createDriveService>,
  wikiSession: SessionIssuer,
) {
  const app = new OpenAPIHono<ApiContext>({
    defaultHook: (r) => {
      if (!r.success)
        throw new AppError(400, "INVALID_INPUT", "Check the request fields and try again.");
    },
  });
  const parameters = z.object({ workspaceId: idSchema });
  const docParameters = parameters.extend({ documentId: idSchema });
  const versionParameters = docParameters.extend({ versionId: idSchema });
  function register(
    method: "get" | "post" | "patch" | "delete",
    path: string,
    params: z.ZodObject,
    output: z.ZodType,
    handler: (c: Context<ApiContext>) => Promise<Response>,
    body?: z.ZodType,
    query?: z.ZodObject,
  ) {
    const route = createRoute({
      method,
      path,
      tags: ["Office"],
      security: [{ cookieAuth: [] }],
      request: {
        params,
        ...(body
          ? { body: { content: { "application/json": { schema: body } }, required: true } }
          : {}),
        ...(query ? { query } : {}),
      },
      responses: {
        200: json(output),
        400: json(errorSchema),
        401: json(errorSchema),
        403: json(errorSchema),
        404: json(errorSchema),
        409: json(errorSchema),
        429: json(errorSchema),
        503: json(errorSchema),
      },
    });
    app.openAPIRegistry.registerPath(route);
    app.on(method.toUpperCase(), path.replace(/\{([^}]+)\}/g, ":$1"), handler);
  }
  const args = (c: Context<ApiContext>) => parse(docParameters, c.req.param());
  const base = "/workspaces/{workspaceId}/documents",
    item = `${base}/{documentId}`,
    wiki = "/workspaces/{workspaceId}/wiki/pages";
  register(
    "get",
    base,
    parameters,
    driveListSchema,
    async (c) => {
      const { workspaceId } = parse(parameters, c.req.param());
      c.set("workspaceId", workspaceId);
      const input = parse(officeListInputSchema, c.req.query());
      return c.json(await office.list(workspaceId, c.get("user").id, input, input.kind));
    },
    undefined,
    officeListInputSchema,
  );
  register(
    "post",
    base,
    parameters,
    officeDetailSchema,
    async (c) => {
      const { workspaceId } = parse(parameters, c.req.param());
      return c.json(
        await office.create(
          workspaceId,
          c.get("user").id,
          parse(officeCreateSchema, await c.req.json()),
        ),
      );
    },
    officeCreateSchema,
  );
  register("get", item, docParameters, officeDetailSchema, async (c) => {
    const { workspaceId, documentId } = args(c);
    return c.json(await office.detail(workspaceId, c.get("user").id, documentId));
  });
  register(
    "post",
    `${item}/editor-config`,
    docParameters,
    officeEditorSchema,
    async (c) => {
      const { workspaceId, documentId } = args(c),
        actor = c.get("user");
      return c.json(await office.editor(workspaceId, actor.id, actor.name, documentId));
    },
    z.object({}).strict(),
  );
  register("get", `${item}/versions`, docParameters, officeVersionsSchema, async (c) => {
    const { workspaceId, documentId } = args(c);
    return c.json(await office.versions(workspaceId, c.get("user").id, documentId));
  });
  register(
    "post",
    `${item}/versions/{versionId}/download`,
    versionParameters,
    driveUrlSchema,
    async (c) => {
      const { workspaceId, documentId, versionId } = parse(versionParameters, c.req.param());
      return c.json(
        await office.versionDownload(workspaceId, c.get("user").id, documentId, versionId),
      );
    },
    z.object({}).strict(),
  );
  register(
    "post",
    `${item}/versions/{versionId}/restore`,
    versionParameters,
    officeDetailSchema,
    async (c) => {
      const { workspaceId, documentId, versionId } = parse(versionParameters, c.req.param());
      return c.json(await office.restore(workspaceId, c.get("user").id, documentId, versionId));
    },
    z.object({}).strict(),
  );
  register(
    "post",
    `${item}/save`,
    docParameters,
    okSchema,
    async (c) => {
      const { workspaceId, documentId } = args(c);
      await office.forceSave(workspaceId, c.get("user").id, documentId);
      return c.json({ ok: true });
    },
    z.object({}).strict(),
  );
  register("get", `${item}/share-item`, docParameters, driveItemSchema, async (c) => {
    const { workspaceId, documentId } = args(c),
      actor = c.get("user").id;
    const doc = await office.detail(workspaceId, actor, documentId);
    if (doc.kind !== "wiki") return c.json(doc.item);
    const { page } = await office.wikiLocation(workspaceId, actor, documentId);
    return c.json((await drive.details(workspaceId, actor, page.folderId)).item);
  });
  register("get", wiki, parameters, wikiTreeSchema, async (c) => {
    const { workspaceId } = parse(parameters, c.req.param());
    return c.json(await office.tree(workspaceId, c.get("user").id));
  });
  register(
    "post",
    wiki,
    parameters,
    officeDetailSchema,
    async (c) => {
      const { workspaceId } = parse(parameters, c.req.param());
      return c.json(
        await office.create(workspaceId, c.get("user").id, {
          ...parse(officeCreateSchema, await c.req.json()),
          kind: "wiki",
        }),
      );
    },
    officeCreateSchema,
  );
  register(
    "patch",
    `${wiki}/{documentId}`,
    docParameters,
    okSchema,
    async (c) => {
      const { workspaceId, documentId } = args(c),
        input = parse(wikiMoveSchema, await c.req.json());
      await office.wikiMove(
        workspaceId,
        c.get("user").id,
        documentId,
        input.parentId,
        input.position,
      );
      return c.json({ ok: true });
    },
    wikiMoveSchema,
  );
  register("delete", `${wiki}/{documentId}`, docParameters, okSchema, async (c) => {
    const { workspaceId, documentId } = args(c),
      actor = c.get("user").id;
    const { page } = await office.wikiLocation(workspaceId, actor, documentId);
    await drive.trash(workspaceId, actor, page.folderId);
    return c.json({ ok: true });
  });
  register(
    "post",
    `${wiki}/{documentId}/session`,
    docParameters,
    wikiSessionSchema,
    async (c) => {
      const { workspaceId, documentId } = args(c),
        actor = c.get("user");
      parse(z.object({ format: z.literal("markdown-v1") }), await c.req.json());
      return c.json(await wikiSession(workspaceId, actor.id, actor.name, documentId));
    },
    z.object({ format: z.literal("markdown-v1") }).strict(),
  );
  register(
    "post",
    `${wiki}/{documentId}/copy`,
    docParameters,
    officeDetailSchema,
    async (c) => {
      const { workspaceId, documentId } = args(c);
      return c.json(await office.wikiCopy(workspaceId, c.get("user").id, documentId));
    },
    z.object({}).strict(),
  );
  return app;
}
export function officeMachineRoutes(office: OfficeService, failed?: (error: Error) => void) {
  const app = new OpenAPIHono<ApiContext>();
  app.use("*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 1 }, 413) }));
  app.get("/files/:id/:versionId", async (c) => {
    const { id, versionId } = parse(z.object({ id: idSchema, versionId: idSchema }), c.req.param());
    const result = await office.source(id, versionId, c.req.query("token") ?? "");
    c.header("Content-Type", result.mime);
    c.header("Content-Length", String(result.size));
    c.header(
      "Content-Disposition",
      `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(result.name).replaceAll("'", "%27")}`,
    );
    return c.body(Readable.toWeb(result.stream) as ReadableStream<Uint8Array>);
  });
  app.post("/callback/:id/:generation", async (c) => {
    if (c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return c.json({ error: 1 }, 415);
    const { id, generation } = parse(
      z.object({ id: idSchema, generation: z.coerce.number().int().min(0) }),
      c.req.param(),
    );
    await office.callback(id, generation, await c.req.json(), c.req.header("authorization"));
    return c.json({ error: 0 });
  });
  app.onError((error, c) => {
    failed?.(error);
    return c.json({ error: 1 }, error instanceof AppError ? error.status : 500);
  });
  return app;
}
