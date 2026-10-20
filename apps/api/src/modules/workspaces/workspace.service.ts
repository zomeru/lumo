import { createHash, randomBytes } from "node:crypto";

import type { Role, WorkspaceInput } from "@lumo/contracts";
import {
  canChangeRole,
  canInviteRole,
  canManageSettings,
  canRemoveMember,
} from "@lumo/contracts/permissions";
import type { Database, Transaction } from "@lumo/database";
import {
  auditEvent,
  invitation,
  membership,
  profile,
  user,
  workspace,
} from "@lumo/database/schema";
import { and, asc, desc, eq, gt, ilike, isNull, sql } from "drizzle-orm";

import type { SessionUser } from "../../lib/context.ts";
import { AppError, denied, missing } from "../../lib/errors.ts";

type Db = Database | Transaction;
type WorkspaceRow = typeof workspace.$inferSelect;
type MembershipRow = typeof membership.$inferSelect;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function dto(value: WorkspaceRow, role: Role) {
  const { personalOwnerId, updatedAt: _updatedAt, createdAt, ...rest } = value;
  return {
    ...rest,
    role,
    isPersonal: personalOwnerId !== null,
    createdAt: createdAt.toISOString(),
  };
}

async function findMembership(db: Db, workspaceId: string, userId: string) {
  const [result] = await db
    .select()
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, userId)));
  return result;
}

async function audit(
  tx: Transaction,
  workspaceId: string,
  actorId: string,
  action: string,
  targetId?: string,
) {
  await tx.insert(auditEvent).values({ workspaceId, actorId, action, targetId });
}

export function createWorkspaceService(
  db: Database,
  revokeAccess?: (tx: Transaction, workspaceId: string, userId: string) => Promise<void>,
  roleChanged?: (tx: Transaction, workspaceId: string, userId: string) => Promise<void>,
) {
  // All workspace writes share this lock. Membership is checked AFTER acquiring it,
  // so a concurrent demotion/removal cannot authorize a later mutation.
  async function withAccess<T>(
    workspaceId: string,
    userId: string,
    action: (tx: Transaction, ws: WorkspaceRow, member: MembershipRow) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      const [ws] = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .for("update");
      const member = await findMembership(tx, workspaceId, userId);
      if (!ws || !member) missing();
      return action(tx, ws, member);
    });
  }

  async function requireAccess(workspaceId: string, userId: string) {
    const [result] = await db
      .select({ ws: workspace, member: membership })
      .from(workspace)
      .innerJoin(
        membership,
        and(eq(membership.workspaceId, workspace.id), eq(membership.userId, userId)),
      )
      .where(eq(workspace.id, workspaceId));
    if (!result) missing();
    return result;
  }

  return {
    requireAccess,
    withAccess,
    async list(userId: string) {
      const rows = await db
        .select({ ws: workspace, role: membership.role })
        .from(membership)
        .innerJoin(workspace, eq(workspace.id, membership.workspaceId))
        .where(eq(membership.userId, userId))
        .orderBy(asc(workspace.createdAt), asc(workspace.id));
      return rows.map(({ ws, role }) => dto(ws, role));
    },
    async create(userId: string, input: WorkspaceInput) {
      return db.transaction(async (tx) => {
        const [ws] = await tx.insert(workspace).values(input).returning();
        if (!ws) throw new Error("Workspace insert failed");
        await tx.insert(membership).values({ workspaceId: ws.id, userId, role: "owner" });
        await tx
          .update(profile)
          .set({ activeWorkspaceId: ws.id })
          .where(eq(profile.userId, userId));
        await audit(tx, ws.id, userId, "workspace.created");
        return dto(ws, "owner");
      });
    },
    async get(workspaceId: string, userId: string) {
      const { ws, member } = await requireAccess(workspaceId, userId);
      return dto(ws, member.role);
    },
    async update(workspaceId: string, userId: string, input: Partial<WorkspaceInput>) {
      return withAccess(workspaceId, userId, async (tx, ws, member) => {
        if (!canManageSettings(member.role)) denied();
        if (ws.personalOwnerId && input.visibility && input.visibility !== "private")
          throw new AppError(400, "PERSONAL_WORKSPACE", "Personal workspaces are always private.");
        const [updated] = await tx
          .update(workspace)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(workspace.id, workspaceId))
          .returning();
        if (!updated) missing();
        await audit(tx, workspaceId, userId, "workspace.updated");
        return dto(updated, member.role);
      });
    },
    async activate(workspaceId: string, userId: string) {
      return withAccess(workspaceId, userId, async (tx) => {
        await tx
          .update(profile)
          .set({ activeWorkspaceId: workspaceId })
          .where(eq(profile.userId, userId));
      });
    },
    async discover(userId: string, q: string, offset: number, limit: number) {
      const rows = await db
        .select({ id: workspace.id, name: workspace.name, description: workspace.description })
        .from(workspace)
        .where(
          and(
            eq(workspace.visibility, "public"),
            ilike(workspace.name, `%${q}%`),
            sql`not exists (select 1 from ${membership} where ${membership.workspaceId} = ${workspace.id} and ${membership.userId} = ${userId})`,
          ),
        )
        .orderBy(asc(workspace.name), asc(workspace.id))
        .offset(offset)
        .limit(limit + 1);
      return {
        workspaces: rows.slice(0, limit),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    },
    async join(workspaceId: string, userId: string) {
      return db.transaction(async (tx) => {
        const [ws] = await tx
          .select()
          .from(workspace)
          .where(eq(workspace.id, workspaceId))
          .for("update");
        // A private workspace's existence and metadata are not disclosed.
        if (!ws || ws.visibility !== "public") missing();
        const added = await tx
          .insert(membership)
          .values({ workspaceId, userId, role: "member" })
          .onConflictDoNothing()
          .returning();
        if (added.length) await audit(tx, workspaceId, userId, "member.joined", userId);
        await tx
          .update(profile)
          .set({ activeWorkspaceId: workspaceId })
          .where(eq(profile.userId, userId));
        const member = await findMembership(tx, workspaceId, userId);
        if (!member) missing();
        return dto(ws, member.role);
      });
    },
    async members(workspaceId: string, userId: string, q: string, offset: number, limit: number) {
      await requireAccess(workspaceId, userId);
      const rows = await db
        .select({
          userId: user.id,
          name: user.name,
          image: user.image,
          jobTitle: profile.jobTitle,
          department: profile.department,
          role: membership.role,
          joinedAt: membership.createdAt,
        })
        .from(membership)
        .innerJoin(user, eq(user.id, membership.userId))
        .innerJoin(profile, eq(profile.userId, user.id))
        .where(and(eq(membership.workspaceId, workspaceId), ilike(user.name, `%${q}%`)))
        .orderBy(asc(user.name), asc(user.id))
        .offset(offset)
        .limit(limit + 1);
      return {
        members: rows
          .slice(0, limit)
          .map((row) => ({ ...row, joinedAt: row.joinedAt.toISOString() })),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    },
    async changeRole(
      workspaceId: string,
      actorId: string,
      targetId: string,
      next: Exclude<Role, "owner">,
    ) {
      await withAccess(workspaceId, actorId, async (tx, _ws, actor) => {
        const target = await findMembership(tx, workspaceId, targetId);
        if (!target) missing();
        if (actorId === targetId || !canChangeRole(actor.role, target.role, next)) denied();
        await tx
          .update(membership)
          .set({ role: next })
          .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, targetId)));
        await roleChanged?.(tx, workspaceId, targetId);
        await audit(tx, workspaceId, actorId, `member.role.${next}`, targetId);
      });
    },
    async remove(workspaceId: string, actorId: string, targetId: string) {
      await withAccess(workspaceId, actorId, async (tx, _ws, actor) => {
        const target = await findMembership(tx, workspaceId, targetId);
        if (!target) missing();
        if (actorId === targetId || !canRemoveMember(actor.role, target.role)) denied();
        await revokeAccess?.(tx, workspaceId, targetId);
        await tx
          .delete(membership)
          .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, targetId)));
        await tx
          .update(profile)
          .set({ activeWorkspaceId: null })
          .where(and(eq(profile.userId, targetId), eq(profile.activeWorkspaceId, workspaceId)));
        await audit(tx, workspaceId, actorId, "member.removed", targetId);
      });
    },
    async leave(workspaceId: string, userId: string) {
      await withAccess(workspaceId, userId, async (tx, _ws, member) => {
        if (member.role === "owner")
          throw new AppError(
            409,
            "OWNER_REQUIRED",
            "Transfer ownership before leaving this workspace.",
          );
        await revokeAccess?.(tx, workspaceId, userId);
        await tx
          .delete(membership)
          .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, userId)));
        await tx
          .update(profile)
          .set({ activeWorkspaceId: null })
          .where(and(eq(profile.userId, userId), eq(profile.activeWorkspaceId, workspaceId)));
        await audit(tx, workspaceId, userId, "member.left", userId);
      });
    },
    async transfer(workspaceId: string, actorId: string, targetId: string) {
      await withAccess(workspaceId, actorId, async (tx, ws, member) => {
        if (member.role !== "owner" || actorId === targetId) denied();
        if (ws.personalOwnerId)
          throw new AppError(
            400,
            "PERSONAL_WORKSPACE",
            "Personal workspace ownership cannot be transferred.",
          );
        if (!(await findMembership(tx, workspaceId, targetId))) missing();
        await tx
          .update(membership)
          .set({ role: "admin" })
          .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, actorId)));
        await tx
          .update(membership)
          .set({ role: "owner" })
          .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, targetId)));
        await audit(tx, workspaceId, actorId, "workspace.ownership.transferred", targetId);
      });
    },
    async invite(
      workspaceId: string,
      actorId: string,
      email: string,
      role: "member" | "moderator",
    ) {
      return withAccess(workspaceId, actorId, async (tx, _ws, member) => {
        if (!canInviteRole(member.role, role)) denied();
        const pending = await tx
          .select({ id: invitation.id })
          .from(invitation)
          .where(
            and(
              eq(invitation.workspaceId, workspaceId),
              isNull(invitation.acceptedAt),
              isNull(invitation.revokedAt),
              gt(invitation.expiresAt, new Date()),
            ),
          )
          .limit(100);
        if (pending.length >= 100)
          throw new AppError(
            409,
            "INVITATION_LIMIT",
            "Revoke unused invitations before creating more.",
          );
        // Reissuing an invitation revokes the previous link for the same address.
        await tx
          .update(invitation)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(invitation.workspaceId, workspaceId),
              eq(invitation.email, email),
              isNull(invitation.acceptedAt),
              isNull(invitation.revokedAt),
            ),
          );
        const token = randomBytes(32).toString("hex");
        const [result] = await tx
          .insert(invitation)
          .values({
            workspaceId,
            invitedBy: actorId,
            email,
            role,
            tokenHash: tokenHash(token),
            expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
          })
          .returning();
        if (!result) throw new Error("Invitation insert failed");
        await audit(tx, workspaceId, actorId, "invitation.created", result.id);
        return {
          id: result.id,
          email: result.email,
          role: result.role,
          expiresAt: result.expiresAt.toISOString(),
          createdAt: result.createdAt.toISOString(),
          token,
        };
      });
    },
    async invitations(workspaceId: string, userId: string) {
      const { member } = await requireAccess(workspaceId, userId);
      if (member.role === "member") denied();
      const rows = await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        })
        .from(invitation)
        .where(
          and(
            eq(invitation.workspaceId, workspaceId),
            isNull(invitation.acceptedAt),
            isNull(invitation.revokedAt),
            gt(invitation.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(invitation.createdAt))
        .limit(100);
      return rows.map((row) => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }));
    },
    async revoke(workspaceId: string, userId: string, invitationId: string) {
      await withAccess(workspaceId, userId, async (tx, _ws, member) => {
        const [item] = await tx
          .select()
          .from(invitation)
          .where(
            and(
              eq(invitation.id, invitationId),
              eq(invitation.workspaceId, workspaceId),
              isNull(invitation.acceptedAt),
              isNull(invitation.revokedAt),
            ),
          );
        if (!item) missing();
        if (!canInviteRole(member.role, item.role)) denied();
        await tx
          .update(invitation)
          .set({ revokedAt: new Date() })
          .where(eq(invitation.id, invitationId));
        await audit(tx, workspaceId, userId, "invitation.revoked", invitationId);
      });
    },
    async preview(token: string, currentUser: SessionUser) {
      const [item] = await db
        .select({ invite: invitation, workspaceName: workspace.name })
        .from(invitation)
        .innerJoin(workspace, eq(workspace.id, invitation.workspaceId))
        .where(eq(invitation.tokenHash, tokenHash(token)));
      if (
        !item ||
        item.invite.email !== currentUser.email.toLowerCase() ||
        item.invite.acceptedAt ||
        item.invite.revokedAt ||
        item.invite.expiresAt <= new Date()
      )
        missing();
      return {
        workspaceName: item.workspaceName,
        role: item.invite.role,
        expiresAt: item.invite.expiresAt.toISOString(),
      };
    },
    async decline(token: string, currentUser: SessionUser) {
      const [lookup] = await db
        .select({ workspaceId: invitation.workspaceId })
        .from(invitation)
        .where(eq(invitation.tokenHash, tokenHash(token)));
      if (!lookup) missing();
      return db.transaction(async (tx) => {
        await tx
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.id, lookup.workspaceId))
          .for("update");
        const [item] = await tx
          .select()
          .from(invitation)
          .where(eq(invitation.tokenHash, tokenHash(token)));
        if (
          !item ||
          item.email !== currentUser.email.toLowerCase() ||
          item.revokedAt ||
          item.acceptedAt ||
          item.expiresAt <= new Date()
        )
          missing();
        await tx
          .update(invitation)
          .set({ revokedAt: new Date() })
          .where(eq(invitation.id, item.id));
        await audit(tx, item.workspaceId, currentUser.id, "invitation.declined", item.id);
        return { ok: true as const };
      });
    },
    async accept(token: string, currentUser: SessionUser) {
      if (!currentUser.emailVerified)
        throw new AppError(
          403,
          "EMAIL_NOT_VERIFIED",
          "Verify your email before accepting a workspace invitation.",
        );
      // Resolve only the lock key first, then re-read the invitation under the shared workspace lock.
      const [lookup] = await db
        .select({ workspaceId: invitation.workspaceId })
        .from(invitation)
        .where(eq(invitation.tokenHash, tokenHash(token)));
      if (!lookup) missing();
      return db.transaction(async (tx) => {
        const [ws] = await tx
          .select()
          .from(workspace)
          .where(eq(workspace.id, lookup.workspaceId))
          .for("update");
        const [item] = await tx
          .select()
          .from(invitation)
          .where(eq(invitation.tokenHash, tokenHash(token)));
        if (
          !ws ||
          !item ||
          item.email !== currentUser.email.toLowerCase() ||
          item.revokedAt ||
          item.acceptedAt ||
          item.expiresAt <= new Date()
        )
          missing();
        // Revoking/demoting an inviter also invalidates their unused authority.
        const inviter = await findMembership(tx, item.workspaceId, item.invitedBy);
        if (!inviter || !canInviteRole(inviter.role, item.role)) missing();
        await tx
          .insert(membership)
          .values({ workspaceId: ws.id, userId: currentUser.id, role: item.role })
          .onConflictDoNothing();
        await tx
          .update(invitation)
          .set({ acceptedAt: new Date() })
          .where(eq(invitation.id, item.id));
        await tx
          .update(profile)
          .set({ activeWorkspaceId: ws.id })
          .where(eq(profile.userId, currentUser.id));
        await audit(tx, ws.id, currentUser.id, "invitation.accepted", item.id);
        const member = await findMembership(tx, ws.id, currentUser.id);
        if (!member) missing();
        return dto(ws, member.role);
      });
    },
    async activity(workspaceId: string, userId: string) {
      const { member } = await requireAccess(workspaceId, userId);
      if (!canManageSettings(member.role)) denied();
      const rows = await db
        .select({
          id: auditEvent.id,
          action: auditEvent.action,
          actorName: user.name,
          createdAt: auditEvent.createdAt,
        })
        .from(auditEvent)
        .leftJoin(user, eq(user.id, auditEvent.actorId))
        .where(eq(auditEvent.workspaceId, workspaceId))
        .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
        .limit(50);
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    },
  };
}
