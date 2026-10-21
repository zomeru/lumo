import { credentialsSchema, registrationSchema } from "@lumo/contracts";
import { legalVersions } from "@lumo/contracts/legal";
import { Button, Card, ErrorMessage, Field, ThemeMenu } from "@lumo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, MessageSquare } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "../../chrome";
import { BrandLink } from "../../components/brand-link";
import { command, sessionQuery } from "../../lib/api";
import type { LegalDocument } from "../public/legal-content";
import { PublicFooter } from "../public/public-layout";
import { LegalConsent } from "./legal-consent";

export function AuthPage({ mode, invite }: { mode: "login" | "register"; invite?: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [validation, setValidation] = useState<Error | null>(null);
  const register = mode === "register";
  const [fields, setFields] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [reviewed, setReviewed] = useState<Record<LegalDocument, boolean>>({
    terms: false,
    privacy: false,
  });
  const [accepted, setAccepted] = useState(false);
  const consent = {
    accepted,
    termsVersion: legalVersions.terms,
    privacyVersion: legalVersions.privacy,
  };
  const registrationValid =
    registrationSchema.safeParse({ ...fields, consent }).success &&
    reviewed.terms &&
    reviewed.privacy;
  const nameError =
    register && touched.name && !fields.name.trim() ? "Enter your full name." : undefined;
  const emailError =
    register && touched.email && !credentialsSchema.shape.email.safeParse(fields.email).success
      ? "Enter a valid email address."
      : undefined;
  const passwordError =
    register && touched.password && (fields.password.length < 12 || fields.password.length > 128)
      ? "Use between 12 and 128 characters."
      : undefined;
  const confirmationError =
    register && touched.confirmPassword && fields.password !== fields.confirmPassword
      ? "Passwords do not match. Enter the same password in both fields."
      : undefined;
  const submit = useMutation({
    mutationFn: (body: unknown) =>
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
    <div className="flex min-h-dvh flex-col bg-background">
      <main id="main-content" className="relative grid flex-1 lg:grid-cols-2">
        <AppHeader className="app-auth-header absolute top-5 right-5 flex items-center gap-3">
          <ThemeMenu />
        </AppHeader>
        <div className="hidden flex-col justify-between border-r bg-sidebar px-12 py-10 lg:flex xl:px-20">
          <BrandLink to="/" />
          <div>
            <span className="mb-3 block text-xs font-medium text-accent-foreground">
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
        <div className="flex flex-col items-center justify-center gap-6 px-5 pt-16 pb-8 sm:px-10">
          <div className="w-full max-w-sm lg:hidden">
            <BrandLink to="/" />
          </div>
          <Card
            asChild
            className="w-full max-w-sm border-0 bg-transparent p-0 shadow-none sm:p-0 [&>p]:my-3 [&>form]:mt-5"
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
                onChange={(event) => {
                  const target = event.target;
                  if (target instanceof HTMLInputElement && target.name in fields) {
                    setFields((current) => ({ ...current, [target.name]: target.value }));
                    setValidation(null);
                  }
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = Object.fromEntries(new FormData(event.currentTarget)) as Record<
                    string,
                    string
                  >;
                  const payload = register ? { ...body, consent } : body;
                  const result = (register ? registrationSchema : credentialsSchema).safeParse(
                    payload,
                  );
                  if (!result.success) {
                    setValidation(
                      new Error(result.error.issues[0]?.message ?? "Check your details."),
                    );
                    return;
                  }
                  if (register && (!reviewed.terms || !reviewed.privacy)) {
                    setValidation(
                      new Error("Read and acknowledge both legal documents before continuing."),
                    );
                    return;
                  }
                  if (submit.isPending) return;
                  setValidation(null);
                  submit.mutate(result.data);
                }}
              >
                {register && (
                  <Field
                    label="Full name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    error={nameError}
                    onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                  />
                )}
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  error={emailError}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={12}
                  maxLength={128}
                  hint={register ? "Use between 12 and 128 characters." : undefined}
                  error={passwordError}
                  onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                />
                {register && (
                  <>
                    <Field
                      label="Confirm Password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      error={confirmationError}
                      onBlur={() =>
                        setTouched((current) => ({ ...current, confirmPassword: true }))
                      }
                    />
                    <LegalConsent
                      reviewed={reviewed}
                      onReview={(document) =>
                        setReviewed((current) => ({ ...current, [document]: true }))
                      }
                      accepted={accepted}
                      onAcceptedChange={setAccepted}
                    />
                  </>
                )}
                <ErrorMessage error={validation ?? submit.error} />
                <Button
                  variant="primary"
                  type="submit"
                  className="w-full"
                  loading={submit.isPending}
                  disabled={submit.isPending || (register && !registrationValid)}
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
      <PublicFooter />
    </div>
  );
}
