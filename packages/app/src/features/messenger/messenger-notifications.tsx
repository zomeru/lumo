import { messengerNotificationsSchema } from "@lumolynk/contracts/messenger";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  ErrorMessage,
} from "@lumolynk/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { api } from "../../lib/api";
import { connectMessenger, messengerKey } from "./messenger-api";
import { PresenceProvider } from "./presence";

const RealtimeContext = createContext<{
  status: string;
  typing: { id: string; until: number } | null;
  sendTyping: (id: string) => void;
}>({ status: "Connecting…", typing: null, sendTyping: () => {} });
export function MessengerRealtimeProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const client = useQueryClient(),
    [status, setStatus] = useState("Connecting…"),
    [typing, setTyping] = useState<{ id: string; until: number } | null>(null),
    connection = useRef<ReturnType<typeof connectMessenger> | null>(null);
  useEffect(() => {
    const current = connectMessenger(workspaceId, client, setStatus, (id) =>
      setTyping({ id, until: Date.now() + 4000 }),
    );
    connection.current = current;
    return () => {
      current.close();
      connection.current = null;
    };
  }, [workspaceId, client]);
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(null), Math.max(0, typing.until - Date.now()));
    return () => clearTimeout(timer);
  }, [typing]);
  return (
    <RealtimeContext value={{ status, typing, sendTyping: (id) => connection.current?.typing(id) }}>
      <PresenceProvider key={workspaceId} workspaceId={workspaceId}>
        {children}
      </PresenceProvider>
    </RealtimeContext>
  );
}
export const useMessengerRealtime = () => useContext(RealtimeContext);
export function MessengerInbox({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false),
    [offset, setOffset] = useState(0);
  const conversations = useQuery({
    queryKey: [...messengerKey(workspaceId), "notifications", offset],
    queryFn: ({ signal }) =>
      api(
        `/workspaces/${workspaceId}/messenger/notifications?offset=${offset}`,
        messengerNotificationsSchema,
        { signal },
      ),
    refetchInterval: 30000,
  });
  const unread = conversations.data?.conversations ?? [],
    count = conversations.data?.totalUnread ?? 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            count ? `Messenger notifications, ${count} unread messages` : "Messenger notifications"
          }
          className="relative"
        >
          <MessageSquare aria-hidden="true" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 px-1 text-[9px]">
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Messenger notifications</DialogTitle>
        <DialogDescription>
          Unread conversations in this workspace. Manage notification preferences in conversation
          settings.
        </DialogDescription>
        <ErrorMessage error={conversations.error} />
        <ul className="grid max-h-80 gap-2 overflow-y-auto">
          {unread.map((item) => (
            <li key={item.id}>
              <Link
                onClick={() => setOpen(false)}
                to="/w/$workspaceId/messenger/$conversationId"
                params={{ workspaceId, conversationId: item.id }}
                hash=""
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <Badge>{item.unread} unread</Badge>
                {item.mentions > 0 && <span className="text-xs">{item.mentions} mentions</span>}
              </Link>
            </li>
          ))}
        </ul>
        {!unread.length && !conversations.isError && !conversations.isPending && (
          <p>You’re all caught up.</p>
        )}
        {conversations.data?.nextOffset != null && (
          <Button onClick={() => setOffset(conversations.data!.nextOffset!)}>
            More notifications
          </Button>
        )}
        {offset > 0 && (
          <Button onClick={() => setOffset(Math.max(0, offset - 50))}>
            Previous notifications
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
