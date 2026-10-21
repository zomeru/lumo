import type { Member, Role } from "@lumo/contracts";
import {
  canChangeRole,
  canInvite,
  canInviteRole,
  canRemoveMember,
} from "@lumo/contracts/permissions";
import { formatDate } from "@lumo/shared/date-time";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  Select,
  SelectContent,
  SelectField,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@lumo/ui";
import { ConfirmAction } from "@lumo/ui/confirm-action";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  clearWorkspaceCache,
  command,
  createInvite,
  invitationsQuery,
  membersQuery,
  refreshWorkspaces,
  sessionQuery,
  workspaceQuery,
} from "../../lib/api";

function RoleEditor({
  member,
  actorRole,
  busy,
  onChange,
}: {
  member: Member;
  actorRole: Role;
  busy: boolean;
  onChange: (role: string) => void;
}) {
  const [selected, setSelected] = useState(member.role);
  return (
    <div className="flex items-end gap-2">
      <Select
        value={selected}
        onValueChange={(value) => setSelected(value as Role)}
        disabled={busy}
      >
        <SelectTrigger aria-label={`Role for ${member.name}`} size="sm" className="w-28 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={member.role}>{member.role}</SelectItem>
          {(["admin", "moderator", "member"] as const)
            .filter((role) => role !== member.role && canChangeRole(actorRole, member.role, role))
            .map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"

        disabled={busy || selected === member.role}
        onClick={() => onChange(selected)}
      >
        Save role
      </Button>
    </div>
  );
}

import { getPlatform } from "../../platform";

export function MembersPage({ workspaceId }: { workspaceId: string }) {
  const notify = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const ws = useQuery(workspaceQuery(workspaceId));
  const session = useQuery(sessionQuery());
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<Error | null>(null);
  const members = useQuery(membersQuery(workspaceId, q, offset));
  const invitations = useQuery({
    ...invitationsQuery(workspaceId),
    enabled: Boolean(ws.data && canInvite(ws.data.role)),
  });
  const action = useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body = {},
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => command(`/workspaces/${workspaceId}${path}`, method, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      await refreshWorkspaces(client);
    },
  });
  const invite = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      createInvite(workspaceId, email, role),
    onSuccess: async (value) => {
      setInviteLink(
        `${getPlatform()?.webOrigin ?? window.location.origin}/invite?token=${value.token}`,
      );
      setCopied(false);
      setCopyError(null);
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "invitations"] });
    },
  });
  const leave = useMutation({
    mutationFn: () => command(`/workspaces/${workspaceId}/leave`),
    onSuccess: async () => {
      await clearWorkspaceCache(client);
      await refreshWorkspaces(client);
      await navigate({ to: "/workspaces" });
    },
  });
  if (!ws.data || !session.data) return <Loading />;
  const role = ws.data.role;
  return (
    <>
      <PageHeading eyebrow="Better together" title="Members">
        Manage the people who belong to {ws.data.name}.
      </PageHeading>
      {canInvite(role) && (
        <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
          <section>
            <h2>Invite your team</h2>
            <p>
              Create a link for a specific email address. Your colleague must verify that email to
              accept it. Links expire in seven days.
            </p>
            <form
              className="grid items-end gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                invite.mutate({
                  email: values.get("email") as string,
                  role: values.get("role") as string,
                });
              }}
            >
              <Field label="Colleague’s email" name="email" type="email" required maxLength={254} />
              <SelectField
                label="Invitation role"
                name="role"
                options={[
                  { value: "member", label: "Member" },
                  ...(canInviteRole(role, "moderator")
                    ? [{ value: "moderator", label: "Moderator" }]
                    : []),
                ]}
              />
              <Button variant="primary" type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Creating…" : "Create invitation"}
              </Button>
            </form>
            <ErrorMessage error={invite.error} />
            {inviteLink && (
              <div className="mt-5 grid gap-3 border-t pt-5">
                <Field
                  label="Invitation link"
                  value={inviteLink}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  hint="Share this link with the invited colleague. It is only shown after creation."
                />
                <Button
                  onClick={() => {
                    void Promise.resolve()
                      .then(() => navigator.clipboard.writeText(inviteLink))
                      .then(
                        () => {
                          setCopied(true);
                          notify({
                            title: "Invitation link copied",
                            description: "Share it with the invited colleague.",
                          });
                        },
                        () => setCopyError(new Error("Select and copy the invitation link above.")),
                      );
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <ErrorMessage error={copyError} />
              </div>
            )}
          </section>
        </Card>
      )}
      <section>
        <div className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2>Workspace members</h2>
          <Badge>{role}</Badge>
        </div>
        <Field
          label="Search members"
          type="search"
          className="mb-5 max-w-md"
          value={q}
          maxLength={100}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <ErrorMessage error={members.error ?? action.error} />
        {action.isSuccess && (
          <output className="my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
            Workspace membership updated.
          </output>
        )}
        {members.isPending ? (
          <Loading label="Loading members…" />
        ) : members.isError ? null : members.data?.members.length ? (
          <div className="mt-4 divide-y overflow-hidden rounded-lg border bg-surface">
            {members.data.members.map((member) => (
              <article
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                key={member.userId}
              >
                <Avatar name={member.name} />
                <div className="min-w-28 flex-1 wrap-anywhere text-sm">
                  <strong>
                    {member.name}
                    {member.userId === session.data!.user.id ? " (you)" : ""}
                  </strong>
                  <small>{member.jobTitle || "Workspace member"}</small>
                </div>
                <Badge>{member.role}</Badge>
                {member.userId !== session.data!.user.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    {(["admin", "moderator", "member"] as const).some((next) =>
                      canChangeRole(role, member.role, next),
                    ) && (
                      <RoleEditor
                        key={member.role}
                        member={member}
                        actorRole={role}
                        busy={action.isPending}
                        onChange={(next) =>
                          action.mutate({
                            path: `/members/${member.userId}`,
                            method: "PATCH",
                            body: { role: next },
                          })
                        }
                      />
                    )}
                    {canRemoveMember(role, member.role) && (
                      <ConfirmAction
                        label="Remove member"
                        message={`Remove ${member.name}? They will lose workspace access immediately.`}
                        disabled={action.isPending}
                        onConfirm={() =>
                          action.mutate({ path: `/members/${member.userId}`, method: "DELETE" })
                        }
                      />
                    )}
                    {role === "owner" && !ws.data!.isPersonal && (
                      <ConfirmAction
                        label="Transfer ownership"
                        message={`Make ${member.name} the owner? You will become an admin.`}
                        disabled={action.isPending}
                        onConfirm={() =>
                          action.mutate({
                            path: "/transfer-ownership",
                            body: { userId: member.userId },
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-surface px-5 py-10 text-center text-muted-foreground">
            No members match your search.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {offset > 0 && (
            <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
          )}
          {members.data?.nextOffset != null && (
            <Button onClick={() => setOffset(members.data!.nextOffset!)}>Next</Button>
          )}
        </div>
      </section>
      {canInvite(role) && (
        <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
          <section>
            <h2>Pending invitations</h2>
            <ErrorMessage error={invitations.error} />
            {invitations.isPending ? (
              <Loading label="Loading invitations…" />
            ) : invitations.data?.invitations.length ? (
              invitations.data.invitations.map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-0"
                  key={item.id}
                >
                  <div>
                    <strong>{item.email}</strong>
                    <small>
                      {item.role} · expires {formatDate(item.expiresAt)}
                    </small>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"

                    disabled={action.isPending || !canInviteRole(role, item.role)}
                    onClick={() => {
                      setInviteLink("");
                      action.mutate({ path: `/invitations/${item.id}`, method: "DELETE" });
                    }}
                  >
                    Revoke invitation
                  </Button>
                </div>
              ))
            ) : (
              <p>No pending invitations.</p>
            )}
          </section>
        </Card>
      )}
      {role !== "owner" && (
        <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
          <section>
            <h2>Leave workspace</h2>
            <p>
              You will lose access to this workspace. You can return with a new invitation
              {ws.data.visibility === "public" ? " or by joining again" : ""}.
            </p>
            <ErrorMessage error={leave.error} />
            <ConfirmAction
              label="Leave workspace"
              message="You will no longer have access to this workspace’s data."
              disabled={leave.isPending}
              onConfirm={() => leave.mutate()}
            />
          </section>
        </Card>
      )}
    </>
  );
}
