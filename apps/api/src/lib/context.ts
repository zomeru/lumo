import type { Role } from "@lumo/contracts";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
};
export type ApiContext = {
  Variables: { user: SessionUser; requestId: string; workspaceId: string; role: Role };
};
