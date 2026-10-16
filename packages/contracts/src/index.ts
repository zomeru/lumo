import { z } from "zod";

export const idSchema = z.uuid();
export const roleSchema = z.enum(["owner", "admin", "moderator", "member"]);
export const assignableRoleSchema = z.enum(["admin", "moderator", "member"]);
export const visibilitySchema = z.enum(["public", "private", "invite-only"]);
export type Role = z.infer<typeof roleSchema>;

const name = z.string().trim().min(1).max(100);
const shortText = z.string().trim().max(100);
export const profileInputSchema = z
  .object({ name, jobTitle: shortText, department: shortText })
  .strict();
export const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export const registrationSchema = credentialsSchema.extend({ name });
export const workspaceInputSchema = z
  .object({
    name,
    description: z.string().trim().max(1000).default(""),
    visibility: visibilitySchema.default("private"),
    industry: shortText.default(""),
    companySize: z.enum(["just-me", "2-10", "11-50", "51-200", "201+"]).default("just-me"),
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
    currency: z.enum(["USD", "CNY", "PHP", "EUR", "GBP", "SGD"]).default("USD"),
    language: z.enum(["en", "zh", "fil"]).default("en"),
  })
  .strict();
// PATCH fields intentionally have no defaults: omitting a setting must preserve it.
export const workspaceUpdateSchema = z
  .object({
    name,
    description: workspaceInputSchema.shape.description.removeDefault(),
    visibility: workspaceInputSchema.shape.visibility.removeDefault(),
    industry: workspaceInputSchema.shape.industry.removeDefault(),
    companySize: workspaceInputSchema.shape.companySize.removeDefault(),
    timezone: workspaceInputSchema.shape.timezone.removeDefault(),
    currency: workspaceInputSchema.shape.currency.removeDefault(),
    language: workspaceInputSchema.shape.language.removeDefault(),
  })
  .strict()
  .partial()
  .refine((data) => Object.keys(data).length > 0);
export const invitationInputSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    role: z.enum(["moderator", "member"]).default("member"),
  })
  .strict();
export const tokenInputSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const memberRoleInputSchema = z.object({ role: assignableRoleSchema }).strict();
export const transferInputSchema = z.object({ userId: idSchema }).strict();
export const activeWorkspaceInputSchema = z.object({ workspaceId: idSchema }).strict();
export const paginationSchema = z.object({
  q: z.string().trim().max(100).default(""),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  jobTitle: z.string(),
  department: z.string(),
});
export const workspaceSchema = workspaceInputSchema.extend({
  id: idSchema,
  isPersonal: z.boolean(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
});
export const meSchema = z.object({ user: userSchema, activeWorkspaceId: idSchema.nullable() });
export const workspacesSchema = z.object({ workspaces: z.array(workspaceSchema) });
export const discoveryWorkspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
});
export const discoverySchema = z.object({
  workspaces: z.array(discoveryWorkspaceSchema),
  nextOffset: z.number().nullable(),
});
export const memberSchema = z.object({
  userId: idSchema,
  name: z.string(),
  image: z.string().nullable(),
  jobTitle: z.string(),
  department: z.string(),
  role: roleSchema,
  joinedAt: z.iso.datetime(),
});
export const membersSchema = z.object({
  members: z.array(memberSchema),
  nextOffset: z.number().nullable(),
});
export const invitationSchema = z.object({
  id: idSchema,
  email: z.email(),
  role: assignableRoleSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export const invitationsSchema = z.object({ invitations: z.array(invitationSchema) });
export const invitationCreatedSchema = invitationSchema.extend({ token: z.string() });
export const invitationPreviewSchema = z.object({
  workspaceName: z.string(),
  role: assignableRoleSchema,
  expiresAt: z.iso.datetime(),
});
export const auditSchema = z.object({
  events: z.array(
    z.object({
      id: idSchema,
      action: z.string(),
      actorName: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export const okSchema = z.object({ ok: z.literal(true) });
export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Member = z.infer<typeof memberSchema>;
export type CurrentUser = z.infer<typeof userSchema>;
export type WorkspaceInput = z.input<typeof workspaceInputSchema>;
