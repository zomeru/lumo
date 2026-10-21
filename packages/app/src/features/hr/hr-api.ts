import { hrAccessSchema, peopleSchema, departmentsSchema, hrUrlSchema } from "@lumo/contracts/hr";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { api, command } from "../../lib/api";
import { getPlatform } from "../../platform";

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

export async function downloadHrFile(workspaceId: string, id: string) {
  const path = `${hrPath(workspaceId)}/files/${id}/download`;
  const platform = getPlatform();
  if (platform?.download) {
    await platform.download(`/api/v1${path}`, {});
    return;
  }
  const result = await api(path, hrUrlSchema, { method: "POST", body: {} });
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.download = "";
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export const allPeopleQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "hr", "people-options"],
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const people = [];
      let offset = 0;
      for (;;) {
        const page = await api(
          `${hrPath(workspaceId)}/people?limit=100&offset=${offset}`,
          peopleSchema,
          { signal },
        );
        people.push(...page.people);
        if (page.nextOffset === null) return { people, nextOffset: null };
        if (page.nextOffset <= offset) throw new Error("Invalid directory pagination");
        offset = page.nextOffset;
      }
    },
  });
