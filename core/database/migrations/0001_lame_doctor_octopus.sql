CREATE TABLE "application_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"vote_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "application_votes_application_id_user_id_pk" PRIMARY KEY("application_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "applications" (
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
ALTER TABLE "application_votes" ADD CONSTRAINT "application_votes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "votes_application_idx" ON "application_votes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_wallet_idx" ON "applications" USING btree ("wallet_address");