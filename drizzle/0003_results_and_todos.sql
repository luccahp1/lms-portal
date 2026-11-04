CREATE TYPE "public"."action_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"steps" text DEFAULT '' NOT NULL,
	"link_url" text,
	"link_label" text,
	"due_on" date,
	"status" "action_status" DEFAULT 'open' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_answers" (
	"question_id" uuid NOT NULL,
	"month" text NOT NULL,
	"engine" text NOT NULL,
	"result" text NOT NULL,
	CONSTRAINT "ai_answers_question_id_month_engine_pk" PRIMARY KEY("question_id","month","engine")
);
--> statement-breakpoint
CREATE TABLE "ai_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"question" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_ranks" (
	"keyword_id" uuid NOT NULL,
	"month" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "keyword_ranks_keyword_id_month_pk" PRIMARY KEY("keyword_id","month")
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"priority" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_stats" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"since" date,
	"fetched_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "payment_instructions" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "stats_url" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "stats_token" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "folder" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_done_by_id_users_id_fk" FOREIGN KEY ("done_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_answers" ADD CONSTRAINT "ai_answers_question_id_ai_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."ai_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_questions" ADD CONSTRAINT "ai_questions_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_questions" ADD CONSTRAINT "ai_questions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_ranks" ADD CONSTRAINT "keyword_ranks_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_stats" ADD CONSTRAINT "site_stats_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_stats" ADD CONSTRAINT "site_stats_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_client_idx" ON "action_items" USING btree ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_questions_client_question_idx" ON "ai_questions" USING btree ("client_id","question");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_client_keyword_idx" ON "keywords" USING btree ("client_id","keyword");