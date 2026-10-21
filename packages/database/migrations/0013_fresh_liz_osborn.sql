CREATE TABLE "hr_onboarding_task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_onboarding_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"user_id" uuid,
	"invitation_id" uuid,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"start_date" date NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_onboarding_workspace_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "hr_onboarding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"assignee_id" uuid,
	"step" jsonb NOT NULL,
	"position" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	CONSTRAINT "hr_task_workspace_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "hr_task_position" UNIQUE("workspace_id","instance_id","position")
);
--> statement-breakpoint
CREATE TABLE "hr_onboarding_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"steps" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_template_workspace_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "hr_onboarding_task_events" ADD CONSTRAINT "hr_onboarding_task_events_workspace_id_task_id_hr_onboarding_tasks_workspace_id_id_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."hr_onboarding_tasks"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_onboarding_instances" ADD CONSTRAINT "hr_onboarding_instances_workspace_id_template_id_hr_onboarding_templates_workspace_id_id_fk" FOREIGN KEY ("workspace_id","template_id") REFERENCES "public"."hr_onboarding_templates"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_onboarding_tasks" ADD CONSTRAINT "hr_onboarding_tasks_workspace_id_instance_id_hr_onboarding_instances_workspace_id_id_fk" FOREIGN KEY ("workspace_id","instance_id") REFERENCES "public"."hr_onboarding_instances"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_onboarding_templates" ADD CONSTRAINT "hr_onboarding_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_task_history" ON "hr_onboarding_task_events" USING btree ("workspace_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX "hr_onboarding_employee" ON "hr_onboarding_instances" USING btree ("workspace_id","user_id");