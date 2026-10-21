CREATE TABLE "hr_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"manager_id" uuid,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_employees" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_code" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"department_id" uuid,
	"manager_id" uuid,
	"employment_type" text DEFAULT 'employee' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"hire_date" date,
	"end_date" date,
	"location" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_employees_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "hr_employee_status" CHECK ("hr_employees"."status" in ('active','on_leave','terminated')),
	CONSTRAINT "hr_employee_type" CHECK ("hr_employees"."employment_type" in ('employee','contractor','intern')),
	CONSTRAINT "hr_employee_manager_not_self" CHECK ("hr_employees"."manager_id" <> "hr_employees"."user_id"),
	CONSTRAINT "hr_employee_dates" CHECK ("hr_employees"."end_date" is null or "hr_employees"."hire_date" is null or "hr_employees"."end_date" >= "hr_employees"."hire_date")
);
--> statement-breakpoint
CREATE TABLE "hr_permission_grants" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"scope" text DEFAULT 'workspace' NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_permission_grants_workspace_id_user_id_capability_pk" PRIMARY KEY("workspace_id","user_id","capability"),
	CONSTRAINT "hr_grant_scope" CHECK ("hr_permission_grants"."scope" in ('workspace','direct_reports'))
);
--> statement-breakpoint
CREATE TABLE "hr_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"module" text NOT NULL,
	"target_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hr_department_workspace_id" ON "hr_departments" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_department_name" ON "hr_departments" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_employee_code" ON "hr_employees" USING btree ("workspace_id","employee_code") WHERE "hr_employees"."employee_code" <> '';--> statement-breakpoint
ALTER TABLE "hr_audit_events" ADD CONSTRAINT "hr_audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_workspace_id_manager_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","manager_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_workspace_id_manager_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","manager_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_workspace_id_department_id_hr_departments_workspace_id_id_fk" FOREIGN KEY ("workspace_id","department_id") REFERENCES "public"."hr_departments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_permission_grants" ADD CONSTRAINT "hr_permission_grants_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_audit_workspace_time" ON "hr_audit_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "hr_employee_manager" ON "hr_employees" USING btree ("workspace_id","manager_id");--> statement-breakpoint
CREATE INDEX "hr_notification_recipient" ON "hr_notifications" USING btree ("workspace_id","user_id","created_at");