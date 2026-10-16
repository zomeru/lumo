import { workspaceInputSchema, workspaceSchema, type WorkspaceInput } from "@lumo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Brand, ErrorMessage, Field } from "@/components/ui";
import { api, clearWorkspaceCache, command, refreshWorkspaces, sessionQuery } from "@/lib/api";

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
    <main id="main-content" className="onboarding">
      <Brand />
      <ol className="steps" aria-label="Workspace setup progress">
        {["Your company", "About you", "Ready"].map((label, index) => (
          <li
            className={index <= step ? "active" : ""}
            aria-current={index === step ? "step" : undefined}
            key={label}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <section className="card" key={step}>
        {step === 0 ? (
          <>
            <h1>Set up your workspace</h1>
            <p>Bring your team together in a space of your own.</p>
            <form
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
              <div className="actions">
                <Link to="/workspaces">Cancel</Link>
                <button className="primary push">
                  Continue <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </>
        ) : step === 1 ? (
          <>
            <h1>About you</h1>
            <p>Let your team know a little more about you. These details appear in your profile.</p>
            <form
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
              <div className="actions">
                <button type="button" onClick={() => setStep(0)}>
                  Back
                </button>
                <button className="primary push" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? "Saving…" : "Continue →"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1>Ready to create {company.name}</h1>
            <p>Here’s what happens next.</p>
            <ul className="ready-list">
              <li>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>A dedicated workspace</strong>
                  <p>Your settings and profile will be saved for your team.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>You’re in control</strong>
                  <p>
                    You’ll be the owner, with control over settings, invitations and member roles.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Invite your people</strong>
                  <p>Create secure invitation links for your colleagues from Members.</p>
                </div>
              </li>
            </ul>
            <ErrorMessage error={create.error} />
            <div className="actions">
              <button onClick={() => setStep(1)} disabled={create.isPending}>
                Back
              </button>
              <button
                className="primary push"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
