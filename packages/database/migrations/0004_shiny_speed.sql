CREATE TABLE "drive_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"original_name" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"object_key" text,
	"staging_key" text,
	"upload_id" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"checksum" text,
	"etag" text,
	"upload_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deletion_id" uuid,
	CONSTRAINT "drive_items_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "drive_items_staging_key_unique" UNIQUE("staging_key"),
	CONSTRAINT "drive_kind" CHECK ("drive_items"."kind" in ('file','folder')),
	CONSTRAINT "drive_status" CHECK ("drive_items"."status" in ('uploading','ready','failed','deleting')),
	CONSTRAINT "drive_size" CHECK ("drive_items"."size" >= 0 and "drive_items"."size" <= 5368709120),
	CONSTRAINT "drive_parent_self" CHECK ("drive_items"."id" <> "drive_items"."parent_id"),
	CONSTRAINT "drive_storage" CHECK (("drive_items"."kind" = 'folder' and "drive_items"."object_key" is null and "drive_items"."size" = 0) or ("drive_items"."kind" = 'file' and "drive_items"."object_key" is not null))
);
--> statement-breakpoint
CREATE TABLE "drive_shares" (
	"workspace_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_shares_item_id_user_id_pk" PRIMARY KEY("item_id","user_id"),
	CONSTRAINT "drive_permission" CHECK ("drive_shares"."permission" in ('viewer','editor'))
);
--> statement-breakpoint
CREATE TABLE "drive_stars" (
	"workspace_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "drive_stars_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "storage_cleanup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"upload_id" text,
	"not_before" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_cleanup_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "drive_workspace_id_idx" ON "drive_items" USING btree ("workspace_id","id");--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_workspace_id_parent_id_drive_items_workspace_id_id_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."drive_items"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_shares" ADD CONSTRAINT "drive_shares_workspace_id_item_id_drive_items_workspace_id_id_fk" FOREIGN KEY ("workspace_id","item_id") REFERENCES "public"."drive_items"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_shares" ADD CONSTRAINT "drive_shares_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_stars" ADD CONSTRAINT "drive_stars_workspace_id_item_id_drive_items_workspace_id_id_fk" FOREIGN KEY ("workspace_id","item_id") REFERENCES "public"."drive_items"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_stars" ADD CONSTRAINT "drive_stars_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drive_parent_idx" ON "drive_items" USING btree ("workspace_id","parent_id","name");--> statement-breakpoint
CREATE INDEX "drive_owner_idx" ON "drive_items" USING btree ("workspace_id","owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "drive_trash_idx" ON "drive_items" USING btree ("workspace_id","deleted_at");--> statement-breakpoint
CREATE INDEX "drive_share_user_idx" ON "drive_shares" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "storage_cleanup_due_idx" ON "storage_cleanup" USING btree ("not_before");