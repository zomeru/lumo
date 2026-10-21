import { hrNotificationsSchema } from "@lumo/contracts/hr";
import { Badge, Button, EmptyState, ErrorMessage } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";

import { hrQuery, useHrAction } from "./hr-api";
import { HrDialog } from "./hr-ui";
export function HrInbox({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false),
    action = useHrAction(workspaceId);
  const inbox = useQuery({
    ...hrQuery(workspaceId, "/notifications", hrNotificationsSchema),
    // Drive and Office invalidate the broad workspace key after each file action.
    // Inbox refresh is independent, while workspace/session changes still clear it.
    queryKey: ["hr-inbox", workspaceId],
    staleTime: 30000,
  });
  const unread = inbox.data?.notifications.filter((n) => !n.readAt).length ?? 0;
  return (
    <>
      <Button size="sm" variant="ghost" aria-label="HR notifications" onClick={() => setOpen(true)}>
        <Bell aria-hidden="true" />
        {unread > 0 && <Badge>{unread}</Badge>}
      </Button>
      <HrDialog title="HR notifications" open={open} onClose={() => setOpen(false)}>
        <ErrorMessage error={inbox.error ?? action.error} />
        {inbox.data?.notifications.length ? (
          inbox.data.notifications.map((n) => (
            <article key={n.id} className="grid gap-2 border-b pb-3">
              <strong className="text-sm">{n.title}</strong>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link
                    to={
                      n.module === "payroll"
                        ? "/w/$workspaceId/payroll"
                        : n.module === "onboarding"
                          ? "/w/$workspaceId/hr-onboarding"
                          : "/w/$workspaceId/approvals"
                    }
                    params={{ workspaceId }}
                    onClick={() => setOpen(false)}
                  >
                    Open {n.module}
                  </Link>
                </Button>
                {!n.readAt && (
                  <Button
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ path: `/notifications/${n.id}/read` })}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No HR notifications" />
        )}
      </HrDialog>
    </>
  );
}
