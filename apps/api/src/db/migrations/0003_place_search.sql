-- What place search matches: name, city and state, lower-case and without accents, plus the
-- everyday names of the two big states (DENUE calls Estado de México just "México").
-- A RETURN body is resolved when the function is created, so index builds (which run with a
-- restricted search_path) still find f_unaccent. The index on it is in migration 0004.
CREATE OR REPLACE FUNCTION place_search_text(name text, city text, state text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  RETURN lower(f_unaccent(
    coalesce(name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(state, '') ||
    CASE state
      WHEN 'Ciudad de México' THEN ' CDMX DF'
      WHEN 'México' THEN ' Estado de México Edomex'
      WHEN 'Estado de México' THEN ' Edomex'
      ELSE ''
    END));
