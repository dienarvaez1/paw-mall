CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"group" text NOT NULL,
	"sort_order" smallint NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"category_id" integer NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_ok" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"rows_excluded" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_categories" (
	"place_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "place_categories_place_id_category_id_pk" PRIMARY KEY("place_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "places_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"external_id" text,
	"activity_code" text,
	"name" text,
	"chain" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"phone" text,
	"website" text,
	"social_url" text,
	"hours" jsonb,
	"location" geography(Point, 4326) NOT NULL,
	"registered_on" date,
	"source_updated_on" date,
	"hidden_at" timestamp with time zone,
	"hidden_reason" text,
	"owner_verified_at" timestamp with time zone,
	"phone_source" text,
	"website_source" text,
	"website_status" text,
	"website_failures" integer DEFAULT 0 NOT NULL,
	"website_checked_at" timestamp with time zone,
	"overture_id" text
);
--> statement-breakpoint
CREATE TABLE "vet_details" (
	"place_id" integer PRIMARY KEY NOT NULL,
	"open24h" boolean,
	"open24h_source" text,
	"accepts_emergencies" boolean,
	"species" text[]
);
--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vet_details" ADD CONSTRAINT "vet_details_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_runs_source_started_at_idx" ON "import_runs" USING btree ("source","started_at");--> statement-breakpoint
CREATE INDEX "place_categories_category_id_idx" ON "place_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "places_location_idx" ON "places" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "places_source_external_id_idx" ON "places" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "places_name_search_idx" ON "places" USING gin (lower(f_unaccent(coalesce("name", ''))) gin_trgm_ops);