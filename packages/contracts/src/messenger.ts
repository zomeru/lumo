import { z } from "zod";

import { idSchema } from "./index";

export const channelInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u),
    description: z.string().trim().max(1000).default(""),
    visibility: z.enum(["public", "private"]).default("public"),
    memberIds: z.array(idSchema).max(49).default([]),
  })
  .strict();
export const channelUpdateSchema = z
  .object({
    name: channelInputSchema.shape.name.optional(),
    description: z.string().trim().max(1000).optional(),
    archived: z.boolean().optional(),
  })
  .strict();
export const channelMemberInputSchema = z
  .object({ userId: idSchema, role: z.enum(["owner", "manager", "member"]).default("member") })
  .strict();
export const messengerPreferencesSchema = z
  .object({ notifications: z.enum(["all", "mentions", "muted"]) })
  .strict();
export const messengerReadSchema = z.object({ messageId: idSchema }).strict();
export const messageInputSchema = z
  .object({
    nonce: idSchema,
    body: z.string().trim().max(4000),
    parentId: idSchema.optional(),
    mentionIds: z.array(idSchema).max(20).default([]),
    attachmentIds: z.array(idSchema).max(5).default([]),
  })
  .strict()
  .refine((v) => v.body.length > 0 || v.attachmentIds.length > 0, {
    message: "Write a message or attach a file.",
  });
export const messageEditSchema = z.object({ body: z.string().trim().min(1).max(4000) }).strict();
export const messageReactionSchema = z
  .object({
    emoji: z
      .string()
      .max(32)
      .refine((value) => {
        const segments = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)];
        return (
          segments.length === 1 &&
          /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F})$/u.test(
            value,
          )
        );
      }, "Choose a single emoji."),
    active: z.boolean(),
  })
  .strict();
export const messagePinSchema = z.object({ active: z.boolean() }).strict();
export const messengerHistoryQuerySchema = z.object({
  before: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  after: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  parentId: idSchema.optional(),
  around: idSchema.optional(),
  pinned: z.enum(["true"]).optional(),
  files: z.enum(["true"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export const messengerSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  conversationId: idSchema.optional(),
  authorId: idSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export const messengerAttachmentInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[^/\\]+$/)
      .refine((v) => v.split("").every((char) => char.charCodeAt(0) >= 32)),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]),
    size: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 ** 2),
    checksum: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  })
  .strict();
export const messengerAttachmentSchema = messengerAttachmentInputSchema
  .omit({ checksum: true })
  .extend({ id: idSchema, scanStatus: z.literal("unscanned").default("unscanned") });
export const messengerMessageSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  conversationId: idSchema,
  senderId: idSchema,
  senderName: z.string(),
  senderImage: z.string().nullable(),
  sequence: z.number(),
  nonce: idSchema,
  body: z.string(),
  parentId: idSchema.nullable(),
  mentionIds: z.array(idSchema),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  pinnedAt: z.iso.datetime().nullable(),
  replies: z.number(),
  replyParticipants: z
    .array(z.object({ userId: idSchema, name: z.string(), image: z.string().nullable() }))
    .max(3)
    .default([]),
  reactions: z.array(z.object({ emoji: z.string(), count: z.number(), mine: z.boolean() })),
  attachments: z.array(messengerAttachmentSchema),
});
export const messengerMessagesSchema = z.object({
  parent: messengerMessageSchema.nullable().optional(),
  messages: z.array(messengerMessageSchema),
  nextBefore: z.number().nullable(),
});
export const messengerSearchSchema = z.object({
  results: z.array(messengerMessageSchema.extend({ conversationName: z.string() })),
  nextBefore: z.number().nullable(),
});
export const messengerMembersSchema = z.object({
  members: z.array(
    z.object({
      userId: idSchema,
      name: z.string(),
      image: z.string().nullable(),
      role: z.enum(["owner", "manager", "member"]),
    }),
  ),
  nextOffset: z.number().nullable(),
});
export const messengerSessionSchema = z.object({ url: z.url(), token: z.string() });
export const messengerEventSchema = z.object({
  conversationId: idSchema.nullable(),
  type: z.enum(["changed", "typing", "revoked", "presence"]),
  actorId: idSchema.optional(),
});
export type MessengerMessage = z.infer<typeof messengerMessageSchema>;

export const messengerNotificationsSchema = z.object({
  conversations: z.array(
    z.object({ id: idSchema, name: z.string(), unread: z.number(), mentions: z.number() }),
  ),
  totalUnread: z.number(),
  nextOffset: z.number().nullable(),
});
export const messengerAuditSchema = z.object({
  events: z.array(
    z.object({
      id: idSchema,
      workspaceId: idSchema,
      conversationId: idSchema,
      actorId: idSchema,
      action: z.string(),
      targetId: idSchema,
      createdAt: z.iso.datetime(),
    }),
  ),
  nextOffset: z.number().nullable(),
});
