import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import {
  conversation,
  conversationMember,
  messengerMessage,
  membership,
  user,
  workspace,
} from "@lumolynk/database/schema";
import { eq, sql } from "drizzle-orm";
import { expect, test } from "vitest";

import { createTestDatabase } from "./test/database";

test("Messenger upgrade preserves populated provider history references and rejects cross-workspace threads", async () => {
  const source = {
    ...(existsSync(new URL("../.env", import.meta.url))
      ? parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"))
      : {}),
    ...process.env,
  };
  const database = await createTestDatabase(source.TEST_DATABASE_URL, 15);
  try {
    const [actor] = await database.db
      .insert(user)
      .values({ name: "Existing", email: `migration-${randomUUID()}@example.com` })
      .returning();
    const [ws] = await database.db
      .select()
      .from(workspace)
      .where(eq(workspace.personalOwnerId, actor!.id));
    const id = randomUUID();
    await database.db.execute(
      sql`INSERT INTO conversations (id, workspace_id, kind, name, created_by, provider_group_id, direct_key) VALUES (${id}, ${ws!.id}, 'direct', 'Existing private', ${actor!.id}, 'preserved-provider-group', 'old-dm-key')`,
    );
    await database.db.execute(
      sql`INSERT INTO conversation_members (workspace_id, conversation_id, user_id) VALUES (${ws!.id}, ${id}, ${actor!.id})`,
    );
    await database.migrateRemaining();
    await database.migrateRemaining();
    expect(
      await database.db.select().from(conversation).where(eq(conversation.id, id)),
    ).toMatchObject([
      {
        id,
        providerGroupId: "preserved-provider-group",
        visibility: "private",
        directKey: null,
        retiredAt: expect.any(Date),
        archivedAt: expect.any(Date),
      },
    ]);
    expect(
      await database.db
        .select()
        .from(conversationMember)
        .where(eq(conversationMember.conversationId, id)),
    ).toMatchObject([{ role: "owner", lastReadSequence: 0 }]);
    const [other] = await database.db.insert(workspace).values({ name: "Other" }).returning();
    await database.db.insert(membership).values({ workspaceId: other!.id, userId: actor!.id });
    const [channel] = await database.db
      .insert(conversation)
      .values({
        workspaceId: other!.id,
        kind: "channel",
        name: "general",
        slug: "general",
        visibility: "public",
        createdBy: actor!.id,
      })
      .returning();
    const [message] = await database.db
      .insert(messengerMessage)
      .values({
        workspaceId: other!.id,
        conversationId: channel!.id,
        senderId: actor!.id,
        nonce: randomUUID(),
        body: "Retained",
      })
      .returning();
    await expect(
      database.db.insert(messengerMessage).values({
        workspaceId: ws!.id,
        conversationId: id,
        senderId: actor!.id,
        nonce: randomUUID(),
        body: "Cross-workspace reply",
        parentId: message!.id,
      }),
    ).rejects.toThrow(/Failed query/);
    await expect(
      database.db.insert(conversation).values({
        workspaceId: other!.id,
        kind: "channel",
        name: "Duplicate",
        slug: "general",
        createdBy: actor!.id,
      }),
    ).rejects.toThrow(/Failed query/);
  } finally {
    await database.cleanup();
  }
});

test("public membership migration backfills existing channels and enrolls future members without changing private access", async () => {
  const source = {
    ...(existsSync(new URL("../.env", import.meta.url))
      ? parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"))
      : {}),
    ...process.env,
  };
  const database = await createTestDatabase(source.TEST_DATABASE_URL, 19);
  try {
    const [owner, existing, newcomer] = await database.db
      .insert(user)
      .values(
        ["Owner", "Existing", "Newcomer"].map((name) => ({
          name,
          email: `${name}-${randomUUID()}@example.com`,
        })),
      )
      .returning();
    const [ws] = await database.db
      .select()
      .from(workspace)
      .where(eq(workspace.personalOwnerId, owner!.id));
    await database.db.insert(membership).values({ workspaceId: ws!.id, userId: existing!.id });
    const [publicItem, archived, privateItem, retired] = await database.db
      .insert(conversation)
      .values([
        {
          workspaceId: ws!.id,
          createdBy: owner!.id,
          kind: "channel",
          name: "Public",
          slug: "public",
          visibility: "public" as const,
        },
        {
          workspaceId: ws!.id,
          createdBy: owner!.id,
          kind: "channel",
          name: "Archived",
          slug: "archived",
          visibility: "public" as const,
          archivedAt: new Date(),
        },
        {
          workspaceId: ws!.id,
          createdBy: owner!.id,
          kind: "channel",
          name: "Private",
          slug: "private",
          visibility: "private" as const,
        },
        {
          workspaceId: ws!.id,
          createdBy: owner!.id,
          kind: "channel",
          name: "Retired",
          slug: "retired",
          visibility: "public" as const,
          retiredAt: new Date(),
        },
      ])
      .returning();
    await database.db.insert(conversationMember).values({
      workspaceId: ws!.id,
      conversationId: publicItem!.id,
      userId: owner!.id,
      role: "owner",
      lastReadSequence: 84,
      notifications: "muted",
    });
    await database.migrateRemaining();
    await database.migrateRemaining();
    const members = await database.db
      .select()
      .from(conversationMember)
      .where(eq(conversationMember.workspaceId, ws!.id));
    expect(
      members.find((m) => m.userId === owner!.id && m.conversationId === publicItem!.id),
    ).toMatchObject({ role: "owner", lastReadSequence: 84, notifications: "muted" });
    expect(
      members
        .filter((m) => m.userId === existing!.id)
        .map((m) => m.conversationId)
        .sort(),
    ).toEqual([publicItem!.id, archived!.id].sort());
    expect(
      members.some((m) => m.conversationId === privateItem!.id || m.conversationId === retired!.id),
    ).toBe(false);
    await database.db.insert(membership).values({ workspaceId: ws!.id, userId: newcomer!.id });
    const added = await database.db
      .select()
      .from(conversationMember)
      .where(eq(conversationMember.userId, newcomer!.id));
    expect(added.map((m) => m.conversationId).sort()).toEqual(
      [publicItem!.id, archived!.id].sort(),
    );
    expect(added.every((m) => m.role === "member")).toBe(true);
  } finally {
    await database.cleanup();
  }
});
