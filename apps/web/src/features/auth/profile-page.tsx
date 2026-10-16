import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { Brand, ErrorMessage, Field, Loading, PageHeading } from "@/components/ui";
import { command, sessionQuery } from "@/lib/api";

export function ProfilePage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const session = useQuery(sessionQuery());
  const save = useMutation({
    mutationFn: (body: Record<string, FormDataEntryValue>) => command("/me", "PATCH", body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["session"] }),
  });
  const verify = useMutation({
    mutationFn: () =>
      command("/api/auth/send-verification-email", "POST", { email: session.data!.user.email }),
  });
  const logout = useMutation({
    mutationFn: () => command("/api/auth/sign-out"),
    onSuccess: async () => {
      await client.cancelQueries();
      client.clear();
      await navigate({ to: "/login" });
    },
  });
  if (!session.data) return <Loading />;
  return (
    <main id="main-content" className="narrow-page">
      <Brand />
      <Link className="back-link" to="/workspaces">
        ← Your workspaces
      </Link>
      <PageHeading eyebrow="Your account" title="Your profile">
        Help your colleagues put a name to a face.
      </PageHeading>
      <section className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(Object.fromEntries(new FormData(e.currentTarget)));
          }}
        >
          <Field
            label="Full name"
            name="name"
            defaultValue={session.data.user.name}
            required
            maxLength={100}
          />
          <Field
            label="Job title"
            name="jobTitle"
            defaultValue={session.data.user.jobTitle}
            maxLength={100}
          />
          <Field
            label="Department"
            name="department"
            defaultValue={session.data.user.department}
            maxLength={100}
          />
          <Field
            label="Email address"
            value={session.data.user.email}
            readOnly
            hint="Your account email cannot be changed here."
          />
          <ErrorMessage error={save.error} />
          {save.isSuccess && <output className="notice">Profile saved.</output>}
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>
      <section className="card">
        <h2>Email verification</h2>
        <p>
          {session.data.user.emailVerified
            ? "Your email is verified. You can accept workspace invitations."
            : "Verify your email to accept workspace invitations. Check your email for a verification link."}
        </p>
        {!session.data.user.emailVerified && (
          <button disabled={verify.isPending || verify.isSuccess} onClick={() => verify.mutate()}>
            {verify.isSuccess ? "Verification link sent" : "Send verification email"}
          </button>
        )}
        <ErrorMessage error={verify.error} />
      </section>
      <ErrorMessage error={logout.error} />
      <button className="danger" disabled={logout.isPending} onClick={() => logout.mutate()}>
        Sign out
      </button>
    </main>
  );
}
