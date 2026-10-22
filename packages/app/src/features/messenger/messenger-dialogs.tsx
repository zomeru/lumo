import type { Conversation } from "@lumo/contracts/collaboration";
import { conversationSchema, conversationsSchema } from "@lumo/contracts/collaboration";
import { messengerMembersSchema } from "@lumo/contracts/messenger";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  SelectField,
  Checkbox,
  ErrorMessage,
  Badge,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { api, command, membersQuery, sessionQuery } from "../../lib/api";
import { messengerKey, messengerPath } from "./messenger-api";

function MemberPicker({
  workspaceId,
  selected,
  onChange,
}: {
  workspaceId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    people = useQuery(membersQuery(workspaceId, q, offset)),
    session = useQuery(sessionQuery());
  return (
    <div className="grid gap-3">
      <Field
        label="Find members"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOffset(0);
        }}
        maxLength={100}
      />
      <fieldset className="max-h-48 overflow-y-auto rounded-md border p-3">
        <legend className="px-1 text-xs">Participants ({selected.length} selected)</legend>
        {people.data?.members
          .filter((p) => p.userId !== session.data?.user.id)
          .map((p) => (
            <label className="flex items-center gap-3 py-2 text-sm" key={p.userId}>
              <Checkbox
                checked={selected.includes(p.userId)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked ? [...selected, p.userId] : selected.filter((id) => id !== p.userId),
                  )
                }
              />
              {p.name}
            </label>
          ))}
      </fieldset>
      <ErrorMessage error={people.error} />
      <div className="flex gap-2">
        {offset > 0 && (
          <Button size="sm" onClick={() => setOffset(Math.max(0, offset - 50))}>
            Previous members
          </Button>
        )}
        {people.data?.nextOffset != null && (
          <Button size="sm" onClick={() => setOffset(people.data!.nextOffset!)}>
            More members
          </Button>
        )}
      </div>
    </div>
  );
}
export function CreateConversationDialog({
  workspaceId,
  channel,
  onClose,
  initialMembers = [],
}: {
  workspaceId: string;
  channel: boolean;
  onClose: () => void;
  initialMembers?: string[];
}) {
  const [selected, setSelected] = useState(initialMembers),
    client = useQueryClient(),
    navigate = useNavigate();
  const create = useMutation({
    mutationFn: (body: unknown) =>
      api(
        channel ? `/workspaces/${workspaceId}/channels` : messengerPath(workspaceId),
        conversationSchema,
        { method: "POST", body },
      ),
    onSuccess: async (item) => {
      await client.invalidateQueries({ queryKey: messengerKey(workspaceId) });
      onClose();
      await navigate({
        to: "/w/$workspaceId/messenger/$conversationId",
        params: { workspaceId, conversationId: item.id },
        hash: "",
      });
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{channel ? "Create channel" : "New conversation"}</DialogTitle>
        <DialogDescription>
          {channel
            ? "Public channels can be read by workspace members. Private channels are visible to their members."
            : "Choose workspace members. Changing a group’s participants starts a new conversation with fresh history."}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            create.mutate(
              channel
                ? {
                    name: form.get("name"),
                    description: form.get("description"),
                    visibility: form.get("visibility"),
                    memberIds: selected,
                  }
                : { name: form.get("name"), kind: form.get("kind"), memberIds: selected },
            );
          }}
        >
          <Field
            label={channel ? "Channel name" : "Conversation name"}
            name="name"
            required
            maxLength={channel ? 80 : 100}
          />
          {channel ? (
            <>
              <Field label="Description" name="description" maxLength={1000} />
              <SelectField
                label="Visibility"
                name="visibility"
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
              />
            </>
          ) : (
            <SelectField
              label="Type"
              name="kind"
              defaultValue={initialMembers.length > 1 ? "group" : "direct"}
              options={[
                { value: "direct", label: "Direct message" },
                { value: "group", label: "Group direct message" },
              ]}
            />
          )}
          <MemberPicker workspaceId={workspaceId} selected={selected} onChange={setSelected} />
          <ErrorMessage error={create.error} />
          <Button
            type="submit"
            variant="primary"
            disabled={create.isPending || selected.length > 49}
          >
            {channel ? "Create channel" : "Create conversation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ChannelBrowser({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    client = useQueryClient();
  const channels = useQuery({
    queryKey: [...messengerKey(workspaceId), "browse", q, offset],
    queryFn: ({ signal }) =>
      api(
        `/workspaces/${workspaceId}/channels?q=${encodeURIComponent(q)}&offset=${offset}`,
        conversationsSchema,
        { signal },
      ),
  });
  const join = useMutation({
    mutationFn: (id: string) => command(`${messengerPath(workspaceId, id)}/join`),
    onSuccess: () => client.invalidateQueries({ queryKey: messengerKey(workspaceId) }),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>Browse channels</DialogTitle>
        <DialogDescription>
          Explore channels in this workspace. Join a public channel to send messages.
        </DialogDescription>
        <Field
          label="Find channels"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <ErrorMessage error={channels.error ?? join.error} />
        <ul className="grid max-h-[50vh] gap-3 overflow-y-auto">
          {channels.data?.conversations.map((item) => (
            <li className="flex items-center gap-3 rounded-md border p-3" key={item.id}>
              <div className="min-w-0 flex-1">
                <Link
                  onClick={onClose}
                  to="/w/$workspaceId/messenger/$conversationId"
                  params={{ workspaceId, conversationId: item.id }}
                  hash=""
                  className="font-medium text-primary"
                >
                  {item.visibility === "private" ? "🔒" : "#"} {item.name}
                </Link>
                <p className="truncate text-xs">{item.description}</p>
                {item.archivedAt && <Badge>Archived</Badge>}
              </div>
              {item.joined ? (
                <Badge>Joined</Badge>
              ) : (
                <Button
                  size="sm"
                  disabled={join.isPending || Boolean(item.archivedAt)}
                  onClick={() => join.mutate(item.id)}
                >
                  Join
                </Button>
              )}
            </li>
          ))}
        </ul>
        {channels.data?.conversations.length === 0 && <p>No matching channels.</p>}
        <div className="flex gap-2">
          {offset > 0 && (
            <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous channels</Button>
          )}
          {channels.data?.nextOffset != null && (
            <Button onClick={() => setOffset(channels.data!.nextOffset!)}>More channels</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function ConversationSettings({
  workspaceId,
  item,
  onClose,
  onNewGroup,
}: {
  workspaceId: string;
  item: Conversation;
  onClose: () => void;
  onNewGroup: (ids: string[]) => void;
}) {
  const client = useQueryClient(),
    navigate = useNavigate(),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string[]>([]);
  const members = useQuery({
    queryKey: [...messengerKey(workspaceId), "members", item.id, offset],
    queryFn: ({ signal }) =>
      api(
        `${messengerPath(workspaceId, item.id)}/members?offset=${offset}`,
        messengerMembersSchema,
        { signal },
      ),
  });
  const manager = item.kind === "channel" && ["owner", "manager"].includes(item.role ?? "");
  const action = useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body = {},
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => command(path, method, body),
    onSuccess: () => client.invalidateQueries({ queryKey: messengerKey(workspaceId) }),
  });
  const update = useMutation({
    mutationFn: (body: unknown) =>
      api(`/workspaces/${workspaceId}/channels/${item.id}`, conversationSchema, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: messengerKey(workspaceId) }),
  });
  const leave = useMutation({
    mutationFn: () => command(`${messengerPath(workspaceId, item.id)}/leave`),
    onSuccess: async () => {
      onClose();
      await client.invalidateQueries({ queryKey: messengerKey(workspaceId) });
      await navigate({ to: "/w/$workspaceId/messenger", params: { workspaceId } });
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{item.name} settings</DialogTitle>
        <DialogDescription>
          {item.kind === "channel"
            ? `${item.visibility} channel · ${item.memberCount} members`
            : "Only participants can access this conversation."}
        </DialogDescription>
        <ErrorMessage error={action.error ?? update.error ?? leave.error ?? members.error} />
        {manager && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              update.mutate({ name: form.get("name"), description: form.get("description") });
            }}
          >
            <Field
              label="Channel name"
              name="name"
              defaultValue={item.name}
              required
              maxLength={80}
            />
            <Field
              label="Description"
              name="description"
              defaultValue={item.description}
              maxLength={1000}
            />
            <Button type="submit" disabled={update.isPending}>
              Save channel
            </Button>
          </form>
        )}
        {item.joined && (
          <SelectField
            label="Notifications"
            value={item.notifications}
            onValueChange={(notifications) =>
              action.mutate({
                path: `${messengerPath(workspaceId, item.id)}/preferences`,
                body: { notifications },
              })
            }
            options={[
              { value: "all", label: "All messages" },
              { value: "mentions", label: "Mentions only" },
              { value: "muted", label: "Muted" },
            ]}
          />
        )}
        <h3 className="font-medium">Members</h3>
        <ul className="max-h-44 overflow-y-auto">
          {members.data?.members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-2 border-b py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {member.name} <Badge>{member.role}</Badge>
              </span>
              {manager && member.role !== "owner" && (
                <>
                  <Button
                    size="sm"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/workspaces/${workspaceId}/channels/${item.id}/members/${member.userId}`,
                        method: "DELETE",
                      })
                    }
                  >
                    Remove {member.name}
                  </Button>
                  {item.role === "owner" && (
                    <>
                      <Button
                        size="sm"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            path: `/workspaces/${workspaceId}/channels/${item.id}/members`,
                            body: {
                              userId: member.userId,
                              role: member.role === "manager" ? "member" : "manager",
                            },
                          })
                        }
                      >
                        {member.role === "manager" ? "Make member" : "Make manager"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            path: `/workspaces/${workspaceId}/channels/${item.id}/members`,
                            body: { userId: member.userId, role: "owner" },
                          })
                        }
                      >
                        Transfer ownership to {member.name}
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          {offset > 0 && (
            <Button size="sm" onClick={() => setOffset(Math.max(0, offset - 50))}>
              Previous members
            </Button>
          )}
          {members.data?.nextOffset != null && (
            <Button size="sm" onClick={() => setOffset(members.data!.nextOffset!)}>
              More members
            </Button>
          )}
        </div>
        {manager && !item.archivedAt && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Add workspace members</summary>
            <MemberPicker workspaceId={workspaceId} selected={selected} onChange={setSelected} />
            <Button
              disabled={action.isPending || !selected.length}
              onClick={() => {
                void (async () => {
                  for (const userId of selected)
                    await action.mutateAsync({
                      path: `/workspaces/${workspaceId}/channels/${item.id}/members`,
                      body: { userId },
                    });
                  setSelected([]);
                })().catch(() => {});
              }}
            >
              Add selected members
            </Button>
          </details>
        )}
        {item.kind === "group" && (
          <Button onClick={() => onNewGroup(item.memberIds)}>
            Start a group with different participants
          </Button>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {manager && (
            <Button
              disabled={update.isPending}
              onClick={() => update.mutate({ archived: !item.archivedAt })}
            >
              {item.archivedAt ? "Unarchive channel" : "Archive channel"}
            </Button>
          )}
          {item.joined && (
            <Button
              disabled={leave.isPending || (item.role === "owner" && item.kind === "channel")}
              onClick={() => leave.mutate()}
            >
              Leave {item.kind === "channel" ? "channel" : "conversation"}
            </Button>
          )}
        </div>
        {item.role === "owner" && item.kind === "channel" && (
          <p className="text-xs">Transfer ownership before leaving this channel.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
