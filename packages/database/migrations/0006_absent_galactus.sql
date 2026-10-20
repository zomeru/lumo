CREATE TABLE "wiki_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_connections" ADD CONSTRAINT "wiki_connections_document_id_office_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."office_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_connection_document_idx" ON "wiki_connections" USING btree ("document_id","expires_at");