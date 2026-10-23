import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import * as contracts from "@lumolynk/contracts";
import {
  avatarConfigSchema,
  avatarInputSchema,
  avatarResultSchema,
  avatarUrlSchema,
} from "@lumolynk/contracts/avatar";

import type { ApiContext } from "./lib/context";
/** Existing routes retain their behavior; documentation consumes their real DTO/input schemas. */
export function documentFoundation(app: OpenAPIHono<ApiContext>) {
  const json = (schema: z.ZodType) => ({
    description: "Success",
    content: { "application/json": { schema } },
  });
  const endpoints: {
    method: "get" | "post" | "patch" | "put" | "delete";
    path: string;
    response: z.ZodType;
    input?: z.ZodType;
    status?: number;
  }[] = [
    { method: "get", path: "/api/v1/me", response: contracts.meSchema },
    { method: "get", path: "/api/v1/me/avatar/config", response: avatarConfigSchema },
    {
      method: "put",
      path: "/api/v1/me/avatar",
      input: avatarInputSchema,
      response: avatarResultSchema,
    },
    { method: "delete", path: "/api/v1/me/avatar", response: avatarResultSchema },
    { method: "get", path: "/api/v1/avatars/{id}/{version}", response: avatarUrlSchema },
    {
      method: "patch",
      path: "/api/v1/me",
      response: contracts.okSchema,
      input: contracts.profileInputSchema,
    },
    {
      method: "put",
      path: "/api/v1/me/active-workspace",
      response: contracts.okSchema,
      input: contracts.activeWorkspaceInputSchema,
    },
    { method: "get", path: "/api/v1/workspaces", response: contracts.workspacesSchema },
    {
      method: "post",
      path: "/api/v1/workspaces",
      response: contracts.workspaceSchema,
      input: contracts.workspaceInputSchema,
      status: 201,
    },
    { method: "get", path: "/api/v1/workspaces/discover", response: contracts.discoverySchema },
    {
      method: "get",
      path: "/api/v1/workspaces/{workspaceId}",
      response: contracts.workspaceSchema,
    },
    {
      method: "patch",
      path: "/api/v1/workspaces/{workspaceId}",
      response: contracts.workspaceSchema,
      input: contracts.workspaceUpdateSchema,
    },
    {
      method: "post",
      path: "/api/v1/workspaces/{workspaceId}/join",
      response: contracts.workspaceSchema,
    },
    {
      method: "post",
      path: "/api/v1/workspaces/{workspaceId}/leave",
      response: contracts.okSchema,
    },
    {
      method: "post",
      path: "/api/v1/workspaces/{workspaceId}/transfer-ownership",
      response: contracts.okSchema,
      input: contracts.transferInputSchema,
    },
    {
      method: "get",
      path: "/api/v1/workspaces/{workspaceId}/members",
      response: contracts.membersSchema,
    },
    {
      method: "patch",
      path: "/api/v1/workspaces/{workspaceId}/members/{userId}",
      response: contracts.okSchema,
      input: contracts.memberRoleInputSchema,
    },
    {
      method: "delete",
      path: "/api/v1/workspaces/{workspaceId}/members/{userId}",
      response: contracts.okSchema,
    },
    {
      method: "get",
      path: "/api/v1/workspaces/{workspaceId}/invitations",
      response: contracts.invitationsSchema,
    },
    {
      method: "post",
      path: "/api/v1/workspaces/{workspaceId}/invitations",
      response: contracts.invitationCreatedSchema,
      input: contracts.invitationInputSchema,
      status: 201,
    },
    {
      method: "delete",
      path: "/api/v1/workspaces/{workspaceId}/invitations/{invitationId}",
      response: contracts.okSchema,
    },
    {
      method: "get",
      path: "/api/v1/workspaces/{workspaceId}/activity",
      response: contracts.auditSchema,
    },
    {
      method: "post",
      path: "/api/v1/invitations/preview",
      response: contracts.invitationPreviewSchema,
      input: contracts.tokenInputSchema,
    },
    {
      method: "post",
      path: "/api/v1/invitations/accept",
      response: contracts.workspaceSchema,
      input: contracts.tokenInputSchema,
    },
    {
      method: "post",
      path: "/api/v1/invitations/decline",
      response: contracts.okSchema,
      input: contracts.tokenInputSchema,
    },
  ];
  for (const endpoint of endpoints) {
    const params = Object.fromEntries(
      [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((match) => [match[1]!, contracts.idSchema]),
    );
    app.openAPIRegistry.registerPath({
      method: endpoint.method,
      path: endpoint.path,
      tags: ["Accounts & workspaces"],
      security: [{ cookieAuth: [] }],
      request: {
        ...(Object.keys(params).length ? { params: z.object(params) } : {}),
        ...(endpoint.input
          ? {
              body: { required: true, content: { "application/json": { schema: endpoint.input } } },
            }
          : {}),
      },
      responses: {
        [endpoint.status ?? 200]: json(endpoint.response),
        400: json(contracts.errorSchema),
        401: json(contracts.errorSchema),
        403: json(contracts.errorSchema),
        404: json(contracts.errorSchema),
      },
    });
  }
}
