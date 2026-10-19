import { conversationSchema } from "@lumo/contracts/collaboration";
import { Avatar, Badge, Button, Card, ErrorMessage, Field, Loading, PageHeading } from "@lumo/ui";
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
        className="mb-5 max-w-md"
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {members.data.members.map((member) => (
            <Card asChild key={member.userId} className="[&>p]:my-3 [&>form]:mt-4">
              <article className="flex flex-col items-start gap-3" key={member.userId}>
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
                <Badge>{member.role}</Badge>
                {member.userId !== session.data?.user.id && (
                  <Button
                    className="w-full"
                    disabled={start.isPending}
                    onClick={() => start.mutate(member.userId)}
                  >
                    Message {member.name}
                  </Button>
                )}
              </article>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-surface px-5 py-10 text-center text-muted-foreground">
          <h2>No members found</h2>
          <p>Try a different name.</p>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {offset > 0 && (
          <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
        )}
        {members.data?.nextOffset != null && (
          <Button onClick={() => setOffset(members.data!.nextOffset!)}>Next</Button>
        )}
      </div>
    </>
  );
}
