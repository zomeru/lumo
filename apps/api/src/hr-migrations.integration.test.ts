import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { user, workspace, membership, hrEmployee } from "@lumo/database/schema";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

import { createTestDatabase } from "./test/database";

test("upgrading the existing schema preserves users, personal workspaces and memberships", async () => {
  const source = {
    ...(existsSync(new URL("../.env", import.meta.url))
      ? parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"))
      : {}),
    ...process.env,
  };
  const database = await createTestDatabase(source.TEST_DATABASE_URL, 7);
  try {
    const [before] = await database.db
      .insert(user)
      .values({ name: "Existing employee", email: "existing-hr-upgrade@example.com" })
      .returning();
    const [personal] = await database.db
      .select()
      .from(workspace)
      .where(eq(workspace.personalOwnerId, before!.id));
    expect(personal).toBeTruthy();
    await database.migrateRemaining();
    await database.migrateRemaining();
    const after = await database.db.select().from(user).where(eq(user.id, before!.id));
    expect(after).toEqual([before]);
    const [member] = await database.db
      .select()
      .from(membership)
      .where(eq(membership.workspaceId, personal!.id));
    expect(member?.userId).toBe(before!.id);
    expect(member?.role).toBe("owner");
    await database.db
      .insert(hrEmployee)
      .values({ workspaceId: personal!.id, userId: before!.id, jobTitle: "Engineer" });
    expect((await database.db.select().from(hrEmployee))[0]?.jobTitle).toBe("Engineer");
  } finally {
    await database.cleanup();
  }
});
