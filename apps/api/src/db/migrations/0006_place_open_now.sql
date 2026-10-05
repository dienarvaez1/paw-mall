-- Whether a place is open at a moment, by confirmed hours: true or false, or NULL when unknown.
-- An owner's 24-hour answer is always open; a "24 horas" name hint alone stays unknown. Hours are
-- in Mexico City time; a close at or before the open runs past midnight. This is the SQL twin of
-- isOpenAt() in packages/shared/src/hours.ts; keep them in step.
CREATE OR REPLACE FUNCTION place_open_now(
  hours jsonb, open24h boolean, open24h_source text, at timestamptz
) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE
  RETURN CASE
    WHEN open24h_source = 'owner' AND open24h THEN true
    WHEN hours IS NULL THEN NULL
    ELSE (
      WITH t AS (
        SELECT extract(dow FROM at AT TIME ZONE 'America/Mexico_City')::int AS dow,
               (extract(hour FROM at AT TIME ZONE 'America/Mexico_City') * 60
                 + extract(minute FROM at AT TIME ZONE 'America/Mexico_City'))::int AS mins
      ),
      d AS (
        SELECT t.mins,
               split_part(hours -> t.dow::text ->> 'open', ':', 1)::int * 60
                 + split_part(hours -> t.dow::text ->> 'open', ':', 2)::int AS o,
               split_part(hours -> t.dow::text ->> 'close', ':', 1)::int * 60
                 + split_part(hours -> t.dow::text ->> 'close', ':', 2)::int AS c,
               split_part(hours -> ((t.dow + 6) % 7)::text ->> 'open', ':', 1)::int * 60
                 + split_part(hours -> ((t.dow + 6) % 7)::text ->> 'open', ':', 2)::int AS yo,
               split_part(hours -> ((t.dow + 6) % 7)::text ->> 'close', ':', 1)::int * 60
                 + split_part(hours -> ((t.dow + 6) % 7)::text ->> 'close', ':', 2)::int AS yc
        FROM t
      )
      SELECT coalesce(
               CASE WHEN o IS NULL THEN false
                    WHEN c > o THEN mins >= o AND mins < c
                    ELSE mins >= o END, false)
             OR coalesce(yo IS NOT NULL AND yc <= yo AND mins < yc, false)
      FROM d
    )
  END;
