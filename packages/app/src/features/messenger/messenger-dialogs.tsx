import type { Conversation } from "@lumo/contracts/collaboration";
import { conversationSchema } from "@lumo/contracts/collaboration";
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
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";

import { api, command, membersQuery, sessionQuery } from "../../lib/api";
import { messengerKey, messengerPath } from "./messenger-api";
import { MemberAvatar } from "./presence";

// These controlled dialogs mount without a DialogTrigger; restore the initiating control.
function useDialogReturnFocus() {
  const [trigger] = useState(() => document.activeElement);
  return (event: Event) => {
    if (trigger instanceof HTMLElement && trigger.isConnected) {
      event.preventDefault();
      trigger.focus();
    }
  };
}

function MemberPicker({
  workspaceId,
  selected,
  onChange,
}: {
  workspaceId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Selected participants">
          {selected.map((id) => (
            <Button
              key={id}
              size="sm"
              aria-label={`Remove ${names[id] ?? people.data?.members.find((p) => p.userId === id)?.name ?? "selected participant"}`}
              onClick={() => onChange(selected.filter((value) => value !== id))}
            >
              {names[id] ??
                people.data?.members.find((p) => p.userId === id)?.name ??
                "Selected teammate"}
              <X aria-hidden="true" />
            </Button>
          ))}
        </div>
      )}
      <fieldset className="max-h-48 overflow-y-auto rounded-md border p-3">
        <legend className="px-1 text-xs">Participants ({selected.length} selected)</legend>
        {people.data?.members
          .filter((p) => p.userId !== session.data?.user.id)
          .map((p) => (
            <label className="flex items-center gap-3 py-2 text-sm" key={p.userId}>
              <Checkbox
                aria-label={p.name}
                checked={selected.includes(p.userId)}
                disabled={!selected.includes(p.userId) && selected.length >= 49}
                onCheckedChange={(checked) => {
                  setNames((current) => ({ ...current, [p.userId]: p.name }));
                  onChange(
                    checked ? [...selected, p.userId] : selected.filter((id) => id !== p.userId),
                  );
                }}
              />
              <MemberAvatar userId={p.userId} name={p.name} src={p.image ?? undefined} size="sm" />
              {p.name}
            </label>
          ))}
      </fieldset>
      <ErrorMessage error={people.error} />
      <div className="flex gap-2">
        {offset > 0 && (
          <Button size="sm" onClick={() => setOffset(Math.max(0, offset - 50))}>
            Previous workspace members
          </Button>
        )}
        {people.data?.nextOffset != null && (
          <Button size="sm" onClick={() => setOffset(people.data!.nextOffset!)}>
            More workspace members
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
  const returnFocus = useDialogReturnFocus();
  const session = useQuery(sessionQuery());
  const [kind, setKind] = useState(initialMembers.length > 1 ? "group" : "direct");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
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
      <DialogContent onCloseAutoFocus={returnFocus}>
        <DialogTitle>{channel ? "Create channel" : "New conversation"}</DialogTitle>
        <DialogDescription>
          {channel
            ? "Everyone in the workspace automatically joins public channels. Private channels are visible only to their members."
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
                    memberIds: visibility === "private" ? selected : [],
                  }
                : {
                    name: form.get("name"),
                    kind,
                    memberIds: selected.filter((id) => id !== session.data?.user.id),
                  },
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
                value={visibility}
                onValueChange={(value) => setVisibility(value === "private" ? "private" : "public")}
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
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "direct", label: "Direct message" },
                { value: "group", label: "Group direct message" },
              ]}
            />
          )}
          {!channel || visibility === "private" ? (
            <MemberPicker workspaceId={workspaceId} selected={selected} onChange={setSelected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              All current and future workspace members are added automatically.
            </p>
          )}
          <ErrorMessage error={create.error} />
          <Button
            type="submit"
            variant="primary"
            disabled={
              create.isPending ||
              ((!channel || visibility === "private") && selected.length > 49) ||
              (!channel &&
                (kind === "direct"
                  ? selected.filter((id) => id !== session.data?.user.id).length !== 1
                  : selected.filter((id) => id !== session.data?.user.id).length < 2))
            }
          >
            {channel ? "Create channel" : "Create conversation"}
          </Button>
        </form>
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
  const returnFocus = useDialogReturnFocus();
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
      <DialogContent onCloseAutoFocus={returnFocus}>
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
        {item.kind === "channel" && item.visibility === "public" && (
          <p className="text-xs text-muted-foreground">
            Membership follows the workspace. Mute notifications to reduce updates.
          </p>
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
                  {item.visibility === "private" && (
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
                  )}
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
        {manager && item.visibility === "private" && !item.archivedAt && (
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
          {item.joined && !(item.kind === "channel" && item.visibility === "public") && (
            <Button
              disabled={leave.isPending || (item.role === "owner" && item.kind === "channel")}
              onClick={() => leave.mutate()}
            >
              Leave {item.kind === "channel" ? "channel" : "conversation"}
            </Button>
          )}
        </div>
        {item.role === "owner" && item.kind === "channel" && item.visibility === "private" && (
          <p className="text-xs">Transfer ownership before leaving this channel.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
