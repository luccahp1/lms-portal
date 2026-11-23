CREATE TABLE "online_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"invoice_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'cad' NOT NULL,
	"session_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"problem" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"paid_at" timestamp with time zone,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payment_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "online_payments_client_idx" ON "online_payments" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "online_payments_session_idx" ON "online_payments" USING btree ("session_id");--> statement-breakpoint
-- Live updates: the client's Billing page redraws when an online payment changes (trigger function from 0011).
DROP TRIGGER IF EXISTS portal_notify ON "online_payments";--> statement-breakpoint
CREATE TRIGGER portal_notify AFTER INSERT OR UPDATE OR DELETE ON "online_payments" FOR EACH ROW EXECUTE FUNCTION portal_notify_row();
