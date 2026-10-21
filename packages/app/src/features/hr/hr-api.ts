import { hrAccessSchema, peopleSchema, departmentsSchema } from "@lumo/contracts/hr";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { api, command } from "../../lib/api";

export const hrPath = (workspaceId: string) => `/workspaces/${workspaceId}/hr`;
export const hrQuery = <S extends z.ZodType>(workspaceId: string, path: string, schema: S) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "hr", path],
    queryFn: ({ signal }) => api(`${hrPath(workspaceId)}${path}`, schema, { signal }),
    retry: false,
    staleTime: 0,
    refetchInterval: 30000,
  });
export const hrAccessQuery = (id: string) => hrQuery(id, "/access", hrAccessSchema);
export const peopleQuery = (id: string, q = "", offset = 0) =>
  hrQuery(id, `/people?q=${encodeURIComponent(q)}&offset=${offset}`, peopleSchema);
export const departmentsQuery = (id: string) => hrQuery(id, "/departments", departmentsSchema);
export function useHrAction(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      body = {},
      method = "POST",
    }: {
      path: string;
      body?: unknown;
      method?: string;
    }) => command(`${hrPath(workspaceId)}${path}`, method, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workspace", workspaceId, "hr"] }),
  });
}
