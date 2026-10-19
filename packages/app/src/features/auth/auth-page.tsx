import { credentialsSchema, registrationSchema } from "@lumo/contracts";
import { Brand, Button, Card, ErrorMessage, Field, ThemeMenu } from "@lumo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, MessageSquare } from "lucide-react";
import { useState } from "react";

import { command, sessionQuery } from "../../lib/api";

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
    <main id="main-content" className="relative grid min-h-dvh lg:grid-cols-2">
      <div className="absolute top-5 right-5">
        <ThemeMenu />
      </div>
      <div className="hidden flex-col justify-between border-r bg-sidebar px-12 py-10 lg:flex xl:px-20">
        <Brand />
        <div>
          <span className="mb-3 block text-xs font-medium text-primary">
            Your team’s next chapter
          </span>
          <h1 className="my-5 text-4xl leading-tight tracking-tight xl:text-5xl">
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
        <div
          className="mt-10 max-w-sm rounded-xl border bg-surface p-5 shadow-xs"
          aria-hidden="true"
        >
          <div className="mb-4 flex items-center gap-2 text-xs font-medium">
            <MessageSquare className="size-4 text-primary" />A little more connected
          </div>
          <div className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              LT
            </span>
            <div>
              <span className="text-xs font-semibold">Lumo team</span>
              <p className="mt-1 text-xs">
                A shared space. A new idea. Your next chapter starts here.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
            <Check className="size-3.5 text-primary" />
            Your people, all in one place.
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-8 px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm lg:hidden">
          <Brand />
        </div>
        <Card
          asChild
          className="w-full max-w-sm border-0 bg-transparent p-0 shadow-none sm:p-0 [&>p]:my-3 [&>form]:mt-7"
        >
          <div>
            <span className="mb-3 block text-xs font-medium text-primary">
              Welcome {register ? "to Lumo" : "back"}
            </span>
            <h2 className="text-2xl">{register ? "Create your account" : "Sign in to Lumo"}</h2>
            <p>
              {register
                ? "Start with your own private workspace."
                : "Pick up where your team left off."}
            </p>
            {invite && (
              <p className="my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
                Sign in with the email address that received your invitation.
              </p>
            )}
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const body = Object.fromEntries(new FormData(event.currentTarget)) as Record<
                  string,
                  string
                >;
                const result = (register ? registrationSchema : credentialsSchema).safeParse(body);
                if (!result.success) {
                  setValidation(
                    new Error(result.error.issues[0]?.message ?? "Check your details."),
                  );
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
              <Button
                variant="primary"
                type="submit"
                className="w-full"
                disabled={submit.isPending}
              >
                {submit.isPending ? "Please wait…" : register ? "Create account" : "Sign in"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground [&_a]:font-medium [&_a]:text-primary">
              {register ? "Already have an account?" : "New to Lumo?"}{" "}
              <Link to={register ? "/login" : "/register"} search={{ invite }}>
                {register ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
