import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./helpers.ts";

export const user = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text(),
  // Initial registration acceptance is immutable; null means a legacy account, not consent.
  registrationTermsVersion: text("registration_terms_version"),
  registrationPrivacyVersion: text("registration_privacy_version"),
  registrationAcceptedAt: timestamp("registration_accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const session = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const account = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_idx").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("rate_limits", {
  id: text()
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
