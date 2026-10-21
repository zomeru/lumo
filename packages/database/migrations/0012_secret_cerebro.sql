CREATE TABLE "hr_employee_compensation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"salary_minor" bigint NOT NULL,
	"allowances" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_compensation_effective" UNIQUE("workspace_id","user_id","effective_from"),
	CONSTRAINT "hr_salary_positive" CHECK ("hr_employee_compensation"."salary_minor" between 1 and 1000000000)
);
--> statement-breakpoint
CREATE TABLE "hr_payroll_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"source_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_payroll_adjustment_once" UNIQUE("workspace_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "hr_payroll_run_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"verified_by" uuid,
	"verification_reference" text,
	"verified_at" timestamp with time zone,
	CONSTRAINT "hr_run_employee_once" UNIQUE("workspace_id","run_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hr_payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cutoff_date" date NOT NULL,
	"payout_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"calculated_by" uuid,
	"approved_by" uuid,
	"rule_version" text,
	"settings_snapshot" jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"replaces_run_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_run_workspace_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "hr_run_status" CHECK ("hr_payroll_runs"."status" in ('draft','calculated','under_review','approved','finalized','paid','voided')),
	CONSTRAINT "hr_run_dates" CHECK ("hr_payroll_runs"."end_date" >= "hr_payroll_runs"."start_date" and "hr_payroll_runs"."cutoff_date" <= "hr_payroll_runs"."end_date")
);
--> statement-breakpoint
CREATE TABLE "hr_payroll_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"data" jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_payroll_settings_effective" UNIQUE("workspace_id","effective_from")
);
--> statement-breakpoint
ALTER TABLE "hr_employee_compensation" ADD CONSTRAINT "hr_employee_compensation_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_adjustments" ADD CONSTRAINT "hr_payroll_adjustments_workspace_id_run_id_hr_payroll_runs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."hr_payroll_runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_adjustments" ADD CONSTRAINT "hr_payroll_adjustments_workspace_id_source_request_id_hr_requests_workspace_id_id_fk" FOREIGN KEY ("workspace_id","source_request_id") REFERENCES "public"."hr_requests"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_run_employees" ADD CONSTRAINT "hr_payroll_run_employees_workspace_id_run_id_hr_payroll_runs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."hr_payroll_runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_settings" ADD CONSTRAINT "hr_payroll_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_run_period" ON "hr_payroll_runs" USING btree ("workspace_id","start_date","end_date");