import { credentialsSchema, registrationSchema } from "@lumo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Brand, ErrorMessage, Field } from "@/components/ui";
import { command, sessionQuery } from "@/lib/api";

export function AuthPage({ mode, invite }: { mode: "login" | "register"; invite?: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [validation, setValidation] = useState<Error | null>(null);
  const register = mode === "register";
  const submit = useMutation({
    mutationFn: (body: Record<string, string>) =>
      command(`/api/auth/${register ? "sign-up" : "sign-in"}/email`, "POST", body),
    onSuccess: async () => {
      await client.cancelQueries();
      client.clear();
      if (invite) {
        await navigate({ to: "/invite", search: { token: invite } });
        return;
      }
      const session = await client.fetchQuery(sessionQuery());
      await navigate(
        session.activeWorkspaceId
          ? { to: "/w/$workspaceId", params: { workspaceId: session.activeWorkspaceId } }
          : { to: "/workspaces" },
      );
    },
  });
  return (
    <main id="main-content" className="auth-page">
      <div className="auth-aside">
        <Brand />
        <div>
          <span className="eyebrow">Your team’s next chapter</span>
          <h1>
            Good work starts
            <br />
            with connection.
          </h1>
          <p>
            One account. A space for every team.
            <br />
            Everything you need to belong.
          </p>
        </div>
        <small>One Workspace. Everything Connected.</small>
      </div>
      <div className="auth-form">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="card">
          <span className="eyebrow">Welcome {register ? "to Lumo" : "back"}</span>
          <h2>{register ? "Create your account" : "Sign in to Lumo"}</h2>
          <p>
            {register
              ? "Start with your own private workspace."
              : "Pick up where your team left off."}
          </p>
          {invite && (
            <p className="notice">Sign in with the email address that received your invitation.</p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const body = Object.fromEntries(new FormData(event.currentTarget)) as Record<
                string,
                string
              >;
              const result = (register ? registrationSchema : credentialsSchema).safeParse(body);
              if (!result.success) {
                setValidation(new Error(result.error.issues[0]?.message ?? "Check your details."));
                return;
              }
              setValidation(null);
              submit.mutate(body);
            }}
          >
            {register && (
              <Field label="Full name" name="name" autoComplete="name" required maxLength={100} />
            )}
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
              hint={register ? "Use at least 12 characters." : undefined}
            />
            <ErrorMessage error={validation ?? submit.error} />
            <button className="primary full" disabled={submit.isPending}>
              {submit.isPending ? "Please wait…" : register ? "Create account" : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="form-footer">
            {register ? "Already have an account?" : "New to Lumo?"}{" "}
            <Link to={register ? "/login" : "/register"} search={{ invite }}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
