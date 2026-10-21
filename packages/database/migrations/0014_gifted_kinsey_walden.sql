CREATE TABLE "hr_payroll_statutory_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"valid_through" date NOT NULL,
	"data" jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_statutory_configuration_effective" UNIQUE("workspace_id","effective_from"),
	CONSTRAINT "hr_statutory_configuration_dates" CHECK ("hr_payroll_statutory_configurations"."valid_through" >= "hr_payroll_statutory_configurations"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "hr_payroll_statutory_configurations" ADD CONSTRAINT "hr_payroll_statutory_configurations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;