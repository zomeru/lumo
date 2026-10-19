import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import type { Role } from "@lumo/contracts";
import type { DriveItem, DriveListInput, DriveUploadInput } from "@lumo/contracts/drive";
import { canManageSettings } from "@lumo/contracts/permissions";
import type { Database, Transaction } from "@lumo/database";
import {
  driveItem as item,
  driveShare as share,
  driveStar as star,
  storageCleanup,
  membership,
  user,
  auditEvent,
} from "@lumo/database/schema";
import type { ServerEnv } from "@lumo/env/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ZipFile } from "yazl";

import { AppError, denied, missing } from "../../lib/errors";
import {
  MULTIPART_THRESHOLD,
  PART_SIZE,
  URL_TTL_SECONDS,
  type Storage,
} from "../../storage/storage";
import type { createWorkspaceService } from "../workspaces/workspace.service";
import { previewType, validateSignature } from "./validation";

type Item = typeof item.$inferSelect;
type Access = {
  row: Item;
  chain: Item[];
  permission: "owner" | "editor" | "viewer";
  canManage: boolean;
};
function conflict(message: string): never {
  throw new AppError(409, "DRIVE_CONFLICT", message);
}
const expiry = () => new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString();
const later = () => new Date(Date.now() + 24 * 3600_000);

function metadataDto(
  row: Item,
  ownerName: string,
  starred: boolean,
  shared: boolean,
  permission: Access["permission"],
): DriveItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    parentId: row.parentId,
    ownerId: row.ownerId,
    ownerName,
    name: row.name,
    originalName: row.originalName,
    kind: row.kind,
    mimeType: row.mimeType,
    size: row.size,
    status: row.status,
    checksum: row.checksum,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    starred,
    shared,
    permission,
    canManage: permission === "owner",
  };
}

export function createDriveService(
  db: Database,
  workspaces: ReturnType<typeof createWorkspaceService>,
  storage: Storage,
  env: ServerEnv,
) {
  async function chain(tx: Transaction, workspaceId: string, id: string) {
    const rows: Item[] = [];
    let next: string | null = id;
    while (next) {
      if (rows.length >= 63 || rows.some((v) => v.id === next))
        conflict("Folder nesting exceeds the supported depth.");
      const [row] = await tx
        .select()
        .from(item)
        .where(and(eq(item.workspaceId, workspaceId), eq(item.id, next)));
      if (!row) missing();
      rows.push(row);
      next = row.parentId;
    }
    return rows;
  }
  async function access(
    tx: Transaction,
    workspaceId: string,
    userId: string,
    role: Role,
    id: string,
    trash = false,
  ): Promise<Access> {
    const ancestors = await chain(tx, workspaceId, id);
    const row = ancestors[0]!;
    if ((!trash && ancestors.some((v) => v.deletedAt)) || row.status === "deleting") missing();
    const canManage = canManageSettings(role) || ancestors.some((v) => v.ownerId === userId);
    const grants = await tx
      .select()
      .from(share)
      .where(
        and(
          eq(share.workspaceId, workspaceId),
          eq(share.userId, userId),
          inArray(
            share.itemId,
            ancestors.map((v) => v.id),
          ),
        ),
      );
    const permission = canManage
      ? "owner"
      : grants.some((v) => v.permission === "editor")
        ? "editor"
        : grants.length
          ? "viewer"
          : null;
    if (!permission) missing();
    return { row, chain: ancestors, canManage, permission };
  }
  function writable(value: Access) {
    if (value.permission === "viewer") denied();
  }
  function manageable(value: Access) {
    if (!value.canManage) denied();
  }
  async function destination(
    tx: Transaction,
    workspaceId: string,
    userId: string,
    role: Role,
    parentId: string | null,
  ) {
    if (!parentId) return;
    const parent = await access(tx, workspaceId, userId, role, parentId);
    writable(parent);
    if (parent.row.kind !== "folder" || parent.row.status !== "ready")
      conflict("Choose an available folder.");
    if (parent.chain.length >= 63) conflict("Folder nesting exceeds the supported depth.");
  }
  async function dto(tx: Transaction, value: Access, userId: string): Promise<DriveItem> {
    const { row, permission } = value;
    const [owner] = await tx.select({ name: user.name }).from(user).where(eq(user.id, row.ownerId));
    const [favorite] = await tx
      .select()
      .from(star)
      .where(and(eq(star.itemId, row.id), eq(star.userId, userId)));
    const [shared] = await tx
      .select()
      .from(share)
      .where(
        inArray(
          share.itemId,
          value.chain.map((v) => v.id),
        ),
      )
      .limit(1);
    return metadataDto(
      row,
      owner?.name ?? "Former member",
      Boolean(favorite),
      Boolean(shared),
      permission,
    );
  }

  async function descendants(tx: Transaction, workspaceId: string, id: string) {
    const result = await tx.execute<{ id: string; depth: number }>(sql`with recursive tree as (
      select id, 0 as depth from drive_items where workspace_id = ${workspaceId} and id = ${id}
      union all select child.id, tree.depth + 1 from drive_items child join tree on child.parent_id = tree.id where child.workspace_id = ${workspaceId} and tree.depth < 64
    ) select * from tree order by depth, id limit 1001`);
    if (result.rows.length > 1000)
      conflict("This folder contains too many items for a single operation (maximum 1,000).");
    return result.rows;
  }
  const scope = <T>(
    workspaceId: string,
    userId: string,
    action: (tx: Transaction, role: Role) => Promise<T>,
  ) => workspaces.withAccess(workspaceId, userId, (tx, _ws, member) => action(tx, member.role));
  async function audit(
    tx: Transaction,
    workspaceId: string,
    actorId: string,
    action: string,
    targetId: string,
  ) {
    await tx
      .insert(auditEvent)
      .values({ workspaceId, actorId, action: `drive.${action}`, targetId });
  }
  async function cleanupIntent(tx: Transaction, key: string, notBefore = later()) {
    await tx.insert(storageCleanup).values({ key, notBefore }).onConflictDoNothing();
  }
  function ready(row: Item) {
    if (row.status !== "ready" || row.kind !== "file")
      conflict("The file is not ready for download.");
  }

  const service = {
    async list(workspaceId: string, userId: string, input: DriveListInput) {
      return scope(workspaceId, userId, async (tx, role) => {
        let breadcrumbs: { id: string; name: string }[] = [],
          canWrite = input.view === "my";
        if (input.parentId) {
          const parent = await access(
            tx,
            workspaceId,
            userId,
            role,
            input.parentId,
            input.view === "trash",
          );
          if (parent.row.kind !== "folder") missing();
          // Ancestor names are private unless the user has access to each ancestor.
          for (const ancestor of [...parent.chain].reverse()) {
            try {
              await access(tx, workspaceId, userId, role, ancestor.id);
              breadcrumbs.push({ id: ancestor.id, name: ancestor.name });
            } catch (error) {
              if (!(error instanceof AppError && error.status === 404)) throw error;
            }
          }
          canWrite = input.view !== "trash" && parent.permission !== "viewer";
        }
        // Propagate effective ACLs and ancestor tombstones once, including direct
        // grants on a child whose parent is private. Pagination happens AFTER ACLs.
        const tree = sql`with recursive acl as (
          select d.id, d.parent_id, d.owner_id, d.deleted_at, d.deletion_id, d.status, 0 as depth,
            case when ${canManageSettings(role)} or d.owner_id = ${userId} then 3 when s.permission = 'editor' then 2 when s.permission = 'viewer' then 1 else 0 end as rank,
            d.deleted_at is not null as trashed,
            exists (select 1 from drive_shares ds where ds.item_id = d.id) as shared
          from drive_items d left join drive_shares s on s.item_id = d.id and s.user_id = ${userId}
          where d.workspace_id = ${workspaceId} and d.parent_id is null
          union all select d.id, d.parent_id, d.owner_id, d.deleted_at, d.deletion_id, d.status, acl.depth + 1,
            greatest(acl.rank, case when d.owner_id = ${userId} then 3 when s.permission = 'editor' then 2 when s.permission = 'viewer' then 1 else 0 end),
            acl.trashed or d.deleted_at is not null,
            acl.shared or exists (select 1 from drive_shares ds where ds.item_id = d.id)
          from drive_items d join acl on d.parent_id = acl.id left join drive_shares s on s.item_id = d.id and s.user_id = ${userId}
          where d.workspace_id = ${workspaceId} and acl.depth < 64
        )`;
        const view =
          input.view === "trash"
            ? sql`acl.trashed and d.deleted_at is not null and (p.deleted_at is null or p.deletion_id is distinct from d.deletion_id)`
            : sql`not acl.trashed`;
        const folder = input.parentId
          ? sql`d.parent_id = ${input.parentId}`
          : input.view === "my" && !input.q
            ? sql`d.parent_id is null and d.owner_id = ${userId}`
            : sql`true`;
        const mode =
          input.view === "starred" && !input.parentId
            ? sql`f.item_id is not null`
            : input.view === "shared" && !input.parentId
              ? sql`d.owner_id <> ${userId} and exists (select 1 from drive_shares ds where ds.item_id = d.id and ds.user_id = ${userId})`
              : sql`true`;
        const fileType =
          input.type === "all"
            ? sql`true`
            : input.type === "folder"
              ? sql`d.kind = 'folder'`
              : input.type === "pdf"
                ? sql`d.mime_type = 'application/pdf'`
                : input.type === "other"
                  ? sql`d.kind = 'file' and d.mime_type not like 'image/%' and d.mime_type not like 'text/%' and d.mime_type <> 'application/pdf'`
                  : sql`d.mime_type like ${input.type + "/%"}`;
        const sort = {
          name: sql`lower(d.name)`,
          size: sql`d.size`,
          type: sql`d.mime_type`,
          updatedAt: sql`d.updated_at`,
        }[input.view === "recent" ? "updatedAt" : input.sort];
        const direction =
          input.view === "recent" || input.direction === "desc" ? sql`desc` : sql`asc`;
        const result = await tx.execute<{
          id: string;
          rank: number;
          shared: boolean;
        }>(sql`${tree} select d.id, acl.rank, acl.shared from acl join drive_items d on d.id = acl.id left join drive_items p on p.id = d.parent_id left join drive_stars f on f.item_id = d.id and f.user_id = ${userId}
          where acl.rank > 0 and d.status in ('ready','failed') and ${view} and ${folder} and ${mode} and ${fileType} and d.name ilike ${"%" + input.q.replace(/[\\%_]/g, "\\$&") + "%"}
          order by (d.kind = 'folder') desc, ${sort} ${direction}, d.id asc limit ${input.limit + 1} offset ${input.offset}`);
        const totals = await tx.execute<{ size: string; count: string }>(
          sql`${tree} select coalesce(sum(d.size),0)::text as size, count(*)::text as count from acl join drive_items d on d.id = acl.id where acl.rank > 0 and not acl.trashed and d.status = 'ready' and d.kind = 'file'`,
        );
        const page = result.rows.slice(0, input.limit);
        const loaded = page.length
          ? await tx
              .select({ row: item, ownerName: user.name, starred: star.itemId })
              .from(item)
              .innerJoin(user, eq(user.id, item.ownerId))
              .leftJoin(star, and(eq(star.itemId, item.id), eq(star.userId, userId)))
              .where(
                and(
                  eq(item.workspaceId, workspaceId),
                  inArray(
                    item.id,
                    page.map((v) => v.id),
                  ),
                ),
              )
          : [];
        const byId = new Map(loaded.map((v) => [v.row.id, v]));
        const items = page.map((entry) => {
          const value = byId.get(entry.id)!;
          return metadataDto(
            value.row,
            value.ownerName,
            Boolean(value.starred),
            entry.shared,
            entry.rank === 3 ? "owner" : entry.rank === 2 ? "editor" : "viewer",
          );
        });
        return {
          items,
          breadcrumbs,
          canWrite,
          nextOffset: result.rows.length > input.limit ? input.offset + input.limit : null,
          totalSize: Number(totals.rows[0]?.size ?? 0),
          totalFiles: Number(totals.rows[0]?.count ?? 0),
        };
      });
    },
    async details(workspaceId: string, userId: string, id: string) {
      return scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id);
        return { item: await dto(tx, value, userId), breadcrumbs: [{ id, name: value.row.name }] };
      });
    },
    async folder(
      workspaceId: string,
      userId: string,
      input: { name: string; parentId: string | null },
    ) {
      return scope(workspaceId, userId, async (tx, role) => {
        await destination(tx, workspaceId, userId, role, input.parentId);
        const [row] = await tx
          .insert(item)
          .values({
            ...input,
            workspaceId,
            ownerId: userId,
            originalName: input.name,
            kind: "folder",
          })
          .returning();
        if (!row) throw new Error("Folder insert failed");
        await audit(tx, workspaceId, userId, "folder.created", row.id);
        return dto(tx, await access(tx, workspaceId, userId, role, row.id), userId);
      });
    },
    async initialize(workspaceId: string, userId: string, input: DriveUploadInput) {
      if (input.size > env.DRIVE_MAX_FILE_BYTES)
        throw new AppError(
          413,
          "FILE_TOO_LARGE",
          "The file exceeds this workspace's upload limit.",
        );
      const allowed = env.DRIVE_ALLOWED_MIME_TYPES.split(",").map((v) => v.trim());
      if (
        !allowed.includes("*") &&
        !allowed.some(
          (v) =>
            v === input.mimeType || (v.endsWith("/*") && input.mimeType.startsWith(v.slice(0, -1))),
        )
      )
        throw new AppError(400, "FILE_TYPE_NOT_ALLOWED", "This file type is not allowed.");
      const multipart = input.size >= MULTIPART_THRESHOLD;
      if (!multipart && !input.checksum)
        throw new AppError(400, "CHECKSUM_REQUIRED", "A SHA-256 checksum is required.");
      const id = randomUUID(),
        stagingKey = `drive-staging/${workspaceId}/${id}`,
        objectKey = `drive/${workspaceId}/${id}`;
      await scope(workspaceId, userId, async (tx, role) => {
        await destination(tx, workspaceId, userId, role, input.parentId);
        await tx.insert(item).values({
          id,
          workspaceId,
          ownerId: userId,
          parentId: input.parentId,
          name: input.name,
          originalName: input.name,
          size: input.size,
          mimeType: input.mimeType,
          kind: "file",
          status: "uploading",
          stagingKey,
          objectKey,
          checksum: input.checksum ?? null,
          uploadExpiresAt: later(),
        });
        await cleanupIntent(tx, stagingKey);
        await cleanupIntent(tx, objectKey);
      });
      let uploadId: string | undefined;
      try {
        uploadId = multipart ? await storage.startMultipart(stagingKey, input.mimeType) : undefined;
        const url = multipart
          ? undefined
          : await storage.putUrl(stagingKey, input.size, input.mimeType, input.checksum!);
        return await scope(workspaceId, userId, async (tx, role) => {
          const value = await access(tx, workspaceId, userId, role, id);
          if (value.row.status !== "uploading") conflict("The upload was canceled.");
          await tx
            .update(item)
            .set({ uploadId: uploadId ?? null })
            .where(eq(item.id, id));
          if (uploadId)
            await tx
              .update(storageCleanup)
              .set({ uploadId })
              .where(eq(storageCleanup.key, stagingKey));
          return {
            item: await dto(tx, value, userId),
            multipart,
            partSize: PART_SIZE,
            url,
            headers: multipart
              ? {}
              : { "Content-Type": input.mimeType, "x-amz-checksum-sha256": input.checksum! },
            expiresAt: expiry(),
          };
        });
      } catch (error) {
        if (uploadId) await storage.abort(stagingKey, uploadId).catch(() => {});
        await db
          .update(item)
          .set({ status: "failed" })
          .where(and(eq(item.id, id), eq(item.status, "uploading")));
        throw error;
      }
    },
    async part(
      workspaceId: string,
      userId: string,
      id: string,
      partNumber: number,
      checksum: string,
    ) {
      return scope(workspaceId, userId, async (tx, role) => {
        const { row } = await access(tx, workspaceId, userId, role, id);
        if (row.ownerId !== userId) denied();
        if (
          row.status !== "uploading" ||
          !row.stagingKey ||
          !row.uploadExpiresAt ||
          row.uploadExpiresAt <= new Date()
        )
          conflict("This upload is unavailable or expired.");
        if (!row.uploadId) {
          if (partNumber !== 1 || row.checksum !== checksum)
            conflict("The upload checksum has changed.");
          return {
            url: await storage.putUrl(row.stagingKey, row.size, row.mimeType, checksum),
            headers: { "Content-Type": row.mimeType, "x-amz-checksum-sha256": checksum },
            expiresAt: expiry(),
          };
        }
        const size = Math.min(PART_SIZE, row.size - (partNumber - 1) * PART_SIZE);
        if (size <= 0) throw new AppError(400, "INVALID_PART", "Invalid upload part.");
        return {
          url: await storage.partUrl(row.stagingKey, row.uploadId, partNumber, size, checksum),
          headers: { "x-amz-checksum-sha256": checksum },
          expiresAt: expiry(),
        };
      });
    },
    async complete(workspaceId: string, userId: string, id: string) {
      // The workspace lock serializes finalization against cancellation, sharing,
      // moves and membership revocation; storage work is bounded by the size limit.
      return scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id),
          row = value.row;
        if (row.ownerId !== userId) denied();
        if (row.status === "ready") return dto(tx, value, userId);
        if (
          row.status !== "uploading" ||
          !row.stagingKey ||
          !row.objectKey ||
          !row.uploadExpiresAt ||
          row.uploadExpiresAt <= new Date()
        )
          conflict("This upload is unavailable or expired.");
        await destination(tx, workspaceId, userId, role, row.parentId);
        if (row.uploadId) {
          try {
            const parts = await storage.parts(row.stagingKey, row.uploadId);
            if (
              parts.length !== Math.ceil(row.size / PART_SIZE) ||
              parts.some(
                (part, index) =>
                  part.partNumber !== index + 1 ||
                  part.size !== Math.min(PART_SIZE, row.size - index * PART_SIZE),
              )
            )
              conflict("The uploaded parts are incomplete or have incorrect sizes.");
            await storage.complete(row.stagingKey, row.uploadId, parts);
          } catch (error) {
            // Completion can succeed at S3 while the response or DB commit fails.
            if (!(error instanceof Error && error.name === "NoSuchUpload")) throw error;
          }
        }
        const metadata = await storage.stat(row.stagingKey);
        if (
          metadata.size !== row.size ||
          metadata.mimeType !== row.mimeType ||
          (!row.uploadId && row.checksum !== metadata.checksum)
        )
          throw new AppError(
            400,
            "UPLOAD_MISMATCH",
            "Uploaded file metadata does not match the upload request.",
          );
        validateSignature(row.mimeType, await storage.sample(row.stagingKey, row.size));
        await storage.copy(row.stagingKey, row.objectKey, metadata.etag);
        const final = await storage.stat(row.objectKey);
        if (final.size !== row.size) throw new Error("Promoted object size mismatch");
        await tx
          .update(item)
          .set({
            status: "ready",
            etag: final.etag,
            checksum: final.checksum,
            updatedAt: new Date(),
          })
          .where(eq(item.id, id));
        await tx.delete(storageCleanup).where(eq(storageCleanup.key, row.objectKey));
        // Keep the staging key until all issued PUT URLs have expired. A late PUT
        // cannot change the accepted object and is removed by the cleanup worker.
        await tx
          .update(storageCleanup)
          .set({ notBefore: new Date(Date.now() + (URL_TTL_SECONDS + 60) * 1000) })
          .where(eq(storageCleanup.key, row.stagingKey));
        await audit(tx, workspaceId, userId, "upload.completed", id);
        return dto(tx, await access(tx, workspaceId, userId, role, id), userId);
      });
    },
    async cancel(workspaceId: string, userId: string, id: string) {
      const canceled = await scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id);
        manageable(value);
        if (value.row.status === "ready") conflict("A completed upload cannot be canceled.");
        await tx
          .update(item)
          .set({ status: "failed", deletedAt: new Date(), deletionId: randomUUID() })
          .where(eq(item.id, id));
        for (const key of [value.row.stagingKey, value.row.objectKey])
          if (key)
            await tx
              .update(storageCleanup)
              .set({
                notBefore:
                  key === value.row.stagingKey
                    ? new Date(Date.now() + (URL_TTL_SECONDS + 60) * 1000)
                    : new Date(),
              })
              .where(eq(storageCleanup.key, key));
        return value.row;
      });
      // Cancellation is durable even during an S3 outage. The stored upload ID
      // lets maintenance retry aborting and delete any late-arriving parts.
      if (canceled.uploadId && canceled.stagingKey)
        await storage.abort(canceled.stagingKey, canceled.uploadId).catch(() => {});
    },
    async update(
      workspaceId: string,
      userId: string,
      id: string,
      input: { name?: string; parentId?: string | null },
    ) {
      return scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id);
        writable(value);
        if (value.row.status !== "ready") conflict("Wait for the upload to finish.");
        if (input.parentId !== undefined) {
          // Moving changes inherited access. Only a manager may change that boundary.
          manageable(value);
          await destination(tx, workspaceId, userId, role, input.parentId);
          const subtree = await descendants(tx, workspaceId, id);
          const parents = input.parentId ? await chain(tx, workspaceId, input.parentId) : [];
          if (
            parents.some((v) => v.id === id) ||
            parents.length + Math.max(...subtree.map((v) => v.depth)) >= 63
          )
            conflict("A folder cannot be moved into itself or exceed the nesting limit.");
        }
        await tx
          .update(item)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(item.id, id));
        await audit(tx, workspaceId, userId, "updated", id);
        return dto(tx, await access(tx, workspaceId, userId, role, id), userId);
      });
    },
    async trash(workspaceId: string, userId: string, id: string) {
      await scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id);
        writable(value);
        const ids = (await descendants(tx, workspaceId, id)).map((v) => v.id);
        await tx
          .update(item)
          .set({ deletedAt: new Date(), deletionId: randomUUID(), updatedAt: new Date() })
          .where(and(inArray(item.id, ids), sql`${item.deletedAt} is null`));
        await audit(tx, workspaceId, userId, "trashed", id);
      });
    },
    async restore(workspaceId: string, userId: string, id: string) {
      await scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id, true);
        manageable(value);
        if (!value.row.deletedAt || value.chain.slice(1).some((v) => v.deletedAt))
          conflict("Restore the parent folder first.");
        await destination(tx, workspaceId, userId, role, value.row.parentId);
        if (value.row.status !== "ready")
          conflict("Incomplete uploads cannot be restored. Upload the file again.");
        const ids = (await descendants(tx, workspaceId, id)).map((v) => v.id);
        await tx
          .update(item)
          .set({ deletedAt: null, deletionId: null, updatedAt: new Date() })
          .where(and(inArray(item.id, ids), eq(item.deletionId, value.row.deletionId!)));
        await audit(tx, workspaceId, userId, "restored", id);
      });
    },
    async purge(workspaceId: string, userId: string, id: string) {
      await scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id, true);
        manageable(value);
        if (!value.row.deletedAt) conflict("Move this item to Trash first.");
        const ids = (await descendants(tx, workspaceId, id)).map((v) => v.id);
        const rows = await tx.select().from(item).where(inArray(item.id, ids));
        for (const row of rows)
          for (const key of [row.objectKey, row.stagingKey])
            if (key) {
              await cleanupIntent(
                tx,
                key,
                key === row.stagingKey
                  ? new Date(Date.now() + (URL_TTL_SECONDS + 60) * 1000)
                  : new Date(),
              );
              await tx
                .update(storageCleanup)
                .set({
                  notBefore:
                    key === row.stagingKey
                      ? new Date(Date.now() + (URL_TTL_SECONDS + 60) * 1000)
                      : new Date(),
                  uploadId: key === row.stagingKey ? row.uploadId : null,
                })
                .where(eq(storageCleanup.key, key));
            }
        // Rows disappear only after physical cleanup, so partial failures are retryable.
        await tx.update(item).set({ status: "deleting" }).where(inArray(item.id, ids));
        await audit(tx, workspaceId, userId, "purged", id);
      });
    },
    async favorite(workspaceId: string, userId: string, id: string, starred: boolean) {
      await scope(workspaceId, userId, async (tx, role) => {
        await access(tx, workspaceId, userId, role, id);
        if (starred)
          await tx.insert(star).values({ workspaceId, userId, itemId: id }).onConflictDoNothing();
        else await tx.delete(star).where(and(eq(star.itemId, id), eq(star.userId, userId)));
      });
    },
    async shares(workspaceId: string, userId: string, id: string) {
      return scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id);
        const rows = await tx
          .select({
            userId: share.userId,
            name: user.name,
            permission: share.permission,
            itemId: share.itemId,
          })
          .from(share)
          .innerJoin(user, eq(user.id, share.userId))
          .where(
            inArray(
              share.itemId,
              value.chain.map((v) => v.id),
            ),
          );
        return {
          shares: rows.map(({ itemId, ...rest }) => ({
            ...rest,
            inheritedFrom: itemId === id ? null : itemId,
          })),
        };
      });
    },
    async grant(
      workspaceId: string,
      userId: string,
      id: string,
      targetId: string,
      permission: "viewer" | "editor" | null,
    ) {
      await scope(workspaceId, userId, async (tx, role) => {
        const value = await access(tx, workspaceId, userId, role, id);
        manageable(value);
        const [member] = await tx
          .select()
          .from(membership)
          .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, targetId)));
        if (!member) missing();
        if (targetId === value.row.ownerId) conflict("The owner already has full access.");
        if (permission)
          await tx
            .insert(share)
            .values({ workspaceId, itemId: id, userId: targetId, permission })
            .onConflictDoUpdate({ target: [share.itemId, share.userId], set: { permission } });
        else await tx.delete(share).where(and(eq(share.itemId, id), eq(share.userId, targetId)));
        await audit(tx, workspaceId, userId, permission ? "shared" : "share.revoked", id);
      });
    },
    async download(workspaceId: string, userId: string, id: string, preview = false) {
      return scope(workspaceId, userId, async (tx, role) => {
        const { row } = await access(tx, workspaceId, userId, role, id);
        ready(row);
        const mime = preview ? previewType(row.mimeType) : undefined;
        if (preview && !mime)
          throw new AppError(
            400,
            "PREVIEW_UNAVAILABLE",
            "Preview is unavailable for this file type.",
          );
        return {
          url: await storage.downloadUrl(row.objectKey!, row.name, mime),
          expiresAt: expiry(),
        };
      });
    },
  };
  return {
    ...service,
    async copy(
      workspaceId: string,
      userId: string,
      id: string,
      input: { name?: string; parentId?: string | null },
    ) {
      // Persist cleanup intents before copying any object. All copied objects are
      // removed if a later copy, access recheck, or metadata commit fails.
      const plan = await scope(workspaceId, userId, async (tx, role) => {
        const source = await access(tx, workspaceId, userId, role, id);
        const parentId = input.parentId === undefined ? source.row.parentId : input.parentId;
        await destination(tx, workspaceId, userId, role, parentId);
        if (parentId && (await chain(tx, workspaceId, parentId)).some((v) => v.id === id))
          conflict("Choose a destination outside the source folder.");
        const tree = await descendants(tx, workspaceId, id);
        if (tree.length > 100) conflict("Copy at most 100 items at a time.");
        const parentDepth = parentId ? (await chain(tx, workspaceId, parentId)).length : 0;
        if (parentDepth + Math.max(...tree.map((v) => v.depth)) >= 63)
          conflict("The copy would exceed the nesting limit.");
        const map = new Map(tree.map((v) => [v.id, randomUUID()]));
        const rows: Item[] = [];
        const sourceMap: Record<string, string> = {};
        for (const node of tree) {
          const value = await access(tx, workspaceId, userId, role, node.id, true);
          if (value.chain.some((v) => v.deletedAt)) continue;
          if (value.row.status !== "ready") conflict("Wait for all uploads to complete.");
          const newId = map.get(node.id)!;
          sourceMap[newId] = node.id;
          const row = {
            ...value.row,
            id: newId,
            ownerId: userId,
            parentId: node.id === id ? parentId : map.get(value.row.parentId!)!,
            name: node.id === id ? (input.name ?? `${source.row.name} (copy)`) : value.row.name,
            objectKey: value.row.kind === "file" ? `drive/${workspaceId}/${newId}` : null,
            stagingKey: null,
            uploadId: null,
            uploadExpiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            deletionId: null,
          };
          if (row.objectKey) await cleanupIntent(tx, row.objectKey);
          rows.push(row);
        }
        if (rows.reduce((total, v) => total + v.size, 0) > 512 * 1024 ** 2)
          conflict("Copy at most 512 MiB at a time.");
        return { rows, sources: tree.map((v) => v.id), sourceMap, parentId };
      });
      return scope(workspaceId, userId, async (tx, role) => {
        await destination(tx, workspaceId, userId, role, plan.parentId);
        for (const sourceId of plan.sources)
          await access(tx, workspaceId, userId, role, sourceId, true);
        // Source metadata is re-read under the shared workspace lock.
        for (const row of plan.rows) {
          const current = await access(tx, workspaceId, userId, role, plan.sourceMap[row.id]!);
          if (row.objectKey) {
            await storage.copy(current.row.objectKey!, row.objectKey, current.row.etag!);
            const metadata = await storage.stat(row.objectKey);
            if (metadata.size !== row.size) conflict("The source changed. Retry the copy.");
            row.etag = metadata.etag;
            row.checksum = metadata.checksum;
          }
          await tx.insert(item).values(row);
          if (row.objectKey)
            await tx.delete(storageCleanup).where(eq(storageCleanup.key, row.objectKey));
        }
        await audit(tx, workspaceId, userId, "copied", id);
        return dto(tx, await access(tx, workspaceId, userId, role, plan.rows[0]!.id), userId);
      });
    },
    async archive(workspaceId: string, userId: string, ids: string[]) {
      const key = `drive-archives/${workspaceId}/${randomUUID()}.zip`;
      await scope(workspaceId, userId, async (tx) =>
        cleanupIntent(tx, key, new Date(Date.now() + 3600_000)),
      );
      return scope(workspaceId, userId, async (tx, role) => {
        const files = new Map<string, { row: Item; path: string }>();
        async function add(id: string, prefix: string) {
          if (files.has(id)) return;
          const value = await access(tx, workspaceId, userId, role, id, true);
          if (value.chain.some((v) => v.deletedAt)) return;
          if (value.row.status !== "ready") conflict("Only completed uploads can be archived.");
          // IDs prevent collisions even when siblings have identical display names.
          const path = `${prefix}${value.row.name.replace(/[:\\/]/g, "_")} (${value.row.id.slice(0, 8)})`;
          files.set(id, { row: value.row, path });
          if (files.size > 500) conflict("Download at most 500 items per archive.");
          if (value.row.kind === "folder") {
            const children = await tx
              .select({ id: item.id })
              .from(item)
              .where(and(eq(item.workspaceId, workspaceId), eq(item.parentId, id)));
            for (const child of children) await add(child.id, path + "/");
          }
        }
        for (const id of [...new Set(ids)]) {
          await access(tx, workspaceId, userId, role, id);
          await add(id, "");
        }
        if ([...files.values()].reduce((sum, v) => sum + v.row.size, 0) > 512 * 1024 ** 2)
          conflict("Download at most 512 MiB per archive.");
        const zip = new ZipFile();
        const output = Readable.from(zip.outputStream);
        const streams: Readable[] = [];
        zip.on("error", (error: Error) => output.destroy(error));
        try {
          const upload = storage.write(key, output);
          // Attach a rejection handler immediately while populating the archive.
          void upload.catch((error: unknown) =>
            output.destroy(error instanceof Error ? error : new Error("Archive upload failed")),
          );
          for (const { row, path } of files.values()) {
            if (row.kind === "folder") zip.addEmptyDirectory(path + "/");
            else
              zip.addReadStreamLazy(path, { size: row.size }, (callback) => {
                void storage.read(row.objectKey!).then(
                  (stream) => {
                    streams.push(stream);
                    callback(null, stream);
                  },
                  (error: unknown) => {
                    callback(error, Readable.from([]));
                  },
                );
              });
          }
          zip.end();
          await upload;
        } catch (error) {
          for (const stream of streams) stream.destroy();
          output.destroy();
          throw error;
        }
        return { url: await storage.downloadUrl(key, "Lumo Drive.zip"), expiresAt: expiry() };
      });
    },
  };
}
