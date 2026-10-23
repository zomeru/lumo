import { driveUrlSchema } from "@lumolynk/contracts/drive";
import {
  officeDetailSchema,
  officeVersionsSchema,
  wikiTreeSchema,
} from "@lumolynk/contracts/office";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api";
import { getPlatform } from "../../platform";
export const officePath = (workspaceId: string, id?: string) =>
  `/workspaces/${workspaceId}/documents${id ? `/${id}` : ""}`;
export const wikiPath = (workspaceId: string) => `/workspaces/${workspaceId}/wiki/pages`;
export const officeQuery = (workspaceId: string, id: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "office", id],
    queryFn: ({ signal }) => api(officePath(workspaceId, id), officeDetailSchema, { signal }),
    refetchInterval: 5000,
    retry: false,
  });
export const versionsQuery = (workspaceId: string, id: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "office", id, "versions"],
    queryFn: ({ signal }) =>
      api(`${officePath(workspaceId, id)}/versions`, officeVersionsSchema, { signal }),
    refetchInterval: 5000,
    retry: false,
  });
export const wikiQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "wiki"],
    queryFn: ({ signal }) => api(wikiPath(workspaceId), wikiTreeSchema, { signal }),
    refetchInterval: 5000,
    retry: false,
  });
export async function downloadVersion(workspaceId: string, id: string, versionId: string) {
  const path = `${officePath(workspaceId, id)}/versions/${versionId}/download`;
  const platform = getPlatform();
  if (platform?.download) return platform.download(`/api/v1${path}`, {});
  const result = await api(path, driveUrlSchema, { method: "POST", body: {} });
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.rel = "noreferrer";
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
