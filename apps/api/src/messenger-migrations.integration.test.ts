import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import {
  conversation,
  conversationMember,
  messengerMessage,
  membership,
  user,
  workspace,
} from "@lumo/database/schema";
import { eq, sql } from "drizzle-orm";
import { expect, test } from "vitest";

import { createTestDatabase } from "./test/database";

test("Messenger upgrade preserves populated provider history references and rejects cross-workspace threads", async () => {
  const source = {
    ...parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8")),
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
      sql`INSERT INTO conversations (id, workspace_id, kind, name, created_by, provider_group_id) VALUES (${id}, ${ws!.id}, 'group', 'Existing private', ${actor!.id}, 'preserved-provider-group')`,
    );
    await database.db.execute(
      sql`INSERT INTO conversation_members (workspace_id, conversation_id, user_id) VALUES (${ws!.id}, ${id}, ${actor!.id})`,
    );
    await database.migrateRemaining();
    await database.migrateRemaining();
    expect(
      await database.db.select().from(conversation).where(eq(conversation.id, id)),
    ).toMatchObject([{ id, providerGroupId: "preserved-provider-group", visibility: "private" }]);
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
