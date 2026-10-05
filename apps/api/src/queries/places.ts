import {
  type Category,
  type CategorySlug,
  DEFAULT_LOCALE,
  type Locale,
  type Place,
  type PlaceListQuery,
  type ValueSource,
} from '@paw-mall/shared';
import { type SQL, sql } from 'drizzle-orm';

import type { Database } from '../db/client';

type Point = { lat: number; lng: number };

function pointSql({ lat, lng }: Point) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** Places (aliased `p`) not hidden by shopper reports or confirmed closed. */
const visibleSql = sql`p.hidden_at IS NULL`;

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
  total: number;
};

/** Place columns where the places table is aliased `p`, with category names in `locale`. */
function placeColumnsSql(locale: Locale, point: Point) {
  // Dead websites (pnpm places:check-websites) aren't shown unless the owner verified them.
  const deadWebsite = sql`p.website_status = 'dead' AND p.owner_verified_at IS NULL`;
  return sql`p.id, p.name, p.chain, p.address, p.city, p.state, p.phone,
    CASE WHEN ${deadWebsite} THEN NULL ELSE p.website END AS website,
    CASE WHEN ${deadWebsite} THEN NULL ELSE p.website_source END AS website_source,
    p.social_url, p.source, p.phone_source, p.source_updated_on::text,
    ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
    round((ST_Distance(p.location, ${pointSql(point)}) / 1000)::numeric, 1) AS distance_km,
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
  };
}

/** Visible places within the radius, nearest first, optionally in one category. */
export async function listPlaces(db: Database, query: PlaceListQuery) {
  const locale = query.lang ?? DEFAULT_LOCALE;
  const point = { lat: query.lat, lng: query.lng };
  const conditions: SQL[] = [
    visibleSql,
    sql`ST_DWithin(p.location, ${pointSql(point)}, ${query.radiusKm * 1000})`,
  ];
  if (query.category) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
      WHERE pc.place_id = p.id AND c.slug = ${query.category})`);
  }
  const where = sql.join(conditions, sql` AND `);

  const rows = await db.execute<PlaceRow>(sql`
    SELECT ${placeColumnsSql(locale, point)}, count(*) OVER()::int AS total
    FROM places p
    LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${where}
    ORDER BY distance_km, p.id
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);

  let total = rows[0]?.total;
  if (total === undefined) {
    // A page past the end has no rows to carry the count.
    const [row] = await db.execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM places p WHERE ${where}`,
    );
    total = row?.total ?? 0;
  }
  return { items: rows.map(toPlace), total, page: query.page, pageSize: query.pageSize };
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
