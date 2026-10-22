import type { conversationInputSchema } from "@lumo/contracts/collaboration";
import type * as contracts from "@lumo/contracts/messenger";
import type { Database, Transaction } from "@lumo/database";
import {
  auditEvent,
  conversation,
  conversationMember,
  membership,
  user,
  messengerMessage as message,
  messengerReaction as reaction,
  messengerAttachment as attachment,
} from "@lumo/database/schema";
import { chatIdentity } from "@lumo/shared";
import {
  and,
  eq,
  desc,
  asc,
  inArray,
  or,
  sql,
  isNull,
  lt,
  gt,
  ilike,
  isNotNull,
  gte,
  lte,
} from "drizzle-orm";
import type { z } from "zod";

import type { CollaborationProvider } from "../../integrations/agora";
import { AppError, denied, missing } from "../../lib/errors";
import type { createWorkspaceService } from "../workspaces/workspace.service";

type Conversation = typeof conversation.$inferSelect;
type Member = typeof conversationMember.$inferSelect;
const conflict = (text: string): never => {
  throw new AppError(409, "MESSENGER_CONFLICT", text);
};
const slugFor = (name: string) => name.trim().toLowerCase().replace(/[ _]+/g, "-");
export function createMessengerService(
  _db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  provider: CollaborationProvider,
) {
  const visible = (actor: string) =>
    or(
      eq(conversation.visibility, "public"),
      sql`exists (select 1 from ${conversationMember} cm where cm.conversation_id = ${conversation.id} and cm.user_id = ${actor})`,
    )!;
  async function access(tx: Transaction, workspaceId: string, actor: string, id: string) {
    const [item] = await tx
      .select()
      .from(conversation)
      .where(
        and(eq(conversation.workspaceId, workspaceId), eq(conversation.id, id), visible(actor)),
      );
    if (!item) missing();
    const [member] = await tx
      .select()
      .from(conversationMember)
      .where(and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, actor)));
    return { item, member };
  }
  function canPost(item: Conversation, member: Member | undefined) {
    if (!member) denied();
    if (item.archivedAt) conflict("This channel is archived.");
    if (item.providerGroupId)
      conflict("Use the existing provider conversation for its preserved history.");
  }
  function manage(item: Conversation, member: Member | undefined) {
    if (item.kind !== "channel" || !member || !["owner", "manager"].includes(member.role)) denied();
  }
  async function notify(tx: Transaction, workspaceId: string) {
    // No names, IDs of private resources, bodies or previews in notifications.
    await tx.execute(sql`select pg_notify('lumo_messenger', ${workspaceId})`);
  }
  async function audit(
    tx: Transaction,
    workspaceId: string,
    actorId: string,
    action: string,
    _targetId: string,
  ) {
    await tx
      .insert(auditEvent)
      .values({ workspaceId, actorId, action: `messenger.${action}`, targetId: undefined });
    await notify(tx, workspaceId);
  }
  async function dtos(tx: Transaction, items: Conversation[], actor: string) {
    if (!items.length) return [];
    const ids = items.map((v) => v.id);
    const members = await tx
      .select()
      .from(conversationMember)
      .where(inArray(conversationMember.conversationId, ids));
    const stats = await tx
      .select({
        conversationId: message.conversationId,
        unread: sql<number>`count(*) filter (where ${message.senderId} <> ${actor} and ${message.sequence} > coalesce(${conversationMember.lastReadSequence},0) and ${message.deletedAt} is null)::int`,
        mentions: sql<number>`count(*) filter (where ${message.senderId} <> ${actor} and ${message.sequence} > coalesce(${conversationMember.lastReadSequence},0) and ${message.deletedAt} is null and ${actor}::uuid = any(${message.mentionIds}))::int`,
      })
      .from(message)
      .leftJoin(
        conversationMember,
        and(
          eq(conversationMember.conversationId, message.conversationId),
          eq(conversationMember.userId, actor),
        ),
      )
      .where(inArray(message.conversationId, ids))
      .groupBy(message.conversationId);
    const latest = await tx
      .selectDistinctOn([message.conversationId], {
        conversationId: message.conversationId,
        body: message.body,
      })
      .from(message)
      .where(and(inArray(message.conversationId, ids), isNull(message.deletedAt)))
      .orderBy(message.conversationId, desc(message.sequence));
    return items.map((item) => {
      const own = members.find((m) => m.conversationId === item.id && m.userId === actor),
        counts = stats.find((m) => m.conversationId === item.id);
      return {
        ...item,
        kind: item.kind as "direct" | "group" | "channel",
        createdAt: item.createdAt.toISOString(),
        archivedAt: item.archivedAt?.toISOString() ?? null,
        memberIds: members.filter((m) => m.conversationId === item.id).map((m) => m.userId),
        joined: Boolean(own),
        role: own?.role ?? null,
        notifications: own?.notifications ?? "all",
        unread: own ? (counts?.unread ?? 0) : 0,
        mentions: own ? (counts?.mentions ?? 0) : 0,
        lastMessage: latest.find((m) => m.conversationId === item.id)?.body.slice(0, 150) ?? null,
      };
    });
  }
  async function get(workspaceId: string, actor: string, id: string) {
    return workspaces.withAccess(
      workspaceId,
      actor,
      async (tx) => (await dtos(tx, [(await access(tx, workspaceId, actor, id)).item], actor))[0]!,
    );
  }
  async function scoped<T>(
    workspaceId: string,
    actor: string,
    id: string,
    action: (tx: Transaction, item: Conversation, member: Member | undefined) => Promise<T>,
  ) {
    return workspaces.withAccess(workspaceId, actor, async (tx) => {
      const { item, member } = await access(tx, workspaceId, actor, id);
      return action(tx, item, member);
    });
  }
  async function eligible(tx: Transaction, workspaceId: string, ids: string[]) {
    const rows = await tx
      .select({ id: membership.userId })
      .from(membership)
      .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, ids)));
    if (rows.length !== ids.length) missing();
  }
  async function messageDtos(
    tx: Transaction,
    rows: (typeof message.$inferSelect)[],
    actor: string,
  ) {
    if (!rows.length) return [];
    const ids = rows.map((v) => v.id),
      senderIds = [...new Set(rows.map((v) => v.senderId))];
    const [senders, reactions, attachments, replies] = await Promise.all([
      tx
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, senderIds)),
      tx.select().from(reaction).where(inArray(reaction.messageId, ids)),
      tx
        .select()
        .from(attachment)
        .where(and(inArray(attachment.messageId, ids), eq(attachment.state, "ready"))),
      tx
        .select({ parentId: message.parentId, count: sql<number>`count(*)::int` })
        .from(message)
        .where(inArray(message.parentId, ids))
        .groupBy(message.parentId),
    ]);
    return rows.map((row) => {
      const sender = senders.find((v) => v.id === row.senderId)!;
      const ownReactions = row.deletedAt ? [] : reactions.filter((v) => v.messageId === row.id);
      return {
        ...row,
        body: row.deletedAt ? "" : row.body,
        mentionIds: row.deletedAt ? [] : row.mentionIds,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        pinnedAt: row.deletedAt ? null : (row.pinnedAt?.toISOString() ?? null),
        senderName: sender.name,
        senderImage: sender.image,
        replies: replies.find((v) => v.parentId === row.id)?.count ?? 0,
        reactions: [...new Set(ownReactions.map((v) => v.emoji))].map((emoji) => ({
          emoji,
          count: ownReactions.filter((v) => v.emoji === emoji).length,
          mine: ownReactions.some((v) => v.emoji === emoji && v.userId === actor),
        })),
        attachments: row.deletedAt
          ? []
          : attachments
              .filter((v) => v.messageId === row.id)
              .map(({ id, name, mimeType, size }) => ({
                id,
                name,
                mimeType,
                size,
                scanStatus: "unscanned" as const,
              })),
      };
    });
  }
  async function findMessage(tx: Transaction, workspaceId: string, id: string) {
    const [row] = await tx
      .select()
      .from(message)
      .where(and(eq(message.workspaceId, workspaceId), eq(message.id, id)));
    if (!row) missing();
    return row;
  }
  return {
    get,
    scoped,
    canPost,
    notify,
    async list(
      workspaceId: string,
      actor: string,
      offset: number,
      limit: number,
      browse = false,
      q = "",
    ) {
      return workspaces.withAccess(workspaceId, actor, async (tx) => {
        const rows = await tx
          .select()
          .from(conversation)
          .where(
            and(
              eq(conversation.workspaceId, workspaceId),
              visible(actor),
              browse
                ? eq(conversation.kind, "channel")
                : sql`exists (select 1 from ${conversationMember} cm where cm.conversation_id = ${conversation.id} and cm.user_id = ${actor})`,
              q
                ? or(ilike(conversation.name, `%${q}%`), ilike(conversation.description, `%${q}%`))
                : undefined,
            ),
          )
          .orderBy(
            desc(
              sql`coalesce((select max(m.created_at) from ${message} m where m.conversation_id = ${conversation.id}),${conversation.createdAt})`,
            ),
            desc(conversation.id),
          )
          .offset(offset)
          .limit(limit + 1);
        return {
          conversations: await dtos(tx, rows.slice(0, limit), actor),
          nextOffset: rows.length > limit ? offset + limit : null,
        };
      });
    },
    async create(
      workspaceId: string,
      actor: string,
      input: z.infer<typeof conversationInputSchema>,
    ) {
      return workspaces.withAccess(workspaceId, actor, async (tx) => {
        const ids = [...new Set([actor, ...input.memberIds])].sort();
        if ((input.kind === "direct" && ids.length !== 2) || ids.length < 2)
          throw new AppError(400, "INVALID_PARTICIPANTS", "Select eligible workspace members.");
        await eligible(tx, workspaceId, ids);
        const directKey = input.kind === "direct" ? ids.join(":") : null;
        if (directKey) {
          const [existing] = await tx
            .select()
            .from(conversation)
            .where(
              and(eq(conversation.workspaceId, workspaceId), eq(conversation.directKey, directKey)),
            );
          if (existing) return (await dtos(tx, [existing], actor))[0]!;
        }
        const names = await tx.select({ name: user.name }).from(user).where(inArray(user.id, ids));
        const [item] = await tx
          .insert(conversation)
          .values({
            workspaceId,
            createdBy: actor,
            kind: input.kind,
            name: input.kind === "direct" ? names.map((v) => v.name).join(" & ") : input.name,
            directKey,
          })
          .returning();
        await tx.insert(conversationMember).values(
          ids.map((userId) => ({
            workspaceId,
            conversationId: item!.id,
            userId,
            role: userId === actor ? ("owner" as const) : ("member" as const),
          })),
        );
        await notify(tx, workspaceId);
        return (await dtos(tx, [item!], actor))[0]!;
      });
    },
    async createChannel(
      workspaceId: string,
      actor: string,
      input: z.infer<typeof contracts.channelInputSchema>,
    ) {
      return workspaces.withAccess(workspaceId, actor, async (tx) => {
        const ids = [...new Set([actor, ...input.memberIds])];
        await eligible(tx, workspaceId, ids);
        const slug = slugFor(input.name),
          [existing] = await tx
            .select({ id: conversation.id })
            .from(conversation)
            .where(and(eq(conversation.workspaceId, workspaceId), eq(conversation.slug, slug)));
        if (existing) conflict("A channel with this name already exists.");
        const [item] = await tx
          .insert(conversation)
          .values({
            workspaceId,
            createdBy: actor,
            kind: "channel",
            name: input.name,
            description: input.description,
            visibility: input.visibility,
            slug,
          })
          .returning();
        await tx.insert(conversationMember).values(
          ids.map((userId) => ({
            workspaceId,
            conversationId: item!.id,
            userId,
            role: userId === actor ? ("owner" as const) : ("member" as const),
          })),
        );
        await audit(tx, workspaceId, actor, "channel.created", item!.id);
        return (await dtos(tx, [item!], actor))[0]!;
      });
    },
    async update(
      workspaceId: string,
      actor: string,
      id: string,
      input: z.infer<typeof contracts.channelUpdateSchema>,
    ) {
      return scoped(workspaceId, actor, id, async (tx, item, member) => {
        manage(item, member);
        const slug = input.name ? slugFor(input.name) : item.slug;
        const [existing] = await tx
          .select({ id: conversation.id })
          .from(conversation)
          .where(and(eq(conversation.workspaceId, workspaceId), eq(conversation.slug, slug!)));
        if (existing && existing.id !== id) conflict("A channel with this name already exists.");
        const [updated] = await tx
          .update(conversation)
          .set({
            name: input.name,
            description: input.description,
            slug,
            archivedAt:
              input.archived === undefined ? item.archivedAt : input.archived ? new Date() : null,
          })
          .where(eq(conversation.id, id))
          .returning();
        await audit(tx, workspaceId, actor, "channel.updated", id);
        return (await dtos(tx, [updated!], actor))[0]!;
      });
    },
    async join(workspaceId: string, actor: string, id: string) {
      return scoped(workspaceId, actor, id, async (tx, item) => {
        if (item.kind !== "channel" || item.visibility !== "public") missing();
        if (item.archivedAt) conflict("This channel is archived.");
        await tx
          .insert(conversationMember)
          .values({ workspaceId, conversationId: id, userId: actor })
          .onConflictDoNothing();
        await notify(tx, workspaceId);
      });
    },
    async leave(workspaceId: string, actor: string, id: string) {
      return scoped(workspaceId, actor, id, async (tx, item, member) => {
        if (!member) missing();
        if (item.kind === "channel" && member.role === "owner")
          conflict("Transfer channel ownership before leaving.");
        if (item.providerGroupId)
          await provider.removeMember(item.providerGroupId, chatIdentity(workspaceId, actor));
        await tx
          .delete(conversationMember)
          .where(
            and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, actor)),
          );
        if (item.kind === "direct")
          await tx.update(conversation).set({ directKey: null }).where(eq(conversation.id, id));
        await notify(tx, workspaceId);
      });
    },
    async members(workspaceId: string, actor: string, id: string, offset: number, limit: number) {
      return scoped(workspaceId, actor, id, async (tx) => {
        const rows = await tx
          .select({
            userId: user.id,
            name: user.name,
            image: user.image,
            role: conversationMember.role,
          })
          .from(conversationMember)
          .innerJoin(user, eq(user.id, conversationMember.userId))
          .where(eq(conversationMember.conversationId, id))
          .orderBy(asc(user.name), asc(user.id))
          .offset(offset)
          .limit(limit + 1);
        return {
          members: rows.slice(0, limit),
          nextOffset: rows.length > limit ? offset + limit : null,
        };
      });
    },
    async member(
      workspaceId: string,
      actor: string,
      id: string,
      target: string,
      role: "owner" | "manager" | "member" | null,
    ) {
      return scoped(workspaceId, actor, id, async (tx, item, own) => {
        manage(item, own);
        if (item.archivedAt) conflict("Unarchive this channel before changing members.");
        await eligible(tx, workspaceId, [target]);
        const [previous] = await tx
          .select()
          .from(conversationMember)
          .where(
            and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, target)),
          );
        if (
          previous?.role === "owner" ||
          (role !== "member" && own?.role !== "owner") ||
          (previous?.role === "manager" && own?.role !== "owner")
        )
          denied();
        if (role === null)
          await tx
            .delete(conversationMember)
            .where(
              and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, target)),
            );
        else {
          await tx
            .insert(conversationMember)
            .values({ workspaceId, conversationId: id, userId: target, role })
            .onConflictDoUpdate({
              target: [conversationMember.conversationId, conversationMember.userId],
              set: { role },
            });
          if (role === "owner")
            await tx
              .update(conversationMember)
              .set({ role: "manager" })
              .where(
                and(
                  eq(conversationMember.conversationId, id),
                  eq(conversationMember.userId, actor),
                ),
              );
        }
        await audit(tx, workspaceId, actor, "channel.membership_changed", id);
      });
    },
    async preferences(
      workspaceId: string,
      actor: string,
      id: string,
      notifications: Member["notifications"],
    ) {
      return scoped(workspaceId, actor, id, async (tx, _item, member) => {
        if (!member) missing();
        await tx
          .update(conversationMember)
          .set({ notifications })
          .where(
            and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, actor)),
          );
        await notify(tx, workspaceId);
      });
    },
    async credentials(workspaceId: string, actor: string, id: string) {
      return scoped(workspaceId, actor, id, async (tx, item, member) => {
        if (!member || item.kind === "channel") missing();
        const [stored] = await tx
          .select({ id: message.id })
          .from(message)
          .where(eq(message.conversationId, id))
          .limit(1);
        if (stored) conflict("This conversation uses Lumo messaging.");
        const identity = chatIdentity(workspaceId, actor),
          uuid = await provider.chatUser(identity);
        let groupId = item.providerGroupId;
        if (!groupId) {
          const members = await tx
            .select({ id: conversationMember.userId })
            .from(conversationMember)
            .where(eq(conversationMember.conversationId, id));
          groupId = await provider.createGroup(
            item.name,
            members.map((m) => chatIdentity(workspaceId, m.id)),
          );
          await tx
            .update(conversation)
            .set({ providerGroupId: groupId })
            .where(eq(conversation.id, id));
        }
        return { ...provider.chatToken(uuid), identity, groupId };
      });
    },
    async read(workspaceId: string, actor: string, id: string, messageId?: string) {
      return scoped(workspaceId, actor, id, async (tx, _item, member) => {
        if (!member) return;
        let sequence = member.lastReadSequence;
        if (messageId) {
          const row = await findMessage(tx, workspaceId, messageId);
          if (row.conversationId !== id) missing();
          sequence = Math.max(sequence, row.sequence);
        }
        await tx
          .update(conversationMember)
          .set({ lastReadAt: new Date(), lastReadSequence: sequence })
          .where(
            and(eq(conversationMember.conversationId, id), eq(conversationMember.userId, actor)),
          );
        await notify(tx, workspaceId);
      });
    },
    async history(
      workspaceId: string,
      actor: string,
      id: string,
      input: z.infer<typeof contracts.messengerHistoryQuerySchema>,
    ) {
      return scoped(workspaceId, actor, id, async (tx, item) => {
        if (item.providerGroupId) conflict("Use the preserved Agora conversation history.");
        let before = input.before,
          after = input.after;
        if (input.around) {
          const row = await findMessage(tx, workspaceId, input.around);
          if (row.conversationId !== id) missing();
          before = row.sequence + 1;
          after = undefined;
        }
        if (input.parentId) {
          const row = await findMessage(tx, workspaceId, input.parentId);
          if (row.conversationId !== id || row.parentId) missing();
        }
        const rows = await tx
          .select()
          .from(message)
          .where(
            and(
              eq(message.conversationId, id),
              input.parentId
                ? eq(message.parentId, input.parentId)
                : input.around
                  ? undefined
                  : isNull(message.parentId),
              before ? lt(message.sequence, before) : undefined,
              after !== undefined ? gt(message.sequence, after) : undefined,
              input.pinned
                ? and(isNotNull(message.pinnedAt), isNull(message.deletedAt))
                : undefined,
            ),
          )
          .orderBy(after !== undefined ? asc(message.sequence) : desc(message.sequence))
          .limit(input.limit + 1);
        const selected = rows.slice(0, input.limit);
        selected.sort((a, b) => a.sequence - b.sequence);
        return {
          messages: await messageDtos(tx, selected, actor),
          nextBefore: rows.length > input.limit ? selected[0]!.sequence : null,
        };
      });
    },
    async send(
      workspaceId: string,
      actor: string,
      id: string,
      input: z.infer<typeof contracts.messageInputSchema>,
    ) {
      return scoped(workspaceId, actor, id, async (tx, item, member) => {
        canPost(item, member);
        const [previous] = await tx
          .select()
          .from(message)
          .where(
            and(
              eq(message.conversationId, id),
              eq(message.senderId, actor),
              eq(message.nonce, input.nonce),
            ),
          );
        if (previous) return (await messageDtos(tx, [previous], actor))[0]!;
        if (input.parentId) {
          const parent = await findMessage(tx, workspaceId, input.parentId);
          if (parent.conversationId !== id || parent.parentId) missing();
        }
        const mentions = [...new Set(input.mentionIds)];
        if (mentions.length) {
          await eligible(tx, workspaceId, mentions);
          if (item.visibility !== "public") {
            const members = await tx
              .select()
              .from(conversationMember)
              .where(
                and(
                  eq(conversationMember.conversationId, id),
                  inArray(conversationMember.userId, mentions),
                ),
              );
            if (members.length !== mentions.length) missing();
          }
        }
        const attachmentIds = [...new Set(input.attachmentIds)];
        if (attachmentIds.length) {
          const rows = await tx
            .select()
            .from(attachment)
            .where(
              and(
                eq(attachment.conversationId, id),
                eq(attachment.ownerId, actor),
                eq(attachment.state, "ready"),
                isNull(attachment.messageId),
                inArray(attachment.id, attachmentIds),
              ),
            );
          if (rows.length !== attachmentIds.length) missing();
        }
        const [row] = await tx
          .insert(message)
          .values({
            workspaceId,
            conversationId: id,
            senderId: actor,
            nonce: input.nonce,
            body: input.body,
            parentId: input.parentId,
            mentionIds: mentions,
          })
          .returning();
        if (attachmentIds.length)
          await tx
            .update(attachment)
            .set({ messageId: row!.id })
            .where(inArray(attachment.id, attachmentIds));
        await notify(tx, workspaceId);
        return (await messageDtos(tx, [row!], actor))[0]!;
      });
    },
    async mutateMessage(
      workspaceId: string,
      actor: string,
      messageId: string,
      action: "edit" | "delete" | "reaction" | "pin",
      input: { body?: string; emoji?: string; active?: boolean },
    ) {
      return workspaces.withAccess(workspaceId, actor, async (tx) => {
        const row = await findMessage(tx, workspaceId, messageId),
          { item, member } = await access(tx, workspaceId, actor, row.conversationId);
        canPost(item, member);
        if (row.deletedAt) missing();
        if (action === "edit" || action === "delete") {
          if (row.senderId !== actor) denied();
          await tx
            .update(message)
            .set(
              action === "edit"
                ? { body: input.body!, editedAt: new Date() }
                : {
                    body: "",
                    deletedAt: new Date(),
                    pinnedAt: null,
                    pinnedBy: null,
                    mentionIds: [],
                  },
            )
            .where(eq(message.id, messageId));
        }
        if (action === "reaction") {
          if (input.active)
            await tx
              .insert(reaction)
              .values({
                workspaceId,
                conversationId: row.conversationId,
                messageId,
                userId: actor,
                emoji: input.emoji!,
              })
              .onConflictDoNothing();
          else
            await tx
              .delete(reaction)
              .where(
                and(
                  eq(reaction.messageId, messageId),
                  eq(reaction.userId, actor),
                  eq(reaction.emoji, input.emoji!),
                ),
              );
        }
        if (action === "pin")
          await tx
            .update(message)
            .set({
              pinnedAt: input.active ? new Date() : null,
              pinnedBy: input.active ? actor : null,
            })
            .where(eq(message.id, messageId));
        if (action === "delete") await tx.delete(reaction).where(eq(reaction.messageId, messageId));
        await audit(tx, workspaceId, actor, `message.${action}`, messageId);
      });
    },
    async search(
      workspaceId: string,
      actor: string,
      input: z.infer<typeof contracts.messengerSearchQuerySchema>,
    ) {
      return workspaces.withAccess(workspaceId, actor, async (tx) => {
        const rows = await tx
          .select({ message, name: conversation.name })
          .from(message)
          .innerJoin(conversation, eq(conversation.id, message.conversationId))
          .where(
            and(
              eq(message.workspaceId, workspaceId),
              visible(actor),
              isNull(message.deletedAt),
              sql`to_tsvector('simple', ${message.body}) @@ websearch_to_tsquery('simple', ${input.q})`,
              input.conversationId ? eq(message.conversationId, input.conversationId) : undefined,
              input.authorId ? eq(message.senderId, input.authorId) : undefined,
              input.before ? lt(message.sequence, input.before) : undefined,
              input.from ? gte(message.createdAt, new Date(input.from)) : undefined,
              input.to ? lte(message.createdAt, new Date(input.to)) : undefined,
            ),
          )
          .orderBy(desc(message.sequence))
          .limit(input.limit + 1);
        const selected = rows.slice(0, input.limit),
          values = await messageDtos(
            tx,
            selected.map((v) => v.message),
            actor,
          );
        return {
          results: values.map((v, i) => ({ ...v, conversationName: selected[i]!.name })),
          nextBefore: rows.length > input.limit ? values.at(-1)!.sequence : null,
        };
      });
    },
  };
}
export type MessengerService = ReturnType<typeof createMessengerService>;
