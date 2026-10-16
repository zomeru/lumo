import type { Role } from "./index.ts";

const rank: Record<Role, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };

export const canManageSettings = (role: Role) => role === "owner" || role === "admin";
export const canInvite = (role: Role) => role !== "member";
export const canInviteRole = (role: Role, next: Role) =>
  canInvite(role) && (next === "member" || (next === "moderator" && canManageSettings(role)));
export const canRemoveMember = (actor: Role, target: Role) =>
  actor !== "member" && rank[actor] > rank[target];
export const canChangeRole = (actor: Role, target: Role, next: Role) =>
  target !== "owner" &&
  next !== "owner" &&
  (actor === "owner" ||
    (actor === "admin" && rank[target] < rank.admin && rank[next] < rank.admin));
