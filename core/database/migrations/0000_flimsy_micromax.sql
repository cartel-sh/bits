CREATE TABLE IF NOT EXISTS "channel_settings" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"voice_channel_id" text NOT NULL,
	"text_channel_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"duration" integer,
	"date" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_identities" (
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"identity" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_identities_platform_identity_pk" PRIMARY KEY("platform","identity")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vanishing_channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"vanish_after" integer NOT NULL,
	"messages_deleted" integer DEFAULT 0,
	"last_deletion" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'practice_sessions_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_identities_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_sessions_user_date_idx" ON "practice_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_sessions_active_idx" ON "practice_sessions" USING btree ("user_id") WHERE "practice_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_identities_user_id_idx" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vanishing_channels_guild_idx" ON "vanishing_channels" USING btree ("guild_id");