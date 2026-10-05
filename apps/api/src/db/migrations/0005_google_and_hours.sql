CREATE TABLE "google_lookups" (
	"day" date NOT NULL,
	"client" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "google_lookups_day_client_pk" PRIMARY KEY("day","client")
);
--> statement-breakpoint
CREATE TABLE "google_usage" (
	"month" text NOT NULL,
	"sku" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "google_usage_month_sku_pk" PRIMARY KEY("month","sku")
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "hours_source" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_place_id" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_match_status" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_matched_at" timestamp with time zone;