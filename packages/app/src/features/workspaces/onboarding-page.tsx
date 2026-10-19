import { workspaceInputSchema, workspaceSchema, type WorkspaceInput } from "@lumo/contracts";
import { Brand, Button, Card, ErrorMessage, Field } from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

import { api, clearWorkspaceCache, command, refreshWorkspaces, sessionQuery } from "../../lib/api";
import { WorkspaceFields } from "./workspace-fields";

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState<WorkspaceInput>({ name: "" });
  const [details, setDetails] = useState({ jobTitle: "", department: "" });
  const [validation, setValidation] = useState<Error | null>(null);
  const session = useQuery(sessionQuery());
  const client = useQueryClient();
  const navigate = useNavigate();
  const saveProfile = useMutation({
    mutationFn: () => command("/me", "PATCH", { name: session.data!.user.name, ...details }),
    onSuccess: () => setStep(2),
  });
  const create = useMutation({
    mutationFn: () => api("/workspaces", workspaceSchema, { method: "POST", body: company }),
    onSuccess: async (ws) => {
      await clearWorkspaceCache(client);
      await refreshWorkspaces(client);
      await navigate({ to: "/w/$workspaceId", params: { workspaceId: ws.id } });
    },
  });
  return (
    <main
      id="main-content"
      className="mx-auto grid min-h-dvh max-w-2xl content-start gap-6 px-5 py-10 sm:py-14"
    >
      <Brand />
      <ol className="flex items-center gap-2" aria-label="Workspace setup progress">
        {["Your company", "About you", "Ready"].map((label, index) => (
          <li
            className={
              index <= step
                ? "flex-1 rounded-md border border-primary/20 bg-accent px-2 py-2 text-center text-xs font-medium text-accent-foreground"
                : "flex-1 rounded-md border bg-muted/40 px-2 py-2 text-center text-xs text-muted-foreground"
            }
            aria-current={index === step ? "step" : undefined}
            key={label}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section key={step}>
          {step === 0 ? (
            <>
              <h1>Set up your workspace</h1>
              <p>Bring your team together in a space of your own.</p>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const result = workspaceInputSchema.safeParse(
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  if (!result.success) {
                    setValidation(
                      new Error(result.error.issues[0]?.message ?? "Check the workspace details."),
                    );
                    return;
                  }
                  setCompany(result.data);
                  setValidation(null);
                  setStep(1);
                }}
              >
                <WorkspaceFields value={company} />
                <ErrorMessage error={validation} />
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link to="/workspaces">Cancel</Link>
                  <Button variant="primary" type="submit" className="ml-auto">
                    Continue <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </form>
            </>
          ) : step === 1 ? (
            <>
              <h1>About you</h1>
              <p>
                Let your team know a little more about you. These details appear in your profile.
              </p>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveProfile.mutate();
                }}
              >
                <Field
                  label="Job title"
                  value={details.jobTitle}
                  maxLength={100}
                  onChange={(e) => setDetails({ ...details, jobTitle: e.target.value })}
                  placeholder="e.g. Operations Manager"
                />
                <Field
                  label="Department"
                  value={details.department}
                  maxLength={100}
                  onChange={(e) => setDetails({ ...details, department: e.target.value })}
                  placeholder="e.g. Operations"
                />
                <ErrorMessage error={saveProfile.error} />
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    className="ml-auto"
                    disabled={saveProfile.isPending}
                  >
                    {saveProfile.isPending ? "Saving…" : "Continue"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1>Ready to create {company.name}</h1>
              <p>Here’s what happens next.</p>
              <ul className="my-6 grid gap-5 [&_li]:flex [&_li]:gap-3 [&_li>span]:text-primary [&_p]:mt-1">
                <li>
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <strong>A dedicated workspace</strong>
                    <p>Your settings and profile will be saved for your team.</p>
                  </div>
                </li>
                <li>
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <strong>You’re in control</strong>
                    <p>
                      You’ll be the owner, with control over settings, invitations and member roles.
                    </p>
                  </div>
                </li>
                <li>
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <strong>Invite your people</strong>
                    <p>Create secure invitation links for your colleagues from Members.</p>
                  </div>
                </li>
              </ul>
              <ErrorMessage error={create.error} />
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button onClick={() => setStep(1)} disabled={create.isPending}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  className="ml-auto"
                  disabled={create.isPending}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? "Creating…" : "Create workspace"}
                </Button>
              </div>
            </>
          )}
        </section>
      </Card>
    </main>
  );
}
