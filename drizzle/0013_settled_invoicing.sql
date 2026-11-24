ALTER TABLE "clients" ADD COLUMN "settled_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "settled_org_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "settled_api_key" text;