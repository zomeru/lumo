import { driveListSchema, driveUrlSchema, type DriveListInput } from "@lumo/contracts/drive";
import { queryOptions } from "@tanstack/react-query";

import { api } from "../../lib/api";
import { getPlatform } from "../../platform";

export const drivePath = (workspaceId: string) => `/workspaces/${workspaceId}/drive`;
export const driveQuery = (workspaceId: string, input: Partial<DriveListInput> = {}) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "drive", input],
    queryFn: ({ signal }) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(input))
        if (value !== undefined) search.set(key, String(value));
      return api(`${drivePath(workspaceId)}?${search}`, driveListSchema, { signal });
    },
    refetchInterval: 15000,
    retry: false,
  });
export async function downloadDrive(workspaceId: string, ids: string[], folder = false) {
  const path = `${drivePath(workspaceId)}/${ids.length === 1 && !folder ? `${ids[0]}/download` : "archive"}`;
  const body = path.endsWith("archive") ? { ids } : {};
  const platform = getPlatform();
  if (platform?.download) {
    await platform.download(`/api/v1${path}`, body);
    return;
  }
  const result = await api(path, driveUrlSchema, { method: "POST", body });
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.rel = "noreferrer";
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const unit = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unit).toFixed(1)} ${["B", "KB", "MB", "GB"][unit]}`;
}
