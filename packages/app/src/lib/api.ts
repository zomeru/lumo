import {
  auditSchema,
  discoverySchema,
  invitationCreatedSchema,
  invitationPreviewSchema,
  invitationsSchema,
  membersSchema,
  meSchema,
  okSchema,
  workspaceSchema,
  workspacesSchema,
} from "@lumo/contracts";
import { readWebEnv } from "@lumo/env/web";
import { queryOptions, type QueryClient } from "@tanstack/react-query";

const { VITE_API_URL } = readWebEnv(import.meta.env);
export { ApiError } from "@lumo/api-client";
import { createApi, fetchTransport } from "@lumo/api-client";

import { getPlatform } from "../platform";
const browserTransport = fetchTransport(VITE_API_URL);
export const api = createApi((path, options) =>
  (getPlatform()?.transport ?? browserTransport)(path, options),
);

export const sessionQuery = () =>
  queryOptions({
    queryKey: ["session"],
    queryFn: ({ signal }) => api("/me", meSchema, { signal }),
    staleTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
export const workspacesQuery = () =>
  queryOptions({
    queryKey: ["workspaces"],
    queryFn: ({ signal }) => api("/workspaces", workspacesSchema, { signal }),
    staleTime: 0,
  });
export const workspaceQuery = (id: string) =>
  queryOptions({
    queryKey: ["workspace", id],
    queryFn: ({ signal }) => api(`/workspaces/${id}`, workspaceSchema, { signal }),
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
export const membersQuery = (id: string, q = "", offset = 0) =>
  queryOptions({
    queryKey: ["workspace", id, "members", q, offset],
    queryFn: ({ signal }) =>
      api(`/workspaces/${id}/members?q=${encodeURIComponent(q)}&offset=${offset}`, membersSchema, {
        signal,
      }),
    staleTime: 0,
  });
export const invitationsQuery = (id: string) =>
  queryOptions({
    queryKey: ["workspace", id, "invitations"],
    queryFn: ({ signal }) => api(`/workspaces/${id}/invitations`, invitationsSchema, { signal }),
  });
export const activityQuery = (id: string) =>
  queryOptions({
    queryKey: ["workspace", id, "activity"],
    queryFn: ({ signal }) => api(`/workspaces/${id}/activity`, auditSchema, { signal }),
  });
export const discoveryQuery = (q: string, offset: number) =>
  queryOptions({
    queryKey: ["discovery", q, offset],
    queryFn: ({ signal }) =>
      api(`/workspaces/discover?q=${encodeURIComponent(q)}&offset=${offset}`, discoverySchema, {
        signal,
      }),
  });
export const invitePreviewQuery = (token: string) =>
  queryOptions({
    queryKey: ["invitation", token],
    queryFn: ({ signal }) =>
      api("/invitations/preview", invitationPreviewSchema, {
        method: "POST",
        body: { token },
        signal,
      }),
    retry: false,
  });
export const createInvite = (id: string, email: string, role: string) =>
  api(`/workspaces/${id}/invitations`, invitationCreatedSchema, {
    method: "POST",
    body: { email, role },
  });
export const command = (path: string, method = "POST", body: unknown = {}) =>
  api(path, okSchema, { method, body });

export async function clearWorkspaceCache(client: QueryClient) {
  await Promise.all([
    client.cancelQueries({ queryKey: ["workspace"] }),
    client.cancelQueries({ queryKey: ["meeting"] }),
    client.cancelQueries({ queryKey: ["hr-inbox"] }),
  ]);
  client.removeQueries({ queryKey: ["workspace"] });
  client.removeQueries({ queryKey: ["meeting"] });
  client.removeQueries({ queryKey: ["hr-inbox"] });
}

export async function refreshWorkspaces(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["workspaces"] }),
    client.invalidateQueries({ queryKey: ["session"] }),
  ]);
}
