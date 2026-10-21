CREATE TABLE "hr_attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"request_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_correction_request" UNIQUE("workspace_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "hr_attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"action" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_punch_idempotency" UNIQUE("workspace_id","user_id","idempotency_key"),
	CONSTRAINT "hr_punch_action" CHECK ("hr_attendance_events"."action" in ('clock_in','start_break','end_break','clock_out'))
);
--> statement-breakpoint
CREATE TABLE "hr_attendance_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"clock_in" timestamp with time zone NOT NULL,
	"clock_out" timestamp with time zone,
	"timezone" text NOT NULL,
	"schedule" jsonb,
	"breaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "hr_shift_time_order" CHECK ("hr_attendance_shifts"."clock_out" is null or "hr_attendance_shifts"."clock_out" >= "hr_attendance_shifts"."clock_in")
);
--> statement-breakpoint
ALTER TABLE "hr_attendance_corrections" ADD CONSTRAINT "hr_attendance_corrections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_attendance_events" ADD CONSTRAINT "hr_attendance_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_attendance_events" ADD CONSTRAINT "hr_attendance_events_shift_id_hr_attendance_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."hr_attendance_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_attendance_shifts" ADD CONSTRAINT "hr_attendance_shifts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_correction_day" ON "hr_attendance_corrections" USING btree ("workspace_id","user_id","date","created_at");--> statement-breakpoint
CREATE INDEX "hr_punch_audit" ON "hr_attendance_events" USING btree ("workspace_id","shift_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_one_open_shift" ON "hr_attendance_shifts" USING btree ("workspace_id","user_id") WHERE "hr_attendance_shifts"."clock_out" is null;--> statement-breakpoint
CREATE INDEX "hr_shift_workday" ON "hr_attendance_shifts" USING btree ("workspace_id","user_id","work_date");