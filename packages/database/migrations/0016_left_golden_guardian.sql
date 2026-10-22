CREATE TABLE "messenger_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text NOT NULL,
	"state" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messenger_attachment_size" CHECK ("messenger_attachments"."size" > 0 and "messenger_attachments"."size" <= 20971520),
	CONSTRAINT "messenger_attachment_state" CHECK ("messenger_attachments"."state" in ('uploading','ready'))
);
--> statement-breakpoint
CREATE TABLE "messenger_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "messenger_messages_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nonce" uuid NOT NULL,
	"body" text NOT NULL,
	"parent_id" uuid,
	"mention_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"pinned_by" uuid,
	CONSTRAINT "messenger_message_body" CHECK (length("messenger_messages"."body") <= 4000),
	CONSTRAINT "messenger_message_parent" CHECK ("messenger_messages"."id" <> "messenger_messages"."parent_id")
);
--> statement-breakpoint
CREATE TABLE "messenger_reactions" (
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messenger_reactions_message_id_user_id_emoji_pk" PRIMARY KEY("message_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversation_kind";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "last_read_sequence" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "notifications" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_message_scope_idx" ON "messenger_messages" USING btree ("workspace_id","conversation_id","id");--> statement-breakpoint
ALTER TABLE "messenger_attachments" ADD CONSTRAINT "messenger_attachments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_attachments" ADD CONSTRAINT "messenger_attachments_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "public"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_attachments" ADD CONSTRAINT "messenger_attachments_workspace_id_conversation_id_message_id_messenger_messages_workspace_id_conversation_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id","message_id") REFERENCES "public"."messenger_messages"("workspace_id","conversation_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "public"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_workspace_id_conversation_id_parent_id_messenger_messages_workspace_id_conversation_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id","parent_id") REFERENCES "public"."messenger_messages"("workspace_id","conversation_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_reactions" ADD CONSTRAINT "messenger_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_reactions" ADD CONSTRAINT "messenger_reactions_workspace_id_conversation_id_message_id_messenger_messages_workspace_id_conversation_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id","message_id") REFERENCES "public"."messenger_messages"("workspace_id","conversation_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messenger_attachment_message_idx" ON "messenger_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_message_nonce_idx" ON "messenger_messages" USING btree ("conversation_id","sender_id","nonce");--> statement-breakpoint
CREATE INDEX "messenger_message_history_idx" ON "messenger_messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE INDEX "messenger_message_thread_idx" ON "messenger_messages" USING btree ("parent_id","sequence");--> statement-breakpoint
CREATE INDEX "messenger_message_search_idx" ON "messenger_messages" USING gin (to_tsvector('simple', "body"));--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_channel_slug_idx" ON "conversations" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "conversation_discovery_idx" ON "conversations" USING btree ("workspace_id","kind","visibility");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversation_visibility" CHECK ("conversations"."visibility" in ('public','private'));--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversation_channel" CHECK (("conversations"."kind" = 'channel' and "conversations"."slug" is not null) or ("conversations"."kind" <> 'channel' and "conversations"."slug" is null and "conversations"."visibility" = 'private'));--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversation_kind" CHECK ("conversations"."kind" in ('direct','group','channel'));--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_member_role" CHECK ("conversation_members"."role" in ('owner','manager','member'));--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_member_notifications" CHECK ("conversation_members"."notifications" in ('all','mentions','muted'));
--> statement-breakpoint
UPDATE conversation_members AS cm SET role = 'owner' FROM conversations AS c WHERE cm.conversation_id = c.id AND cm.user_id = c.created_by;
