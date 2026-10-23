import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import {
  user,
  workspace,
  membership,
  hrEmployee,
  hrPayrollRun,
  hrStatutoryConfiguration,
} from "@lumolynk/database/schema";
import { eq, sql } from "drizzle-orm";
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
    // Seed the historical shape, before the registration-consent columns exist.
    const {
      rows: [before],
    } = await database.db.execute<{ id: string; name: string; email: string }>(sql`
      INSERT INTO users (name, email) VALUES ('Existing employee', 'existing-hr-upgrade@example.com')
      RETURNING id, name, email
    `);
    const [personal] = await database.db
      .select()
      .from(workspace)
      .where(eq(workspace.personalOwnerId, before!.id));
    expect(personal).toBeTruthy();
    await database.migrateRemaining();
    await database.migrateRemaining();
    const after = await database.db.select().from(user).where(eq(user.id, before!.id));
    expect(after).toMatchObject([
      {
        ...before,
        registrationTermsVersion: null,
        registrationPrivacyVersion: null,
        registrationAcceptedAt: null,
      },
    ]);
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

test("statutory migration preserves historical payroll without activating an unsaved configuration", async () => {
  const source = {
    ...(existsSync(new URL("../.env", import.meta.url))
      ? parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"))
      : {}),
    ...process.env,
  };
  const database = await createTestDatabase(source.TEST_DATABASE_URL, 13);
  try {
    const {
      rows: [actor],
    } = await database.db.execute<{ id: string }>(sql`
      INSERT INTO users (name, email) VALUES ('Accounting', 'statutory-upgrade@example.com')
      RETURNING id
    `);
    const [ws] = await database.db
      .select()
      .from(workspace)
      .where(eq(workspace.personalOwnerId, actor!.id));
    const [run] = await database.db
      .insert(hrPayrollRun)
      .values({
        workspaceId: ws!.id,
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        cutoffDate: "2026-01-31",
        payoutDate: "2026-01-31",
        status: "finalized",
        createdBy: actor!.id,
        ruleVersion: "PH-2025-01-v1",
        settingsSnapshot: { historical: "unchanged" },
      })
      .returning();
    await database.migrateRemaining();
    expect(await database.db.select().from(hrPayrollRun)).toEqual([run]);
    expect(await database.db.select().from(hrStatutoryConfiguration)).toEqual([]);
    const version = {
      workspaceId: ws!.id,
      actorId: actor!.id,
      effectiveFrom: "2026-02-01",
      validThrough: "2026-12-31",
      data: { reviewed: true },
    };
    await database.db.insert(hrStatutoryConfiguration).values(version);
    await expect(database.db.insert(hrStatutoryConfiguration).values(version)).rejects.toThrow(
      /Failed query/,
    );
    await expect(
      database.db
        .insert(hrStatutoryConfiguration)
        .values({ ...version, effectiveFrom: "2027-01-01" }),
    ).rejects.toThrow(/Failed query/);
  } finally {
    await database.cleanup();
  }
});
