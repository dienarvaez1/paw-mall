-- Extensions the schema relies on: PostGIS for place locations, unaccent for accent-insensitive
-- search, pg_trgm for typo-tolerant matching.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- unaccent() is only STABLE, so generated columns and indexes need an IMMUTABLE wrapper that pins
-- the dictionary.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.unaccent('public.unaccent'::regdictionary, $1);
