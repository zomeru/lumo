import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  boolean,
  jsonb,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { createdAt } from "./helpers.ts";
import { workspace } from "./workspaces.ts";
export const hrOnboardingTemplate = pgTable(
  "hr_onboarding_templates",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text().notNull(),
    version: integer().notNull().default(1),
    active: boolean().notNull().default(true),
    steps: jsonb().$type<Record<string, unknown>[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("hr_template_workspace_id").on(t.workspaceId, t.id)],
);
export const hrOnboardingInstance = pgTable(
  "hr_onboarding_instances",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    templateId: uuid("template_id").notNull(),
    userId: uuid("user_id"),
    invitationId: uuid("invitation_id"),
    name: text().notNull(),
    version: integer().notNull(),
    snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    startDate: date("start_date").notNull(),
    ownerId: uuid("owner_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.templateId],
      foreignColumns: [hrOnboardingTemplate.workspaceId, hrOnboardingTemplate.id],
    }),
    unique("hr_onboarding_workspace_id").on(t.workspaceId, t.id),
    index("hr_onboarding_employee").on(t.workspaceId, t.userId),
  ],
);
export const hrOnboardingTask = pgTable(
  "hr_onboarding_tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    instanceId: uuid("instance_id").notNull(),
    assigneeId: uuid("assignee_id"),
    step: jsonb().$type<Record<string, unknown>>().notNull(),
    position: integer().notNull(),
    dueDate: date("due_date").notNull(),
    status: text().notNull().default("todo"),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.instanceId],
      foreignColumns: [hrOnboardingInstance.workspaceId, hrOnboardingInstance.id],
    }),
    unique("hr_task_workspace_id").on(t.workspaceId, t.id),
    unique("hr_task_position").on(t.workspaceId, t.instanceId, t.position),
  ],
);
export const hrOnboardingEvent = pgTable(
  "hr_onboarding_task_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    taskId: uuid("task_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    action: text().notNull(),
    comment: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.taskId],
      foreignColumns: [hrOnboardingTask.workspaceId, hrOnboardingTask.id],
    }),
    index("hr_task_history").on(t.workspaceId, t.taskId, t.createdAt),
  ],
);
