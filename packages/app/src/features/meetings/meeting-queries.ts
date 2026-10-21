import { calendarMeetingsSchema, calendarMeetingDetailSchema } from "@lumo/contracts/collaboration";
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { api } from "../../lib/api";

export const calendarQuery = (workspaceId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "calendar", from, to],
    queryFn: async ({ signal }) => {
      const meetings: ReturnType<typeof calendarMeetingsSchema.parse>["meetings"] = [];
      let offset: number | null = 0;
      do {
        const page: ReturnType<typeof calendarMeetingsSchema.parse> = await api(
          `/workspaces/${workspaceId}/meetings/calendar?${new URLSearchParams({ from, to, offset: String(offset), limit: "200" })}`,
          calendarMeetingsSchema,
          { signal },
        );
        meetings.push(...page.meetings);
        offset = page.nextOffset;
      } while (offset !== null);
      return meetings;
    },
    retry: false,
    staleTime: 0,
    refetchInterval: 15000,
  });
export const calendarDetailQuery = (workspaceId: string, meetingId: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId, "calendar-detail", meetingId],
    queryFn: ({ signal }) =>
      api(`/workspaces/${workspaceId}/meetings/${meetingId}`, calendarMeetingDetailSchema, {
        signal,
      }),
    retry: false,
    refetchInterval: 15000,
  });
export async function refreshMeetings(
  client: QueryClient,
  workspaceId: string,
  meetingId?: string,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["workspace", workspaceId, "meetings"] }),
    client.invalidateQueries({ queryKey: ["workspace", workspaceId, "calendar"] }),
    client.invalidateQueries({ queryKey: ["workspace", workspaceId, "calendar-detail"] }),
    client.invalidateQueries({ queryKey: ["workspace", workspaceId, "availability"] }),
    client.invalidateQueries({ queryKey: meetingId ? ["meeting", meetingId] : ["meeting"] }),
  ]);
}
