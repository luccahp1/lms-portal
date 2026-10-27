CREATE TYPE "public"."user_status" AS ENUM('pending', 'active');--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "join_code" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_business" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_join_code_unique" UNIQUE("join_code");