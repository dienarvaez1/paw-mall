import { type SearchArea, detectCategory } from '@paw-mall/shared';
import { sql } from 'drizzle-orm';

import type { Database } from '../db/client';

type Point = { lat: number; lng: number };

/** "veterinaria en coyoacán" -> business "veterinaria", area "coyoacán"; also "cerca de". */
export function splitAreaSearch(q: string): { business: string | null; area: string } {
  const match = /^(.*\S)\s+(?:en|cerca de|cerca del|near)\s+(.+)$/i.exec(q.trim());
  return match ? { business: match[1] ?? null, area: match[2] ?? q } : { business: null, area: q };
}

/** The same key the areas builder stores (packages/importers/src/areas/build.ts). */
export function nameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .replace(
      /^(colonia|col|barrio|bo|fraccionamiento|fracc|pueblo|unidad habitacional|u hab|ampliacion|amp)\s+/,
      '',
    )
    .trim();
}

/**
 * How close a misspelled area name must be (trigram similarity) to count: one-letter typos
 * ("zocallo", 0.67) pass; everyday pet words stay business searches ("animalia" vs the colonia
 * "Animal" is 0.60).
 */
const MIN_SIMILARITY = 0.65;

/**
 * The area a search names, if any: a landmark first, then a municipality, a town, a colonia.
 * Names shared by several areas ("Centro") resolve to the one nearest the user. A whole search
 * must name an area exactly or nearly; "X en Y" lets Y be a bit looser.
 */
export async function resolveArea(
  db: Database,
  text: string,
  near: Point,
  minSimilarity = MIN_SIMILARITY,
): Promise<Omit<SearchArea, 'radiusKm'> | null> {
  const key = nameKey(text);
  if (key.length < 3) return null;
  const [row] = await db.execute<{
    name: string;
    kind: SearchArea['kind'];
    municipality: string | null;
    state: string;
    lat: number;
    lng: number;
  }>(sql`
    SELECT name, kind, municipality, state,
           ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM search_areas
    WHERE name_key = ${key}
       OR (name_key % ${key} AND similarity(name_key, ${key}) >= ${minSimilarity})
    ORDER BY name_key = ${key} DESC,
             similarity(name_key, ${key}) DESC,
             CASE kind WHEN 'landmark' THEN 0 WHEN 'municipality' THEN 1 WHEN 'town' THEN 2 ELSE 3 END,
             ST_Distance(location, ST_SetSRID(ST_MakePoint(${near.lng}, ${near.lat}), 4326)::geography),
             business_count DESC
    LIMIT 1`);
  return row
    ? {
        name: row.name,
        kind: row.kind,
        municipality: row.municipality,
        state: row.state,
        location: { lat: row.lat, lng: row.lng },
      }
    : null;
}

/** Most words a place name inside a search can have ("san juan del rio"). */
const MAX_AREA_WORDS = 4;
const FILLER = new Set(['en', 'de', 'del', 'la', 'el', 'los', 'las', 'cerca', 'near', 'in', 'the']);

/**
 * A place named anywhere in a search, exactly, and the words around it: "tlaxcala vet" and
 * "vet tlaxcala" both find Tlaxcala and leave "vet". The longest name wins ("san juan del rio"
 * over "san juan"); business keywords ("vet", "hospital") and fillers are never taken for places.
 */
export async function resolveAreaInText(
  db: Database,
  text: string,
  near: Point,
): Promise<{ area: Omit<SearchArea, 'radiusKm'>; rest: string } | null> {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const spans: { key: string; start: number; length: number }[] = [];
  for (let length = Math.min(MAX_AREA_WORDS, words.length - 1); length >= 1; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const span = words.slice(start, start + length);
      const key = nameKey(span.join(' '));
      const first = nameKey(span[0] ?? '');
      const last = nameKey(span[span.length - 1] ?? '');
      const keyword = detectCategory(span.join(' '));
      if (key.length < 3 || FILLER.has(first) || FILLER.has(last)) continue;
      if (keyword.category && !keyword.words) continue;
      spans.push({ key, start, length });
    }
  }
  if (spans.length === 0) return null;

  // The best area for each candidate name: a landmark first, then the nearest. (An IN list, not
  // an array parameter: with fetch_types off, postgres.js can't send text arrays.)
  const rows = await db.execute<{
    name_key: string;
    name: string;
    kind: SearchArea['kind'];
    municipality: string | null;
    state: string;
    lat: number;
    lng: number;
  }>(sql`
    SELECT DISTINCT ON (name_key) name_key, name, kind, municipality, state,
           ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM search_areas
    WHERE name_key IN (${sql.join(
      spans.map((span) => sql`${span.key}`),
      sql`, `,
    )})
    ORDER BY name_key,
             CASE kind WHEN 'landmark' THEN 0 WHEN 'municipality' THEN 1 WHEN 'town' THEN 2 ELSE 3 END,
             ST_Distance(location, ST_SetSRID(ST_MakePoint(${near.lng}, ${near.lat}), 4326)::geography),
             business_count DESC`);
  const byKey = new Map(rows.map((row) => [row.name_key, row]));
  // spans are longest first, so the first hit is the longest place name.
  const hit = spans.find((span) => byKey.has(span.key));
  const row = hit && byKey.get(hit.key);
  if (!hit || !row) return null;
  const rest = [...words.slice(0, hit.start), ...words.slice(hit.start + hit.length)]
    .filter((word) => !FILLER.has(nameKey(word)))
    .join(' ');
  return {
    area: {
      name: row.name,
      kind: row.kind,
      municipality: row.municipality,
      state: row.state,
      location: { lat: row.lat, lng: row.lng },
    },
    rest,
  };
}
