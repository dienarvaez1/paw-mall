CREATE TABLE "search_synonyms" (
	"word" text PRIMARY KEY NOT NULL,
	"alternatives" text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "search_words" "tsvector" GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, place_search_text(name, city, state))) STORED;--> statement-breakpoint
CREATE INDEX "places_search_words_idx" ON "places" USING gin ("search_words");--> statement-breakpoint
-- One search word as a full-text query (Phase 20): its Spanish stem, or any of its synonyms'
-- (a phrase's words all present): "tacos" → 'taco' | 'taqueri'. Null for a word Spanish search
-- ignores ("de", "la"). Accents and case aside, as place_search_text().
CREATE OR REPLACE FUNCTION search_word_query(word text) RETURNS tsquery
  LANGUAGE sql STABLE PARALLEL SAFE
  RETURN (
    SELECT nullif(string_agg('(' || q::text || ')', ' | '), '')::tsquery
    FROM (
      SELECT plainto_tsquery('spanish'::regconfig, lower(f_unaccent(w))) AS q
      FROM (
        SELECT $1 AS w
        UNION
        SELECT unnest(s.alternatives) FROM search_synonyms s WHERE s.word = lower(f_unaccent($1))
      ) words
    ) parts
    WHERE q::text <> ''
  );
