import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import type { Auth } from "@lumolynk/auth";
import type { Database } from "@lumolynk/database";
import { session } from "@lumolynk/database/schema";
import type { ServerEnv } from "@lumolynk/env/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { sign, verify } from "hono/jwt";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";

import { missing } from "../../lib/errors";
import type { createWorkspaceService } from "../workspaces/workspace.service";
import type { MessengerService } from "./messenger.service";
import { createPresenceService } from "./presence.service";

const ticketSchema = z.object({
  purpose: z.literal("messenger-sync"),
  workspaceId: z.uuid(),
  actor: z.uuid(),
  sessionId: z.uuid(),
  exp: z.number(),
});
type Ticket = z.infer<typeof ticketSchema>;
export function createMessengerHub(
  db: Database,
  auth: Auth,
  workspaces: ReturnType<typeof createWorkspaceService>,
  chat: MessengerService,
  env: ServerEnv,
  presence = createPresenceService(db, workspaces),
) {
  const clients = new Map<
    WebSocket,
    { ticket: Ticket; lastTyping: number; alive: boolean; leaseId: string }
  >();
  let sockets: WebSocketServer | undefined, timer: ReturnType<typeof setInterval> | undefined;
  async function authorized(ticket: Ticket) {
    const [active] = await db
      .select({ id: session.id })
      .from(session)
      .where(
        and(
          eq(session.id, ticket.sessionId),
          eq(session.userId, ticket.actor),
          gt(session.expiresAt, new Date()),
        ),
      );
    if (!active) missing();
    await workspaces.requireAccess(ticket.workspaceId, ticket.actor);
  }
  async function deliver(socket: WebSocket, event: object, conversationId?: string) {
    const client = clients.get(socket);
    if (!client) return;
    try {
      await authorized(client.ticket);
      if (conversationId)
        await chat.get(client.ticket.workspaceId, client.ticket.actor, conversationId);
      if (socket.readyState === WebSocket.OPEN) {
        if (socket.bufferedAmount > 65536) socket.close(1013);
        else socket.send(JSON.stringify(event));
      }
    } catch {
      socket.close(1008, "Messenger access changed");
    }
  }
  async function refresh(workspaceId: string) {
    if (!z.uuid().safeParse(workspaceId).success) return;
    await Promise.all(
      [...clients]
        .filter(([, c]) => c.ticket.workspaceId === workspaceId)
        .map(([ws]) => deliver(ws, { type: "changed", conversationId: null })),
    );
  }
  async function typing(payload: string) {
    const value = z
      .object({ workspaceId: z.uuid(), conversationId: z.uuid(), actorId: z.uuid() })
      .safeParse(JSON.parse(payload));
    if (!value.success) return;
    const event = {
      type: "typing",
      conversationId: value.data.conversationId,
      actorId: value.data.actorId,
    };
    // A recipient without access is skipped, rather than disclosing the conversation ID.
    for (const [socket, client] of clients)
      if (
        client.ticket.workspaceId === value.data.workspaceId &&
        client.ticket.actor !== value.data.actorId
      ) {
        try {
          await chat.get(client.ticket.workspaceId, client.ticket.actor, value.data.conversationId);
        } catch {
          continue;
        }
        await deliver(socket, event, value.data.conversationId);
      }
  }
  return {
    refresh,
    async presence(workspaceId: string) {
      if (!z.uuid().safeParse(workspaceId).success) return;
      await Promise.all(
        [...clients]
          .filter(([, c]) => c.ticket.workspaceId === workspaceId)
          .map(([ws]) => deliver(ws, { type: "presence", conversationId: null })),
      );
    },
    typing(payload: string) {
      void typing(payload).catch(() => {});
    },
    async issue(workspaceId: string, actor: string, headers: Headers) {
      const current = await auth.api.getSession({ headers });
      if (!current || current.user.id !== actor) missing();
      await workspaces.requireAccess(workspaceId, actor);
      const token = await sign(
        {
          purpose: "messenger-sync",
          workspaceId,
          actor,
          sessionId: current.session.id,
          exp: Math.floor(Date.now() / 1000) + 120,
        },
        env.BETTER_AUTH_SECRET,
        "HS256",
      );
      return { url: `${env.API_ORIGIN.replace(/^http/, "ws")}/api/internal/messenger`, token };
    },
    attach(server: Server) {
      sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
      server.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url ?? "/", env.API_ORIGIN);
        if (url.pathname !== "/api/internal/messenger") return;
        if (
          ![
            env.WEB_ORIGIN,
            "lumolynk://app",
            ...(env.NODE_ENV !== "production" ? ["http://127.0.0.1:5174"] : []),
          ].includes(request.headers.origin ?? "")
        ) {
          socket.destroy();
          return;
        }
        void (async () => {
          const ticket = ticketSchema.parse(
            await verify(url.searchParams.get("ticket") ?? "", env.BETTER_AUTH_SECRET, "HS256"),
          );
          await authorized(ticket);
          sockets!.handleUpgrade(request, socket, head, (ws) => {
            const leaseId = randomUUID();
            clients.set(ws, { ticket, lastTyping: 0, alive: true, leaseId });
            const joined = presence.renew(
              leaseId,
              ticket.workspaceId,
              ticket.actor,
              ticket.sessionId,
            );
            void joined.catch(() => ws.close(1008));
            ws.on("error", () => ws.terminate());
            ws.on("close", () => {
              clients.delete(ws);
              void joined.then(() => presence.release(leaseId)).catch(() => {});
            });
            ws.on("pong", () => {
              const client = clients.get(ws);
              if (client) client.alive = true;
            });
            ws.on("message", (raw) => {
              const client = clients.get(ws);
              if (!client || Date.now() - client.lastTyping < 2000) return;
              client.lastTyping = Date.now();
              void (async () => {
                const input = z
                  .object({ type: z.literal("typing"), conversationId: z.uuid() })
                  .strict()
                  .parse(
                    JSON.parse(
                      (Array.isArray(raw)
                        ? Buffer.concat(raw)
                        : Buffer.isBuffer(raw)
                          ? raw
                          : Buffer.from(raw)
                      ).toString("utf8"),
                    ),
                  );
                await authorized(ticket);
                await chat.scoped(
                  ticket.workspaceId,
                  ticket.actor,
                  input.conversationId,
                  async (tx, item, member) => {
                    chat.canPost(item, member);
                    await tx.execute(
                      sql`select pg_notify('lumolynk_messenger_typing',${JSON.stringify({ workspaceId: ticket.workspaceId, conversationId: input.conversationId, actorId: ticket.actor })})`,
                    );
                  },
                );
              })().catch(() => ws.close(1008));
            });
            void deliver(ws, { type: "changed", conversationId: null });
          });
        })().catch(() => socket.destroy());
      });
      timer = setInterval(() => {
        void presence.expire().catch(() => {});
        for (const [ws, client] of clients) {
          if (!client.alive) {
            ws.terminate();
            continue;
          }
          client.alive = false;
          if (client.ticket.exp * 1000 <= Date.now()) {
            ws.close(4001, "Renew Messenger session");
            continue;
          }
          void authorized(client.ticket).then(
            () => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
                void presence
                  .renew(
                    client.leaseId,
                    client.ticket.workspaceId,
                    client.ticket.actor,
                    client.ticket.sessionId,
                  )
                  .catch(() => ws.close(1008));
              }
            },
            () => ws.close(1008),
          );
        }
      }, 15000);
      timer.unref();
    },
    async close() {
      if (timer) clearInterval(timer);
      for (const ws of clients.keys()) ws.terminate();
      clients.clear();
      sockets?.close();
    },
  };
}
