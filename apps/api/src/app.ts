import { randomUUID } from "node:crypto";

import { OpenAPIHono } from "@hono/zod-openapi";
import type { Auth } from "@lumo/auth";
import type { Database, Transaction } from "@lumo/database";
import {
  conversation,
  conversationMember,
  officeDocument,
  membership,
} from "@lumo/database/schema";
import type { ServerEnv } from "@lumo/env/server";
import { chatIdentity } from "@lumo/shared";
import { Scalar } from "@scalar/hono-api-reference";
import { and, eq, sql, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import pino from "pino";

import { createAgora, type CollaborationProvider } from "./integrations/agora";
import type { ApiContext } from "./lib/context.ts";
import { AppError } from "./lib/errors.ts";
import { enforceRateLimit } from "./middleware/rate-limit.ts";
import { collaborationRoutes } from "./modules/collaboration.routes";
import { driveRoutes } from "./modules/drive/drive.routes";
import { createDriveService } from "./modules/drive/drive.service";
import { hrRoutes } from "./modules/hr/hr.routes";
import { officeRoutes, officeMachineRoutes } from "./modules/office/office.routes";
import { createOfficeService } from "./modules/office/office.service";
import { createOfficeProvider, officeKey, type OfficeProvider } from "./modules/office/provider";
import { createWikiHub } from "./modules/office/wiki-hub";
import { userRoutes } from "./modules/users/user.routes.ts";
import { workspaceRoutes } from "./modules/workspaces/workspace.routes.ts";
import { createWorkspaceService } from "./modules/workspaces/workspace.service.ts";
import { documentFoundation } from "./openapi";
import { createS3Storage } from "./storage/s3";
import type { Storage } from "./storage/storage";

export function createApp({
  db,
  auth,
  env,
  clientIp = () => "direct",
  provider = createAgora(env),
  storage = createS3Storage(env),
  officeProvider = createOfficeProvider(env),
}: {
  db: Database;
  auth: Auth;
  env: ServerEnv;
  clientIp?: (c: Context) => string;
  provider?: CollaborationProvider;
  storage?: Storage;
  officeProvider?: OfficeProvider;
}) {
  const app = new OpenAPIHono<ApiContext>();
  const logger = pino({ level: env.LOG_LEVEL });
  async function disconnectOffice(
    tx: Transaction,
    workspaceId: string,
    userId: string,
    force = false,
  ): Promise<void> {
    const [member] = await tx
      .select()
      .from(membership)
      .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, userId)));
    const documents = await tx
      .select()
      .from(officeDocument)
      .where(
        and(
          eq(officeDocument.workspaceId, workspaceId),
          sql`${officeDocument.kind} <> 'wiki'`,
          sql`${officeDocument.state} <> 'idle'`,
        ),
      );
    for (const document of documents) {
      if (!force && member) {
        try {
          const access = await drive.policy.access(
            tx,
            workspaceId,
            userId,
            member.role,
            document.id,
          );
          if (access.permission !== "viewer") continue;
        } catch (error) {
          if (!(error instanceof AppError && error.status === 404)) throw error;
        }
      }
      await officeProvider.command({
        c: "drop",
        key: officeKey(workspaceId, document.id, document.generation, env.API_ORIGIN),
        users: [userId],
      });
    }
  }
  const workspaces = createWorkspaceService(
    db,
    async (tx, workspaceId, userId) => {
      await disconnectOffice(tx, workspaceId, userId, true);
      const groups = await tx
        .select({
          id: conversation.providerGroupId,
          conversationId: conversation.id,
          kind: conversation.kind,
        })
        .from(conversation)
        .innerJoin(conversationMember, eq(conversationMember.conversationId, conversation.id))
        .where(
          and(eq(conversation.workspaceId, workspaceId), eq(conversationMember.userId, userId)),
        );
      const direct = groups
        .filter((group) => group.kind === "direct")
        .map((group) => group.conversationId);
      if (direct.length)
        await tx
          .update(conversation)
          .set({ directKey: null })
          .where(inArray(conversation.id, direct));
      if (!groups.some((group) => group.id)) return;
      const identity = chatIdentity(workspaceId, userId);
      await provider.deactivate(identity);
      for (const group of groups) if (group.id) await provider.removeMember(group.id, identity);
    },
    disconnectOffice,
  );
  const drive = createDriveService(db, workspaces, storage, env, disconnectOffice);
  const office = createOfficeService(db, workspaces, drive, storage, env, officeProvider);
  const wiki = createWikiHub(db, office, storage, env);
  app.use("*", secureHeaders());
  app.use("*", async (c, next) => {
    const start = performance.now();
    const requestId = randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
    // Never log URLs, query strings, cookies, request bodies, or invitation tokens.
    logger.info({
      requestId,
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      durationMs: Math.round(performance.now() - start),
      userId: c.get("user")?.id,
      workspaceId: c.get("workspaceId"),
    });
  });
  // Provider capabilities replace browser sessions only for these exact machine routes.
  app.route(
    "/api/internal/onlyoffice",
    officeMachineRoutes(office, (error) =>
      logger.warn(
        { code: error instanceof AppError ? error.code : "OFFICE_INTERNAL_ERROR" },
        "Office machine request failed",
      ),
    ),
  );
  app.get("/api/config/office", (c) =>
    c.json({ documentServerUrl: env.ONLYOFFICE_DOCUMENT_SERVER_URL ?? null }),
  );
  app.use(
    "/api/*",
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      exposeHeaders: ["X-Request-Id"],
      maxAge: 600,
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 32 * 1024,
      onError: () => {
        throw new AppError(413, "BODY_TOO_LARGE", "Request body is too large.");
      },
    }),
  );
  app.use("/api/*", async (c, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      if (![env.WEB_ORIGIN, env.API_ORIGIN].includes(c.req.header("origin") ?? ""))
        throw new AppError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
      if (c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
        throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json requests.");
    }
    await next();
  });
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/ready", async (c) => {
    await db.execute(sql`select 1`);
    return c.json({ status: "ready" });
  });
  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    const path = c.req.path.slice("/api/auth".length);
    const allowed =
      c.req.method === "GET"
        ? ["/verify-email"]
        : ["/sign-up/email", "/sign-in/email", "/sign-out", "/send-verification-email"];
    if (!allowed.includes(path))
      throw new AppError(404, "NOT_FOUND", "This authentication endpoint is unavailable.");
    const headers = new Headers(c.req.raw.headers);
    headers.set("x-lumo-client-ip", clientIp(c));
    const response = await auth.handler(new Request(c.req.raw, { headers }));
    if (response.status >= 300 && response.status < 400) return response;
    if (!response.headers.get("content-type")?.includes("application/json")) return response;
    const body = (await response.json()) as { message?: string; code?: string };
    if (response.ok)
      return new Response(JSON.stringify({ ok: true }), {
        status: response.status,
        headers: response.headers,
      });
    if (response.status === 429) c.header("Retry-After", "60");
    return new Response(
      JSON.stringify({
        error: {
          code: body.code ?? "AUTH_ERROR",
          message: body.message ?? "Authentication failed.",
          requestId: c.get("requestId"),
        },
      }),
      { status: response.status, headers: response.headers },
    );
  });
  app.use("/api/v1/*", async (c, next) => {
    const { response: result, headers } = await auth.api.getSession({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    // Forward renewal and deletion cookies produced by the server-side session check.
    for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
    if (!result) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
    c.set("user", result.user);
    await enforceRateLimit(db, `api:${result.user.id}`, 300);
    await next();
  });
  app.route("/api/v1", userRoutes(db, workspaces));
  app.route("/api/v1", workspaceRoutes(workspaces));
  app.route("/api/v1", hrRoutes(workspaces, storage));
  app.route("/api/v1", collaborationRoutes(db, workspaces, provider));
  app.route("/api/v1", driveRoutes(db, workspaces, storage, env, drive));
  app.route(
    "/api/v1",
    officeRoutes(office, drive, (workspaceId, actor, name, id) =>
      wiki.issue(workspaceId, actor, name, id),
    ),
  );
  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name:
      env.NODE_ENV === "production"
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token",
  });
  documentFoundation(app);
  app.doc31("/api/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Lumo API", version: "1.0.0" },
    servers: [{ url: env.API_ORIGIN }],
  });
  app.get(
    "/api/reference",
    async (c, next) => {
      if (env.NODE_ENV === "production") {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session)
          throw new AppError(401, "UNAUTHENTICATED", "Sign in to view API documentation.");
      }
      await next();
    },
    Scalar({ url: "/api/openapi.json" }),
  );
  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "This endpoint is unavailable.",
          requestId: c.get("requestId"),
        },
      },
      404,
    ),
  );
  app.onError((error, c) => {
    const known = error instanceof AppError;
    const malformed = error instanceof SyntaxError;
    const httpError = error instanceof HTTPException;
    const code = known
      ? error.code
      : malformed
        ? "INVALID_JSON"
        : httpError
          ? "BAD_REQUEST"
          : "INTERNAL_ERROR";
    const status = known || httpError ? error.status : malformed ? 400 : 500;
    const message = known
      ? error.message
      : malformed
        ? "Enter valid JSON."
        : httpError
          ? "Invalid request."
          : "An unexpected error occurred.";
    if (status === 429) c.header("Retry-After", "60");
    // Log only error classification; database error messages can contain input values.
    if (status === 500)
      logger.error({ requestId: c.get("requestId"), errorType: error.name }, "Request failed");
    return c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
  });
  return Object.assign(app, { wiki });
}
