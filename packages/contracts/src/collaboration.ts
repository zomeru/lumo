import { z } from "zod";

import { idSchema } from "./index";
export const conversationInputSchema = z
  .object({
    kind: z.enum(["direct", "group"]),
    name: z.string().trim().min(1).max(100),
    memberIds: z.array(idSchema).min(1).max(49),
  })
  .strict();
export const conversationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  kind: z.enum(["direct", "group"]),
  name: z.string(),
  createdAt: z.iso.datetime(),
  memberIds: z.array(idSchema),
  providerGroupId: z.string().nullable().default(null),
});
export const conversationsSchema = z.object({
  conversations: z.array(conversationSchema),
  nextOffset: z.number().nullable(),
});
export const chatCredentialsSchema = z.object({
  appKey: z.string(),
  identity: z.string(),
  token: z.string(),
  groupId: z.string(),
  expiresAt: z.iso.datetime(),
});
export const meetingInputSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).default(""),
    access: z.enum(["workspace", "open"]).default("workspace"),
    startsAt: z.iso.datetime().optional(),
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .default("UTC"),
    durationMinutes: z.number().int().min(5).max(1440).default(60),
    participantIds: z.array(idSchema).max(100).default([]),
  })
  .strict();
export const meetingSchema = meetingInputSchema.omit({ participantIds: true }).extend({
  id: idSchema,
  hostId: idSchema,
  status: z.enum(["scheduled", "active", "ended"]),
  startsAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const meetingsSchema = z.object({
  meetings: z.array(meetingSchema),
  nextOffset: z.number().nullable(),
});
export const meetingDetailSchema = z.object({
  meeting: meetingSchema,
  participants: z.array(
    z.object({ userId: idSchema, name: z.string(), online: z.boolean(), invited: z.boolean() }),
  ),
});
export const rtcCredentialsSchema = z.object({
  appId: z.string(),
  channel: z.string(),
  uid: z.string(),
  token: z.string(),
  expiresAt: z.iso.datetime(),
});
export const rtcTokenInputSchema = z.object({ screen: z.boolean().default(false) }).strict();
export type Conversation = z.infer<typeof conversationSchema>;
export type Meeting = z.infer<typeof meetingSchema>;
