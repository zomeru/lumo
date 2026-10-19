import {
  Brand,
  Button,
  Card,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  ThemeMenu,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { command, sessionQuery } from "../../lib/api";

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
    <main id="main-content" className="mx-auto grid max-w-2xl gap-6 px-5 py-10 sm:px-8">
      <Brand />
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        to="/workspaces"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your workspaces
      </Link>
      <PageHeading eyebrow="Your account" title="Your profile">
        Help your colleagues put a name to a face.
      </PageHeading>
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <form
            className="grid gap-4"
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
            {save.isSuccess && (
              <output className="my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
                Profile saved.
              </output>
            )}
            <Button variant="primary" type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </section>
      </Card>
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <h2>Email verification</h2>
          <p>
            {session.data.user.emailVerified
              ? "Your email is verified. You can accept workspace invitations."
              : "Verify your email to accept workspace invitations. Check your email for a verification link."}
          </p>
          {!session.data.user.emailVerified && (
            <Button disabled={verify.isPending || verify.isSuccess} onClick={() => verify.mutate()}>
              {verify.isSuccess ? "Verification link sent" : "Send verification email"}
            </Button>
          )}
          <ErrorMessage error={verify.error} />
        </section>
      </Card>
      <ErrorMessage error={logout.error} />
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2>Appearance</h2>
            <p className="mt-1 text-xs">Choose a theme, or follow your device.</p>
          </div>
          <ThemeMenu />
        </div>
      </Card>
      <Button variant="destructive" disabled={logout.isPending} onClick={() => logout.mutate()}>
        Sign out
      </Button>
    </main>
  );
}
