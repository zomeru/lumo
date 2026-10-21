CREATE TABLE "hr_holidays" (
	"workspace_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "hr_holiday_date" UNIQUE("workspace_id","date")
);
--> statement-breakpoint
CREATE TABLE "hr_leave_balance_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"amount_half_days" integer NOT NULL,
	"source" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_ledger_once" UNIQUE("workspace_id","user_id","leave_type_id","source"),
	CONSTRAINT "hr_ledger_year" CHECK ("hr_leave_balance_ledger"."year" between 1900 and 2200)
);
--> statement-breakpoint
CREATE TABLE "hr_leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"paid" boolean NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_leave_workspace_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "hr_leave_name" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "hr_work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"timezone" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_schedule_effective" UNIQUE("workspace_id","user_id","effective_from")
);
--> statement-breakpoint
ALTER TABLE "hr_holidays" ADD CONSTRAINT "hr_holidays_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_balance_ledger" ADD CONSTRAINT "hr_leave_balance_ledger_workspace_id_leave_type_id_hr_leave_types_workspace_id_id_fk" FOREIGN KEY ("workspace_id","leave_type_id") REFERENCES "public"."hr_leave_types"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_types" ADD CONSTRAINT "hr_leave_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_work_schedules" ADD CONSTRAINT "hr_work_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_ledger_balance" ON "hr_leave_balance_ledger" USING btree ("workspace_id","user_id","leave_type_id","year");