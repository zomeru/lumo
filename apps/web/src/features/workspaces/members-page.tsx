import type { Member, Role } from "@lumo/contracts";
import {
  canChangeRole,
  canInvite,
  canInviteRole,
  canRemoveMember,
} from "@lumo/contracts/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { Avatar, ErrorMessage, Field, Loading, PageHeading, SelectField } from "@/components/ui";
import {
  clearWorkspaceCache,
  command,
  createInvite,
  invitationsQuery,
  membersQuery,
  refreshWorkspaces,
  sessionQuery,
  workspaceQuery,
} from "@/lib/api";

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
    <div className="role-editor">
      <select
        aria-label={`Role for ${member.name}`}
        value={selected}
        onChange={(e) => setSelected(e.target.value as Role)}
        disabled={busy}
      >
        <option value={member.role}>{member.role}</option>
        {(["admin", "moderator", "member"] as const)
          .filter((role) => role !== member.role && canChangeRole(actorRole, member.role, role))
          .map((role) => (
            <option key={role}>{role}</option>
          ))}
      </select>
      <button
        className="compact"
        disabled={busy || selected === member.role}
        onClick={() => onChange(selected)}
      >
        Save role
      </button>
    </div>
  );
}

export function MembersPage({ workspaceId }: { workspaceId: string }) {
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
      setInviteLink(`${window.location.origin}/invite?token=${value.token}`);
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
        <section className="card">
          <h2>Invite your team</h2>
          <p>
            Create a link for a specific email address. Your colleague must verify that email to
            accept it. Links expire in seven days.
          </p>
          <form
            className="invite-form"
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
            <SelectField label="Invitation role" name="role">
              <option value="member">Member</option>
              {canInviteRole(role, "moderator") && <option value="moderator">Moderator</option>}
            </SelectField>
            <button className="primary" disabled={invite.isPending}>
              {invite.isPending ? "Creating…" : "Create invitation"}
            </button>
          </form>
          <ErrorMessage error={invite.error} />
          {inviteLink && (
            <div className="invite-result">
              <Field
                label="Invitation link"
                value={inviteLink}
                readOnly
                onFocus={(e) => e.target.select()}
                hint="Share this link with the invited colleague. It is only shown after creation."
              />
              <button
                onClick={() => {
                  void Promise.resolve()
                    .then(() => navigator.clipboard.writeText(inviteLink))
                    .then(
                      () => setCopied(true),
                      () => setCopyError(new Error("Select and copy the invitation link above.")),
                    );
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <ErrorMessage error={copyError} />
            </div>
          )}
        </section>
      )}
      <section>
        <div className="section-heading">
          <h2>Workspace members</h2>
          <span className="badge">{role}</span>
        </div>
        <Field
          label="Search members"
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <ErrorMessage error={members.error ?? action.error} />
        {action.isSuccess && <output className="notice">Workspace membership updated.</output>}
        {members.isPending ? (
          <Loading label="Loading members…" />
        ) : members.isError ? null : members.data?.members.length ? (
          <div className="member-list">
            {members.data.members.map((member) => (
              <article className="member-row" key={member.userId}>
                <Avatar name={member.name} />
                <div className="member-name">
                  <strong>
                    {member.name}
                    {member.userId === session.data!.user.id ? " (you)" : ""}
                  </strong>
                  <small>{member.jobTitle || "Workspace member"}</small>
                </div>
                <span className="badge">{member.role}</span>
                {member.userId !== session.data!.user.id && (
                  <div className="member-actions">
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
          <p className="empty">No members match your search.</p>
        )}
        <div className="actions">
          {offset > 0 && (
            <button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
          )}
          {members.data?.nextOffset != null && (
            <button onClick={() => setOffset(members.data!.nextOffset!)}>Next</button>
          )}
        </div>
      </section>
      {canInvite(role) && (
        <section className="card">
          <h2>Pending invitations</h2>
          <ErrorMessage error={invitations.error} />
          {invitations.isPending ? (
            <Loading label="Loading invitations…" />
          ) : invitations.data?.invitations.length ? (
            invitations.data.invitations.map((item) => (
              <div className="invitation-row" key={item.id}>
                <div>
                  <strong>{item.email}</strong>
                  <small>
                    {item.role} · expires {new Date(item.expiresAt).toLocaleDateString()}
                  </small>
                </div>
                <button
                  className="danger compact"
                  disabled={action.isPending || !canInviteRole(role, item.role)}
                  onClick={() => {
                    setInviteLink("");
                    action.mutate({ path: `/invitations/${item.id}`, method: "DELETE" });
                  }}
                >
                  Revoke invitation
                </button>
              </div>
            ))
          ) : (
            <p>No pending invitations.</p>
          )}
        </section>
      )}
      {role !== "owner" && (
        <section className="card">
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
      )}
    </>
  );
}
