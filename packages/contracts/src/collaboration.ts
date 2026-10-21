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
          if (/^[+-]/.test(value)) return false;
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
  // Older records may contain an Intl-supported fixed offset; keep their links readable.
  timezone: z.string(),
  status: z.enum(["scheduled", "active", "ended", "canceled"]),
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

// Calendar remains a workspace-scoped view of Meetings. Range boundaries are UTC instants.
export const calendarRangeSchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .refine(
    ({ from, to }) => {
      const span = Date.parse(to) - Date.parse(from);
      return span > 0 && span <= 62 * 86400000;
    },
    { message: "Choose a range of at most 62 days." },
  );
export const calendarQuerySchema = calendarRangeSchema.safeExtend({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const calendarMeetingSchema = meetingSchema.extend({ hostName: z.string() });
export const calendarMeetingsSchema = z.object({
  meetings: z.array(calendarMeetingSchema),
  nextOffset: z.number().nullable(),
});
export const scheduledMeetingInputSchema = meetingInputSchema.extend({
  startsAt: z.iso.datetime(),
});
export const meetingAvailabilityInputSchema = calendarRangeSchema
  .safeExtend({
    participantIds: z.array(idSchema).max(100).default([]),
    excludeMeetingId: idSchema.optional(),
  })
  .strict()
  .refine(({ from, to }) => Date.parse(to) - Date.parse(from) <= 86400000, {
    message: "Choose a duration of at most 24 hours.",
  });
export const meetingAvailabilitySchema = z.object({
  conflicts: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      userIds: z.array(idSchema),
    }),
  ),
});

export const calendarMeetingDetailSchema = meetingDetailSchema.extend({ hostName: z.string() });
