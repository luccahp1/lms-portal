CREATE TABLE "change_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"request_id" uuid,
	"author_id" uuid,
	"source" text DEFAULT 'site' NOT NULL,
	"kind" text NOT NULL,
	"page_path" text DEFAULT '/' NOT NULL,
	"page_title" text DEFAULT '' NOT NULL,
	"anchor" jsonb,
	"viewport_w" integer DEFAULT 0 NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"text_before" text,
	"text_after" text,
	"strokes" jsonb,
	"file_id" uuid,
	"done_at" timestamp with time zone,
	"done_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intakes" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"template_slug" text,
	"template_note" text DEFAULT '' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "start_links" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "review_url" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "stage" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_done_by_id_users_id_fk" FOREIGN KEY ("done_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_links" ADD CONSTRAINT "start_links_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_links" ADD CONSTRAINT "start_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_links" ADD CONSTRAINT "start_links_claimed_by_id_users_id_fk" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_notes_client_idx" ON "change_notes" USING btree ("client_id","request_id");--> statement-breakpoint
CREATE INDEX "start_links_client_idx" ON "start_links" USING btree ("client_id");