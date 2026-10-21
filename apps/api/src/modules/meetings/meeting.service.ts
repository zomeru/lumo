import type {
  meetingInputSchema,
  calendarQuerySchema,
  meetingAvailabilityInputSchema,
  scheduledMeetingInputSchema,
} from "@lumo/contracts/collaboration";
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
import { and, eq, desc, inArray, asc, lt, gt, ne, sql, or, exists } from "drizzle-orm";
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
  status: item.status as "active" | "scheduled" | "ended" | "canceled",
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
    async calendar(
      workspaceId: string,
      userId: string,
      range: z.infer<typeof calendarQuerySchema>,
    ) {
      await workspaces.requireAccess(workspaceId, userId);
      const rows = await db
        .select({ item: meeting, hostName: user.name })
        .from(meeting)
        .innerJoin(user, eq(user.id, meeting.hostId))
        .where(
          and(
            eq(meeting.workspaceId, workspaceId),
            lt(meeting.startsAt, new Date(range.to)),
            gt(
              sql`${meeting.startsAt} + ${meeting.durationMinutes} * interval '1 minute'`,
              new Date(range.from),
            ),
          ),
        )
        .orderBy(asc(meeting.startsAt), asc(meeting.id))
        .offset(range.offset)
        .limit(range.limit + 1);
      return {
        meetings: rows
          .slice(0, range.limit)
          .map(({ item, hostName }) => ({ ...dto(item), hostName })),
        nextOffset: rows.length > range.limit ? range.offset + range.limit : null,
      };
    },
    async calendarDetail(workspaceId: string, userId: string, id: string) {
      await workspaces.requireAccess(workspaceId, userId);
      const [item] = await db
        .select()
        .from(meeting)
        .where(and(eq(meeting.id, id), eq(meeting.workspaceId, workspaceId)));
      if (!item) missing();
      const [host] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, item.hostId));
      return { ...(await this.detail(id, userId)), hostName: host!.name };
    },
    async availability(
      workspaceId: string,
      userId: string,
      input: z.infer<typeof meetingAvailabilityInputSchema>,
    ) {
      await workspaces.requireAccess(workspaceId, userId);
      const ids = [...new Set([userId, ...input.participantIds])];
      const eligible = await db
        .select({ id: membership.userId })
        .from(membership)
        .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, ids)));
      if (eligible.length !== ids.length) missing();
      const attendees = db
        .select({ id: meetingParticipant.userId })
        .from(meetingParticipant)
        .where(
          and(
            eq(meetingParticipant.meetingId, meeting.id),
            inArray(meetingParticipant.userId, ids),
          ),
        );
      const rows = await db
        .select()
        .from(meeting)
        .where(
          and(
            eq(meeting.workspaceId, workspaceId),
            inArray(meeting.status, ["scheduled", "active"]),
            input.excludeMeetingId ? ne(meeting.id, input.excludeMeetingId) : undefined,
            lt(meeting.startsAt, new Date(input.to)),
            gt(
              sql`${meeting.startsAt} + ${meeting.durationMinutes} * interval '1 minute'`,
              new Date(input.from),
            ),
            or(inArray(meeting.hostId, ids), exists(attendees)),
          ),
        )
        .orderBy(asc(meeting.startsAt), asc(meeting.id));
      const participants = rows.length
        ? await db
            .select()
            .from(meetingParticipant)
            .where(
              and(
                inArray(
                  meetingParticipant.meetingId,
                  rows.map((item) => item.id),
                ),
                inArray(meetingParticipant.userId, ids),
              ),
            )
        : [];
      return {
        conflicts: rows.map((item) => ({
          id: item.id,
          title: item.title,
          startsAt: item.startsAt!.toISOString(),
          endsAt: new Date(item.startsAt!.getTime() + item.durationMinutes * 60000).toISOString(),
          userIds: [
            ...new Set([
              ...(ids.includes(item.hostId) ? [item.hostId] : []),
              ...participants.filter((p) => p.meetingId === item.id).map((p) => p.userId),
            ]),
          ],
        })),
      };
    },
    async update(
      workspaceId: string,
      userId: string,
      id: string,
      input: z.infer<typeof scheduledMeetingInputSchema>,
    ) {
      return workspaces.withAccess(workspaceId, userId, async (tx) => {
        const [item] = await tx
          .select()
          .from(meeting)
          .where(and(eq(meeting.id, id), eq(meeting.workspaceId, workspaceId)))
          .for("update");
        if (!item) missing();
        if (item.hostId !== userId) denied();
        if (
          item.status !== "scheduled" ||
          !item.startsAt ||
          item.startsAt.getTime() + item.durationMinutes * 60000 <= Date.now()
        )
          throw new AppError(
            409,
            "INVALID_STATE",
            "Only upcoming scheduled meetings can be edited.",
          );
        if (new Date(input.startsAt) <= new Date())
          throw new AppError(400, "INVALID_TIME", "Schedule a future start time.");
        const ids = [...new Set(input.participantIds)];
        if (ids.length) {
          const eligible = await tx
            .select()
            .from(membership)
            .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, ids)));
          if (eligible.length !== ids.length) missing();
        }
        const { participantIds: _ids, startsAt, ...rest } = input;
        const [updated] = await tx
          .update(meeting)
          .set({ ...rest, startsAt: new Date(startsAt) })
          .where(eq(meeting.id, id))
          .returning();
        await tx.delete(meetingParticipant).where(eq(meetingParticipant.meetingId, id));
        if (ids.length)
          await tx
            .insert(meetingParticipant)
            .values(ids.map((person) => ({ meetingId: id, userId: person, invited: true })));
        await tx
          .insert(auditEvent)
          .values({ workspaceId, actorId: userId, action: "meeting.updated", targetId: id });
        return dto(updated!);
      });
    },
    async cancel(workspaceId: string, userId: string, id: string) {
      return workspaces.withAccess(workspaceId, userId, async (tx) => {
        const [item] = await tx
          .select()
          .from(meeting)
          .where(and(eq(meeting.id, id), eq(meeting.workspaceId, workspaceId)))
          .for("update");
        if (!item) missing();
        if (item.hostId !== userId) denied();
        if (item.status !== "scheduled")
          throw new AppError(409, "INVALID_STATE", "Only scheduled meetings can be canceled.");
        await tx
          .update(meeting)
          .set({ status: "canceled", endedAt: new Date() })
          .where(eq(meeting.id, id));
        await tx
          .insert(auditEvent)
          .values({ workspaceId, actorId: userId, action: "meeting.canceled", targetId: id });
      });
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
        if (
          !item ||
          item.status === "ended" ||
          item.status === "canceled" ||
          (item.status === "scheduled" &&
            item.startsAt &&
            item.startsAt.getTime() + item.durationMinutes * 60000 <= Date.now())
        )
          throw new AppError(409, "MEETING_ENDED", "This meeting has ended or was canceled.");
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
        const [currentMeeting] = await tx
          .select()
          .from(meeting)
          .where(eq(meeting.id, id))
          .for("update");
        if (currentMeeting?.status === "canceled")
          throw new AppError(409, "INVALID_STATE", "This meeting was canceled.");
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
