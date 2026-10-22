import { randomUUID } from "node:crypto";

import type { Database } from "@lumo/database";
import {
  driveItem,
  storageCleanup,
  workspace,
  officeVersion,
  messengerAttachment,
  messengerMessage,
} from "@lumo/database/schema";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

import type { Storage } from "./storage";

export async function cleanupStorage(db: Database, storage: Storage) {
  const due = await db
    .select()
    .from(storageCleanup)
    .where(lte(storageCleanup.notBefore, new Date()))
    .orderBy(asc(storageCleanup.notBefore))
    .limit(50);
  let failures = 0;
  for (const candidate of due) {
    try {
      await db.transaction(async (tx) => {
        let [file] = await tx
          .select()
          .from(driveItem)
          .where(
            or(eq(driveItem.objectKey, candidate.key), eq(driveItem.stagingKey, candidate.key)),
          );
        if (!file) {
          const [revision] = await tx
            .select({ file: driveItem })
            .from(officeVersion)
            .innerJoin(driveItem, eq(driveItem.id, officeVersion.documentId))
            .where(eq(officeVersion.objectKey, candidate.key));
          file = revision?.file;
        }
        const messengerKey =
          /^messenger\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/(staging|content)$/.exec(candidate.key);
        const [chatFile] = messengerKey
          ? await tx
              .select()
              .from(messengerAttachment)
              .where(
                and(
                  eq(messengerAttachment.workspaceId, messengerKey[1]!),
                  eq(messengerAttachment.id, messengerKey[2]!),
                ),
              )
          : [];
        // Match the lock ordering used by Drive, Messenger and membership mutations.
        const workspaceId = file?.workspaceId ?? chatFile?.workspaceId;
        if (workspaceId)
          await tx
            .select({ id: workspace.id })
            .from(workspace)
            .where(eq(workspace.id, workspaceId))
            .for("update");
        if (file) [file] = await tx.select().from(driveItem).where(eq(driveItem.id, file.id));
        const [job] = await tx
          .select()
          .from(storageCleanup)
          .where(
            and(eq(storageCleanup.id, candidate.id), lte(storageCleanup.notBefore, new Date())),
          )
          .for("update", { skipLocked: true });
        if (!job) return;
        if (chatFile && messengerKey?.[3] === "content") {
          const [attached] = await tx
            .select({ deletedAt: messengerMessage.deletedAt })
            .from(messengerAttachment)
            .innerJoin(messengerMessage, eq(messengerMessage.id, messengerAttachment.messageId))
            .where(eq(messengerAttachment.id, chatFile.id));
          if (attached && !attached.deletedAt) {
            await tx.delete(storageCleanup).where(eq(storageCleanup.id, job.id));
            return;
          }
        }
        const [retained] = await tx
          .select({ id: officeVersion.id })
          .from(officeVersion)
          .where(eq(officeVersion.objectKey, job.key))
          .limit(1);
        if (retained && file?.status !== "deleting") {
          await tx.delete(storageCleanup).where(eq(storageCleanup.id, job.id));
          return;
        }
        if (job.uploadId) await storage.abort(job.key, job.uploadId);
        await storage.remove(job.key);
        await tx.delete(storageCleanup).where(eq(storageCleanup.id, job.id));
        if (
          file?.status === "uploading" &&
          file.uploadExpiresAt &&
          file.uploadExpiresAt <= new Date()
        )
          await tx
            .update(driveItem)
            .set({ status: "failed", deletedAt: new Date(), deletionId: randomUUID() })
            .where(and(eq(driveItem.id, file.id), eq(driveItem.status, "uploading")));
      });
    } catch {
      failures++;
      await db
        .update(storageCleanup)
        .set({
          attempts: sql`${storageCleanup.attempts} + 1`,
          notBefore: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** Math.min(candidate.attempts, 7)) * 1000,
          ),
        })
        .where(eq(storageCleanup.id, candidate.id));
    }
  }
  // Delete leaves only after BOTH object keys have been physically cleaned up.
  for (let depth = 0; depth < 64; depth++) {
    const leaves = await db.execute<{
      id: string;
    }>(sql`select d.id from drive_items d where d.status = 'deleting'
      and not exists (select 1 from storage_cleanup c where c.key = d.object_key or c.key = d.staging_key)
      and not exists (select 1 from storage_cleanup c join office_document_versions v on v.object_key = c.key where v.document_id = d.id)
      and not exists (select 1 from wiki_pages child where child.parent_id = d.id)
      and not exists (select 1 from drive_items child where child.parent_id = d.id) limit 1000`);
    if (!leaves.rows.length) break;
    await db.delete(driveItem).where(
      inArray(
        driveItem.id,
        leaves.rows.map((v) => v.id),
      ),
    );
  }
  return { processed: due.length, failures };
}
