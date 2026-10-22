import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { idSchema, okSchema, paginationSchema, errorSchema } from "@lumo/contracts";
import {
  calendarMeetingDetailSchema,
  calendarQuerySchema,
  calendarMeetingsSchema,
  scheduledMeetingInputSchema,
  meetingAvailabilityInputSchema,
  meetingAvailabilitySchema,
  chatCredentialsSchema,
  conversationInputSchema,
  conversationSchema,
  conversationsSchema,
  meetingInputSchema,
  meetingSchema,
  meetingsSchema,
  meetingDetailSchema,
  rtcCredentialsSchema,
  rtcTokenInputSchema,
} from "@lumo/contracts/collaboration";
import type { Database } from "@lumo/database";

import type { CollaborationProvider } from "../integrations/agora";
import type { ApiContext } from "../lib/context";
import { AppError } from "../lib/errors";
import { enforceRateLimit } from "../middleware/rate-limit";
import { createMeetingService } from "./meetings/meeting.service";
import { createMessengerService } from "./messenger/messenger.service";
import type { createWorkspaceService } from "./workspaces/workspace.service";
export function collaborationRoutes(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  provider: CollaborationProvider,
) {
  const app = new OpenAPIHono<ApiContext>({
    defaultHook: (result) => {
      if (!result.success)
        throw new AppError(400, "INVALID_INPUT", "Check the request fields and try again.");
    },
  });
  const chat = createMessengerService(db, workspaces, provider),
    meetings = createMeetingService(db, workspaces, provider);
  const security = [{ cookieAuth: [] }];
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
    429: json(errorSchema),
    503: json(errorSchema),
  };
  const workspaceParams = z.object({ workspaceId: idSchema });
  const conversationParams = workspaceParams.extend({ conversationId: idSchema });
  const meetingParams = z.object({ meetingId: idSchema });
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/conversations",
      tags: ["Messenger"],
      security,
      request: {
        params: workspaceParams,
        query: paginationSchema.extend({ q: z.string().max(100).default("") }),
      },
      responses: { 200: json(conversationsSchema), ...errors },
    }),
    async (c) => {
      const { offset, limit, q } = c.req.valid("query");
      return c.json(
        await chat.list(
          c.req.valid("param").workspaceId,
          c.get("user").id,
          offset,
          limit,
          false,
          q,
        ),
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/conversations",
      tags: ["Messenger"],
      security,
      request: {
        params: workspaceParams,
        body: {
          content: { "application/json": { schema: conversationInputSchema } },
          required: true,
        },
      },
      responses: { 201: json(conversationSchema), ...errors },
    }),
    async (c) => {
      await enforceRateLimit(db, `conversation:${c.get("user").id}`, 20);
      return c.json(
        await chat.create(c.req.valid("param").workspaceId, c.get("user").id, c.req.valid("json")),
        201,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/conversations/{conversationId}",
      tags: ["Messenger"],
      security,
      request: { params: conversationParams },
      responses: { 200: json(conversationSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, conversationId } = c.req.valid("param");
      return c.json(await chat.get(workspaceId, c.get("user").id, conversationId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/conversations/{conversationId}/credentials",
      tags: ["Messenger"],
      security,
      request: { params: conversationParams },
      responses: { 200: json(chatCredentialsSchema), ...errors },
    }),
    async (c) => {
      await enforceRateLimit(db, `chat-token:${c.get("user").id}`, 30);
      const { workspaceId, conversationId } = c.req.valid("param");
      return c.json(await chat.credentials(workspaceId, c.get("user").id, conversationId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/conversations/{conversationId}/read",
      tags: ["Messenger"],
      security,
      request: { params: conversationParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, conversationId } = c.req.valid("param");
      await chat.read(workspaceId, c.get("user").id, conversationId);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/meetings",
      tags: ["Meetings"],
      security,
      request: { params: workspaceParams, query: paginationSchema },
      responses: { 200: json(meetingsSchema), ...errors },
    }),
    async (c) => {
      const { offset, limit } = c.req.valid("query");
      return c.json(
        await meetings.list(c.req.valid("param").workspaceId, c.get("user").id, offset, limit),
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/meetings",
      tags: ["Meetings"],
      security,
      request: {
        params: workspaceParams,
        body: { content: { "application/json": { schema: meetingInputSchema } }, required: true },
      },
      responses: { 201: json(meetingSchema), ...errors },
    }),
    async (c) => {
      await enforceRateLimit(db, `meeting-create:${c.get("user").id}`, 20);
      return c.json(
        await meetings.create(
          c.req.valid("param").workspaceId,
          c.get("user").id,
          c.req.valid("json"),
        ),
        201,
      );
    },
  );
  const scopedMeetingParams = workspaceParams.extend({ meetingId: idSchema });
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/meetings/calendar",
      tags: ["Meetings"],
      security,
      request: { params: workspaceParams, query: calendarQuerySchema },
      responses: { 200: json(calendarMeetingsSchema), ...errors },
    }),
    async (c) =>
      c.json(
        await meetings.calendar(
          c.req.valid("param").workspaceId,
          c.get("user").id,
          c.req.valid("query"),
        ),
        200,
      ),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/meetings/availability",
      tags: ["Meetings"],
      security,
      request: {
        params: workspaceParams,
        body: {
          content: { "application/json": { schema: meetingAvailabilityInputSchema } },
          required: true,
        },
      },
      responses: { 200: json(meetingAvailabilitySchema), ...errors },
    }),
    async (c) =>
      c.json(
        await meetings.availability(
          c.req.valid("param").workspaceId,
          c.get("user").id,
          c.req.valid("json"),
        ),
        200,
      ),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/workspaces/{workspaceId}/meetings/{meetingId}",
      tags: ["Meetings"],
      security,
      request: { params: scopedMeetingParams },
      responses: { 200: json(calendarMeetingDetailSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, meetingId } = c.req.valid("param");
      return c.json(await meetings.calendarDetail(workspaceId, c.get("user").id, meetingId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/workspaces/{workspaceId}/meetings/{meetingId}",
      tags: ["Meetings"],
      security,
      request: {
        params: scopedMeetingParams,
        body: {
          content: { "application/json": { schema: scheduledMeetingInputSchema } },
          required: true,
        },
      },
      responses: { 200: json(meetingSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, meetingId } = c.req.valid("param");
      return c.json(
        await meetings.update(workspaceId, c.get("user").id, meetingId, c.req.valid("json")),
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/workspaces/{workspaceId}/meetings/{meetingId}/cancel",
      tags: ["Meetings"],
      security,
      request: { params: scopedMeetingParams },
      responses: { 200: json(okSchema), ...errors },
    }),
    async (c) => {
      const { workspaceId, meetingId } = c.req.valid("param");
      await meetings.cancel(workspaceId, c.get("user").id, meetingId);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/meetings/{meetingId}",
      tags: ["Meetings"],
      security,
      request: { params: meetingParams },
      responses: { 200: json(meetingDetailSchema), ...errors },
    }),
    async (c) =>
      c.json(await meetings.detail(c.req.valid("param").meetingId, c.get("user").id), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/meetings/{meetingId}/token",
      tags: ["Meetings"],
      security,
      request: {
        params: meetingParams,
        body: { content: { "application/json": { schema: rtcTokenInputSchema } }, required: true },
      },
      responses: { 200: json(rtcCredentialsSchema), ...errors },
    }),
    async (c) => {
      await enforceRateLimit(db, `rtc-token:${c.get("user").id}`, 30);
      return c.json(
        await meetings.token(
          c.req.valid("param").meetingId,
          c.get("user").id,
          c.req.valid("json").screen,
        ),
        200,
      );
    },
  );
  for (const action of ["leave", "end"] as const)
    app.openapi(
      createRoute({
        method: "post",
        path: `/meetings/{meetingId}/${action}`,
        tags: ["Meetings"],
        security,
        request: { params: meetingParams },
        responses: { 200: json(okSchema), ...errors },
      }),
      async (c) => {
        await meetings[action](c.req.valid("param").meetingId, c.get("user").id);
        return c.json({ ok: true as const }, 200);
      },
    );
  return app;
}
