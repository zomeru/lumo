ALTER TABLE "users" ADD COLUMN "registration_terms_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registration_privacy_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registration_accepted_at" timestamp with time zone;