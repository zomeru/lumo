import { workspaceSchema, type Member } from "@lumo/contracts";
import { vi } from "vitest";

export const personalId = "11111111-1111-4111-8111-111111111111";
export const teamId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
export const bobId = "44444444-4444-4444-8444-444444444444";
const invitationId = "55555555-5555-4555-8555-555555555555";
export const inviteToken = "a".repeat(64);
const createdAt = "2026-10-16T08:00:00.000Z";

export function mockApi() {
  const state = {
    authenticated: true,
    presenceDnd: false,
    user: {
      id: userId,
      name: "Alice Chen",
      email: "alice@example.com",
      emailVerified: true,
      image: null as string | null,
      jobTitle: "Engineer",
      department: "Product",
    },
    activeWorkspaceId: personalId,
    workspaces: [
      workspaceSchema.parse({
        id: personalId,
        name: "Alice's Workspace",
        isPersonal: true,
        role: "owner",
        createdAt,
      }),
      workspaceSchema.parse({
        id: teamId,
        name: "Acme",
        description: "Acme-only description",
        isPersonal: false,
        role: "owner",
        createdAt,
      }),
    ],
    members: [
      {
        userId,
        name: "Alice Chen",
        image: null,
        jobTitle: "Engineer",
        department: "Product",
        role: "owner",
        joinedAt: createdAt,
      },
      {
        userId: bobId,
        name: "Bob Rivera",
        image: null,
        jobTitle: "Designer",
        department: "",
        role: "member",
        joinedAt: createdAt,
      },
    ] as Member[],
    invitations: [] as {
      id: string;
      email: string;
      role: string;
      expiresAt: string;
      createdAt: string;
    }[],
    overrides: new Map<
      string,
      (body: Record<string, unknown>, url: URL) => Response | Promise<Response>
    >(),
  };
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const error = (status: number, message = "Request denied") =>
    json({ error: { code: "TEST_ERROR", message, requestId: "test" } }, status);
  const fetch = vi.fn<typeof globalThis.fetch>(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        "http://localhost",
      );
      const method = init?.method ?? "GET";
      const path = url.pathname;
      const body =
        typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      if (path === "/api/v1/me/avatar/config") return json({ maxBytes: 5242880 });
      const override = state.overrides.get(`${method} ${path}`);
      if (override) return override(body, url);
      if (path.startsWith("/api/auth/")) {
        if (path.endsWith("/sign-out")) state.authenticated = false;
        else if (!path.endsWith("/send-verification-email")) state.authenticated = true;
        return json({ ok: true });
      }
      if (!state.authenticated) return error(401, "Sign in to continue.");
      if (path === "/api/v1/me/presence") {
        if (method === "PUT") state.presenceDnd = body.dnd === true;
        return json({ dnd: state.presenceDnd });
      }
      if (/^\/api\/v1\/workspaces\/[^/]+\/presence$/.test(path)) {
        const ids = new Set(Array.isArray(body.userIds) ? body.userIds : []);
        return json({
          members: state.members
            .filter((member) => ids.has(member.userId))
            .map((member) => ({ userId: member.userId, status: "offline" })),
        });
      }
      if (path === "/api/v1/me") {
        if (method === "PATCH") {
          Object.assign(state.user, body);
          return json({ ok: true });
        }
        return json({ user: state.user, activeWorkspaceId: state.activeWorkspaceId });
      }
      if (path.endsWith("/hr/access"))
        return json({
          userId,
          owner: true,
          grants: [],
          hasReports: false,
          timezone: "UTC",
          currency: "USD",
        });
      if (path.endsWith("/hr/departments")) return json({ departments: [] });
      if (path.endsWith("/hr/people"))
        return json({
          people: state.members
            .filter((member) =>
              member.name.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase()),
            )
            .map((member) => ({
              ...member,
              employeeCode: "",
              departmentId: null,
              managerId: null,
              employmentType: "employee",
              status: "active",
              hireDate: null,
              endDate: null,
              location: "",
            })),
          nextOffset: null,
        });
      if (path === "/api/v1/me/active-workspace") {
        state.activeWorkspaceId = body.workspaceId as string;
        return json({ ok: true });
      }
      if (path === "/api/v1/workspaces/discover")
        return json({
          workspaces: [{ id: teamId, name: "Public Studio", description: "A public team" }],
          nextOffset: null,
        });
      if (path === "/api/v1/workspaces") {
        if (method === "POST") {
          const ws = workspaceSchema.parse({
            ...body,
            id: "66666666-6666-4666-8666-666666666666",
            isPersonal: false,
            role: "owner",
            createdAt,
          });
          state.workspaces.push(ws);
          state.activeWorkspaceId = ws.id;
          return json(ws, 201);
        }
        return json({ workspaces: state.workspaces });
      }
      if (path === "/api/v1/invitations/preview")
        return json({
          workspaceName: "Acme",
          role: "member",
          expiresAt: "2030-01-01T00:00:00.000Z",
        });
      if (path === "/api/v1/invitations/accept") return json(state.workspaces[1]);
      const match = /^\/api\/v1\/workspaces\/([^/]+)(.*)$/.exec(path);
      const ws = state.workspaces.find((item) => item.id === match?.[1]);
      const suffix = match?.[2];
      if (!ws) return error(404);
      if (!suffix) {
        if (method === "PATCH") Object.assign(ws, body);
        return json(ws);
      }
      if (suffix === "/join") return json(ws);
      if (suffix === "/members")
        return json({
          members: state.members.filter((member) =>
            member.name.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase()),
          ),
          nextOffset: null,
        });
      if (suffix?.startsWith("/members/")) {
        const target = suffix.split("/")[2];
        if (method === "DELETE") state.members = state.members.filter((m) => m.userId !== target);
        else {
          const member = state.members.find((m) => m.userId === target);
          if (member) member.role = body.role as Member["role"];
        }
        return json({ ok: true });
      }
      if (suffix === "/transfer-ownership") {
        ws.role = "admin";
        return json({ ok: true });
      }
      if (suffix === "/leave") {
        state.workspaces = state.workspaces.filter((item) => item.id !== ws.id);
        return json({ ok: true });
      }
      if (suffix === "/invitations") {
        if (method === "POST") {
          const item = {
            id: invitationId,
            email: body.email as string,
            role: body.role as string,
            expiresAt: "2030-01-01T00:00:00.000Z",
            createdAt,
          };
          state.invitations.push(item);
          return json({ ...item, token: inviteToken }, 201);
        }
        return json({ invitations: state.invitations });
      }
      if (suffix?.startsWith("/invitations/")) {
        state.invitations = [];
        return json({ ok: true });
      }
      if (suffix === "/activity")
        return json({
          events: [
            { id: invitationId, action: "workspace.created", actorName: "Alice Chen", createdAt },
          ],
        });
      return error(404);
    },
  );
  vi.stubGlobal("fetch", fetch);
  return { state, fetch, json, error };
}
