import { conversationSchema } from "@lumo/contracts/collaboration";
import { Avatar, ErrorMessage, Field, Loading, PageHeading } from "@lumo/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { api, sessionQuery, membersQuery } from "../../lib/api";

export function ContactsPage({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const session = useQuery(sessionQuery());
  const start = useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspaceId}/conversations`, conversationSchema, {
        method: "POST",
        body: { kind: "direct", name: "Direct message", memberIds: [id] },
      }),
    onSuccess: async (value) => {
      await navigate({
        to: "/w/$workspaceId/messenger/$conversationId",
        params: { workspaceId, conversationId: value.id },
      });
    },
  });
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const members = useQuery(membersQuery(workspaceId, q, offset));
  return (
    <>
      <PageHeading eyebrow="Your people" title="Contacts">
        Get to know the people in this workspace.
      </PageHeading>
      <Field
        label="Search members by name"
        type="search"
        maxLength={100}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOffset(0);
        }}
      />
      <ErrorMessage error={members.error ?? start.error} />
      {members.isPending ? (
        <Loading label="Loading contacts…" />
      ) : members.isError ? null : members.data?.members.length ? (
        <div className="contacts-grid">
          {members.data.members.map((member) => (
            <article className="card contact-card" key={member.userId}>
              <Avatar name={member.name} />
              <h2>{member.name}</h2>
              <p>
                {member.jobTitle || "Workspace member"}
                {member.department && (
                  <>
                    <br />
                    {member.department}
                  </>
                )}
              </p>
              <span className="badge">{member.role}</span>
              {member.userId !== session.data?.user.id && (
                <button
                  className="full"
                  disabled={start.isPending}
                  onClick={() => start.mutate(member.userId)}
                >
                  Message {member.name}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>No members found</h2>
          <p>Try a different name.</p>
        </div>
      )}
      <div className="actions">
        {offset > 0 && (
          <button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
        )}
        {members.data?.nextOffset != null && (
          <button onClick={() => setOffset(members.data!.nextOffset!)}>Next</button>
        )}
      </div>
    </>
  );
}
