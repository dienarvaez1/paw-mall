import {
  type Category,
  type CategorySlug,
  DEFAULT_LOCALE,
  type Locale,
  type Place,
  type PlaceCluster,
  type PlaceFilters,
  type PlaceListQuery,
  type PlaceListResponse,
  type PlaceMapQuery,
  type PlaceMapResponse,
  type ValueSource,
} from '@paw-mall/shared';
import { type SQL, sql } from 'drizzle-orm';

import type { Database } from '../db/client';

type Point = { lat: number; lng: number };

function pointSql({ lat, lng }: Point) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

function withinRadiusSql(point: Point, radiusKm: number) {
  return sql`ST_DWithin(p.location, ${pointSql(point)}, ${radiusKm * 1000})`;
}

/** Places (aliased `p`) not hidden by shopper reports or confirmed closed. */
const visibleSql = sql`p.hidden_at IS NULL`;

/** A website that isn't known dead, or that the owner verified. */
const liveWebsiteSql = sql`(p.website IS NOT NULL AND
  (p.website_status IS DISTINCT FROM 'dead' OR p.owner_verified_at IS NOT NULL))`;

/** The conditions for a category and the user's Settings filters (places aliased `p`). */
function filterConditions(filters: PlaceFilters): SQL[] {
  return [
    filters.category
      ? sql`EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                    WHERE pc.place_id = p.id AND c.slug = ${filters.category})`
      : null,
    filters.withPhone ? sql`(p.phone IS NOT NULL AND p.phone <> '')` : null,
    filters.withWebsite ? liveWebsiteSql : null,
    filters.withSocial ? sql`(p.social_url IS NOT NULL)` : null,
    // Not missing, and not "… sin nombre" (any case or accents).
    filters.named
      ? sql`(p.name IS NOT NULL AND lower(f_unaccent(p.name)) NOT LIKE '%sin nombre%')`
      : null,
  ].filter((condition) => condition !== null);
}

type PlaceRow = {
  id: number;
  name: string | null;
  chain: string | null;
  categories: { slug: CategorySlug; name: string }[];
  address: string;
  city: string;
  state: string;
  phone: string | null;
  website: string | null;
  social_url: string | null;
  lat: number;
  lng: number;
  distance_km: string | null;
  open24h: boolean | null;
  open24h_source: 'name' | 'owner' | null;
  source: ValueSource;
  phone_source: ValueSource | null;
  website_source: ValueSource | null;
  source_updated_on: string | null;
  registered_on: string | null;
};

/**
 * Place columns where the places table is aliased `p` and vet_details `v`, with category names in
 * `locale` and the distance from `point` when given.
 */
function placeColumnsSql(locale: Locale, point?: Point) {
  // Dead websites (pnpm places:check-websites) aren't shown unless the owner verified them.
  const deadWebsite = sql`p.website_status = 'dead' AND p.owner_verified_at IS NULL`;
  return sql`p.id, p.name, p.chain, p.address, p.city, p.state, p.phone,
    CASE WHEN ${deadWebsite} THEN NULL ELSE p.website END AS website,
    CASE WHEN ${deadWebsite} THEN NULL ELSE p.website_source END AS website_source,
    p.social_url, p.source, p.phone_source, p.source_updated_on::text, p.registered_on::text,
    ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
    ${point ? sql`round((ST_Distance(p.location, ${pointSql(point)}) / 1000)::numeric, 1)` : sql`NULL`} AS distance_km,
    v.open24h, v.open24h_source,
    (SELECT coalesce(json_agg(json_build_object('slug', c.slug, 'name', coalesce(t.name, d.name))
                              ORDER BY c.sort_order), '[]')
     FROM place_categories pc
     JOIN categories c ON c.id = pc.category_id
     LEFT JOIN category_translations t ON t.category_id = c.id AND t.locale = ${locale}
     LEFT JOIN category_translations d ON d.category_id = c.id AND d.locale = ${DEFAULT_LOCALE}
     WHERE pc.place_id = p.id) AS categories`;
}

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    chain: row.chain,
    categories: row.categories,
    address: row.address,
    city: row.city,
    state: row.state,
    phone: row.phone,
    website: row.website,
    socialUrl: row.social_url,
    location: { lat: row.lat, lng: row.lng },
    distanceKm: row.distance_km === null ? null : Number(row.distance_km),
    open24h:
      row.open24h === null || row.open24h_source === null
        ? null
        : { value: row.open24h, source: row.open24h_source },
    source: row.source,
    phoneSource: row.phone_source,
    websiteSource: row.website_source,
    sourceUpdatedOn: row.source_updated_on,
    registeredOn: row.registered_on,
  };
}

/**
 * Visible places within the radius, nearest first, optionally in one category, with the user's
 * filters. With `q`, every word must appear in the name, city or state (or nearly: a typo); if
 * nothing matches, names close to the whole text are tried, which catches a typo in a short word
 * ("huelitas" → Huellitas) but would add noise to every search.
 */
export async function listPlaces(
  db: Database,
  query: PlaceListQuery,
  locale: Locale,
): Promise<PlaceListResponse> {
  const point = { lat: query.lat, lng: query.lng };
  const conditions = [
    visibleSql,
    withinRadiusSql(point, query.radiusKm),
    ...filterConditions(query),
  ];
  if (!query.q) return pageOfPlaces(db, query, locale, conditions);

  const searchText = sql`place_search_text(p.name, p.city, p.state)`;
  const allWords = sql.join(
    searchWords(query.q).map((word) => {
      const text = sql`lower(f_unaccent(${word}))`;
      return sql`(${searchText} LIKE '%' || ${escapeLike(text)} || '%' ESCAPE '!' OR ${text} <% ${searchText})`;
    }),
    sql` AND `,
  );
  const found = await pageOfPlaces(db, query, locale, [...conditions, sql`(${allWords})`]);
  if (found.total > 0) return found;

  const phrase = sql`lower(f_unaccent(${query.q}))`;
  const nameText = sql`lower(f_unaccent(coalesce(p.name, '')))`;
  return pageOfPlaces(db, query, locale, [...conditions, sql`${phrase} <% ${nameText}`]);
}

async function pageOfPlaces(
  db: Database,
  query: Pick<PlaceListQuery, 'lat' | 'lng' | 'page' | 'pageSize'>,
  locale: Locale,
  conditions: SQL[],
): Promise<PlaceListResponse> {
  const where = sql.join(conditions, sql` AND `);
  const rows = await db.execute<PlaceRow & { total: number }>(sql`
    SELECT ${placeColumnsSql(locale, query)}, count(*) OVER()::int AS total
    FROM places p
    LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${where}
    ORDER BY distance_km, p.id
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);

  // A page past the end has no rows to carry the count.
  const total = rows[0]?.total ?? (await countPlaces(db, conditions));
  return { items: rows.map(toPlace), total, page: query.page, pageSize: query.pageSize };
}

async function countPlaces(db: Database, conditions: SQL[]): Promise<number> {
  const [row] = await db.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM places p WHERE ${sql.join(conditions, sql` AND `)}`,
  );
  return row?.total ?? 0;
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Words any place here could be described with, or that join words ("veterinaria en Toluca"). */
const OPTIONAL_WORDS = new Set([
  'veterinaria',
  'veterinarias',
  'tienda',
  'tiendas',
  'mascotas',
  'en',
  'de',
  'del',
  'la',
  'el',
  'y',
]);

/**
 * Up to 6 words that must each match ("Veterinaria Huellitas en Coyoacán" → ["Huellitas",
 * "Coyoacán"]). Optional words are dropped unless the search has nothing else.
 */
export function searchWords(q: string): string[] {
  const words = q.split(/[\s,.;]+/).filter(Boolean);
  const required = words.filter((word) => !OPTIONAL_WORDS.has(plain(word)));
  return (required.length > 0 ? required : words).slice(0, 6);
}

/** Treats % and _ typed by a user as plain characters in LIKE. */
function escapeLike(text: SQL) {
  return sql`replace(replace(replace(${text}, '!', '!!'), '%', '!%'), '_', '!_')`;
}

export async function getPlace(db: Database, id: number, locale: Locale): Promise<Place | null> {
  const [row] = await db.execute<PlaceRow>(sql`
    SELECT ${placeColumnsSql(locale)}
    FROM places p LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE p.id = ${id} AND ${visibleSql}`);
  return row ? toPlace(row) : null;
}

/** Clusters across the visible width; the grid is anchored at 0,0 so cells don't shift on pan. */
const GRID_COLUMNS = 6;

/**
 * The map: up to `limit` places one by one, or, with more in view, a grid of clusters (count,
 * average position, and the box around their places) covering every place in the box. Only
 * places within radiusKm of lat/lng count (the circle on the map).
 */
export async function placesForMap(
  db: Database,
  query: PlaceMapQuery,
  locale: Locale,
): Promise<PlaceMapResponse> {
  const { minLng, minLat, maxLng, maxLat } = query.bbox;
  const point = { lat: query.lat, lng: query.lng };
  const inBox = sql`p.location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography`;
  const inRadius = [visibleSql, withinRadiusSql(point, query.radiusKm), ...filterConditions(query)];

  const [places, radiusTotal] = await Promise.all([
    pageOfPlaces(db, { ...point, page: 1, pageSize: query.limit }, locale, [...inRadius, inBox]),
    countPlaces(db, inRadius),
  ]);
  if (places.total <= query.limit) {
    return { kind: 'places', items: places.items, total: places.total, radiusTotal };
  }

  const cell = (maxLng - minLng) / GRID_COLUMNS;
  const rows = await db.execute<{
    count: number;
    lat: number;
    lng: number;
    min_lng: number;
    min_lat: number;
    max_lng: number;
    max_lat: number;
  }>(sql`
    SELECT count(*)::int AS count,
           avg(ST_Y(p.location::geometry)) AS lat, avg(ST_X(p.location::geometry)) AS lng,
           min(ST_X(p.location::geometry)) AS min_lng, min(ST_Y(p.location::geometry)) AS min_lat,
           max(ST_X(p.location::geometry)) AS max_lng, max(ST_Y(p.location::geometry)) AS max_lat
    FROM places p
    WHERE ${sql.join([...inRadius, inBox], sql` AND `)}
    GROUP BY ST_SnapToGrid(p.location::geometry, ${cell}::float8, ${cell}::float8)`);
  const clusters: PlaceCluster[] = rows.map((row) => ({
    location: { lat: Number(row.lat), lng: Number(row.lng) },
    count: row.count,
    bounds: [row.min_lng, row.min_lat, row.max_lng, row.max_lat].map(
      Number,
    ) as PlaceCluster['bounds'],
  }));
  return { kind: 'clusters', clusters, total: places.total, radiusTotal };
}

/** Every category with its name in `locale` and its number of visible places. */
export async function listCategories(db: Database, locale: Locale): Promise<Category[]> {
  const rows = await db.execute<{
    slug: Category['slug'];
    group: Category['group'];
    name: string;
    place_count: number;
  }>(sql`
    SELECT c.slug, c."group", coalesce(t.name, d.name) AS name,
           (SELECT count(*)::int FROM place_categories pc JOIN places p ON p.id = pc.place_id
            WHERE pc.category_id = c.id AND ${visibleSql}) AS place_count
    FROM categories c
    LEFT JOIN category_translations t ON t.category_id = c.id AND t.locale = ${locale}
    LEFT JOIN category_translations d ON d.category_id = c.id AND d.locale = ${DEFAULT_LOCALE}
    ORDER BY c.sort_order`);
  return rows.map((r) => ({
    slug: r.slug,
    group: r.group,
    name: r.name,
    placeCount: r.place_count,
  }));
}
