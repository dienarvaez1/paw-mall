ALTER TABLE "places" ADD COLUMN "pet_business" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- places.pet_business follows place_categories: true when the place has a category of the
-- pet_business group. Statement triggers with transition tables, so an import that writes
-- thousands of categories updates each place once, not once per row, and only places whose flag
-- changes (an import replaces every category; most stay as they were).
-- A trigger with a transition table has only one event, and each function names the table it
-- reads: _new for inserts and updates, _old for updates and deletes.
CREATE OR REPLACE FUNCTION sync_place_pet_business_new() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  UPDATE places p SET pet_business = s.pet_business
  FROM (SELECT ch.place_id, EXISTS (
          SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
          WHERE pc.place_id = ch.place_id AND c."group" = 'pet_business') AS pet_business
        FROM (SELECT DISTINCT place_id FROM new_categories) ch) s
  WHERE p.id = s.place_id AND p.pet_business IS DISTINCT FROM s.pet_business;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_place_pet_business_old() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  UPDATE places p SET pet_business = s.pet_business
  FROM (SELECT ch.place_id, EXISTS (
          SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
          WHERE pc.place_id = ch.place_id AND c."group" = 'pet_business') AS pet_business
        FROM (SELECT DISTINCT place_id FROM old_categories) ch) s
  WHERE p.id = s.place_id AND p.pet_business IS DISTINCT FROM s.pet_business;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER place_categories_pet_business_insert
  AFTER INSERT ON place_categories REFERENCING NEW TABLE AS new_categories
  FOR EACH STATEMENT EXECUTE FUNCTION sync_place_pet_business_new();--> statement-breakpoint
CREATE TRIGGER place_categories_pet_business_update_new
  AFTER UPDATE ON place_categories REFERENCING NEW TABLE AS new_categories
  FOR EACH STATEMENT EXECUTE FUNCTION sync_place_pet_business_new();--> statement-breakpoint
CREATE TRIGGER place_categories_pet_business_update_old
  AFTER UPDATE ON place_categories REFERENCING OLD TABLE AS old_categories
  FOR EACH STATEMENT EXECUTE FUNCTION sync_place_pet_business_old();--> statement-breakpoint
CREATE TRIGGER place_categories_pet_business_delete
  AFTER DELETE ON place_categories REFERENCING OLD TABLE AS old_categories
  FOR EACH STATEMENT EXECUTE FUNCTION sync_place_pet_business_old();--> statement-breakpoint
UPDATE places p SET pet_business = true
WHERE EXISTS (
  SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
  WHERE pc.place_id = p.id AND c."group" = 'pet_business');--> statement-breakpoint
CREATE INDEX "places_pet_business_location_idx" ON "places" USING gist ("location") WHERE "places"."pet_business";
