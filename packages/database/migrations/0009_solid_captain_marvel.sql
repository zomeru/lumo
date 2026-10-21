CREATE TABLE "hr_approval_policies" (
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"approver_ids" uuid[] NOT NULL,
	"require_attachment" boolean DEFAULT false NOT NULL,
	CONSTRAINT "hr_approval_policy_key" UNIQUE("workspace_id","type")
);
--> statement-breakpoint
CREATE TABLE "hr_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"checksum" text NOT NULL,
	"state" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_file_size" CHECK ("hr_files"."size" between 1 and 10485760),
	CONSTRAINT "hr_file_state" CHECK ("hr_files"."state" in ('uploading','ready'))
);
--> statement-breakpoint
CREATE TABLE "hr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"details" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approver_ids" uuid[] DEFAULT '{}' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "hr_request_workspace_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "hr_request_status" CHECK ("hr_requests"."status" in ('draft','pending','approved','rejected','cancelled')),
	CONSTRAINT "hr_request_step" CHECK ("hr_requests"."current_step" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hr_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hr_approval_policies" ADD CONSTRAINT "hr_approval_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_files" ADD CONSTRAINT "hr_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_events" ADD CONSTRAINT "hr_request_events_workspace_id_request_id_hr_requests_workspace_id_id_fk" FOREIGN KEY ("workspace_id","request_id") REFERENCES "public"."hr_requests"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_file_target" ON "hr_files" USING btree ("workspace_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "hr_request_queue" ON "hr_requests" USING btree ("workspace_id","status","requester_id");--> statement-breakpoint
CREATE INDEX "hr_request_event_time" ON "hr_request_events" USING btree ("workspace_id","request_id","created_at");