CREATE TABLE "search_areas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "search_areas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"municipality" text,
	"state" text NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"business_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "search_areas_name_key_idx" ON "search_areas" USING gin ("name_key" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_areas_kind_idx" ON "search_areas" USING btree ("kind");