CREATE TABLE IF NOT EXISTS "application_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"vote_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "application_votes_application_id_user_id_unique" UNIQUE("application_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_number" integer NOT NULL,
	"message_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"ens_name" text,
	"github" text,
	"farcaster" text,
	"lens" text,
	"twitter" text,
	"excitement" text NOT NULL,
	"motivation" text NOT NULL,
	"signature" text NOT NULL,
	"status" text DEFAULT 'pending',
	"submitted_at" timestamp with time zone DEFAULT now(),
	"decided_at" timestamp with time zone,
	CONSTRAINT "applications_application_number_unique" UNIQUE("application_number"),
	CONSTRAINT "applications_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'application_votes_application_id_applications_id_fk'
    ) THEN
        ALTER TABLE "application_votes" ADD CONSTRAINT "application_votes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "votes_application_idx" ON "application_votes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_wallet_idx" ON "applications" USING btree ("wallet_address");