import {
  AREA_SUGGESTIONS_MAX,
  type SearchArea,
  detectCategory,
  searchTokens,
} from '@pet-helper/shared';
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
 * The area a search names, if any: a landmark first, then a municipality, a town, a colonia.
 * Names shared by several areas ("Centro") resolve to the one nearest the user. The name must
 * match every letter, ignoring only case and accents (owner's rule): "tlaxcala" is never
 * "Ixtacala", and a typo ("zocallo") names no area.
 */
export async function resolveArea(
  db: Database,
  text: string,
  near: Point,
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
    ORDER BY CASE kind WHEN 'landmark' THEN 0 WHEN 'municipality' THEN 1 WHEN 'town' THEN 2 ELSE 3 END,
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

/** Most typed words a suggestion search looks at. */
const MAX_SUGGEST_TOKENS = 6;

/**
 * The search box text as word patterns for suggestions, order-invariant: each typed word must
 * start a word of the name, in any order ("vallarta puerto", "puerto vall" and "v puerto" all
 * match "puerto vallarta"). The last word is still being typed, so it's a prefix, unless the text
 * ends with a space: then it's a whole word ("puerto " never suggests "Puertollano"). Null when
 * the text is too short to suggest anything. Patterns are POSIX regexes for name_key, which
 * holds only letters, digits and spaces (so nothing typed is a regex character).
 */
export function suggestionPatterns(text: string): string[] | null {
  // The shared search words: stop words ("en", "near"…) don't have to match (search-tokens.ts).
  const tokens = searchTokens(text).slice(0, MAX_SUGGEST_TOKENS);
  if (tokens.join(' ').length < 3) return null;
  const finished = /\s$/.test(text);
  return tokens.map((token, index) => {
    const whole = index < tokens.length - 1 ? false : finished;
    return `(^| )${token}${whole ? '( |$)' : ''}`;
  });
}

/**
 * Place names for the search box's suggestions, matching the typed words in any order
 * (suggestionPatterns). One per name, the one resolveArea would pick (so a tapped suggestion
 * searches exactly that place). The exact name first, then names that start with the text as
 * typed, then cities, towns and landmarks before colonias, then the busiest.
 */
export async function suggestAreas(
  db: Database,
  text: string,
  near: Point,
): Promise<Omit<SearchArea, 'radiusKm'>[]> {
  const patterns = suggestionPatterns(text);
  if (!patterns) return [];
  const key = nameKey(text);
  const asTyped = `${key}%`;
  const rows = await db.execute<{
    name: string;
    kind: SearchArea['kind'];
    municipality: string | null;
    state: string;
    lat: number;
    lng: number;
  }>(sql`
    SELECT name, kind, municipality, state, lat, lng
    FROM (
      -- A landmark is stored under several names ("zocalo", "zocalo cdmx", "plaza de la
      -- constitucion"), all shown as "Zócalo": suggest it once.
      SELECT DISTINCT ON (name, state, coalesce(municipality, ''))
             name, kind, municipality, state, business_count, lat, lng, exact, in_order
      FROM (
        SELECT DISTINCT ON (name_key) name, kind, municipality, state, business_count,
               ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
               name_key = ${key} AS exact, name_key LIKE ${asTyped} AS in_order
        FROM search_areas
        WHERE ${sql.join(
          patterns.map((pattern) => sql`name_key ~ ${pattern}`),
          sql` AND `,
        )}
        ORDER BY name_key,
                 CASE kind WHEN 'landmark' THEN 0 WHEN 'municipality' THEN 1 WHEN 'town' THEN 2 ELSE 3 END,
                 ST_Distance(location, ST_SetSRID(ST_MakePoint(${near.lng}, ${near.lat}), 4326)::geography),
                 business_count DESC
      ) by_key
      ORDER BY name, state, coalesce(municipality, ''), exact DESC, in_order DESC, business_count DESC
    ) best
    ORDER BY exact DESC, in_order DESC, CASE WHEN kind = 'colonia' THEN 1 ELSE 0 END,
             business_count DESC, name
    LIMIT ${AREA_SUGGESTIONS_MAX}`);
  return rows.map((row) => ({
    name: row.name,
    kind: row.kind,
    municipality: row.municipality,
    state: row.state,
    location: { lat: Number(row.lat), lng: Number(row.lng) },
  }));
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
