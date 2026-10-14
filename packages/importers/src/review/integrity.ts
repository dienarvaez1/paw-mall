// The hours module alone: Node runs the CLIs' TypeScript directly and can't load the package index.
import { placeHoursSchema } from '@paw-mall/shared/hours';
import type { Sql } from 'postgres';

/** One place a check flagged, with what's wrong in a few words. */
export type IntegritySample = { id: number; name: string | null; city: string; detail: string };

export type IntegrityCheck = {
  id: string;
  description: string;
  count: number;
  samples: IntegritySample[];
};

/** Mexico's bounding box, with a margin for the islands (Revillagigedo, Guadalupe). */
export const MEXICO_BOUNDS = { south: 14.3, north: 32.8, west: -118.6, east: -86.5 };
/** Places closer than this with the same name are probably the same business twice. */
export const DUPLICATE_DISTANCE_M = 50;
/** DENUE publishes twice a year; an edition older than this means the import is overdue. */
export const STALE_SOURCE_MONTHS = 18;
/** Website checks and pet policies older than this should be checked again. */
export const STALE_CHECK_DAYS = 365;

type Row = IntegritySample & { total: number };

/**
 * A data-integrity report over the visible places: each check counts the places it flags and
 * gives a few samples. Read-only; `pnpm places:integrity` prints it.
 */
export async function integrityReport(sql: Sql, sampleSize = 5): Promise<IntegrityCheck[]> {
  const visible = sql`p.hidden_at IS NULL`;
  const urgent = sql`(v.open24h IS TRUE OR v.accepts_emergencies IS TRUE OR EXISTS (
      SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
      WHERE pc.place_id = p.id AND c.slug = 'vet_hospital'))`;

  // Each query returns the samples plus the total count in every row (count(*) OVER ()).
  const check = async (id: string, description: string, rows: Promise<Row[]>) => {
    const found = await rows;
    return {
      id,
      description,
      count: found[0]?.total ?? 0,
      samples: found.map((r) => ({ id: r.id, name: r.name, city: r.city, detail: r.detail })),
    };
  };
  const { south, north, west, east } = MEXICO_BOUNDS;

  const checks: IntegrityCheck[] = [
    await check(
      'outside_mexico',
      'Coordinates outside Mexico',
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total,
          round(ST_Y(p.location::geometry)::numeric, 4) || ', ' ||
          round(ST_X(p.location::geometry)::numeric, 4) AS detail
        FROM places p
        WHERE ${visible} AND NOT (ST_Y(p.location::geometry) BETWEEN ${south} AND ${north}
          AND ST_X(p.location::geometry) BETWEEN ${west} AND ${east})
        ORDER BY p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'duplicates',
      `Same name within ${DUPLICATE_DISTANCE_M} m (probable duplicates)`,
      sql<Row[]>`
        SELECT a.id, a.name, a.city, count(*) OVER ()::int AS total,
          'same as ' || b.id || ' (' || b.source || ', ' ||
          round(ST_Distance(a.location, b.location)::numeric) || ' m)' AS detail
        FROM places a
        JOIN places b ON b.id > a.id AND b.hidden_at IS NULL
          AND ST_DWithin(a.location, b.location, ${DUPLICATE_DISTANCE_M})
          AND lower(f_unaccent(b.name)) = lower(f_unaccent(a.name))
        WHERE a.hidden_at IS NULL AND a.name IS NOT NULL
          AND lower(f_unaccent(a.name)) NOT LIKE '%sin nombre%'
        ORDER BY a.id LIMIT ${sampleSize}`,
    ),
    await invalidHours(sql, sampleSize),
    await check(
      'urgent_without_phone',
      'Urgencias places (vet hospitals, 24-hour or emergency vets) without a phone',
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total, p.source AS detail
        FROM places p LEFT JOIN vet_details v ON v.place_id = p.id
        WHERE ${visible} AND ${urgent} AND p.phone IS NULL
        ORDER BY p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'urgent_unconfirmed_24h',
      '"24 horas" only from the business name (not confirmed by the owner or hours)',
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total, 'name hint' AS detail
        FROM places p JOIN vet_details v ON v.place_id = p.id
        WHERE ${visible} AND v.open24h IS TRUE AND v.open24h_source = 'name' AND p.hours IS NULL
        ORDER BY p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'stale_source',
      `Source edition older than ${STALE_SOURCE_MONTHS} months`,
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total,
          p.source || ' ' || p.source_updated_on AS detail
        FROM places p
        WHERE ${visible} AND p.source_updated_on <
          current_date - make_interval(months => ${STALE_SOURCE_MONTHS})
        ORDER BY p.source_updated_on, p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'website_unchecked',
      `Website never checked or checked over ${STALE_CHECK_DAYS} days ago`,
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total,
          coalesce('checked ' || p.website_checked_at::date, 'never checked') AS detail
        FROM places p
        WHERE ${visible} AND p.website IS NOT NULL AND (p.website_checked_at IS NULL
          OR p.website_checked_at < now() - make_interval(days => ${STALE_CHECK_DAYS}))
        ORDER BY p.website_checked_at NULLS FIRST, p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'policy_stale',
      `Pet policy not confirmed in ${STALE_CHECK_DAYS} days`,
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total,
          pp.source || ' ' || pp.last_confirmed_on AS detail
        FROM places p JOIN pet_policies pp ON pp.place_id = p.id
        WHERE ${visible} AND pp.last_confirmed_on <
          current_date - make_interval(days => ${STALE_CHECK_DAYS})
        ORDER BY pp.last_confirmed_on, p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'no_category',
      'Places without a category (never shown under a chip)',
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total, p.source AS detail
        FROM places p
        WHERE ${visible}
          AND NOT EXISTS (SELECT 1 FROM place_categories pc WHERE pc.place_id = p.id)
        ORDER BY p.id LIMIT ${sampleSize}`,
    ),
    await check(
      'review_queue',
      'Waiting for the owner: reported places, pending claims, disputed policies',
      sql<Row[]>`
        SELECT p.id, p.name, p.city, count(*) OVER ()::int AS total, q.detail
        FROM (
          SELECT place_id, 'reported (' || string_agg(DISTINCT reason, ', ') || ')' AS detail
          FROM place_reports GROUP BY place_id
          UNION ALL
          SELECT place_id, 'claim pending' FROM place_claims WHERE status = 'pending'
          UNION ALL
          SELECT place_id, 'policy disputed' FROM pet_policies WHERE review_since IS NOT NULL
        ) q JOIN places p ON p.id = q.place_id
        WHERE p.hidden_reason IS NULL OR p.hidden_reason LIKE 'reported_%'
        ORDER BY p.id LIMIT ${sampleSize}`,
    ),
  ];
  return checks;
}

/** Stored hours that the shared schema rejects (the app and API would fail to read them). */
async function invalidHours(sql: Sql, sampleSize: number): Promise<IntegrityCheck> {
  const rows = await sql<(IntegritySample & { hours: unknown })[]>`
    SELECT p.id, p.name, p.city, p.hours_source AS detail, p.hours
    FROM places p WHERE p.hidden_at IS NULL AND p.hours IS NOT NULL ORDER BY p.id`;
  const bad = rows.filter((r) => !placeHoursSchema.safeParse(r.hours).success);
  return {
    id: 'invalid_hours',
    description: 'Opening hours the shared schema rejects',
    count: bad.length,
    samples: bad.slice(0, sampleSize).map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      detail: `from ${r.detail ?? 'unknown'}`,
    })),
  };
}
