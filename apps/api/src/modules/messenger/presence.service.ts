import type { Database, Transaction } from "@lumo/database";
import { presenceLease, presencePreference, membership, session } from "@lumo/database/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { createWorkspaceService } from "../workspaces/workspace.service";

// PostgreSQL leases coordinate all API processes; LISTEN/NOTIFY only prompts reconciliation.
export function createPresenceService(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
) {
  const notify = (tx: Transaction, workspaceId: string) =>
    tx.execute(sql`select pg_notify('lumo_messenger_presence', ${workspaceId})`);
  return {
    async renew(id: string, workspaceId: string, userId: string, sessionId: string) {
      await workspaces.withAccess(workspaceId, userId, async (tx) => {
        const result = await tx
          .insert(presenceLease)
          .values({
            id,
            workspaceId,
            userId,
            sessionId,
            expiresAt: sql`now() + interval '45 seconds'`,
          })
          .onConflictDoNothing()
          .returning({ id: presenceLease.id });
        if (result.length) await notify(tx, workspaceId);
        else
          await tx
            .update(presenceLease)
            .set({ expiresAt: sql`now() + interval '45 seconds'` })
            .where(eq(presenceLease.id, id));
      });
    },
    async release(id: string) {
      // Brief reconnect grace avoids flicker on ticket renewal and transient transport loss.
      await db
        .update(presenceLease)
        .set({ expiresAt: sql`least(expires_at, now() + interval '5 seconds')` })
        .where(eq(presenceLease.id, id));
    },
    async expire() {
      await db.transaction(async (tx) => {
        const expired = await tx
          .delete(presenceLease)
          .where(sql`${presenceLease.expiresAt} <= now()`)
          .returning({ workspaceId: presenceLease.workspaceId });
        for (const workspaceId of new Set(expired.map((r) => r.workspaceId)))
          await notify(tx, workspaceId);
      });
    },
    async preference(userId: string) {
      const [row] = await db
        .select({ dnd: presencePreference.dnd })
        .from(presencePreference)
        .where(eq(presencePreference.userId, userId));
      return { dnd: row?.dnd ?? false };
    },
    async setPreference(userId: string, dnd: boolean) {
      await db.transaction(async (tx) => {
        await tx
          .insert(presencePreference)
          .values({ userId, dnd })
          .onConflictDoUpdate({ target: presencePreference.userId, set: { dnd } });
        const spaces = await tx
          .select({ id: membership.workspaceId })
          .from(membership)
          .where(eq(membership.userId, userId));
        for (const space of spaces) await notify(tx, space.id);
      });
      return { dnd };
    },
    query(workspaceId: string, actor: string, userIds: string[]) {
      return workspaces.withAccess(workspaceId, actor, async (tx) => {
        if (!userIds.length) return { members: [] };
        const rows = await tx
          .select({
            userId: membership.userId,
            status: sql<"online" | "dnd" | "offline">`case when exists (
            select 1 from ${presenceLease} l inner join ${session} s on s.id = l.session_id and s.user_id = l.user_id
            where l.workspace_id = ${workspaceId} and l.user_id = ${membership.userId}
            and l.expires_at > now() and s.expires_at > now()
          ) then case when coalesce(${presencePreference.dnd}, false) then 'dnd' else 'online' end else 'offline' end`,
          })
          .from(membership)
          .leftJoin(presencePreference, eq(presencePreference.userId, membership.userId))
          .where(
            and(
              eq(membership.workspaceId, workspaceId),
              inArray(membership.userId, [...new Set(userIds)]),
            ),
          );
        return { members: rows };
      });
    },
  };
}
