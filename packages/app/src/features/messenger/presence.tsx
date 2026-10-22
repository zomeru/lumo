import {
  presencePreferenceSchema,
  presenceResultSchema,
  type PresenceStatus,
} from "@lumo/contracts/presence";
import { Button, ErrorMessage, cn } from "@lumo/ui";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { AppAvatar } from "../../components/app-avatar";
import { api } from "../../lib/api";

const Registry = createContext<((id: string) => () => void) | null>(null);
const Statuses = createContext<Record<string, PresenceStatus>>({});
export function PresenceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const register = useCallback((id: string) => {
    setCounts((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    return () =>
      setCounts((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) - 1) }));
  }, []);
  const ids = Object.keys(counts)
    .filter((id) => counts[id]! > 0)
    .sort();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
  const results = useQueries({
    queries: batches.map((userIds) => ({
      queryKey: ["workspace", workspaceId, "presence", userIds],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api(`/workspaces/${workspaceId}/presence`, presenceResultSchema, {
          method: "POST",
          body: { userIds },
          signal,
        }),
      staleTime: 15000,
      refetchInterval: 20000,
      retry: false,
    })),
  });
  const statuses: Record<string, PresenceStatus> = {};
  for (const result of results)
    if (result.data && !result.isError && now - result.dataUpdatedAt < 45000)
      for (const member of result.data.members) statuses[member.userId] = member.status;
  return (
    <Registry value={register}>
      <Statuses value={statuses}>{children}</Statuses>
    </Registry>
  );
}
export function usePresence(userId: string) {
  const register = useContext(Registry);
  useEffect(() => register?.(userId), [register, userId]);
  return useContext(Statuses)[userId];
}
const labels = { online: "Online", dnd: "Do Not Disturb", offline: "Offline" };
export function MemberAvatar({
  userId,
  ...props
}: ComponentProps<typeof AppAvatar> & { userId: string }) {
  const status = usePresence(userId);
  return (
    <span
      className="relative inline-flex shrink-0"
      title={status ? labels[status] : "Availability unavailable"}
    >
      <AppAvatar {...props} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface",
          status === "online"
            ? "bg-success"
            : status === "dnd"
              ? "bg-destructive"
              : "bg-muted-foreground",
        )}
      >
        {status === "dnd" && <span className="absolute inset-x-0.5 top-1/2 h-px bg-surface" />}
      </span>
      <span className="sr-only">{status ? labels[status] : "Availability unavailable"}</span>
    </span>
  );
}
export function PresencePreference() {
  const client = useQueryClient();
  const preference = useQuery({
    queryKey: ["presence-preference"],
    queryFn: ({ signal }) => api("/me/presence", presencePreferenceSchema, { signal }),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (dnd: boolean) =>
      api("/me/presence", presencePreferenceSchema, { method: "PUT", body: { dnd } }),
    onSuccess: async (data) => {
      client.setQueryData(["presence-preference"], data);
      await client.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "workspace" && query.queryKey[2] === "presence",
      });
    },
  });
  return (
    <div className="border-t px-3 py-2">
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-start"
        aria-pressed={preference.data?.dnd ?? false}
        disabled={!preference.data || save.isPending}
        onClick={() => save.mutate(!preference.data!.dnd)}
      >
        {preference.data?.dnd ? "Do Not Disturb · Change" : "Set Do Not Disturb"}
      </Button>
      <ErrorMessage error={preference.error ?? save.error} />
      {preference.isError && (
        <Button
          size="sm"
          variant="ghost"
          disabled={preference.isFetching}
          onClick={() => void preference.refetch()}
        >
          Retry availability preference
        </Button>
      )}
    </div>
  );
}
