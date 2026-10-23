import { onboardingStepSchema } from "@lumolynk/contracts/hr";
import type { Transaction } from "@lumolynk/database";
import {
  hrOnboardingInstance,
  hrOnboardingTask,
  hrOnboardingEvent,
  hrNotification,
} from "@lumolynk/database/schema";
import { and, eq, sql } from "drizzle-orm";

import { AppError, denied, missing } from "../../lib/errors";
import type { HrContext } from "./core";
export async function taskFor(c: HrContext, id: string) {
  const [task] = await c.tx
    .select()
    .from(hrOnboardingTask)
    .where(and(eq(hrOnboardingTask.workspaceId, c.workspaceId), eq(hrOnboardingTask.id, id)));
  if (!task) missing();
  return task;
}
export async function onboardingTaskAccess(c: HrContext, id: string, write = false) {
  const task = await taskFor(c, id);
  if (task.assigneeId === c.actorId) {
    if (write && task.status !== "todo")
      throw new AppError(
        409,
        "TASK_CLOSED",
        "Reopen the task before changing verified submissions.",
      );
    return;
  }
  if (write) denied();
  if (!(await c.can("hr.onboarding.manage")) && !(await c.can("hr.onboarding.verify"))) missing();
}
export async function activateOnboarding(
  tx: Transaction,
  workspaceId: string,
  userId: string,
  invitationId: string,
) {
  const instances = await tx
    .update(hrOnboardingInstance)
    .set({ userId })
    .where(
      and(
        eq(hrOnboardingInstance.workspaceId, workspaceId),
        eq(hrOnboardingInstance.invitationId, invitationId),
      ),
    )
    .returning();
  for (const instance of instances) {
    const tasks = await tx
      .update(hrOnboardingTask)
      .set({ assigneeId: userId })
      .where(
        and(
          eq(hrOnboardingTask.workspaceId, workspaceId),
          eq(hrOnboardingTask.instanceId, instance.id),
          sql`${hrOnboardingTask.step}->>'assigneeRole' = 'employee'`,
        ),
      )
      .returning();
    for (const task of tasks) {
      await tx
        .insert(hrOnboardingEvent)
        .values({ workspaceId, taskId: task.id, actorId: userId, action: "invitation_accepted" });
      await tx.insert(hrNotification).values({
        workspaceId,
        userId,
        title: `Onboarding: ${onboardingStepSchema.parse(task.step).title}`,
        module: "onboarding",
        targetId: instance.id,
      });
    }
  }
}
