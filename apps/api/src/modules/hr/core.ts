import type { HrCapability } from "@lumo/contracts/hr";
import type { Transaction } from "@lumo/database";
import { hrGrant, hrEmployee, hrAudit, hrNotification, membership } from "@lumo/database/schema";
import { and, eq } from "drizzle-orm";

import { denied, missing } from "../../lib/errors";
import type { createWorkspaceService } from "../workspaces/workspace.service";

export type HrContext = {
  tx: Transaction;
  workspaceId: string;
  actorId: string;
  timezone: string;
  currency: string;
  owner: boolean;
  grants: (typeof hrGrant.$inferSelect)[];
  can: (capability: HrCapability, targetId?: string) => Promise<boolean>;
  require: (capability: HrCapability, targetId?: string) => Promise<void>;
};
export type HrCore = ReturnType<typeof createHrCore>;
export function createHrCore(workspaces: ReturnType<typeof createWorkspaceService>) {
  return {
    async run<T>(workspaceId: string, actorId: string, action: (context: HrContext) => Promise<T>) {
      return workspaces.withAccess(workspaceId, actorId, async (tx, ws, member) => {
        const grants = await tx
          .select()
          .from(hrGrant)
          .where(and(eq(hrGrant.workspaceId, workspaceId), eq(hrGrant.userId, actorId)));
        async function can(capability: HrCapability, targetId?: string) {
          if (member.role === "owner") return true;
          const grant = grants.find((g) => g.capability === capability);
          if (!grant) return false;
          if (grant.scope === "workspace") return true;
          if (!targetId) return false;
          const [employee] = await tx
            .select()
            .from(hrEmployee)
            .where(
              and(
                eq(hrEmployee.workspaceId, workspaceId),
                eq(hrEmployee.userId, targetId),
                eq(hrEmployee.managerId, actorId),
              ),
            );
          return Boolean(employee);
        }
        return action({
          tx,
          workspaceId,
          actorId,
          timezone: ws.timezone,
          currency: ws.currency,
          owner: member.role === "owner",
          grants,
          can,
          require: async (capability, targetId) => {
            if (!(await can(capability, targetId))) denied();
          },
        });
      });
    },
  };
}
export async function requireHrMember(c: HrContext, userId: string) {
  const [member] = await c.tx
    .select()
    .from(membership)
    .where(and(eq(membership.workspaceId, c.workspaceId), eq(membership.userId, userId)));
  if (!member) missing();
}
export async function auditHr(
  c: HrContext,
  action: string,
  targetId: string,
  data: Record<string, unknown> = {},
) {
  await c.tx
    .insert(hrAudit)
    .values({ workspaceId: c.workspaceId, actorId: c.actorId, action, targetId, data });
}
export async function notifyHr(
  c: HrContext,
  userId: string,
  title: string,
  module: string,
  targetId: string,
) {
  await c.tx
    .insert(hrNotification)
    .values({ workspaceId: c.workspaceId, userId, title, module, targetId });
}
export async function canTeam(
  c: HrContext,
  capability: "hr.leave.read_team" | "hr.attendance.read_team",
  targetId: string,
) {
  if (targetId === c.actorId || (await c.can(capability, targetId))) return true;
  const [report] = await c.tx
    .select()
    .from(hrEmployee)
    .where(
      and(
        eq(hrEmployee.workspaceId, c.workspaceId),
        eq(hrEmployee.userId, targetId),
        eq(hrEmployee.managerId, c.actorId),
      ),
    );
  return Boolean(report);
}
