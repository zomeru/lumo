import type { meetingInputSchema } from "@lumo/contracts/collaboration";
import type { Database } from "@lumo/database";
import {
  meeting,
  meetingParticipant,
  membership,
  user,
  auditEvent,
  workspace,
} from "@lumo/database/schema";
import { rtcIdentity } from "@lumo/shared";
import { and, eq, desc, inArray } from "drizzle-orm";
import type { z } from "zod";

import type { CollaborationProvider } from "../../integrations/agora";
import { AppError, denied, missing } from "../../lib/errors";
import type { createWorkspaceService } from "../workspaces/workspace.service";
const dto = (item: typeof meeting.$inferSelect) => ({
  id: item.id,
  hostId: item.hostId,
  title: item.title,
  description: item.description,
  access: item.access as "open" | "workspace",
  status: item.status as "active" | "scheduled" | "ended",
  startsAt: item.startsAt?.toISOString() ?? null,
  timezone: item.timezone,
  durationMinutes: item.durationMinutes,
  createdAt: item.createdAt.toISOString(),
});
export function createMeetingService(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  provider: CollaborationProvider,
) {
  async function access(id: string, userId: string) {
    const [item] = await db.select().from(meeting).where(eq(meeting.id, id));
    if (!item) missing();
    if (item.access === "workspace") await workspaces.requireAccess(item.workspaceId, userId);
    return item;
  }
  return {
    async list(workspaceId: string, userId: string, offset: number, limit: number) {
      await workspaces.requireAccess(workspaceId, userId);
      const rows = await db
        .select()
        .from(meeting)
        .where(eq(meeting.workspaceId, workspaceId))
        .orderBy(desc(meeting.createdAt), desc(meeting.id))
        .offset(offset)
        .limit(limit + 1);
      return {
        meetings: rows.slice(0, limit).map(dto),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    },
    async create(workspaceId: string, userId: string, input: z.infer<typeof meetingInputSchema>) {
      return workspaces.withAccess(workspaceId, userId, async (tx) => {
        const ids = [...new Set(input.participantIds)];
        if (ids.length) {
          const eligible = await tx
            .select()
            .from(membership)
            .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, ids)));
          if (eligible.length !== ids.length) missing();
        }
        if (input.startsAt && new Date(input.startsAt) <= new Date())
          throw new AppError(400, "INVALID_TIME", "Schedule a future start time.");
        const { participantIds: _ids, startsAt, ...rest } = input;
        const [item] = await tx
          .insert(meeting)
          .values({
            ...rest,
            workspaceId,
            hostId: userId,
            startsAt: startsAt ? new Date(startsAt) : null,
            status: startsAt ? "scheduled" : "active",
          })
          .returning();
        if (!item) throw new Error("Meeting insert failed");
        if (ids.length)
          await tx
            .insert(meetingParticipant)
            .values(ids.map((id) => ({ meetingId: item.id, userId: id, invited: true })));
        await tx
          .insert(auditEvent)
          .values({ workspaceId, actorId: userId, action: "meeting.created", targetId: item.id });
        return dto(item);
      });
    },
    async detail(id: string, userId: string) {
      const item = await access(id, userId);
      const participants = await db
        .select({
          userId: user.id,
          name: user.name,
          lastSeenAt: meetingParticipant.lastSeenAt,
          invited: meetingParticipant.invited,
        })
        .from(meetingParticipant)
        .innerJoin(user, eq(user.id, meetingParticipant.userId))
        .where(eq(meetingParticipant.meetingId, id))
        .limit(200);
      return {
        meeting: dto(item),
        participants: participants.map(({ lastSeenAt, ...person }) => ({
          ...person,
          online: Boolean(lastSeenAt && lastSeenAt.getTime() > Date.now() - 90000),
        })),
      };
    },
    async token(id: string, userId: string, screen = false) {
      const found = await access(id, userId);
      // Same workspace lock as membership revocation and ending. Open guests use it without conferring membership.
      return db.transaction(async (tx) => {
        await tx
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.id, found.workspaceId))
          .for("update");
        const [item] = await tx
          .select()
          .from(meeting)
          .where(eq(meeting.id, found.id))
          .for("update");
        if (!item || item.status === "ended")
          throw new AppError(409, "MEETING_ENDED", "This meeting has ended.");
        if (item.access === "workspace") {
          const [member] = await tx
            .select({ id: membership.userId })
            .from(membership)
            .where(
              and(eq(membership.workspaceId, item.workspaceId), eq(membership.userId, userId)),
            );
          if (!member) missing();
        }
        if (item.startsAt && item.startsAt.getTime() > Date.now() + 5 * 60000)
          throw new AppError(
            409,
            "MEETING_NOT_STARTED",
            "This meeting opens five minutes before its scheduled start.",
          );
        const credentials = provider.rtcToken(
          `m${item.id.replaceAll("-", "")}`,
          rtcIdentity(userId, screen),
        );
        if (!screen) {
          await tx
            .insert(meetingParticipant)
            .values({ meetingId: id, userId, joinedAt: new Date(), lastSeenAt: new Date() })
            .onConflictDoUpdate({
              target: [meetingParticipant.meetingId, meetingParticipant.userId],
              set: { joinedAt: new Date(), lastSeenAt: new Date() },
            });
          if (item.status === "scheduled")
            await tx.update(meeting).set({ status: "active" }).where(eq(meeting.id, id));
        }
        return credentials;
      });
    },
    async leave(id: string, userId: string) {
      await access(id, userId);
      await db
        .update(meetingParticipant)
        .set({ lastSeenAt: null })
        .where(and(eq(meetingParticipant.meetingId, id), eq(meetingParticipant.userId, userId)));
    },
    async end(id: string, userId: string) {
      const item = await access(id, userId);
      if (item.hostId !== userId) denied();
      await db.transaction(async (tx) => {
        await tx
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.id, item.workspaceId))
          .for("update");
        if (item.access === "workspace") {
          const [current] = await tx
            .select({ id: membership.userId })
            .from(membership)
            .where(
              and(eq(membership.workspaceId, item.workspaceId), eq(membership.userId, userId)),
            );
          if (!current) missing();
        }
        await tx
          .update(meeting)
          .set({ status: "ended", endedAt: new Date() })
          .where(eq(meeting.id, id));
        await tx
          .update(meetingParticipant)
          .set({ lastSeenAt: null })
          .where(eq(meetingParticipant.meetingId, id));
        await tx.insert(auditEvent).values({
          workspaceId: item.workspaceId,
          actorId: userId,
          action: "meeting.ended",
          targetId: id,
        });
      });
    },
  };
}
