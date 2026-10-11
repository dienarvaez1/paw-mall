CREATE TABLE "pet_policies" (
	"place_id" integer PRIMARY KEY NOT NULL,
	"dogs" boolean,
	"cats" boolean,
	"other_pets" boolean,
	"max_dog_size" text,
	"max_weight_kg" double precision,
	"max_pets" smallint,
	"fee" jsonb,
	"areas" text[] DEFAULT '{}'::text[] NOT NULL,
	"rules" text,
	"source" text NOT NULL,
	"source_name" text,
	"source_url" text,
	"last_confirmed_on" date NOT NULL,
	"review_since" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "policy_answers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "policy_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"place_id" integer NOT NULL,
	"answer" text NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_claims" ADD COLUMN "pet_policy" jsonb;--> statement-breakpoint
ALTER TABLE "pet_policies" ADD CONSTRAINT "pet_policies_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_answers" ADD CONSTRAINT "policy_answers_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "policy_answers_place_client_idx" ON "policy_answers" USING btree ("place_id","client_id");