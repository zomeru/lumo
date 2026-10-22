ALTER TABLE "conversations" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
-- Retire provider-backed destinations without deleting identities, membership, or history references.
-- Releasing the DM key allows participants to create a fresh persisted conversation.
UPDATE conversations
SET retired_at = now(), archived_at = coalesce(archived_at, now()), direct_key = NULL
WHERE provider_group_id IS NOT NULL AND retired_at IS NULL;
