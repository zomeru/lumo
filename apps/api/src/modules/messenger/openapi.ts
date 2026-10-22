import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { errorSchema, idSchema, okSchema, paginationSchema } from "@lumo/contracts";
import { conversationSchema, conversationsSchema } from "@lumo/contracts/collaboration";
import * as messenger from "@lumo/contracts/messenger";
import {
  presenceQuerySchema,
  presenceResultSchema,
  presencePreferenceSchema,
} from "@lumo/contracts/presence";

import type { ApiContext } from "../../lib/context";

export function documentMessenger(app: OpenAPIHono<ApiContext>) {
  for (const method of ["get", "put"] as const)
    app.openAPIRegistry.registerPath({
      method,
      path: "/api/v1/me/presence",
      tags: ["Messenger"],
      security: [{ cookieAuth: [] }],
      description:
        "Explicit DND preference. Offline takes precedence; notification suppression is separate.",
      ...(method === "put"
        ? {
            request: {
              body: {
                required: true,
                content: { "application/json": { schema: presencePreferenceSchema } },
              },
            },
          }
        : {}),
      responses: {
        200: {
          description: "Availability preference",
          content: { "application/json": { schema: presencePreferenceSchema } },
        },
      },
    });
  const endpoints: {
    method: "get" | "post" | "patch" | "delete";
    path: string;
    response: z.ZodType;
    input?: z.ZodType;
    query?: z.ZodObject;
    status?: number;
  }[] = [
    {
      method: "post",
      path: "/presence",
      input: presenceQuerySchema,
      response: presenceResultSchema,
    },
    {
      method: "get",
      path: "/channels",
      response: conversationsSchema,
      query: paginationSchema.extend({ q: z.string().max(100).optional() }),
    },
    {
      method: "post",
      path: "/channels",
      response: conversationSchema,
      input: messenger.channelInputSchema,
      status: 201,
    },
    {
      method: "patch",
      path: "/channels/{id}",
      response: conversationSchema,
      input: messenger.channelUpdateSchema,
    },
    ...(["join", "leave"] as const).map((action) => ({
      method: "post" as const,
      path: `/conversations/{id}/${action}`,
      response: okSchema,
    })),
    {
      method: "get",
      path: "/conversations/{id}/activity",
      response: messenger.messengerAuditSchema,
      query: paginationSchema,
    },
    {
      method: "get",
      path: "/conversations/{id}/members",
      response: messenger.messengerMembersSchema,
      query: paginationSchema.extend({ q: z.string().max(100).optional() }),
    },
    {
      method: "post",
      path: "/channels/{id}/members",
      response: okSchema,
      input: messenger.channelMemberInputSchema,
    },
    { method: "delete", path: "/channels/{id}/members/{userId}", response: okSchema },
    {
      method: "post",
      path: "/conversations/{id}/preferences",
      response: okSchema,
      input: messenger.messengerPreferencesSchema,
    },
    {
      method: "post",
      path: "/conversations/{id}/cursor",
      response: okSchema,
      input: messenger.messengerReadSchema,
    },
    {
      method: "get",
      path: "/conversations/{id}/messages",
      response: messenger.messengerMessagesSchema,
      query: messenger.messengerHistoryQuerySchema,
    },
    {
      method: "post",
      path: "/conversations/{id}/messages",
      response: messenger.messengerMessageSchema,
      input: messenger.messageInputSchema,
      status: 201,
    },
    {
      method: "patch",
      path: "/messages/{id}",
      response: okSchema,
      input: messenger.messageEditSchema,
    },
    { method: "delete", path: "/messages/{id}", response: okSchema },
    {
      method: "post",
      path: "/messages/{id}/reaction",
      response: okSchema,
      input: messenger.messageReactionSchema,
    },
    {
      method: "post",
      path: "/messages/{id}/pin",
      response: okSchema,
      input: messenger.messagePinSchema,
    },
    {
      method: "get",
      path: "/messenger/notifications",
      response: messenger.messengerNotificationsSchema,
      query: paginationSchema,
    },
    {
      method: "get",
      path: "/messenger/search",
      response: messenger.messengerSearchSchema,
      query: messenger.messengerSearchQuerySchema,
    },
    { method: "post", path: "/messenger/session", response: messenger.messengerSessionSchema },
    {
      method: "post",
      path: "/conversations/{id}/attachments",
      response: z.object({ id: idSchema, url: z.url() }),
      input: messenger.messengerAttachmentInputSchema,
      status: 201,
    },
    {
      method: "post",
      path: "/messenger/attachments/{id}/complete",
      response: messenger.messengerAttachmentSchema,
    },
    {
      method: "post",
      path: "/messenger/attachments/{id}/download",
      response: messenger.messengerAttachmentUrlSchema,
    },
    {
      method: "post",
      path: "/messenger/attachments/{id}/preview",
      response: messenger.messengerAttachmentUrlSchema,
    },
  ];
  for (const endpoint of endpoints) {
    const path = `/api/v1/workspaces/{workspaceId}${endpoint.path}`;
    app.openAPIRegistry.registerPath({
      method: endpoint.method,
      path,
      tags: ["Messenger"],
      security: [{ cookieAuth: [] }],
      description:
        "Requires current workspace membership. Private resources require explicit conversation membership; public channels automatically include all workspace members. Only workspace owners, admins and moderators may create channels. Workspace roles never bypass private content permissions.",
      request: {
        params: z.object(
          Object.fromEntries(
            [...path.matchAll(/\{(\w+)\}/g)].map((match) => [match[1]!, idSchema]),
          ),
        ),
        ...(endpoint.query ? { query: endpoint.query } : {}),
        ...(endpoint.input
          ? {
              body: { required: true, content: { "application/json": { schema: endpoint.input } } },
            }
          : {}),
      },
      responses: Object.fromEntries([
        [
          endpoint.status ?? 200,
          {
            description: "Success",
            content: { "application/json": { schema: endpoint.response } },
          },
        ],
        ...[400, 401, 403, 404, 409, 415, 429, 503].map((status) => [
          status,
          {
            description: "Validated API error",
            content: { "application/json": { schema: errorSchema } },
          },
        ]),
      ]),
    });
  }
}
