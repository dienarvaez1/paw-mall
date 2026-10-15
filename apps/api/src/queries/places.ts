import {
  AREA_NAME_RADIUS_KM,
  CITY_BUSY_MATCHES,
  type Category,
  type CategorySlug,
  DEFAULT_LOCALE,
  DOG_SIZES,
  type PetPolicy,
  POLICY_ANSWER_WINDOW_DAYS,
  type Locale,
  type Place,
  type PlaceCluster,
  type PlaceFilters,
  type PlaceListQuery,
  type PlaceListResponse,
  MAX_RADIUS_KM,
  type PlaceMapQuery,
  type PlaceHours,
  type PlaceMapResponse,
  type UrgentQuery,
  URGENT_LIMIT,
  type UrgentResponse,
  type ValueSource,
  type Verification,
  WEBSITE_VERIFIED_DAYS,
  categoryGroup,
  detectCategory,
  SEARCH_ALIASES,
} from '@paw-mall/shared';
import { type SQL, sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import { resolveArea, resolveAreaInText, splitAreaSearch } from './areas';

type Point = { lat: number; lng: number };

function pointSql({ lat, lng }: Point) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

function withinRadiusSql(point: Point, radiusKm: number) {
  return sql`ST_DWithin(p.location, ${pointSql(point)}, ${radiusKm * 1000})`;
}

/**
 * Nearest first, ties by id. Read from the location index in that order, so a page stops after
 * its places instead of sorting every place in the radius (pnpm load: 370 ms → 25 ms for 25 km
 * around Mexico City).
 */
function nearestFirstSql(point: Point) {
  return sql`p.location <-> ${pointSql(point)}, p.id`;
}

/** Places (aliased `p`) not hidden by shopper reports or confirmed closed. */
const visibleSql = sql`p.hidden_at IS NULL`;

/** A website that isn't known dead, or that the owner verified. */
const liveWebsiteSql = sql`(p.website IS NOT NULL AND
  (p.website_status IS DISTINCT FROM 'dead' OR p.owner_verified_at IS NOT NULL))`;

/** Open now by confirmed hours: true, false or NULL (unknown). Places `p`, vet_details `v`. */
const openNowSql = sql`place_open_now(p.hours, v.open24h, v.open24h_source, now())`;

/**
 * Places whose pet policy takes pets and isn't under review; with the pet profile, only those
 * taking that species, and dogs of that size or larger.
 */
function petFriendlySql(filters: PlaceFilters): SQL {
  const sizes = filters.dogSize ? DOG_SIZES.slice(DOG_SIZES.indexOf(filters.dogSize)) : null;
  const takes =
    filters.petSpecies === 'cat'
      ? sql`pp.cats IS TRUE`
      : filters.petSpecies === 'dog'
        ? sizes
          ? sql`pp.dogs IS TRUE AND pp.max_dog_size IN (${sql.join(
              sizes.map((size) => sql`${size}`),
              sql`, `,
            )})`
          : sql`pp.dogs IS TRUE`
        : sql`(pp.dogs OR pp.cats OR pp.other_pets) IS TRUE`;
  return sql`EXISTS (SELECT 1 FROM pet_policies pp
                     WHERE pp.place_id = p.id AND pp.review_since IS NULL AND ${takes})`;
}

/** The conditions for a category and the user's Settings filters (places aliased `p`). */
function filterConditions(filters: PlaceFilters): SQL[] {
  const petBusinesses =
    filters.group === 'pet_business' ||
    (filters.category !== undefined && categoryGroup(filters.category) === 'pet_business');
  return [
    // Lets Postgres use the pet businesses' own location index (migration 0013).
    petBusinesses ? sql`p.pet_business` : null,
    filters.category
      ? sql`EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                    WHERE pc.place_id = p.id AND c.slug = ${filters.category})`
      : null,
    filters.group && filters.group !== 'pet_business'
      ? sql`EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                    WHERE pc.place_id = p.id AND c."group" = ${filters.group})`
      : null,
    filters.withPhone ? sql`(p.phone IS NOT NULL AND p.phone <> '')` : null,
    filters.withWebsite ? liveWebsiteSql : null,
    filters.withSocial ? sql`(p.social_url IS NOT NULL)` : null,
    // Not missing, and not "… sin nombre" (any case or accents).
    filters.named
      ? sql`(p.name IS NOT NULL AND lower(f_unaccent(p.name)) NOT LIKE '%sin nombre%')`
      : null,
    filters.openNow ? sql`${openNowSql} IS TRUE` : null,
    filters.petFriendly
      ? filters.withUnconfirmed
        ? sql`(${petFriendlySql(filters)}
             OR NOT EXISTS (SELECT 1 FROM pet_policies pp WHERE pp.place_id = p.id))`
        : petFriendlySql(filters)
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
  hours: PlaceHours | null;
  hours_source: Place['hoursSource'];
  open_now: boolean | null;
  source: ValueSource;
  phone_source: ValueSource | null;
  website_source: ValueSource | null;
  source_updated_on: string | null;
  registered_on: string | null;
  owner_verified_on: string | null;
  pet_policy: PetPolicy | null;
  verification: Verification;
};

/** A place's pet policy as JSON in the API's shape, with recent shopper answers counted. */
const petPolicySql = sql`(SELECT json_build_object(
    'dogs', pp.dogs, 'cats', pp.cats, 'otherPets', pp.other_pets,
    'maxDogSize', pp.max_dog_size, 'maxWeightKg', pp.max_weight_kg, 'maxPets', pp.max_pets,
    'fee', pp.fee, 'areas', pp.areas, 'rules', pp.rules,
    'source', pp.source, 'sourceName', pp.source_name, 'sourceUrl', pp.source_url,
    'lastConfirmedOn', pp.last_confirmed_on::text,
    'confirmations', (SELECT count(*) FROM policy_answers a WHERE a.place_id = p.id
      AND a.answer = 'confirm'
      AND a.created_at > now() - make_interval(days => ${POLICY_ANSWER_WINDOW_DAYS}))::int,
    'disputes', (SELECT count(*) FROM policy_answers a WHERE a.place_id = p.id
      AND a.answer = 'dispute'
      AND a.created_at > now() - make_interval(days => ${POLICY_ANSWER_WINDOW_DAYS}))::int,
    'underReview', pp.review_since IS NOT NULL)
  FROM pet_policies pp WHERE pp.place_id = p.id)`;

/**
 * How far the place's details are confirmed, as VERIFICATION_STATUSES describes: the first rule
 * that applies wins.
 */
const verificationSql = sql`(SELECT json_build_object('status', k.status, 'checkedOn', c.checked_on)
  FROM (SELECT CASE
      WHEN EXISTS (SELECT 1 FROM place_reports r WHERE r.place_id = p.id)
        OR EXISTS (SELECT 1 FROM pet_policies pp WHERE pp.place_id = p.id
                   AND pp.review_since IS NOT NULL) THEN 'needs_review'
      WHEN p.owner_verified_at IS NOT NULL THEN 'owner_verified'
      WHEN EXISTS (SELECT 1 FROM pet_policies pp WHERE pp.place_id = p.id
                   AND pp.source = 'community') THEN 'community_confirmed'
      WHEN p.website_status = 'ok'
        AND p.website_checked_at > now() - make_interval(days => ${WEBSITE_VERIFIED_DAYS})
        THEN 'website_verified'
      ELSE 'listed' END AS status) k,
  LATERAL (SELECT CASE k.status
      WHEN 'needs_review' THEN NULL
      WHEN 'owner_verified' THEN (p.owner_verified_at AT TIME ZONE 'America/Mexico_City')::date::text
      WHEN 'community_confirmed' THEN (SELECT pp.last_confirmed_on::text FROM pet_policies pp
                                       WHERE pp.place_id = p.id)
      WHEN 'website_verified' THEN (p.website_checked_at AT TIME ZONE 'America/Mexico_City')::date::text
      ELSE p.source_updated_on::text END AS checked_on) c)`;

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
    (p.owner_verified_at AT TIME ZONE 'America/Mexico_City')::date::text AS owner_verified_on,
    ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
    ${point ? sql`round((ST_Distance(p.location, ${pointSql(point)}) / 1000)::numeric, 1)` : sql`NULL`} AS distance_km,
    v.open24h, v.open24h_source, p.hours, p.hours_source, ${openNowSql} AS open_now,
    ${petPolicySql} AS pet_policy, ${verificationSql} AS verification,
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
    hours: row.hours,
    hoursSource: row.hours ? row.hours_source : null,
    openNow: row.open_now,
    source: row.source,
    phoneSource: row.phone_source,
    websiteSource: row.website_source,
    sourceUpdatedOn: row.source_updated_on,
    registeredOn: row.registered_on,
    ownerVerifiedOn: row.owner_verified_on,
    petPolicy: row.pet_policy,
    verification: row.verification,
  };
}

/**
 * Visible places within the radius, nearest first, optionally in one category, with the user's
 * filters. When `q` names an area ("Zócalo", "Roma Norte", "veterinaria en Coyoacán"), the search
 * moves there: places within areaRadiusKm of the area, nearest to it first, the rest of `q` (if
 * any) searched in names. Otherwise `q` searches names, cities and states around the user.
 */
export async function listPlaces(
  db: Database,
  query: PlaceListQuery,
  locale: Locale,
): Promise<PlaceListResponse> {
  const search = await interpretSearch(db, query);
  const result = await searchPlaces(
    db,
    {
      ...query,
      ...search.point,
      radiusKm: search.radiusKm,
      q: search.words || undefined,
      category: query.category ?? search.category ?? undefined,
    },
    locale,
    search.namedAfter,
  );
  const nearestMunicipality =
    query.page === 1 && result.total === 0 && !search.area
      ? await nearestMunicipalityName(db, search.point)
      : null;
  return { ...result, area: search.area, searchCategory: search.category, nearestMunicipality };
}

type SearchQuery = PlaceFilters & {
  q?: string;
  namesOnly?: boolean;
  lat: number;
  lng: number;
  radiusKm: number;
  areaRadiusKm: number;
  fixedAreaRadius?: boolean;
  cityRadiusKm: number;
};

/**
 * What a search box text asks for, for the list and the map: a place named in it (unless
 * namesOnly, i.e. "Mi ubicación" on) moves the search there within areaRadiusKm; business
 * keywords ("vet") become a category; the rest is searched in names. "tlaxcala vet" → the
 * veterinarian category within 5 km of Tlaxcala.
 */
async function interpretSearch(db: Database, query: SearchQuery) {
  let point = { lat: query.lat, lng: query.lng };
  let radiusKm = query.radiusKm;
  let area: PlaceListResponse['area'] = null;
  let text = query.q ?? '';
  // The whole search is a place's name ("Tlaxcala"): businesses named after it count too.
  let namedAfter: string | null = null;
  if (text && !query.namesOnly) {
    const found = await findAreaSearch(db, text, point);
    if (found) {
      point = found.area.location;
      radiusKm = query.areaRadiusKm;
      area = { ...found.area, radiusKm };
      if (!found.business) namedAfter = text;
      text = found.business ?? '';
    }
  }
  const detected = detectCategory(text);
  // A keyword names a category only where it fits: not against a chip of another category, nor
  // on the other tab ("vet" on Pet-friendly). There the chip wins and the keyword is dropped when
  // something else is left to search by (a place, other words: "estética Plaza X" with
  // Veterinarias lists the plaza's vets); when the keyword is the whole search it's a word to find
  // in names, so "vet" with Restaurantes isn't every restaurant (owner's bug report, 2026-10-13).
  const fits =
    detected.category !== null &&
    (!query.category || query.category === detected.category) &&
    (!query.group || categoryGroup(detected.category) === query.group);
  const category = fits ? detected.category : null;
  const keywordOnly = detected.category !== null && !fits && !area && detected.words === '';
  const words = keywordOnly ? text : detected.words;
  // A city or town (not a colonia or landmark) with more than CITY_BUSY_MATCHES places: 3 mi
  // around it (owner's rule). Counted over every visible place, not the tab's filters, so
  // Explorar's and Pet-friendly's maps get the same circle (owner's rule: the maps stay in sync).
  if (area && !query.fixedAreaRadius && (area.kind === 'municipality' || area.kind === 'town')) {
    const matches = await countPlaces(db, [
      visibleSql,
      searchCircleSql(point, query.cityRadiusKm, namedAfter),
    ]);
    if (matches > CITY_BUSY_MATCHES) {
      radiusKm = query.cityRadiusKm;
      area = { ...area, radiusKm };
    }
  }
  return { point, radiusKm, area, category, words, namedAfter };
}

/**
 * The search circle (places aliased `p`). When the search was just a place's name, it also takes
 * businesses with every word of that name in their own name, up to AREA_NAME_RADIUS_KM away
 * ("Tlaxcala": Tlaxcala's places, plus "Veterinaria Tlaxcala" 20 miles out).
 */
function searchCircleSql(point: Point, radiusKm: number, namedAfter: string | null): SQL {
  if (!namedAfter) return withinRadiusSql(point, radiusKm);
  const name = sql`lower(f_unaccent(coalesce(p.name, '')))`;
  const named = sql.join(
    searchWords(namedAfter).map((word) => {
      const text = sql`lower(f_unaccent(${word}))`;
      return sql`(${name} LIKE '%' || ${escapeLike(text)} || '%' ESCAPE '!')`;
    }),
    sql` AND `,
  );
  return sql`(${withinRadiusSql(point, radiusKm)}
    OR (${withinRadiusSql(point, Math.max(radiusKm, AREA_NAME_RADIUS_KM))} AND ${named}))`;
}

/**
 * Every word of `q` in the name, city or state of places aliased `p`, letter for letter, ignoring
 * only case and accents (owner's rule): "tlaxcala" never matches "Ixtacala".
 */
function allWordsSql(q: string): SQL {
  const searchText = sql`place_search_text(p.name, p.city, p.state)`;
  const words = sql.join(
    searchWords(q).map((word) => {
      const text = sql`lower(f_unaccent(${word}))`;
      return sql`(${searchText} LIKE '%' || ${escapeLike(text)} || '%' ESCAPE '!')`;
    }),
    sql` AND `,
  );
  return sql`(${words})`;
}

/**
 * The area a search names and the business words around it: the whole text ("Zócalo"), "X en Y"
 * or "X cerca de Y", or a place name anywhere ("tlaxcala vet", "veterinario tlaxcala"). A place
 * inside a longer search must match exactly, so ordinary business names stay name searches
 * unless they contain a real place.
 */
async function findAreaSearch(db: Database, q: string, near: { lat: number; lng: number }) {
  const { business, area: areaText } = splitAreaSearch(q);
  if (business) {
    const area = await resolveArea(db, areaText, near);
    if (area) return { area, business };
  }
  // The whole text as a place, then a place inside it ("tlaxcala vet"); names match exactly.
  const whole = await resolveArea(db, q, near);
  if (whole) return { area: whole, business: null };
  const inside = await resolveAreaInText(db, q, near);
  return inside ? { area: inside.area, business: inside.rest || null } : null;
}

/**
 * Places within the radius of lat/lng; with `q`, every word (but the vague ones) must appear in
 * the name, city or state, letter for letter (case and accents aside).
 */
async function searchPlaces(
  db: Database,
  query: PlaceListQuery,
  locale: Locale,
  namedAfter: string | null = null,
): Promise<Omit<PlaceListResponse, 'area' | 'searchCategory' | 'nearestMunicipality'>> {
  const point = { lat: query.lat, lng: query.lng };
  // Every word must match, letter for letter; no looser fallback (owner's rules).
  const base = [visibleSql, ...filterConditions(query), ...(query.q ? [allWordsSql(query.q)] : [])];
  const circle = searchCircleSql(point, query.radiusKm, namedAfter);
  const conditions = [...base, circle];
  const items = await pageOfPlaces(db, query, locale, conditions);
  const { page, pageSize } = query;
  if (page !== 1) {
    const total = await countPlaces(db, conditions);
    return { items, total, page, pageSize, farthestKm: null, nearestBeyondKm: null };
  }
  // circleStats counts the same places (base inside the circle).
  const { total, farthestKm, nearestBeyondKm } = await circleStats(db, base, circle, point);
  return { items, total, page, pageSize, farthestKm, nearestBeyondKm };
}

/** One page of the places meeting `conditions`, nearest to lat/lng first. */
async function pageOfPlaces(
  db: Database,
  query: Pick<PlaceListQuery, 'lat' | 'lng' | 'page' | 'pageSize'>,
  locale: Locale,
  conditions: SQL[],
): Promise<Place[]> {
  const rows = await db.execute<PlaceRow>(sql`
    SELECT ${placeColumnsSql(locale, query)}
    FROM places p
    LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${nearestFirstSql(query)}
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
  return rows.map(toPlace);
}

async function countPlaces(db: Database, conditions: SQL[]): Promise<number> {
  const [row] = await db.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total FROM places p LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${sql.join(conditions, sql` AND `)}`);
  return row?.total ?? 0;
}

type SearchReach = Pick<PlaceListResponse, 'farthestKm' | 'nearestBeyondKm'>;

/**
 * The places meeting `base` inside `circle`: how many, and how far the farthest is from `point`;
 * with none inside, how far the nearest is within MAX_RADIUS_KM (PlaceListResponse's search
 * reach, km).
 */
async function circleStats(
  db: Database,
  base: SQL[],
  circle: SQL,
  point: Point,
): Promise<{ total: number } & SearchReach> {
  const [row] = await db.execute<{ total: number; farthest_km: number | null }>(sql`
    SELECT count(*)::int AS total,
           max(ST_Distance(p.location, ${pointSql(point)})) / 1000 AS farthest_km
    FROM places p LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${sql.join([...base, circle], sql` AND `)}`);
  const total = row?.total ?? 0;
  if (total > 0) {
    return { total, farthestKm: Number(row?.farthest_km), nearestBeyondKm: null };
  }
  const [nearest] = await db.execute<{ km: number }>(sql`
    SELECT ST_Distance(p.location, ${pointSql(point)}) / 1000 AS km
    FROM places p LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${sql.join([...base, withinRadiusSql(point, MAX_RADIUS_KM)], sql` AND `)}
    ORDER BY p.location <-> ${pointSql(point)}
    LIMIT 1`);
  return { total, farthestKm: null, nearestBeyondKm: nearest ? Number(nearest.km) : null };
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Words too vague to require (owner's rule): every other word of a search must match. Business
 * keywords ("veterinaria", "tienda") never get here; they become a category first.
 */
const IGNORED_WORDS = new Set(['en', 'la', 'el', 'de', 'del', 'los', 'las', 'y', 'para']);

/**
 * Up to 6 words that must each match the name, city or state ("Huellitas de Coyoacán" →
 * ["Huellitas", "Coyoacán"], "vet CDMX" → ["vet", "ciudad de mexico"]). The ignored words are
 * only searched when there's nothing else.
 */
export function searchWords(q: string): string[] {
  const words = q.split(/[\s,.;]+/).filter(Boolean);
  const required = words.filter((word) => !IGNORED_WORDS.has(plain(word)));
  // "CDMX" and "DF" are how people write the state "Ciudad de México" (SEARCH_ALIASES).
  return (required.length > 0 ? required : words).slice(0, 6).map((word) => {
    const alias = SEARCH_ALIASES[plain(word)];
    return alias ? alias.join(' ') : word;
  });
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
  // The search box, as in the list: a place moves the circle there, keywords pick a category,
  // and other words must appear in the names.
  const { point, radiusKm, area, category, words, namedAfter } = await interpretSearch(db, query);
  const filters = { ...query, category: query.category ?? category ?? undefined };
  const inBox = sql`p.location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography`;
  const base = [visibleSql, ...filterConditions(filters), ...(words ? [allWordsSql(words)] : [])];
  const circle = searchCircleSql(point, radiusKm, namedAfter);
  const inRadius = [...base, circle];

  // One more than the limit tells whether the box needs clusters.
  const [items, { total: radiusTotal, ...reach }] = await Promise.all([
    pageOfPlaces(db, { ...point, page: 1, pageSize: query.limit + 1 }, locale, [
      ...inRadius,
      inBox,
    ]),
    circleStats(db, base, circle, point),
  ]);
  // The page is nearest first, so its first place names the circle's city; with none in view, the
  // nearest municipality does.
  const nearestCity = items[0]?.city ?? (await nearestMunicipalityName(db, point));
  if (items.length <= query.limit) {
    return {
      kind: 'places',
      area,
      searchCategory: category,
      items,
      total: items.length,
      radiusTotal,
      ...reach,
      nearestCity,
    };
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
    FROM places p LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${sql.join([...inRadius, inBox], sql` AND `)}
    GROUP BY ST_SnapToGrid(p.location::geometry, ${cell}::float8, ${cell}::float8)`);
  const clusters: PlaceCluster[] = rows.map((row) => ({
    location: { lat: Number(row.lat), lng: Number(row.lng) },
    count: row.count,
    bounds: [row.min_lng, row.min_lat, row.max_lng, row.max_lat].map(
      Number,
    ) as PlaceCluster['bounds'],
  }));
  return {
    kind: 'clusters',
    area,
    searchCategory: category,
    clusters,
    // The clusters cover every place in the box.
    total: clusters.reduce((sum, cluster) => sum + cluster.count, 0),
    radiusTotal,
    ...reach,
    nearestCity,
  };
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

/**
 * Urgencias: the nearest vet hospitals and 24-hour vets (confirmed or hinted by name), closest
 * to farthest (owner's rule); each card tells whether it's open.
 */
export async function urgentPlaces(
  db: Database,
  query: UrgentQuery,
  locale: Locale,
): Promise<UrgentResponse> {
  // The search box naming an area ("Xochimilco", "vet en Xochimilco"): the radius goes around it.
  const found = query.q ? await findAreaSearch(db, query.q, query) : null;
  const point = found ? found.area.location : { lat: query.lat, lng: query.lng };
  const area = found ? { ...found.area, radiusKm: query.radiusKm } : null;
  const rows = await db.execute<PlaceRow & { total: number }>(sql`
    SELECT ${placeColumnsSql(locale, point)}, count(*) OVER ()::int AS total
    FROM places p
    LEFT JOIN vet_details v ON v.place_id = p.id
    WHERE ${sql.join([visibleSql, withinRadiusSql(point, query.radiusKm), ...filterConditions(query)], sql` AND `)}
      -- The few hundred candidates first, rather than every pet business by distance.
      AND p.id IN (
        SELECT place_id FROM vet_details WHERE open24h IS TRUE OR accepts_emergencies IS TRUE
        UNION
        SELECT pc.place_id FROM place_categories pc JOIN categories c ON c.id = pc.category_id
        WHERE c.slug = 'vet_hospital')
    ORDER BY ${nearestFirstSql(point)}
    LIMIT ${URGENT_LIMIT}`);
  // None in the circle and no searched area: the nearest municipality names where the app looked
  // ("No hospitals within 5 km of Chiautempan"), as no place's city can.
  const nearestMunicipality =
    rows.length === 0 && !found ? await nearestMunicipalityName(db, point) : null;
  return { area, items: rows.map(toPlace), total: rows[0]?.total ?? 0, nearestMunicipality };
}

/** The municipality whose center is nearest `point`, to name a circle with no place in it. */
async function nearestMunicipalityName(db: Database, point: Point): Promise<string | null> {
  const [near] = await db.execute<{ name: string }>(sql`
    SELECT name FROM search_areas WHERE kind = 'municipality'
    ORDER BY location <-> ${pointSql(point)} LIMIT 1`);
  return near?.name ?? null;
}
