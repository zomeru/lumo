CREATE TABLE "presence_leases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"dnd" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presence_leases" ADD CONSTRAINT "presence_leases_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_leases" ADD CONSTRAINT "presence_leases_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_preferences" ADD CONSTRAINT "presence_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presence_workspace_user_expiry_idx" ON "presence_leases" USING btree ("workspace_id","user_id","expires_at");--> statement-breakpoint
CREATE INDEX "presence_expiry_idx" ON "presence_leases" USING btree ("expires_at");