import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import type { Database } from "@lumo/database";
import { officeDocument, officeVersion, wikiConnection, wikiUpdate } from "@lumo/database/schema";
import type { ServerEnv } from "@lumo/env/server";
import { and, eq, sql } from "drizzle-orm";
import { sign, verify } from "hono/jwt";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { WebSocketServer, WebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { z } from "zod";

import { AppError } from "../../lib/errors";
import type { Storage } from "../../storage/storage";
import { officeBytes, type OfficeService } from "./office.service";
import { initialWikiDocument, wikiMarkdown, isSourceWiki } from "./wiki-markdown";

const ticketSchema = z.object({
  purpose: z.literal("wiki-sync"),
  format: z.literal("markdown-v1"),
  workspaceId: z.uuid(),
  actor: z.uuid(),
  name: z.string(),
  id: z.uuid(),
  generation: z.number().int(),
  exp: z.number(),
});
type Ticket = z.infer<typeof ticketSchema>;
type Client = {
  ticket: Ticket;
  lease: string;
  awarenessId?: number;
  queued: number;
  window: number;
  messages: number;
  alive: boolean;
  queuedBytes: number;
};
type Room = {
  id: string;
  workspaceId: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Map<WebSocket, Client>;
  queue: Promise<unknown>;
  timer?: ReturnType<typeof setTimeout>;
  dirty: boolean;
  actor: string;
};
const message = (type: number, value: Uint8Array) => {
  const e = encoding.createEncoder();
  encoding.writeVarUint(e, type);
  encoding.writeVarUint8Array(e, value);
  return encoding.toUint8Array(e);
};
export function createWikiHub(
  db: Database,
  office: OfficeService,
  storage: Storage,
  env: ServerEnv,
) {
  const rooms = new Map<string, Room>();
  const pending = new Map<string, Promise<Room>>();
  let webSockets: WebSocketServer | undefined,
    heartbeat: ReturnType<typeof setInterval> | undefined;
  async function announce(channel: string, payload: string) {
    await db.execute(sql`select pg_notify(${channel},${payload})`);
  }
  function broadcast(room: Room, data: Uint8Array) {
    for (const [socket, client] of room.clients)
      void office
        .scoped(client.ticket.workspaceId, client.ticket.actor, room.id, async (_tx, doc) => {
          if (doc.generation !== client.ticket.generation) throw new Error("Stale Wiki session");
          if (socket.readyState === WebSocket.OPEN) socket.send(data);
        })
        .catch(() => socket.close(1008));
  }
  async function load(ticket: Ticket): Promise<Room> {
    const existing = rooms.get(ticket.id);
    if (existing) return existing;
    const waiting = pending.get(ticket.id);
    if (waiting) return waiting;
    const operation = (async () => {
      const document = new Y.Doc();
      let dirty = false;
      await office.scoped(ticket.workspaceId, ticket.actor, ticket.id, async (tx, doc, access) => {
        if (doc.kind !== "wiki" || doc.generation !== ticket.generation)
          throw new AppError(409, "WIKI_STALE", "Reload this Wiki page.");
        if (doc.wikiState) Y.applyUpdate(document, Buffer.from(doc.wikiState, "base64"));
        else {
          const initial = initialWikiDocument(
            (await officeBytes(await storage.read(access.row.objectKey!))).toString("utf8"),
          );
          Y.applyUpdate(document, Y.encodeStateAsUpdate(initial));
          initial.destroy();
          await tx
            .update(officeDocument)
            .set({ wikiState: Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64") })
            .where(eq(officeDocument.id, doc.id));
        }
        const [current] = await tx
          .select()
          .from(officeVersion)
          .where(and(eq(officeVersion.documentId, doc.id), eq(officeVersion.number, doc.version)));
        dirty = Boolean(
          doc.wikiState && doc.wikiState !== current?.wikiState && access.permission !== "viewer",
        );
      });
      const awareness = new awarenessProtocol.Awareness(document);
      awareness.setLocalState(null);
      const room: Room = {
        id: ticket.id,
        workspaceId: ticket.workspaceId,
        doc: document,
        awareness,
        clients: new Map(),
        queue: Promise.resolve(),
        dirty,
        actor: ticket.actor,
      };
      awareness.on(
        "update",
        (
          { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
          origin: unknown,
        ) => {
          const ids = [...added, ...updated, ...removed],
            update = awarenessProtocol.encodeAwarenessUpdate(awareness, ids);
          broadcast(room, message(1, update));
          if (origin !== "remote" && update.length < 4000)
            void announce(
              "lumo_wiki_awareness",
              JSON.stringify({ id: room.id, data: Buffer.from(update).toString("base64") }),
            ).catch(() => {});
        },
      );
      rooms.set(ticket.id, room);
      if (dirty) schedule(room);
      return room;
    })();
    pending.set(ticket.id, operation);
    try {
      return await operation;
    } finally {
      pending.delete(ticket.id);
    }
  }
  function syncUpdate(room: Room, update: Uint8Array) {
    const e = encoding.createEncoder();
    encoding.writeVarUint(e, 0);
    syncProtocol.writeUpdate(e, update);
    broadcast(room, encoding.toUint8Array(e));
  }
  async function refresh(id: string) {
    const room = rooms.get(id);
    if (!room) return;
    const [doc] = await db
      .select()
      .from(officeDocument)
      .where(and(eq(officeDocument.id, id), eq(officeDocument.workspaceId, room.workspaceId)));
    if (doc?.wikiState) {
      const state = Buffer.from(doc.wikiState, "base64");
      if (!Buffer.from(Y.encodeStateAsUpdate(room.doc)).equals(state)) {
        Y.applyUpdate(room.doc, state, "database");
        syncUpdate(room, state);
      }
    }
  }
  async function snapshot(room: Room) {
    if (!room.dirty) return;
    const current = await office.scoped(
      room.workspaceId,
      room.actor,
      room.id,
      async (_tx, doc) => doc.wikiState,
    );
    if (!current) return;
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, Buffer.from(current, "base64"));
      await office.wikiSnapshot(
        room.workspaceId,
        room.actor,
        room.id,
        Buffer.from(wikiMarkdown(doc), "utf8"),
        current,
      );
      room.dirty = false;
    } finally {
      doc.destroy();
    }
  }
  function schedule(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      room.queue = room.queue
        .then(() => snapshot(room))
        .catch(async () => {
          await db
            .update(officeDocument)
            .set({ state: "error" })
            .where(eq(officeDocument.id, room.id));
        });
    }, 1000);
    room.timer.unref();
  }
  async function receive(room: Room, socket: WebSocket, data: Uint8Array) {
    const client = room.clients.get(socket);
    if (!client) return;
    const decoder = decoding.createDecoder(data),
      type = decoding.readVarUint(decoder);
    if (type === 0) {
      const response = encoding.createEncoder();
      encoding.writeVarUint(response, 0);
      let committed: Uint8Array | undefined;
      await office.scoped(
        client.ticket.workspaceId,
        client.ticket.actor,
        room.id,
        async (tx, doc, access) => {
          if (doc.generation !== client.ticket.generation) throw new Error("Stale Wiki generation");
          const fresh = new Y.Doc();
          try {
            if (doc.wikiState) Y.applyUpdate(fresh, Buffer.from(doc.wikiState, "base64"));
            const before = Y.encodeStateAsUpdate(fresh);
            const vector = Y.encodeStateVector(fresh);
            syncProtocol.readSyncMessage(decoder, response, fresh, socket);
            const changed = !Buffer.from(before).equals(Buffer.from(Y.encodeStateAsUpdate(fresh)));
            if (changed) {
              if (access.permission === "viewer")
                throw new AppError(403, "FORBIDDEN", "This Wiki page is read-only.");
              if (!isSourceWiki(fresh))
                throw new AppError(400, "WIKI_INVALID_STATE", "Reload the Wiki editor.");
              const state = Y.encodeStateAsUpdate(fresh);
              if (state.length > 4 * 1024 ** 2)
                throw new AppError(
                  413,
                  "WIKI_TOO_LARGE",
                  "Wiki content exceeds the supported size.",
                );
              if (Buffer.byteLength(wikiMarkdown(fresh), "utf8") > 2 * 1024 ** 2)
                throw new AppError(413, "WIKI_TOO_LARGE", "Wiki Markdown exceeds 2 MiB.");
              await tx.insert(wikiUpdate).values({
                documentId: room.id,
                update: Buffer.from(Y.encodeStateAsUpdate(fresh, vector)).toString("base64"),
              });
              await tx
                .update(officeDocument)
                .set({ wikiState: Buffer.from(state).toString("base64"), state: "editing" })
                .where(eq(officeDocument.id, room.id));
              await tx.execute(
                sql`delete from wiki_updates where document_id = ${room.id} and id not in (select id from wiki_updates where document_id = ${room.id} order by created_at desc,id desc limit 1000)`,
              );
              await tx.execute(sql`select pg_notify('lumo_wiki',${room.id})`);
              committed = state;
              room.actor = client.ticket.actor;
            }
          } finally {
            fresh.destroy();
          }
        },
      );
      if (committed) {
        Y.applyUpdate(room.doc, committed, "database");
        syncUpdate(room, committed);
        room.dirty = true;
        schedule(room);
      }
      if (encoding.length(response) > 1 && socket.readyState === WebSocket.OPEN)
        socket.send(encoding.toUint8Array(response));
    } else if (type === 1) {
      await office.scoped(
        client.ticket.workspaceId,
        client.ticket.actor,
        room.id,
        async (_tx, doc) => {
          if (doc.generation !== client.ticket.generation) throw new Error("Stale Wiki generation");
        },
      );
      const raw = decoding.createDecoder(decoding.readVarUint8Array(decoder)),
        count = decoding.readVarUint(raw);
      if (count > 200) throw new Error("Invalid awareness count");
      for (let index = 0; index < count; index++) {
        const id = decoding.readVarUint(raw),
          clock = decoding.readVarUint(raw),
          state: unknown = JSON.parse(decoding.readVarString(raw));
        // y-websocket relays remote awareness. Only this socket's own identity is writable.
        if (client.awarenessId !== undefined && client.awarenessId !== id) continue;
        if (
          [...room.clients.values()].some((other) => other !== client && other.awarenessId === id)
        )
          continue;
        client.awarenessId = id;
        const safe =
          state === null
            ? null
            : {
                ...z
                  .object({ cursor: z.unknown().optional(), selection: z.unknown().optional() })
                  .parse(state),
                user: {
                  id: client.ticket.actor,
                  name: client.ticket.name,
                  color: "#2563eb",
                  colorLight: "#2563eb33",
                },
              };
        const encoded = encoding.createEncoder();
        encoding.writeVarUint(encoded, 1);
        encoding.writeVarUint(encoded, id);
        encoding.writeVarUint(encoded, clock);
        encoding.writeVarString(encoded, JSON.stringify(safe));
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          encoding.toUint8Array(encoded),
          socket,
        );
      }
    } else if (type === 3) {
      socket.send(
        message(
          1,
          awarenessProtocol.encodeAwarenessUpdate(room.awareness, [
            ...room.awareness.getStates().keys(),
          ]),
        ),
      );
    } else throw new Error("Unsupported Wiki message");
  }
  async function connect(socket: WebSocket, ticket: Ticket) {
    const room = await load(ticket),
      lease = randomUUID();
    await office.scoped(ticket.workspaceId, ticket.actor, ticket.id, async (tx, doc) => {
      if (doc.generation !== ticket.generation)
        throw new AppError(409, "WIKI_STALE", "Reload this Wiki page.");
      if (room.clients.size >= 100)
        throw new AppError(429, "WIKI_CAPACITY", "This page has reached its connection limit.");
      await tx
        .insert(wikiConnection)
        .values({ id: lease, documentId: ticket.id, expiresAt: new Date(Date.now() + 45000) });
    });
    room.clients.set(socket, {
      ticket,
      lease,
      queued: 0,
      window: Date.now(),
      messages: 0,
      alive: true,
      queuedBytes: 0,
    });
    socket.on("pong", () => {
      const client = room.clients.get(socket);
      if (client) client.alive = true;
    });
    const step = encoding.createEncoder();
    encoding.writeVarUint(step, 0);
    syncProtocol.writeSyncStep1(step, room.doc);
    socket.send(encoding.toUint8Array(step));
    if (room.awareness.getStates().size)
      socket.send(
        message(
          1,
          awarenessProtocol.encodeAwarenessUpdate(room.awareness, [
            ...room.awareness.getStates().keys(),
          ]),
        ),
      );
    socket.on("message", (data, binary) => {
      const client = room.clients.get(socket);
      if (!client) return;
      if (Date.now() - client.window >= 1000) {
        client.window = Date.now();
        client.messages = 0;
      }
      client.messages++;
      client.queued++;
      if (client.messages > 100 || client.queued > 64) {
        socket.close(1013, "Reconnect to resume Wiki synchronization");
        return;
      }
      if (!binary) {
        socket.close(1003);
        return;
      }
      const bytes = Array.isArray(data)
        ? Buffer.concat(data)
        : data instanceof ArrayBuffer
          ? Buffer.from(data)
          : data;
      client.queuedBytes += bytes.byteLength;
      if (client.queuedBytes > 8 * 1024 ** 2) {
        socket.close(1013, "Wiki synchronization backlog exceeded");
        return;
      }
      room.queue = room.queue
        .then(() => receive(room, socket, bytes))
        .catch(() => socket.close(1008, "Wiki access or update rejected"))
        .finally(() => {
          client.queued--;
          client.queuedBytes -= bytes.byteLength;
        });
    });
    socket.on("error", () => socket.terminate());
    socket.on("close", () => {
      const client = room.clients.get(socket);
      room.clients.delete(socket);
      if (client?.awarenessId !== undefined)
        awarenessProtocol.removeAwarenessStates(room.awareness, [client.awarenessId], socket);
      void db
        .delete(wikiConnection)
        .where(eq(wikiConnection.id, lease))
        .catch(() => {});
      if (!room.clients.size) {
        if (room.timer) clearTimeout(room.timer);
        void room.queue
          .then(() => snapshot(room))
          .catch(() => {})
          .finally(() => {
            if (!room.clients.size) {
              rooms.delete(room.id);
              room.awareness.destroy();
              room.doc.destroy();
            }
          });
      }
    });
    socket.resume();
  }
  return {
    async issue(workspaceId: string, actor: string, name: string, id: string) {
      const { doc, access } = await office.wikiLocation(workspaceId, actor, id);
      const token = await sign(
        {
          purpose: "wiki-sync",
          format: "markdown-v1",
          workspaceId,
          actor,
          name,
          id,
          generation: doc.generation,
          exp: Math.floor(Date.now() / 1000) + 120,
        },
        env.BETTER_AUTH_SECRET,
        "HS256",
      );
      return {
        url: `${env.API_ORIGIN.replace(/^http/, "ws")}/api/internal/wiki`,
        name: id,
        editable: access.permission !== "viewer",
        user: { id: actor, name },
        token,
      };
    },
    attach(server: Server) {
      webSockets = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 ** 2 });
      server.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url ?? "/", env.API_ORIGIN);
        if (!url.pathname.startsWith("/api/internal/wiki/")) return;
        const origin = request.headers.origin;
        if (
          ![
            env.WEB_ORIGIN,
            "lumo://app",
            ...(env.NODE_ENV !== "production" ? ["http://127.0.0.1:5174"] : []),
          ].includes(origin ?? "")
        ) {
          socket.destroy();
          return;
        }
        void (async () => {
          const ticket = ticketSchema.parse(
            await verify(url.searchParams.get("ticket") ?? "", env.BETTER_AUTH_SECRET, "HS256"),
          );
          if (url.pathname !== `/api/internal/wiki/${ticket.id}`)
            throw new Error("Wrong Wiki scope");
          await office.wikiLocation(ticket.workspaceId, ticket.actor, ticket.id);
          webSockets!.handleUpgrade(request, socket, head, (ws) => {
            // Buffer the client's initial sync message until durable state and ACLs load.
            ws.pause();
            void connect(ws, ticket).catch(() => ws.close(1008));
          });
        })().catch(() => socket.destroy());
      });
      heartbeat = setInterval(() => {
        void db
          .delete(wikiConnection)
          .where(sql`${wikiConnection.expiresAt} < now()`)
          .catch(() => {});
        for (const room of rooms.values()) {
          // Recover content notifications missed during a LISTEN reconnect, and retry snapshots
          // without requiring an author to type another edit after storage recovers.
          room.queue = room.queue
            .then(async () => {
              await refresh(room.id);
              await snapshot(room);
            })
            .catch(() => {});
          for (const [socket, client] of room.clients) {
            if (!client.alive) {
              socket.terminate();
              continue;
            }
            client.alive = false;
            void office
              .scoped(client.ticket.workspaceId, client.ticket.actor, room.id, async (tx, doc) => {
                if (doc.generation !== client.ticket.generation)
                  throw new Error("Stale Wiki session");
                await tx
                  .update(wikiConnection)
                  .set({ expiresAt: new Date(Date.now() + 45000) })
                  .where(eq(wikiConnection.id, client.lease));
              })
              .then(
                () => socket.ping(),
                () => socket.close(1008),
              );
          }
        }
      }, 15000);
      heartbeat.unref();
    },
    refresh,
    awareness(payload: string) {
      try {
        const value = z
          .object({ id: z.uuid(), data: z.string().max(6000) })
          .parse(JSON.parse(payload));
        const room = rooms.get(value.id);
        if (room)
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            Buffer.from(value.data, "base64"),
            "remote",
          );
      } catch {
        /* Invalid operational notifications never reach clients. */
      }
    },
    async close() {
      if (heartbeat) clearInterval(heartbeat);
      for (const room of rooms.values()) {
        if (room.timer) clearTimeout(room.timer);
        await room.queue;
        await snapshot(room).catch(() => {});
        for (const socket of room.clients.keys()) socket.terminate();
        room.awareness.destroy();
        room.doc.destroy();
      }
      rooms.clear();
      webSockets?.close();
    },
  };
}
