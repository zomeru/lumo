import type { onboardingStepSchema } from "@lumo/contracts/hr";
import {
  canHr,
  onboardingDetailSchema,
  onboardingInstancesSchema,
  onboardingInvitationsSchema,
  onboardingTemplatesSchema,
} from "@lumo/contracts/hr";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  ViewTabs,
  Progress,
  SelectField,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { z } from "zod";

import { hrAccessQuery, downloadHrFile, hrQuery, allPeopleQuery, useHrAction } from "./hr-api";
import { hrIcons } from "./hr-icons";
import { useHrTab } from "./hr-search";
import { HrDialog, HrForm, formString } from "./hr-ui";
import { uploadHrFile } from "./request-dialog";

type Step = z.infer<typeof onboardingStepSchema>;
const newStep = (): Step => ({
  title: "",
  instructions: "",
  group: "First week",
  assigneeRole: "employee",
  dueOffsetDays: 0,
  required: true,
  requiresVerification: false,
  requiresAttachment: false,
  link: null,
});
function TemplateEditor({
  workspaceId,
  template,
  onClose,
}: {
  workspaceId: string;
  template: { id?: string; name: string; active: boolean; steps: Step[] };
  onClose: () => void;
}) {
  const [steps, setSteps] = useState(template.steps),
    action = useHrAction(workspaceId);
  const update = (index: number, changes: Partial<Step>) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...changes } : step)));
  const move = (index: number, delta: number) =>
    setSteps((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
      return next;
    });
  return (
    <HrForm
      busy={action.isPending}
      error={action.error}
      label="Save template version"
      onSubmit={(data) =>
        action.mutate(
          {
            path: template.id ? `/onboarding/templates/${template.id}` : "/onboarding/templates",
            method: template.id ? "PUT" : "POST",
            body: {
              name: formString(data, "name"),
              active: formString(data, "active") === "true",
              steps,
            },
          },
          { onSuccess: onClose },
        )
      }
    >
      <Field label="Template name" name="name" defaultValue={template.name} required />
      <SelectField
        label="Template status"
        name="active"
        defaultValue={String(template.active)}
        options={[
          { value: "true", label: "Active" },
          { value: "false", label: "Archived" },
        ]}
      />
      {steps.map((step, index) => (
        <fieldset key={index} className="grid gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm">Step {index + 1}</legend>
          <Field
            label="Task title"
            value={step.title}
            onChange={(e) => update(index, { title: e.target.value })}
            required
          />
          <Field
            label="Instructions"
            value={step.instructions}
            onChange={(e) => update(index, { instructions: e.target.value })}
          />
          <Field
            label="Group"
            value={step.group}
            onChange={(e) => update(index, { group: e.target.value })}
          />
          <SelectField
            label="Assignee role"
            value={step.assigneeRole}
            onValueChange={(value) =>
              update(index, { assigneeRole: value as Step["assigneeRole"] })
            }
            options={["employee", "manager", "hr", "it"].map((value) => ({ value, label: value }))}
          />
          <Field
            label="Due days relative to start"
            type="number"
            value={step.dueOffsetDays}
            min="-90"
            max="365"
            onChange={(e) => update(index, { dueOffsetDays: Number(e.target.value) })}
          />
          <SelectField
            label="Required task"
            value={String(step.required)}
            onValueChange={(v) => update(index, { required: v === "true" })}
            options={[
              { value: "true", label: "Required" },
              { value: "false", label: "Optional" },
            ]}
          />
          <SelectField
            label="Independent verification"
            value={String(step.requiresVerification)}
            onValueChange={(v) => update(index, { requiresVerification: v === "true" })}
            options={[
              { value: "false", label: "Not required" },
              { value: "true", label: "Required" },
            ]}
          />
          <SelectField
            label="Document submission"
            value={String(step.requiresAttachment)}
            onValueChange={(v) => update(index, { requiresAttachment: v === "true" })}
            options={[
              { value: "false", label: "Optional" },
              { value: "true", label: "Required" },
            ]}
          />
          <Field
            label="HTTPS reference link (optional)"
            type="url"
            value={step.link ?? ""}
            onChange={(e) => update(index, { link: e.target.value || null })}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
              Move up
            </Button>
            <Button size="sm" disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
              Move down
            </Button>
            <Button
              size="sm"
              disabled={steps.length === 1}
              onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
            >
              Remove step
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        disabled={steps.length >= 60}
        onClick={() => setSteps((current) => [...current, newStep()])}
      >
        Add step
      </Button>
    </HrForm>
  );
}
export function OnboardingPage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useHrTab("My onboarding", "/w/$workspaceId/hr-onboarding"),
    [status, setStatus] = useState("in_progress"),
    [assign, setAssign] = useState(false),
    [template, setTemplate] = useState<{
      id?: string;
      name: string;
      active: boolean;
      steps: Step[];
    } | null>(null),
    [instanceId, setInstanceId] = useState<string | null>(null);
  const access = useQuery(hrAccessQuery(workspaceId)),
    people = useQuery(allPeopleQuery(workspaceId)),
    action = useHrAction(workspaceId),
    client = useQueryClient();
  const instances = useQuery(
    hrQuery(
      workspaceId,
      `/onboarding?view=${tab === "Checklists" ? "checklists" : "mine"}`,
      onboardingInstancesSchema,
    ),
  );
  const templates = useQuery({
    ...hrQuery(workspaceId, "/onboarding/templates", onboardingTemplatesSchema),
    enabled: Boolean(access.data && canHr(access.data, "hr.onboarding.manage")),
  });
  const invitations = useQuery({
    ...hrQuery(workspaceId, "/onboarding/invitations", onboardingInvitationsSchema),
    enabled: assign,
  });
  const detail = useQuery({
    ...hrQuery(workspaceId, `/onboarding/instances/${instanceId}`, onboardingDetailSchema),
    enabled: !!instanceId,
  });
  const upload = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) =>
      uploadHrFile(workspaceId, "task", taskId, file),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workspace", workspaceId, "hr"] }),
  });
  const download = useMutation({ mutationFn: (id: string) => downloadHrFile(workspaceId, id) });
  if (!access.data)
    return (
      <>
        <ErrorMessage error={access.error} />
        {access.isPending && <Loading />}
      </>
    );
  const manage = canHr(access.data, "hr.onboarding.manage"),
    verify = canHr(access.data, "hr.onboarding.verify");
  return (
    <>
      <PageHeading
        icon={<hrIcons.onboarding className="size-6" aria-hidden="true" />}
        eyebrow="People & HR"
        title="Onboarding"
        actions={
          manage ? (
            <Button variant="primary" onClick={() => setAssign(true)}>
              Start a checklist
            </Button>
          ) : null
        }
      >
        Personal tasks, verified submissions and reusable welcome checklists.
      </PageHeading>
      <ViewTabs
        tabs={[
          "My onboarding",
          ...(manage || verify || access.data.hasReports ? ["Checklists"] : []),
          ...(manage ? ["Templates"] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorMessage
        error={instances.error ?? templates.error ?? action.error ?? upload.error ?? download.error}
      />
      {tab === "My onboarding" && (
        <>
          {instances.data?.tasks.length ? (
            <div className="grid gap-3">
              {instances.data.tasks.map((task) => (
                <Card
                  key={task.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <div>
                    <h2>{task.step.title}</h2>
                    <p>{task.step.instructions}</p>
                    <small>
                      {task.step.group} · due {task.dueDate} ·{" "}
                      {task.step.required ? "Required" : "Optional"}
                    </small>
                    <Badge>{task.status}</Badge>
                  </div>
                  <Button onClick={() => setInstanceId(task.instanceId)}>Open checklist</Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing for you to do">
              Your assigned onboarding tasks appear here.
            </EmptyState>
          )}
        </>
      )}
      {tab === "Checklists" && (
        <>
          <SelectField
            label="Checklist status"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "in_progress", label: "In progress" },
              { value: "completed", label: "Completed" },
              { value: "all", label: "All" },
            ]}
            className="mb-4 max-w-48"
          />
          {instances.data?.instances
            .filter((i) => status === "all" || i.status === status)
            .map((i) => (
              <Card key={i.id} className="mb-3">
                <h2>{i.name}</h2>
                <p>
                  {people.data?.people.find((p) => p.userId === i.userId)?.name ??
                    "Pending invitation"}{" "}
                  · starts {i.startDate} · template version {i.version}
                </p>
                <Progress
                  aria-label={`${i.name} progress`}
                  max={i.total || 1}
                  value={i.completed}
                />
                <p>
                  {i.completed} / {i.total} required tasks complete
                </p>
                <Button className="mt-3" onClick={() => setInstanceId(i.id)}>
                  Open checklist
                </Button>
              </Card>
            ))}
          {!instances.data?.instances.length && (
            <EmptyState title="No checklists here">
              Start one for an existing member or a pending workspace invitation.
            </EmptyState>
          )}
        </>
      )}
      {tab === "Templates" && (
        <>
          <Button
            className="mb-4"
            onClick={() => setTemplate({ name: "", active: true, steps: [newStep()] })}
          >
            New template
          </Button>
          {templates.data?.templates.map((t) => (
            <Card key={t.id} className="mb-3">
              <h2>{t.name}</h2>
              <p>
                {t.steps.length} steps · version {t.version} · {t.active ? "Active" : "Archived"}
              </p>
              <Button className="mt-3" onClick={() => setTemplate(t)}>
                Edit template
              </Button>
            </Card>
          ))}
        </>
      )}
      <HrDialog title="Checklist template" open={!!template} onClose={() => setTemplate(null)}>
        {template && (
          <TemplateEditor
            workspaceId={workspaceId}
            template={template}
            onClose={() => setTemplate(null)}
          />
        )}
      </HrDialog>
      <HrDialog title="Assign onboarding checklist" open={assign} onClose={() => setAssign(false)}>
        <HrForm
          busy={action.isPending}
          error={action.error ?? invitations.error}
          label="Assign checklist"
          onSubmit={(data) => {
            const target = formString(data, "target");
            action.mutate(
              {
                path: "/onboarding/instances",
                body: {
                  templateId: formString(data, "templateId"),
                  userId: target.startsWith("member:") ? target.slice(7) : null,
                  invitationId: target.startsWith("invite:") ? target.slice(7) : null,
                  startDate: formString(data, "startDate"),
                  hrAssigneeId: formString(data, "hrAssigneeId"),
                  itAssigneeId:
                    formString(data, "itAssigneeId") === "none"
                      ? null
                      : formString(data, "itAssigneeId"),
                },
              },
              { onSuccess: () => setAssign(false) },
            );
          }}
        >
          <SelectField
            label="Template"
            name="templateId"
            options={(templates.data?.templates ?? [])
              .filter((t) => t.active)
              .map((t) => ({ value: t.id, label: t.name }))}
          />
          <SelectField
            label="Employee or pending invitation"
            name="target"
            options={[
              ...(people.data?.people ?? []).map((p) => ({
                value: `member:${p.userId}`,
                label: p.name,
              })),
              ...(invitations.data?.invitations ?? []).map((i) => ({
                value: `invite:${i.id}`,
                label: `Invited: ${i.email}`,
              })),
            ]}
          />
          <Field label="Start date" name="startDate" type="date" required />
          <SelectField
            label="HR task assignee"
            name="hrAssigneeId"
            options={(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name }))}
          />
          <SelectField
            label="IT task assignee"
            name="itAssigneeId"
            options={[
              { value: "none", label: "Assign later" },
              ...(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name })),
            ]}
          />
        </HrForm>
      </HrDialog>
      <HrDialog title="Assigned checklist" open={!!instanceId} onClose={() => setInstanceId(null)}>
        <ErrorMessage error={detail.error ?? action.error ?? upload.error ?? download.error} />
        {detail.data?.tasks.map((task) => (
          <Card key={task.id} className="grid gap-3 p-4">
            <h3>{task.step.title}</h3>
            <p>{task.step.instructions}</p>
            <small>
              Due {task.dueDate} ·{" "}
              {task.assigneeId
                ? (people.data?.people.find((p) => p.userId === task.assigneeId)?.name ??
                  "Assigned colleague")
                : "Blocked: choose an assignee"}
            </small>
            <Badge>{task.status}</Badge>
            {task.step.link && (
              <a
                className="text-primary underline"
                href={task.step.link}
                target="_blank"
                rel="noreferrer"
              >
                Open instructions
              </a>
            )}
            {task.assigneeId === access.data.userId && task.status === "todo" && (
              <>
                <Field
                  type="file"
                  label={`Private submission for ${task.step.title}`}
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  disabled={upload.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate({ taskId: task.id, file });
                  }}
                />
                <Button
                  disabled={action.isPending || upload.isPending}
                  onClick={() =>
                    action.mutate({
                      path: `/onboarding/tasks/${task.id}/action`,
                      body: { action: "complete" },
                    })
                  }
                >
                  Complete task
                </Button>
              </>
            )}
            {verify && task.status === "submitted" && task.assigneeId !== access.data.userId && (
              <Button
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: `/onboarding/tasks/${task.id}/action`,
                    body: { action: "verify" },
                  })
                }
              >
                Verify submission
              </Button>
            )}
            {detail.data?.files
              .filter((f) => f.targetId === task.id)
              .map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  disabled={download.isPending}
                  onClick={() => download.mutate(f.id)}
                >
                  Download {f.name}
                </Button>
              ))}
            {manage && (
              <HrForm
                busy={action.isPending}
                error={action.error}
                label="Update task assignment"
                onSubmit={(data) =>
                  action.mutate({
                    path: `/onboarding/tasks/${task.id}/action`,
                    body: { action: "reassign", assigneeId: formString(data, "assigneeId") },
                  })
                }
              >
                <SelectField
                  label="Assignee"
                  name="assigneeId"
                  defaultValue={task.assigneeId ?? undefined}
                  options={(people.data?.people ?? []).map((p) => ({
                    value: p.userId,
                    label: p.name,
                  }))}
                />
              </HrForm>
            )}
            {manage && task.status !== "todo" && (
              <HrForm
                label="Reopen task"
                busy={action.isPending}
                error={action.error}
                onSubmit={(data) =>
                  action.mutate({
                    path: `/onboarding/tasks/${task.id}/action`,
                    body: { action: "reopen", comment: formString(data, "comment") },
                  })
                }
              >
                <Field label="Reason to reopen" name="comment" minLength={3} required />
              </HrForm>
            )}
          </Card>
        ))}
        {detail.data?.events.map((event) => (
          <p key={event.id} className="border-t pt-2 text-xs">
            {new Date(event.createdAt).toLocaleString()} · {event.action} · {event.comment}
          </p>
        ))}
      </HrDialog>
    </>
  );
}
