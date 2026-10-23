import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { idSchema } from "@lumolynk/contracts";
import type { DriveListInput } from "@lumolynk/contracts/drive";
import { officeFormats, officeFileKind, type OfficeKind } from "@lumolynk/contracts/office";
import type { Database, Transaction } from "@lumolynk/database";
import {
  officeDocument as document,
  officeVersion as version,
  officeCallback,
  wikiPage,
  driveItem,
  storageCleanup,
  workspace,
  user,
  auditEvent,
  wikiConnection,
} from "@lumolynk/database/schema";
import type { ServerEnv } from "@lumolynk/env/server";
import { and, desc, eq, sql } from "drizzle-orm";
import * as Y from "yjs";

import { AppError, missing, denied } from "../../lib/errors";
import type { Storage } from "../../storage/storage";
import type { createDriveService } from "../drive/drive.service";
import type { createWorkspaceService } from "../workspaces/workspace.service";
import { validateOfficeFile } from "./format";
import { OFFICE_MAX_BYTES, officeKey, type OfficeProvider } from "./provider";
import { officeTemplate } from "./templates";
import { initialWikiDocument, wikiMarkdown, isSourceWiki } from "./wiki-markdown";

const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("base64");
export async function officeBytes(stream: Readable) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of stream) {
    const chunk = Buffer.from(value as Uint8Array);
    size += chunk.length;
    if (size > OFFICE_MAX_BYTES) {
      stream.destroy();
      throw new AppError(413, "OFFICE_FILE_TOO_LARGE", "The file exceeds the 64 MiB editor limit.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function createOfficeService(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  drive: ReturnType<typeof createDriveService>,
  storage: Storage,
  env: ServerEnv,
  provider: OfficeProvider,
) {
  const policy = drive.policy;
  const key = (doc: typeof document.$inferSelect) =>
    officeKey(doc.workspaceId, doc.id, doc.generation, env.API_ORIGIN);
  async function event(
    tx: Transaction,
    workspaceId: string,
    actorId: string | null,
    action: string,
    id: string,
  ) {
    await tx
      .insert(auditEvent)
      .values({ workspaceId, actorId, action: `office.${action}`, targetId: id });
  }
  async function intent(objectKey: string) {
    await db
      .insert(storageCleanup)
      .values({ key: objectKey, notBefore: new Date(Date.now() + 24 * 3600_000) })
      .onConflictDoNothing();
  }
  async function scoped<T>(
    workspaceId: string,
    actor: string,
    id: string,
    action: (
      tx: Transaction,
      doc: typeof document.$inferSelect,
      access: Awaited<ReturnType<typeof policy.access>>,
    ) => Promise<T>,
  ) {
    return workspaces.withAccess(workspaceId, actor, async (tx, _ws, member) => {
      const access = await policy.access(tx, workspaceId, actor, member.role, id);
      if (access.row.kind !== "file" || access.row.status !== "ready") missing();
      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)));
      if (!doc) missing();
      return action(tx, doc, access);
    });
  }
  async function attach(workspaceId: string, actor: string, id: string) {
    return workspaces.withAccess(workspaceId, actor, async (tx, _ws, member) => {
      const access = await policy.access(tx, workspaceId, actor, member.role, id);
      if (access.row.status !== "ready") missing();
      const [existing] = await tx.select().from(document).where(eq(document.id, id));
      if (existing) return existing;
      const kind = officeFileKind(access.row);
      if (!kind || kind === "wiki")
        throw new AppError(
          400,
          "OFFICE_UNSUPPORTED",
          "This file cannot be opened in the Office editor. Create Markdown pages from Wiki.",
        );
      const bytes = await officeBytes(await storage.read(access.row.objectKey!));
      await validateOfficeFile(bytes, kind);
      const [doc] = await tx.insert(document).values({ id, workspaceId, kind }).returning();
      await tx.insert(version).values({
        workspaceId,
        documentId: id,
        number: 1,
        objectKey: access.row.objectKey!,
        checksum: sha(bytes),
        size: bytes.length,
        source: "import",
        generation: 0,
        actorId: actor,
      });
      await event(tx, workspaceId, actor, "imported", id);
      return doc!;
    });
  }
  async function detail(workspaceId: string, actor: string, id: string) {
    await attach(workspaceId, actor, id);
    return scoped(workspaceId, actor, id, async (tx, doc, access) => ({
      item: await policy.dto(tx, access, actor),
      kind: doc.kind,
      version: doc.version,
      generation: doc.generation,
      state:
        doc.kind === "wiki"
          ? doc.state === "error"
            ? "error"
            : (
                  await tx
                    .select({ id: wikiConnection.id })
                    .from(wikiConnection)
                    .where(
                      and(
                        eq(wikiConnection.documentId, id),
                        sql`${wikiConnection.expiresAt} > now()`,
                      ),
                    )
                    .limit(1)
                ).length
              ? "editing"
              : "idle"
          : doc.state,
      savedAt: doc.savedAt.toISOString(),
    }));
  }
  async function saveRevision(
    tx: Transaction,
    doc: typeof document.$inferSelect,
    bytes: Buffer,
    objectKey: string,
    source: typeof version.$inferInsert.source,
    actorId: string | null,
    wikiState?: string,
    final = false,
  ) {
    const metadata = await storage.stat(objectKey),
      number = doc.version + 1,
      now = new Date();
    if (metadata.size !== bytes.length) throw new Error("Office snapshot verification failed");
    await tx.insert(version).values({
      workspaceId: doc.workspaceId,
      documentId: doc.id,
      number,
      objectKey,
      checksum: sha(bytes),
      size: bytes.length,
      source,
      generation: doc.generation,
      actorId,
      wikiState,
    });
    await tx
      .update(driveItem)
      .set({
        objectKey,
        size: bytes.length,
        checksum: sha(bytes),
        etag: metadata.etag,
        updatedAt: now,
      })
      .where(eq(driveItem.id, doc.id));
    await tx
      .update(document)
      .set({
        version: number,
        savedAt: now,
        state: "editing",
        ...(wikiState !== undefined ? { wikiState } : {}),
        ...(final ? { generation: doc.generation + 1, state: "idle" as const } : {}),
      })
      .where(eq(document.id, doc.id));
    await tx.delete(storageCleanup).where(eq(storageCleanup.key, objectKey));
    await event(tx, doc.workspaceId, actorId, source, doc.id);
  }
  const service = {
    scoped,
    key,
    provider,
    list: (workspaceId: string, actor: string, input: DriveListInput, kind?: OfficeKind) =>
      drive.list(
        workspaceId,
        actor,
        {
          ...input,
          type:
            kind ??
            (["document", "sheet", "slide", "wiki"].includes(input.type) ? input.type : "office"),
        },
        true,
      ),
    detail,
    async create(
      workspaceId: string,
      actor: string,
      input: {
        name: string;
        kind: OfficeKind;
        parentId: string | null;
        parentPageId?: string | null;
      },
    ) {
      let parentId = input.parentId,
        folderId: string | undefined;
      if (input.kind === "wiki") {
        if (input.parentPageId) {
          const [parent] = await db
            .select()
            .from(wikiPage)
            .where(and(eq(wikiPage.workspaceId, workspaceId), eq(wikiPage.id, input.parentPageId)));
          if (!parent) missing();
          parentId = parent.folderId;
        }
        const folder = await drive.folder(workspaceId, actor, { name: input.name, parentId });
        folderId = folder.id;
        parentId = folder.id;
      }
      const format = officeFormats[input.kind],
        bytes = officeTemplate(input.kind);
      await validateOfficeFile(bytes, input.kind);
      const name = input.name.toLowerCase().endsWith(`.${format.extension}`)
        ? input.name
        : `${input.name}.${format.extension}`;
      const initialized = await drive.initialize(workspaceId, actor, {
        name,
        parentId,
        mimeType: format.mime,
        size: bytes.length,
        checksum: sha(bytes),
      });
      const [row] = await db.select().from(driveItem).where(eq(driveItem.id, initialized.item.id));
      await storage.write(row!.stagingKey!, Readable.from(bytes), format.mime);
      const item = await drive.complete(workspaceId, actor, row!.id);
      let wikiState: string | undefined;
      if (input.kind === "wiki") {
        const initial = initialWikiDocument(bytes.toString("utf8"));
        wikiState = Buffer.from(Y.encodeStateAsUpdate(initial)).toString("base64");
        initial.destroy();
      }
      await workspaces.withAccess(workspaceId, actor, async (tx) => {
        await tx.insert(document).values({ id: item.id, workspaceId, kind: input.kind, wikiState });
        await tx.insert(version).values({
          workspaceId,
          documentId: item.id,
          number: 1,
          objectKey: row!.objectKey!,
          checksum: sha(bytes),
          size: bytes.length,
          source: "initial",
          wikiState,
          generation: 0,
          actorId: actor,
        });
        if (folderId) {
          const parentPage = input.parentPageId ?? null;
          const [last] = await tx
            .select({ position: wikiPage.position })
            .from(wikiPage)
            .where(
              and(
                eq(wikiPage.workspaceId, workspaceId),
                parentPage ? eq(wikiPage.parentId, parentPage) : sql`${wikiPage.parentId} is null`,
              ),
            )
            .orderBy(desc(wikiPage.position))
            .limit(1);
          await tx.insert(wikiPage).values({
            id: item.id,
            workspaceId,
            folderId,
            parentId: parentPage,
            position: (last?.position ?? -1) + 1,
          });
        }
        await event(tx, workspaceId, actor, "created", item.id);
      });
      return detail(workspaceId, actor, item.id);
    },
    async editor(workspaceId: string, actor: string, name: string, id: string) {
      await attach(workspaceId, actor, id);
      const config = provider.configured();
      return scoped(workspaceId, actor, id, async (tx, doc, access) => {
        if (doc.kind === "wiki")
          throw new AppError(400, "WIKI_EDITOR_REQUIRED", "Open this page in Wiki.");
        const format = officeFormats[doc.kind],
          documentKey = key(doc);
        const [current] = await tx
          .select()
          .from(version)
          .where(and(eq(version.documentId, id), eq(version.number, doc.version)));
        if (!current) missing();
        const token = await provider.sign({
          purpose: "office-read",
          workspaceId,
          id,
          versionId: current.id,
          generation: doc.generation,
          actor,
          exp: Math.floor(Date.now() / 1000) + 300,
        });
        const editorConfig = {
          document: {
            key: documentKey,
            title: access.row.name,
            fileType: format.extension,
            url: `${config.api}/api/internal/onlyoffice/files/${id}/${current.id}?token=${encodeURIComponent(token)}`,
            permissions: { edit: access.permission !== "viewer", download: true, print: true },
          },
          documentType: format.documentType,
          editorConfig: {
            mode: access.permission === "viewer" ? ("view" as const) : ("edit" as const),
            callbackUrl: `${config.api}/api/internal/onlyoffice/callback/${id}/${doc.generation}`,
            user: { id: actor, name },
            coEditing: { mode: "fast" as const, change: false as const },
            // A cross-origin editor sees the embedding page's CSS color-scheme.
            // Follow LumoLynk's light/dark/system preference without replacing its iframe.
            customization: { forcesave: true as const, uiTheme: "theme-system" as const },
          },
        };
        if (access.permission !== "viewer")
          await tx.update(document).set({ state: "editing" }).where(eq(document.id, id));
        return {
          documentServerUrl: config.server,
          config: {
            ...editorConfig,
            token: await provider.sign({
              ...editorConfig,
              exp: Math.floor(Date.now() / 1000) + 300,
            }),
          },
        };
      });
    },
    async source(id: string, versionId: string, token: string) {
      const claims = await provider.verify(token);
      if (
        claims.purpose !== "office-read" ||
        claims.id !== id ||
        claims.versionId !== versionId ||
        typeof claims.workspaceId !== "string" ||
        typeof claims.actor !== "string" ||
        typeof claims.exp !== "number"
      )
        denied();
      return scoped(claims.workspaceId, claims.actor, id, async (tx, doc, access) => {
        if (claims.generation !== doc.generation) denied();
        const [revision] = await tx
          .select()
          .from(version)
          .where(and(eq(version.id, versionId), eq(version.documentId, id)));
        if (!revision) missing();
        return {
          stream: await storage.read(revision.objectKey),
          mime: officeFormats[doc.kind].mime,
          name: access.row.name,
          size: revision.size,
        };
      });
    },
    async callback(
      id: string,
      generation: number,
      body: unknown,
      authorization: string | undefined,
    ) {
      const data = await provider.callback(body, authorization),
        fingerprint = sha(`${data.key}:${data.status}:${data.url ?? ""}`);
      const [lookup] = await db.select().from(document).where(eq(document.id, id));
      if (!lookup) missing();
      if (data.key !== officeKey(lookup.workspaceId, id, generation, env.API_ORIGIN)) denied();
      const [duplicate] = await db
        .select()
        .from(officeCallback)
        .where(eq(officeCallback.fingerprint, fingerprint));
      if (duplicate) return;
      if (lookup.generation !== generation)
        throw new AppError(
          409,
          "OFFICE_STALE_SESSION",
          "The editing generation is no longer active.",
        );
      let objectKey: string | undefined;
      if (data.status === 2 || data.status === 6) {
        if (data.filetype && data.filetype !== officeFormats[lookup.kind].extension)
          throw new AppError(
            400,
            "OFFICE_FORMAT_CHANGED",
            "The provider returned a different file format.",
          );
        objectKey = `office/${lookup.workspaceId}/${id}/versions/${randomUUID()}.${officeFormats[lookup.kind].extension}`;
        await intent(objectKey);
      }
      try {
        await db.transaction(async (tx) => {
          await tx
            .select()
            .from(workspace)
            .where(eq(workspace.id, lookup.workspaceId))
            .for("update");
          const [doc] = await tx.select().from(document).where(eq(document.id, id));
          const [item] = await tx.select().from(driveItem).where(eq(driveItem.id, id));
          const [done] = await tx
            .select()
            .from(officeCallback)
            .where(eq(officeCallback.fingerprint, fingerprint));
          if (done) return;
          if (
            !doc ||
            !item ||
            item.deletedAt ||
            item.status !== "ready" ||
            doc.generation !== generation
          )
            throw new AppError(
              409,
              "OFFICE_STALE_SESSION",
              "The file is no longer available for this editing generation.",
            );
          if (objectKey) {
            // Serialize retrieval as well as promotion: a slow earlier download
            // must not commit after a later callback from the same generation.
            const bytes = await officeBytes(await provider.download(data.url!));
            await validateOfficeFile(bytes, doc.kind);
            await storage.write(objectKey, Readable.from(bytes), officeFormats[doc.kind].mime);
            const candidate = idSchema.safeParse(data.users?.[0]);
            const [editor] = candidate.success
              ? await tx.select({ id: user.id }).from(user).where(eq(user.id, candidate.data))
              : [];
            await saveRevision(
              tx,
              doc,
              bytes,
              objectKey,
              data.status === 2 ? "final-save" : "forcesave",
              editor?.id ?? null,
              undefined,
              data.status === 2,
            );
            await tx
              .insert(officeCallback)
              .values({ fingerprint, documentId: id, generation, status: data.status });
          } else {
            await tx
              .update(document)
              .set({ state: data.status === 1 ? "editing" : data.status === 4 ? "idle" : "error" })
              .where(eq(document.id, id));
            if ([3, 7].includes(data.status))
              await event(tx, doc.workspaceId, null, "save.failed", id);
          }
          await tx
            .delete(officeCallback)
            .where(sql`${officeCallback.createdAt} < now() - interval '7 days'`);
        });
      } catch (error) {
        if (objectKey)
          await db.transaction(async (tx) => {
            await tx
              .select()
              .from(workspace)
              .where(eq(workspace.id, lookup.workspaceId))
              .for("update");
            const [current] = await tx.select().from(document).where(eq(document.id, id));
            if (current?.generation === generation && current.version === lookup.version) {
              await tx.update(document).set({ state: "error" }).where(eq(document.id, id));
              await event(tx, lookup.workspaceId, null, "save.failed", id);
            }
          });
        throw error;
      }
    },
    async versions(workspaceId: string, actor: string, id: string) {
      return scoped(workspaceId, actor, id, async (tx) => ({
        versions: await tx
          .select({
            id: version.id,
            number: version.number,
            size: version.size,
            checksum: version.checksum,
            source: version.source,
            actorName: user.name,
            createdAt: version.createdAt,
          })
          .from(version)
          .leftJoin(user, eq(user.id, version.actorId))
          .where(eq(version.documentId, id))
          .orderBy(desc(version.number))
          .then((rows) => rows.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))),
      }));
    },
    async versionDownload(workspaceId: string, actor: string, id: string, versionId: string) {
      return scoped(workspaceId, actor, id, async (tx, _doc, access) => {
        const [revision] = await tx
          .select()
          .from(version)
          .where(and(eq(version.id, versionId), eq(version.documentId, id)));
        if (!revision) missing();
        return {
          url: await storage.downloadUrl(revision.objectKey, access.row.name),
          expiresAt: new Date(Date.now() + 120000).toISOString(),
        };
      });
    },
    async restore(workspaceId: string, actor: string, id: string, versionId: string) {
      const objectKey = `office/${workspaceId}/${id}/versions/${randomUUID()}`;
      await intent(objectKey);
      await scoped(workspaceId, actor, id, async (tx, doc, access) => {
        policy.manageable(access);
        await policy.editableTree(tx, workspaceId, id);
        if (doc.kind !== "wiki" && doc.state !== "idle")
          throw new AppError(
            409,
            "OFFICE_ACTIVE",
            "Close all editors and wait for the final save before restoring a revision.",
          );
        const [revision] = await tx
          .select()
          .from(version)
          .where(and(eq(version.id, versionId), eq(version.documentId, id)));
        if (!revision) missing();
        if (doc.kind === "wiki") {
          const [current] = await tx
            .select()
            .from(version)
            .where(and(eq(version.documentId, id), eq(version.number, doc.version)));
          if (current?.wikiState !== doc.wikiState)
            throw new AppError(
              409,
              "WIKI_SNAPSHOT_PENDING",
              "Open this Wiki page and wait for its latest snapshot before restoring history.",
            );
        }
        const bytes = await officeBytes(await storage.read(revision.objectKey));
        await validateOfficeFile(bytes, doc.kind);
        await storage.write(objectKey, Readable.from(bytes), officeFormats[doc.kind].mime);
        await saveRevision(
          tx,
          doc,
          bytes,
          objectKey,
          "restore",
          actor,
          revision.wikiState ?? undefined,
          true,
        );
      });
      return detail(workspaceId, actor, id);
    },
    async forceSave(workspaceId: string, actor: string, id: string) {
      const documentKey = await scoped(workspaceId, actor, id, async (_tx, doc, access) => {
        policy.writable(access);
        if (doc.kind === "wiki")
          throw new AppError(
            400,
            "WIKI_EDITOR_REQUIRED",
            "Wiki snapshots are saved by its collaboration service.",
          );
        return key(doc);
      });
      // A provider can wait for the callback ACK before completing this command.
      // The callback must be able to acquire the workspace lock while it runs.
      return provider.command({ c: "forcesave", key: documentKey });
    },
    async tree(workspaceId: string, actor: string) {
      const pages = await db
        .select()
        .from(wikiPage)
        .where(eq(wikiPage.workspaceId, workspaceId))
        .orderBy(wikiPage.position, wikiPage.id);
      await workspaces.requireAccess(workspaceId, actor);
      const result = [];
      for (const page of pages) {
        try {
          result.push({
            ...(await detail(workspaceId, actor, page.id)),
            parentId: page.parentId,
            position: page.position,
          });
        } catch (error) {
          if (!(error instanceof AppError && error.status === 404)) throw error;
        }
      }
      const visible = new Set(result.map((v) => v.item.id));
      return {
        pages: result.map((page) => ({
          ...page,
          parentId: page.parentId && visible.has(page.parentId) ? page.parentId : null,
        })),
      };
    },
    async wikiLocation(workspaceId: string, actor: string, id: string) {
      return scoped(workspaceId, actor, id, async (tx, doc, access) => {
        if (doc.kind !== "wiki") missing();
        if (doc.wikiState) {
          const previous = new Y.Doc();
          try {
            Y.applyUpdate(previous, Buffer.from(doc.wikiState, "base64"));
            if (!isSourceWiki(previous)) {
              const next = initialWikiDocument(wikiMarkdown(previous));
              const wikiState = Buffer.from(Y.encodeStateAsUpdate(next)).toString("base64");
              next.destroy();
              doc = { ...doc, wikiState, generation: doc.generation + 1 };
              await tx
                .update(document)
                .set({ wikiState, generation: doc.generation })
                .where(eq(document.id, id));
            }
          } finally {
            previous.destroy();
          }
        }
        const [page] = await tx.select().from(wikiPage).where(eq(wikiPage.id, id));
        if (!page) missing();
        return { page, doc, access };
      });
    },
    async wikiMove(
      workspaceId: string,
      actor: string,
      id: string,
      parentId: string | null,
      position: number,
    ) {
      return scoped(workspaceId, actor, id, async (tx, doc, access) => {
        if (doc.kind !== "wiki") missing();
        policy.manageable(access);
        await policy.editableTree(tx, workspaceId, id);
        const [page] = await tx.select().from(wikiPage).where(eq(wikiPage.id, id));
        if (!page) missing();
        let current = parentId,
          folder: string | null = null,
          depth = 0;
        const seen = new Set<string>([id]);
        while (current) {
          if (seen.has(current) || depth++ >= 62)
            throw new AppError(409, "WIKI_CYCLE", "A page cannot be moved into its descendants.");
          seen.add(current);
          const [parent] = await tx
            .select()
            .from(wikiPage)
            .where(and(eq(wikiPage.id, current), eq(wikiPage.workspaceId, workspaceId)));
          if (!parent) missing();
          if (current === parentId) folder = parent.folderId;
          current = parent.parentId;
        }
        // Reuse Drive's policy with the actual membership role, including admin inheritance.
        const { member } = await workspaces.requireAccess(workspaceId, actor);
        const container = await policy.access(tx, workspaceId, actor, member.role, page.folderId);
        policy.manageable(container);
        await policy.destination(tx, workspaceId, actor, member.role, folder);
        await policy.editableTree(tx, workspaceId, page.folderId);
        const nodes = await policy.descendants(tx, workspaceId, page.folderId);
        if (nodes.some((v) => v.id === folder))
          throw new AppError(409, "WIKI_CYCLE", "Choose a destination outside this page.");
        const parentDepth = folder ? (await policy.chain(tx, workspaceId, folder)).length : 0;
        for (const node of nodes) {
          const chain = await policy.chain(tx, workspaceId, node.id);
          const subtreeDepth = chain.findIndex((v) => v.id === page.folderId) + 1;
          if (parentDepth + subtreeDepth > 63)
            throw new AppError(409, "WIKI_DEPTH", "This move exceeds the supported folder depth.");
        }
        await tx
          .update(driveItem)
          .set({ parentId: folder, updatedAt: new Date() })
          .where(eq(driveItem.id, page.folderId));
        const siblings = await tx
          .select({ id: wikiPage.id })
          .from(wikiPage)
          .where(
            and(
              eq(wikiPage.workspaceId, workspaceId),
              parentId ? eq(wikiPage.parentId, parentId) : sql`${wikiPage.parentId} is null`,
              sql`${wikiPage.id} <> ${id}`,
            ),
          )
          .orderBy(wikiPage.position, wikiPage.id);
        siblings.splice(Math.min(position, siblings.length), 0, { id });
        await tx.update(wikiPage).set({ parentId }).where(eq(wikiPage.id, id));
        for (const [order, sibling] of siblings.entries())
          await tx.update(wikiPage).set({ position: order }).where(eq(wikiPage.id, sibling.id));
        await event(tx, workspaceId, actor, "wiki.moved", id);
      });
    },
    async wikiCopy(workspaceId: string, actor: string, id: string) {
      const source = await scoped(workspaceId, actor, id, async (tx, doc, access) => {
        if (doc.kind !== "wiki") missing();
        await policy.editableTree(tx, workspaceId, id);
        const [page] = await tx.select().from(wikiPage).where(eq(wikiPage.id, id));
        if (!page) missing();
        let bytes: Buffer;
        if (doc.wikiState) {
          const current = new Y.Doc();
          try {
            Y.applyUpdate(current, Buffer.from(doc.wikiState, "base64"));
            bytes = Buffer.from(wikiMarkdown(current));
          } finally {
            current.destroy();
          }
        } else bytes = await officeBytes(await storage.read(access.row.objectKey!));
        return {
          bytes,
          name: access.row.name.replace(/\.md$/i, "").slice(0, 228) + " (copy)",
          parentId: page.parentId,
        };
      });
      const copy = await service.create(workspaceId, actor, {
        name: source.name,
        kind: "wiki",
        parentId: null,
        parentPageId: source.parentId,
      });
      const initial = initialWikiDocument(source.bytes.toString("utf8"));
      const state = Buffer.from(Y.encodeStateAsUpdate(initial)).toString("base64");
      initial.destroy();
      await scoped(workspaceId, actor, copy.item.id, async (tx) => {
        await tx.update(document).set({ wikiState: state }).where(eq(document.id, copy.item.id));
      });
      await service.wikiSnapshot(workspaceId, actor, copy.item.id, source.bytes, state);
      return detail(workspaceId, actor, copy.item.id);
    },
    async wikiSnapshot(
      workspaceId: string,
      actor: string,
      id: string,
      bytes: Buffer,
      wikiState: string,
    ) {
      const objectKey = `office/${workspaceId}/${id}/versions/${randomUUID()}.md`;
      await intent(objectKey);
      await validateOfficeFile(bytes, "wiki");
      await storage.write(objectKey, Readable.from(bytes), "text/markdown");
      await scoped(workspaceId, actor, id, async (tx, doc, access) => {
        policy.writable(access);
        if (doc.kind !== "wiki") missing();
        if (doc.wikiState !== wikiState)
          throw new AppError(409, "WIKI_CHANGED", "The page changed while saving its snapshot.");
        const [current] = await tx
          .select()
          .from(version)
          .where(and(eq(version.documentId, id), eq(version.number, doc.version)));
        if (current?.wikiState === wikiState) return;
        await saveRevision(tx, doc, bytes, objectKey, "wiki", actor, wikiState);
      });
    },
  };
  return service;
}
export type OfficeService = ReturnType<typeof createOfficeService>;
