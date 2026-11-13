CREATE TABLE "dashboard_sso_links" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "dashboard_sso_secret_hash" text;--> statement-breakpoint
ALTER TABLE "dashboard_sso_links" ADD CONSTRAINT "dashboard_sso_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_sso_links" ADD CONSTRAINT "dashboard_sso_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;