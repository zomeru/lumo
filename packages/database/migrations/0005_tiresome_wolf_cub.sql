CREATE TABLE "office_callback_events" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"status" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'idle' NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"wiki_state" text,
	CONSTRAINT "office_kind" CHECK ("office_documents"."kind" in ('document','sheet','slide','wiki')),
	CONSTRAINT "office_state" CHECK ("office_documents"."state" in ('idle','editing','error')),
	CONSTRAINT "office_versions_positive" CHECK ("office_documents"."version" > 0 and "office_documents"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "office_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"object_key" text NOT NULL,
	"checksum" text NOT NULL,
	"size" bigint NOT NULL,
	"source" text NOT NULL,
	"generation" integer NOT NULL,
	"actor_id" uuid,
	"wiki_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_document_versions_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "office_revision_size" CHECK ("office_document_versions"."size" >= 0 and "office_document_versions"."number" > 0)
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_id" uuid,
	"folder_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wiki_pages_folder_id_unique" UNIQUE("folder_id"),
	CONSTRAINT "wiki_parent_self" CHECK ("wiki_pages"."id" <> "wiki_pages"."parent_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"update" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "office_workspace_id_idx" ON "office_documents" USING btree ("workspace_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_workspace_id_idx" ON "wiki_pages" USING btree ("workspace_id","id");
--> statement-breakpoint
ALTER TABLE "office_callback_events" ADD CONSTRAINT "office_callback_events_document_id_office_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."office_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_documents" ADD CONSTRAINT "office_documents_workspace_id_id_drive_items_workspace_id_id_fk" FOREIGN KEY ("workspace_id","id") REFERENCES "public"."drive_items"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_document_versions" ADD CONSTRAINT "office_document_versions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_document_versions" ADD CONSTRAINT "office_document_versions_workspace_id_document_id_office_documents_workspace_id_id_fk" FOREIGN KEY ("workspace_id","document_id") REFERENCES "public"."office_documents"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_workspace_id_id_office_documents_workspace_id_id_fk" FOREIGN KEY ("workspace_id","id") REFERENCES "public"."office_documents"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_workspace_id_folder_id_drive_items_workspace_id_id_fk" FOREIGN KEY ("workspace_id","folder_id") REFERENCES "public"."drive_items"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_workspace_id_parent_id_wiki_pages_workspace_id_id_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."wiki_pages"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_updates" ADD CONSTRAINT "wiki_updates_document_id_office_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."office_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "office_callback_retention_idx" ON "office_callback_events" USING btree ("created_at");--> statement-breakpoint
--> statement-breakpoint
CREATE UNIQUE INDEX "office_revision_idx" ON "office_document_versions" USING btree ("document_id","number");--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX "wiki_parent_idx" ON "wiki_pages" USING btree ("workspace_id","parent_id","position");--> statement-breakpoint
CREATE INDEX "wiki_update_document_idx" ON "wiki_updates" USING btree ("document_id","created_at");