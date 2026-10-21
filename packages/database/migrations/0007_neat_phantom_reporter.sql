ALTER TABLE "meetings" DROP CONSTRAINT "meeting_status";--> statement-breakpoint
CREATE INDEX "meeting_workspace_schedule_idx" ON "meetings" USING btree ("workspace_id","starts_at");--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meeting_status" CHECK ("meetings"."status" in ('scheduled','active','ended','canceled'));