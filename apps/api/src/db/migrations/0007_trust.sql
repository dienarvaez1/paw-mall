CREATE TABLE "place_claims" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "place_claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"place_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"phone" text,
	"website" text,
	"hours" jsonb,
	"open24h" boolean,
	"accepts_emergencies" boolean,
	"contact_name" text,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "place_reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "place_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"place_id" integer NOT NULL,
	"reason" text NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_claims" ADD CONSTRAINT "place_claims_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_reports" ADD CONSTRAINT "place_reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_claims_status_idx" ON "place_claims" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "place_reports_place_reason_client_idx" ON "place_reports" USING btree ("place_id","reason","client_id");