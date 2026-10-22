import { z } from "zod";

import { idSchema } from "./index";
export const presencePreferenceSchema = z.object({ dnd: z.boolean() }).strict();
export const presenceQuerySchema = z.object({ userIds: z.array(idSchema).max(100) }).strict();
export const presenceResultSchema = z.object({
  members: z.array(z.object({ userId: idSchema, status: z.enum(["online", "dnd", "offline"]) })),
});
export type PresenceStatus = z.infer<typeof presenceResultSchema>["members"][number]["status"];
