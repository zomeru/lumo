import type { conversationInputSchema } from "@lumo/contracts/collaboration";
import type { Database } from "@lumo/database";
import { conversation, conversationMember, membership, user } from "@lumo/database/schema";
import { chatIdentity } from "@lumo/shared";
import { and, eq, desc, inArray } from "drizzle-orm";
import type { z } from "zod";

import type { CollaborationProvider } from "../../integrations/agora";
import { AppError, missing } from "../../lib/errors";
import type { createWorkspaceService } from "../workspaces/workspace.service";
export function createMessengerService(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  provider: CollaborationProvider,
) {
  async function requireConversation(workspaceId: string, userId: string, id: string) {
    await workspaces.requireAccess(workspaceId, userId);
    const [item] = await db
      .select({ conversation })
      .from(conversation)
      .innerJoin(
        conversationMember,
        and(
          eq(conversationMember.conversationId, conversation.id),
          eq(conversationMember.userId, userId),
        ),
      )
      .where(and(eq(conversation.workspaceId, workspaceId), eq(conversation.id, id)));
    if (!item) missing();
    return item.conversation;
  }
  async function dto(item: typeof conversation.$inferSelect) {
    const members = await db
      .select({ id: conversationMember.userId })
      .from(conversationMember)
      .where(eq(conversationMember.conversationId, item.id));
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      kind: item.kind as "direct" | "group",
      name: item.name,
      createdAt: item.createdAt.toISOString(),
      memberIds: members.map((member) => member.id),
      providerGroupId: item.providerGroupId,
    };
  }
  return {
    async get(workspaceId: string, userId: string, id: string) {
      return dto(await requireConversation(workspaceId, userId, id));
    },
    async list(workspaceId: string, userId: string, offset: number, limit: number) {
      await workspaces.requireAccess(workspaceId, userId);
      const rows = await db
        .select({ conversation })
        .from(conversation)
        .innerJoin(
          conversationMember,
          and(
            eq(conversationMember.conversationId, conversation.id),
            eq(conversationMember.userId, userId),
          ),
        )
        .where(eq(conversation.workspaceId, workspaceId))
        .orderBy(desc(conversation.createdAt), desc(conversation.id))
        .offset(offset)
        .limit(limit + 1);
      const selected = rows.slice(0, limit).map((row) => row.conversation);
      const members = selected.length
        ? await db
            .select({
              conversationId: conversationMember.conversationId,
              userId: conversationMember.userId,
            })
            .from(conversationMember)
            .where(
              inArray(
                conversationMember.conversationId,
                selected.map((item) => item.id),
              ),
            )
        : [];
      return {
        conversations: selected.map((item) => ({
          id: item.id,
          workspaceId: item.workspaceId,
          kind: item.kind as "direct" | "group",
          name: item.name,
          createdAt: item.createdAt.toISOString(),
          providerGroupId: item.providerGroupId,
          memberIds: members
            .filter((member) => member.conversationId === item.id)
            .map((member) => member.userId),
        })),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    },
    async create(
      workspaceId: string,
      userId: string,
      input: z.infer<typeof conversationInputSchema>,
    ) {
      return workspaces.withAccess(workspaceId, userId, async (tx) => {
        const ids = [...new Set([userId, ...input.memberIds])].sort();
        if (
          (input.kind === "direct" && ids.length !== 2) ||
          (input.kind === "group" && ids.length < 2)
        )
          throw new AppError(400, "INVALID_PARTICIPANTS", "Select eligible workspace members.");
        const eligible = await tx
          .select({ id: membership.userId })
          .from(membership)
          .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, ids)));
        if (eligible.length !== ids.length) missing();
        const directKey = input.kind === "direct" ? ids.join(":") : null;
        if (directKey) {
          const [existing] = await tx
            .select()
            .from(conversation)
            .where(
              and(eq(conversation.workspaceId, workspaceId), eq(conversation.directKey, directKey)),
            );
          if (existing) return dto(existing);
        }
        // Names are obtained from the real directory for DMs, never caller-supplied identities.
        const names = await tx.select({ name: user.name }).from(user).where(inArray(user.id, ids));
        const [item] = await tx
          .insert(conversation)
          .values({
            workspaceId,
            createdBy: userId,
            kind: input.kind,
            name: input.kind === "direct" ? names.map((row) => row.name).join(" & ") : input.name,
            directKey,
          })
          .returning();
        if (!item) throw new Error("Conversation insert failed");
        await tx
          .insert(conversationMember)
          .values(ids.map((id) => ({ workspaceId, conversationId: item.id, userId: id })));
        return {
          id: item.id,
          workspaceId,
          kind: input.kind,
          name: item.name,
          createdAt: item.createdAt.toISOString(),
          memberIds: ids,
          providerGroupId: null,
        };
      });
    },
    async credentials(workspaceId: string, userId: string, id: string) {
      return workspaces.withAccess(workspaceId, userId, async (tx) => {
        const item = await requireConversation(workspaceId, userId, id);
        const identity = chatIdentity(workspaceId, userId);
        const uuid = await provider.chatUser(identity);
        let groupId = item.providerGroupId;
        if (!groupId) {
          const members = await tx
            .select({ id: conversationMember.userId })
            .from(conversationMember)
            .where(eq(conversationMember.conversationId, id));
          groupId = await provider.createGroup(
            item.name,
            members.map((member) => chatIdentity(workspaceId, member.id)),
          );
          await tx
            .update(conversation)
            .set({ providerGroupId: groupId })
            .where(eq(conversation.id, id));
        }
        return { ...provider.chatToken(uuid), identity, groupId };
      });
    },
    async read(workspaceId: string, userId: string, id: string) {
      await requireConversation(workspaceId, userId, id);
      await db
        .update(conversationMember)
        .set({ lastReadAt: new Date() })
        .where(
          and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, userId)),
        );
    },
  };
}
